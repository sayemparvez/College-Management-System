const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");
const { createNotification } = require("./notificationController");

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

const adminUploadDir = path.resolve(__dirname, "../../uploads/admin");

const getAdminLogo = () => {
    if (!fs.existsSync(adminUploadDir)) return "default.png";

    const files = fs.readdirSync(adminUploadDir);

    const match = files.find(file => {
        const name = path.basename(file, path.extname(file));
        return name === "admin";
    });

    return match || "default.png";
};

// ============================
// Get Students For Marks Entry
// ============================

exports.getStudentsForMarks = async (req, res) => {
    try {

        const { course, sem } = req.query;

        const result = await db.query(
            `SELECT rollnumber, firstname, lastname
             FROM students
             WHERE Courcecode = $1 AND semoryear = $2
             ORDER BY rollnumber`,
            [course, sem]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching students" });
    }
};


// ============================
// Save Marks
// ============================

exports.saveMarks = async (req, res) => {

    try {

        const { course, sem, subject, subjectname, marks } = req.body;

        for (let i = 0; i < marks.length; i++) {
            const { rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks } = marks[i];
            const finalCq = Number(cq_marks) || 0;
            const finalMcq = Number(mcq_marks) || 0;
            const finalPractical = Number(practicalmarks) || 0;
            const finalTheory = (cq_marks !== undefined || mcq_marks !== undefined) 
                ? (finalCq + finalMcq) 
                : (Number(theorymarks) || 0);

            await db.query(
                `INSERT INTO marks
                 (courcecode, semoryear, subjectcode, subjectname, rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (courcecode, semoryear, subjectcode, rollnumber)
                 DO UPDATE SET
                    theorymarks = EXCLUDED.theorymarks,
                    practicalmarks = EXCLUDED.practicalmarks,
                    cq_marks = EXCLUDED.cq_marks,
                    mcq_marks = EXCLUDED.mcq_marks,
                    subjectname = EXCLUDED.subjectname`,
                [
                    course,
                    sem,
                    subject,
                    subjectname || null,
                    rollnumber,
                    finalTheory,
                    finalPractical,
                    finalCq,
                    finalMcq
                ]
            );
        }

                // Notify Admin & Head Teacher
        let teacherName = req.user?.email || "শিক্ষক";
        if (req.user?.role === "faculty") {
            const fRes = await db.query("SELECT facultyname FROM faculties WHERE emailid = $1", [req.user.email]);
            if (fRes.rows.length > 0 && fRes.rows[0].facultyname) {
                teacherName = fRes.rows[0].facultyname;
            }
        }
        await createNotification({
            userprofile: "admin",
            courcecode: course,
            semoryear: sem,
            title: "নম্বর এন্ট্রি জমা হয়েছে",
            message: `${teacherName} কর্তৃক ${course} শ্রেণির (${subjectname || subject}) বিষয়ে নম্বর এন্ট্রি সম্পন্ন হয়েছে।`
        });

        res.json({ message: "Marks saved successfully" });

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Error saving marks" });

    }

};


// ===== TEMPLATE DOWNLOAD =====

exports.downloadMarksTemplate = async (req, res) => {
    try {
        const { course, sem, subject } = req.query;

        if (!course || !sem || !subject) {
            return res.status(400).json({ message: "course, sem and subject are required" });
        }

        const subjectResult = await db.query(
            `SELECT subjectname, theorymarks, practicalmarks, cq_max_marks, mcq_max_marks
             FROM subject
             WHERE subjectcode = $1 AND courcecode = $2 AND semoryear = $3`,
            [subject, course, sem]
        );

        const subjectRows = subjectResult.rows;

        if (!subjectRows.length) {
            return res.status(404).json({ message: "Subject not found" });
        }

        const subjectInfo = subjectRows[0];

        const studentResult = await db.query(
            `SELECT rollnumber
             FROM students
             WHERE Courcecode = $1 AND semoryear = $2
             LIMIT 1`,
            [course, sem]
        );

        const studentRows = studentResult.rows;

        const demoRoll = studentRows.length ? String(studentRows[0].rollnumber) : "";

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Marks Template");

        const hasCQ = Number(subjectInfo.cq_max_marks || 0) > 0;
        const hasMCQ = Number(subjectInfo.mcq_max_marks || 0) > 0;
        const hasPractical = Number(subjectInfo.practicalmarks || 0) > 0;
        const demoCQ = hasCQ ? Math.min(Number(subjectInfo.cq_max_marks), 40) : 0;
        const demoMCQ = hasMCQ ? Math.min(Number(subjectInfo.mcq_max_marks), 20) : 0;
        const demoTheory = (hasCQ || hasMCQ) ? (demoCQ + demoMCQ) : (Number(subjectInfo.theorymarks || 0) > 0 ? Math.min(Number(subjectInfo.theorymarks), 50) : 0);
        const demoPractical = hasPractical ? Math.min(Number(subjectInfo.practicalmarks), 20) : 0;

        // DB-like structure
        worksheet.columns = [
            { header: "courcecode", key: "courcecode", width: 18 },
            { header: "semoryear", key: "semoryear", width: 15 },
            { header: "subjectcode", key: "subjectcode", width: 18 },
            { header: "subjectname", key: "subjectname", width: 28 },
            { header: "rollnumber", key: "rollnumber", width: 18 },
            { header: "cq_marks", key: "cq_marks", width: 15 },
            { header: "mcq_marks", key: "mcq_marks", width: 15 },
            { header: "theorymarks", key: "theorymarks", width: 18 },
            { header: "practicalmarks", key: "practicalmarks", width: 18 }
        ];

        worksheet.addRow({
            courcecode: course,
            semoryear: sem,
            subjectcode: subject,
            subjectname: subjectInfo.subjectname || "",
            rollnumber: demoRoll,
            cq_marks: demoCQ,
            mcq_marks: demoMCQ,
            theorymarks: demoTheory,
            practicalmarks: demoPractical
        });

        worksheet.getRow(1).font = { bold: true };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            'attachment; filename="Marks_Template.xlsx"'
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Download marks template error:", err);
        res.status(500).json({ message: "Failed to download template" });
    }
};


// ===== IMPORT MARKS =====

exports.importMarks = async (req, res) => {
    try {
        const { course, sem, subject } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Excel file is required" });
        }

        if (!course || !sem || !subject) {
            return res.status(400).json({ message: "course, sem and subject are required" });
        }

        const subjectResult = await db.query(
            `SELECT subjectname, theorymarks, practicalmarks, cq_max_marks, mcq_max_marks
             FROM subject
             WHERE subjectcode = $1 AND courcecode = $2 AND semoryear = $3`,
            [subject, course, sem]
        );

        const subjectRows = subjectResult.rows;

        if (!subjectRows.length) {
            return res.status(404).json({ message: "Subject not found" });
        }

        const subjectInfo = subjectRows[0];
        const maxTheory = Number(subjectInfo.theorymarks || 0);
        const maxPractical = Number(subjectInfo.practicalmarks || 0);

        const studentResult = await db.query(
            `SELECT rollnumber
             FROM students
             WHERE Courcecode = $1 AND semoryear = $2`,
            [course, sem]
        );

        const studentRows = studentResult.rows;

        const validRolls = new Set(
            studentRows.map((s) => String(s.rollnumber).trim())
        );

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows.length) {
            return res.status(400).json({ message: "Excel file is empty" });
        }

        const values = [];
        const errors = [];
        let invalidRows = 0;

        rows.forEach((row, index) => {
            const excelRow = index + 2;

            // Accept DB-like column names from template
            const courcecode = String(row.courcecode || course).trim();
            const semoryear = String(row.semoryear || sem).trim();
            const subjectcode = String(row.subjectcode || subject).trim();
            const subjectname = String(
                row.subjectname || subjectInfo.subjectname || ""
            ).trim();

            const rollnumber = String(row.rollnumber || "").trim();

            const theoryRaw = row.theorymarks;
            const practicalRaw = row.practicalmarks;
            const cqRaw = row.cq_marks;
            const mcqRaw = row.mcq_marks;

            if (!rollnumber) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: "rollnumber is required"
                });

                return;
            }

            if (!validRolls.has(rollnumber)) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: `Student not found for rollnumber ${rollnumber}`
                });

                return;
            }

            if (
                courcecode !== String(course) ||
                semoryear !== String(sem) ||
                subjectcode !== String(subject)
            ) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: "courcecode, semoryear or subjectcode does not match selected subject"
                });

                return;
            }

            let cq_marks = (cqRaw !== "" && cqRaw !== null && cqRaw !== undefined) ? Number(cqRaw) : 0;
            let mcq_marks = (mcqRaw !== "" && mcqRaw !== null && mcqRaw !== undefined) ? Number(mcqRaw) : 0;

            let theorymarks =
                theoryRaw === "" ||
                theoryRaw === null ||
                theoryRaw === undefined
                    ? (cq_marks + mcq_marks)
                    : Number(theoryRaw);

            // If CQ or MCQ provided, always recalculate theory from them
            if ((cqRaw !== "" && cqRaw !== undefined) || (mcqRaw !== "" && mcqRaw !== undefined)) {
                theorymarks = cq_marks + mcq_marks;
            }

            const practicalmarks =
                practicalRaw === "" ||
                practicalRaw === null ||
                practicalRaw === undefined
                    ? 0
                    : Number(practicalRaw);

            if (Number.isNaN(theorymarks) || theorymarks < 0) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: "theorymarks must be a valid number"
                });

                return;
            }

            if (Number.isNaN(practicalmarks) || practicalmarks < 0) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: "practicalmarks must be a valid number"
                });

                return;
            }

            if (theorymarks > maxTheory) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: `theorymarks cannot exceed ${maxTheory}`
                });

                return;
            }

            if (practicalmarks > maxPractical) {
                invalidRows++;

                errors.push({
                    row: excelRow,
                    reason: `practicalmarks cannot exceed ${maxPractical}`
                });

                return;
            }

            values.push([
                courcecode,
                Number(semoryear),
                subjectcode,
                subjectname || null,
                rollnumber,
                theorymarks,
                practicalmarks,
                cq_marks,
                mcq_marks
            ]);
        });

        if (!values.length) {
            return res.status(400).json({
                message: "No valid rows found in file",
                totalRows: rows.length,
                inserted: 0,
                invalidRows,
                errors
            });
        }

        const placeholders = values.map((_, index) => {
            const offset = index * 9;

            return `(
                $${offset + 1},
                $${offset + 2},
                $${offset + 3},
                $${offset + 4},
                $${offset + 5},
                $${offset + 6},
                $${offset + 7},
                $${offset + 8},
                $${offset + 9}
            )`;
        }).join(", ");

        const flattenedValues = values.flat();

        await db.query(
            `INSERT INTO marks
             (courcecode, semoryear, subjectcode, subjectname, rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks)
             VALUES ${placeholders}
                 ON CONFLICT (courcecode, semoryear, subjectcode, rollnumber)
             DO UPDATE SET
                theorymarks = EXCLUDED.theorymarks,
                practicalmarks = EXCLUDED.practicalmarks,
                subjectname = EXCLUDED.subjectname,
                cq_marks = EXCLUDED.cq_marks,
                mcq_marks = EXCLUDED.mcq_marks`,
            flattenedValues
        );

        res.json({
            message: "Marks imported successfully",
            totalRows: rows.length,
            inserted: values.length,
            invalidRows,
            errors
        });

    } catch (err) {
        console.error("Import marks error:", err);
        res.status(500).json({ message: "Import failed" });
    }
};


