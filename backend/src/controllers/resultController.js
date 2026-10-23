const db = require("../config/db");
const { createNotification } = require("./notificationController");

// Helper to check if user is Head Teacher or Admin
const isHeadTeacherOrAdmin = async (user) => {
    if (!user) return false;
    const role = (user.role || "").toLowerCase();
    if (role === "admin") return true;
    if (role === "faculty") {
        const res = await db.query(
            "SELECT position FROM faculties WHERE emailid = $1",
            [user.email]
        );
        if (res.rows.length > 0) {
            const pos = String(res.rows[0].position || "").toLowerCase();
            return pos.includes("head") || pos.includes("principal");
        }
    }
    return false;
};

// GET /api/result/status?course=CLASS-6&sem=1
exports.getResultStatus = async (req, res) => {
    try {
        const { course, sem } = req.query;

        if (!course || !sem) {
            return res.status(400).json({ message: "Course and semester/term required" });
        }

        // 1. Get all subjects for this course & sem
        const subjectsResult = await db.query(
            `SELECT subjectcode, subjectname, subjecttype
             FROM subject
             WHERE courcecode = $1 AND semoryear = $2
             ORDER BY subjectcode`,
            [course, sem]
        );
        const subjects = subjectsResult.rows;

        // 2. For each subject, check if marks are entered
        const marksCountResult = await db.query(
            `SELECT subjectcode, COUNT(DISTINCT rollnumber) AS student_count
             FROM marks
             WHERE courcecode = $1 AND semoryear = $2
             GROUP BY subjectcode`,
            [course, sem]
        );

        const marksMap = new Map(
            marksCountResult.rows.map(r => [r.subjectcode, Number(r.student_count)])
        );

        // 3. Count total students in this course
        const studentCountRes = await db.query(
            `SELECT COUNT(*) AS total FROM students WHERE Courcecode = $1 AND semoryear = $2`,
            [course, sem]
        );
        const totalStudents = Number(studentCountRes.rows[0]?.total || 0);

        const subjectStatus = subjects.map(s => {
            const enteredStudents = marksMap.get(s.subjectcode) || 0;
            const isCompleted = totalStudents > 0 && enteredStudents >= totalStudents;
            const hasStarted = enteredStudents > 0;
            return {
                subjectcode: s.subjectcode,
                subjectname: s.subjectname,
                subjecttype: s.subjecttype,
                enteredStudents,
                totalStudents,
                status: isCompleted ? "Completed" : (hasStarted ? "In Progress" : "Pending")
            };
        });

        const totalSubjects = subjects.length;
        const submittedSubjects = subjectStatus.filter(s => s.enteredStudents > 0).length;
        const fullyCompletedSubjects = subjectStatus.filter(s => s.status === "Completed").length;
        const allSubmitted = totalSubjects > 0 && submittedSubjects === totalSubjects;

        // 4. Check if result is declared/published in DB
        const resultRes = await db.query(
            `SELECT isdeclared, declared_by, TO_CHAR(declared_at, 'YYYY-MM-DD HH24:MI') as declared_at
             FROM result
             WHERE courcecode = $1 AND semoryear = $2`,
            [course, sem]
        );

        const isdeclared = resultRes.rows.length > 0 && Number(resultRes.rows[0].isdeclared) === 1;
        const declared_by = resultRes.rows[0]?.declared_by || null;
        const declared_at = resultRes.rows[0]?.declared_at || null;

        const isAuthorizedToPublish = await isHeadTeacherOrAdmin(req.user);

        res.json({
            course,
            sem: Number(sem),
            isdeclared,
            declared_by,
            declared_at,
            totalStudents,
            totalSubjects,
            submittedSubjects,
            fullyCompletedSubjects,
            allSubmitted,
            isAuthorizedToPublish,
            subjects: subjectStatus
        });
    } catch (error) {
        console.error("Error fetching result status:", error);
        res.status(500).json({ message: "Error fetching result status" });
    }
};