// ============================
// Get Marks For Editing
// ============================

exports.getMarksForEdit = async (req, res) => {
    try {
        const { course, sem, subject } = req.query;

        // Privacy check: only assigned teacher, Head Teacher, or Admin can view before publication
        const isHeadOrAdmin = await isHeadTeacherOrAdmin(req.user);
        if (!isHeadOrAdmin && req.user?.role === "faculty") {
            const facCheck = await db.query(
                "SELECT subject FROM faculties WHERE emailid = $1",
                [req.user.email]
            );
            const assignedSubject = facCheck.rows[0]?.subject;
            if (assignedSubject !== subject) {
                const resultCheck = await db.query(
                    "SELECT isdeclared FROM result WHERE courcecode = $1 AND semoryear = $2",
                    [course, sem]
                );
                const isPublished = resultCheck.rows.length > 0 && Number(resultCheck.rows[0].isdeclared) === 1;
                if (!isPublished) {
                    return res.status(403).json({
                        message: "গোপনীয়তা নীতি: ফলাফল অনুমোদিত ও প্রকাশিত না হওয়া পর্যন্ত শুধুমাত্র সংশ্লিষ্ট বিষয়ের শিক্ষক, প্রধান শিক্ষক ও অ্যাডমিন এই নম্বর দেখতে পারেন।"
                    });
                }
            }
        }

        const result = await db.query(
            `SELECT
                 s.rollnumber,
                 s.firstname,
                 s.lastname,
                 m.cq_marks,
                 m.mcq_marks,
                 m.theorymarks,
                 m.practicalmarks,
                 sub.cq_max_marks,
                 sub.mcq_max_marks,
                 sub.theorymarks AS theoryfull,
                 sub.practicalmarks AS practicalfull
             FROM students s
             LEFT JOIN marks m
               ON s.rollnumber = m.rollnumber
               AND m.subjectcode = $1
               AND m.courcecode = $2
               AND m.semoryear = $3
             LEFT JOIN subject sub
               ON sub.subjectcode = $1
               AND sub.courcecode = $2
               AND sub.semoryear = $3
             WHERE s.Courcecode = $4
             AND s.semoryear = $5
             ORDER BY s.rollnumber`,
            [subject, course, sem, course, sem]
        );

        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching marks" });
    }
};


// ============================
// Update Marks
// ============================

exports.updateMarks = async (req, res) => {
    try {
        const { course, sem, subject, marks } = req.body;

        const isHeadOrAdmin = await isHeadTeacherOrAdmin(req.user);
        if (!isHeadOrAdmin && req.user?.role === "faculty") {
            const facCheck = await db.query(
                "SELECT subject FROM faculties WHERE emailid = $1",
                [req.user.email]
            );
            const assignedSubject = facCheck.rows[0]?.subject;
            if (assignedSubject !== subject) {
                return res.status(403).json({
                    message: "আপনি শুধুমাত্র আপনার নির্ধারিত বিষয়ের নম্বর পরিবর্তন করতে পারবেন।"
                });
            }
        }

        for (let i = 0; i < marks.length; i++) {
            const { rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks } = marks[i];
            const finalCq = Number(cq_marks) || 0;
            const finalMcq = Number(mcq_marks) || 0;
            const finalPractical = Number(practicalmarks) || 0;
            const finalTheory = (cq_marks !== undefined || mcq_marks !== undefined)
                ? (finalCq + finalMcq)
                : (Number(theorymarks) || 0);

            await db.query(
                `UPDATE marks
                 SET theorymarks = $1, practicalmarks = $2, cq_marks = $3, mcq_marks = $4
                 WHERE rollnumber = $5
                   AND subjectcode = $6
                   AND courcecode = $7
                   AND semoryear = $8`,
                [
                    finalTheory,
                    finalPractical,
                    finalCq,
                    finalMcq,
                    rollnumber,
                    subject,
                    course,
                    sem
                ]
            );
        }

        res.json({ message: "Marks updated successfully" });

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Error updating marks" });

    }

};