// POST /api/result/publish
exports.publishResult = async (req, res) => {
    try {
        const { course, sem } = req.body;

        if (!course || !sem) {
            return res.status(400).json({ message: "Course and semester/term required" });
        }

        const canPublish = await isHeadTeacherOrAdmin(req.user);
        if (!canPublish) {
            return res.status(403).json({
                message: "শুধুমাত্র প্রধান শিক্ষক (Head Teacher) অথবা অ্যাডমিন ফলাফল অনুমোদন ও প্রকাশ করতে পারেন।"
            });
        }

        // Verify that all subjects have marks entered
        const subjectsResult = await db.query(
            `SELECT subjectcode FROM subject WHERE courcecode = $1 AND semoryear = $2`,
            [course, sem]
        );
        const subjects = subjectsResult.rows;

        const marksCountResult = await db.query(
            `SELECT DISTINCT subjectcode FROM marks WHERE courcecode = $1 AND semoryear = $2`,
            [course, sem]
        );
        const enteredSubjects = marksCountResult.rows.map(r => r.subjectcode);

        const missing = subjects.filter(s => !enteredSubjects.includes(s.subjectcode));
        if (missing.length > 0) {
            return res.status(400).json({
                message: `সকল বিষয়ের নম্বর এখনও এন্ট্রি করা হয়নি। ${missing.length}টি বিষয় বাকি রয়েছে।`
            });
        }

        // Get user identity
        let approverLabel = "Admin";
        if (req.user?.role === "faculty") {
            const facRes = await db.query(
                "SELECT facultyname, position FROM faculties WHERE emailid = $1",
                [req.user.email]
            );
            if (facRes.rows.length > 0) {
                approverLabel = `${facRes.rows[0].facultyname} (${facRes.rows[0].position || "Head Teacher"})`;
            }
        }

        // Upsert into result table
        await db.query(
            `INSERT INTO result (courcecode, semoryear, isdeclared, declared_by, declared_at)
             VALUES ($1, $2, 1, $3, NOW())
             ON CONFLICT (courcecode, semoryear)
             DO UPDATE SET isdeclared = 1, declared_by = EXCLUDED.declared_by, declared_at = NOW()`,
            [course, sem, approverLabel]
        );

        // Fetch course name
        const cRes = await db.query("SELECT course_name FROM courses WHERE course_code = $1", [course]);
        const courseName = cRes.rows[0]?.course_name || course;
        const examName = Number(sem) === 1 ? "অর্ধ-বার্ষিক (Half Yearly)" : "বার্ষিক (Final)";

        // Send notifications
        // 1. To Students
        await createNotification({
            userprofile: "student",
            courcecode: course,
            semoryear: sem,
            title: "ফলাফল প্রকাশিত হয়েছে! 🎉",
            message: `সম্মানিত শিক্ষার্থী, ${courseName}-এর ${examName} পরীক্ষার ফলাফল ${approverLabel} কর্তৃক অনুমোদিত ও প্রকাশ করা হয়েছে। আপনার মার্কশিট দেখতে মার্কশিট মেন্যুতে যান।`
        });

        // 2. To Teachers
        await createNotification({
            userprofile: "faculty",
            courcecode: course,
            semoryear: sem,
            title: "ফলাফল অনুমোদন ও প্রকাশ সম্পন্ন",
            message: `${courseName}-এর ${examName} পরীক্ষার ফলাফল ${approverLabel} কর্তৃক চূড়ান্তভাবে অনুমোদন ও প্রকাশ করা হয়েছে। এখন সকল শিক্ষক ও শিক্ষার্থী পূর্ণাঙ্গ নম্বর ও মার্কশিট দেখতে পারবেন।`
        });

        res.json({
            message: "ফলাফল সফলভাবে অনুমোদন ও প্রকাশ করা হয়েছে!",
            isdeclared: true,
            declared_by: approverLabel
        });
    } catch (error) {
        console.error("Error publishing result:", error);
        res.status(500).json({ message: "Failed to publish result" });
    }
};

// POST /api/result/unpublish
exports.unpublishResult = async (req, res) => {
    try {
        const { course, sem } = req.body;

        if (!course || !sem) {
            return res.status(400).json({ message: "Course and semester/term required" });
        }

        const canPublish = await isHeadTeacherOrAdmin(req.user);
        if (!canPublish) {
            return res.status(403).json({
                message: "শুধুমাত্র প্রধান শিক্ষক (Head Teacher) অথবা অ্যাডমিন ফলাফল অপ্রকাশিত/স্থগিত করতে পারেন।"
            });
        }

        await db.query(
            `UPDATE result SET isdeclared = 0 WHERE courcecode = $1 AND semoryear = $2`,
            [course, sem]
        );

        res.json({
            message: "ফলাফল স্থগিত/অপ্রকাশিত করা হয়েছে। শিক্ষার্থী ও অন্য শিক্ষকরা এখন নম্বর দেখতে পাবেন না।",
            isdeclared: false
        });
    } catch (error) {
        console.error("Error unpublishing result:", error);
        res.status(500).json({ message: "Failed to unpublish result" });
    }
};