// ============================
// Marks Report
// ============================

exports.getMarksReport = async (req, res) => {

    try {

        const { course, sem } = req.query;

        const isHeadOrAdmin = await isHeadTeacherOrAdmin(req.user);
        if (!isHeadOrAdmin) {
            const resultCheck = await db.query(
                "SELECT isdeclared FROM result WHERE courcecode = $1 AND semoryear = $2",
                [course, sem]
            );
            const isPublished = resultCheck.rows.length > 0 && Number(resultCheck.rows[0].isdeclared) === 1;
            if (!isPublished) {
                return res.status(403).json({
                    message: "ফলাফল এখনও প্রধান শিক্ষক বা অ্যাডমিন কর্তৃক অনুমোদন ও প্রকাশ করা হয়নি।",
                    isPublished: false
                });
            }
        }

        const result = await db.query(
            `SELECT
                 m.rollnumber,
                 CONCAT(s.firstname, ' ', s.lastname) AS name,
                 m.subjectcode,
                 m.theorymarks,
                 m.practicalmarks
             FROM marks m
             JOIN students s
             ON m.rollnumber = s.rollnumber
             WHERE m.courcecode = $1
             AND m.semoryear = $2
             ORDER BY m.rollnumber`,
            [course, sem]
        );

        res.json(result.rows);

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Error fetching report" });

    }

};


// ============================
// Delete Marks (Single Student)
// ============================

exports.deleteMarks = async (req, res) => {

    try {

        const { course, sem, subject, rollnumber } = req.body;

        await db.query(
            `DELETE FROM marks
             WHERE courcecode = $1
               AND semoryear = $2
               AND subjectcode = $3
               AND rollnumber = $4`,
            [course, sem, subject, rollnumber]
        );

        res.json({ message: "Marks deleted successfully" });

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Delete failed" });

    }

};


// ============================
// Delete All Marks For Subject
// ============================

exports.deleteSubjectMarks = async (req, res) => {

    try {

        const { course, sem, subject } = req.body;

        await db.query(
            `DELETE FROM marks
             WHERE courcecode = $1
               AND semoryear = $2
               AND subjectcode = $3`,
            [course, sem, subject]
        );

        res.json({ message: "All marks deleted for this subject" });

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Delete failed" });

    }

};


// ============================
// Subject Wise Marks Report
// ============================

exports.getSubjectReport = async (req, res) => {

    try {

        const { course, sem, subject } = req.query;

        const isHeadOrAdmin = await isHeadTeacherOrAdmin(req.user);
        if (!isHeadOrAdmin && req.user?.role === "faculty") {
            const facCheck = await db.query(
                "SELECT subject FROM faculties WHERE emailid = $1",
                [req.user.email]
            );
            const assignedSubject = facCheck.rows[0]?.subject;
            if (assignedSubject !== subject) {
                const resultCheck = await db.query(
                    "SELECT isdeclared FROM result WHERE courcecode = $1 AND semoryear = $2",
                    [course, sem]
                );
                const isPublished = resultCheck.rows.length > 0 && Number(resultCheck.rows[0].isdeclared) === 1;
                if (!isPublished) {
                    return res.status(403).json({
                        message: "এই বিষয়ের ফলাফল এখনও প্রধান শিক্ষক বা অ্যাডমিন কর্তৃক অনুমোদন ও প্রকাশ করা হয়নি।",
                        isPublished: false
                    });
                }
            }
        }

        const result = await db.query(
            `SELECT
                 s.rollnumber,
                 s.firstname,
                 s.lastname,
                 m.theorymarks,
                 m.practicalmarks,
                 sub.theorymarks AS theoryfull,
                 sub.practicalmarks AS practicalfull
             FROM students s
             LEFT JOIN marks m
               ON m.rollnumber = s.rollnumber
               AND m.subjectcode = $1
               AND m.courcecode = $2
               AND m.semoryear = $3
             JOIN subject sub
               ON sub.subjectcode = $4
             WHERE s.Courcecode = $5
             AND s.semoryear = $6
             ORDER BY s.rollnumber`,
            [subject, course, sem, subject, course, sem]
        );

        const rows = result.rows;

        const data = rows.map(r => {

            const theory = r.theorymarks || 0;
            const practical = r.practicalmarks || 0;
            const total = theory + practical;

            let grade = "F";

            if (total >= 90) grade = "O";
            else if (total >= 80) grade = "A+";
            else if (total >= 70) grade = "A";
            else if (total >= 60) grade = "B+";
            else if (total >= 50) grade = "B";
            else if (total >= 40) grade = "C";

            return {
                rollnumber: r.rollnumber,
                name: r.firstname + " " + r.lastname,
                theorymarks: theory,
                practicalmarks: practical,
                theoryfull: r.theoryfull,
                practicalfull: r.practicalfull,
                maxtotal: (r.theoryfull || 0) + (r.practicalfull || 0),
                total,
                grade
            };

        });

        res.json(data);

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Error fetching subject report" });

    }

};


// ============================
// Get Subjects For Marks
// ============================

exports.getSubjects = async (req, res) => {

    try {

        const { course, sem } = req.query;

        const result = await db.query(
            `SELECT subjectcode, subjectname, cq_max_marks, mcq_max_marks, theorymarks, practicalmarks
             FROM subject
             WHERE courcecode = $1
             AND semoryear = $2
             ORDER BY subjectcode`,
            [course, sem]
        );

        res.json(result.rows);

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Error fetching subjects" });

    }

};


// ============================
// Get Student Marksheet
// ============================

exports.getStudentMarksheet = async (req, res) => {

    try {

        const { course, sem, roll } = req.query;

        const isHeadOrAdmin = await isHeadTeacherOrAdmin(req.user);
        if (!isHeadOrAdmin) {
            const resultCheck = await db.query(
                "SELECT isdeclared FROM result WHERE courcecode = $1 AND semoryear = $2",
                [course, sem]
            );
            const isPublished = resultCheck.rows.length > 0 && Number(resultCheck.rows[0].isdeclared) === 1;
            if (!isPublished) {
                return res.status(403).json({
                    message: "ফলাফল এখনও প্রধান শিক্ষক বা অ্যাডমিন কর্তৃক অনুমোদন ও প্রকাশ করা হয়নি।",
                    isPublished: false
                });
            }
        }

        if (!course || !sem || !roll) {
            return res.status(400).json({ message: "Missing parameters" });
        }

        // ============================
        // Get School Info
        // ============================

        const adminResult = await db.query(
            `SELECT collagename, logo FROM admin LIMIT 1`
        );

        const adminRows = adminResult.rows;

        const SchoolName = adminRows.length
            ? adminRows[0].collagename
            : "School";

        const logoFile = getAdminLogo();
        const SchoolLogo = `/uploads/admin/${logoFile}`;

        // ============================
        // Fetch Student Marks
        // ============================

        const marksResult = await db.query(
            `SELECT
                 s.firstname,
                 s.lastname,
                 s.fathername,
                 s.mothername,
                 s.rollnumber,
                 s.courcecode,
                 s.profilepic,
                 m.subjectcode,
                 m.subjectname,
                 sub.cq_max_marks,
                 sub.mcq_max_marks,
                 sub.theorymarks AS theoryfull,
                 sub.practicalmarks AS practicalfull,
                 COALESCE(m.cq_marks, 0) AS cq_marks,
                 COALESCE(m.mcq_marks, 0) AS mcq_marks,
                 m.theorymarks,
                 m.practicalmarks
             FROM marks m
                      JOIN students s
                           ON m.rollnumber = s.rollnumber
                      JOIN subject sub
                           ON sub.subjectcode = m.subjectcode
                           AND sub.courcecode = m.courcecode
                           AND sub.semoryear = m.semoryear
             WHERE m.courcecode = $1
               AND m.semoryear = $2
               AND m.rollnumber = $3
             ORDER BY m.subjectcode`,
            [course, sem, roll]
        );

        const rows = marksResult.rows;

        if (!rows.length) {
            return res.json({
                SchoolName,
                SchoolLogo,
                marks: [],
                summary: null
            });
        }

        // Ensure profile pic exists
        rows.forEach(r => {
            if (!r.profilepic) {
                r.profilepic = "default.png";
            }
        });

        // ============================
        // Bangladesh NCTB Grading Logic
        // ============================

        const getBangladeshGrade = (obtained, max) => {
            if (!max || max <= 0) return { grade: "N/A", point: 0 };
            const pct = (obtained / max) * 100;
            if (pct >= 80) return { grade: "A+", point: 5.0 };
            if (pct >= 70) return { grade: "A", point: 4.0 };
            if (pct >= 60) return { grade: "A-", point: 3.5 };
            if (pct >= 50) return { grade: "B", point: 3.0 };
            if (pct >= 40) return { grade: "C", point: 2.0 };
            if (pct >= 33) return { grade: "D", point: 1.0 };
            return { grade: "F", point: 0.0 };
        };

        let totalObtained = 0;
        let totalMaximum = 0;
        let totalGradePoints = 0;
        let hasFailed = false;

        const processedRows = rows.map(r => {
            const cq = Number(r.cq_marks) || 0;
            const mcq = Number(r.mcq_marks) || 0;
            const practical = Number(r.practicalmarks) || 0;
            const theory = (r.cq_marks !== null || r.mcq_marks !== null) ? (cq + mcq) : (Number(r.theorymarks) || 0);

            const theoryFull = Number(r.theoryfull) || 0;
            const practicalFull = Number(r.practicalfull) || 0;

            const subjectTotal = theory + practical;
            const subjectMax = theoryFull + practicalFull;

            totalObtained += subjectTotal;
            totalMaximum += subjectMax;

            const { grade, point } = getBangladeshGrade(subjectTotal, subjectMax);
            if (grade === "F") {
                hasFailed = true;
            }
            totalGradePoints += point;

            return {
                ...r,
                cq_marks: cq,
                mcq_marks: mcq,
                theorymarks: theory,
                practicalmarks: practical,
                totalmarks: subjectTotal,
                maxmarks: subjectMax,
                grade,
                gradepoint: point.toFixed(2)
            };
        });

        const percentage = totalMaximum
            ? Number(((totalObtained / totalMaximum) * 100).toFixed(2))
            : 0;

        const gpaVal = processedRows.length ? (totalGradePoints / processedRows.length) : 0;
        const finalGpa = hasFailed ? "0.00" : gpaVal.toFixed(2);

        let finalGrade = "F";
        if (!hasFailed) {
            if (gpaVal >= 5.0) finalGrade = "A+";
            else if (gpaVal >= 4.0) finalGrade = "A";
            else if (gpaVal >= 3.5) finalGrade = "A-";
            else if (gpaVal >= 3.0) finalGrade = "B";
            else if (gpaVal >= 2.0) finalGrade = "C";
            else if (gpaVal >= 1.0) finalGrade = "D";
        }

        const result = hasFailed ? "FAILED" : "PASSED";

        // Determine Exam Name
        const isClass10 = String(course).toUpperCase().includes("10");
        const termNum = Number(sem);
        const examName = isClass10
            ? (termNum === 1 ? "Pre-Test Examination" : "Test Examination")
            : (termNum === 1 ? "Half Yearly Examination" : "Final Examination");

        res.json({
            SchoolName,
            SchoolLogo,
            examName,
            marks: processedRows,
            summary: {
                totalObtained,
                totalMaximum,
                percentage,
                gpa: finalGpa,
                finalGrade,
                division: hasFailed ? "FAILED" : (gpaVal >= 5.0 ? "Golden A+" : `GPA ${finalGpa}`),
                result
            }
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({ message: "Error fetching marksheet" });

    }

};