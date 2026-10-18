const db = require("../config/db");

// =========================================================
// Public Marksheet Verification Controller
// Description: Unauthenticated endpoint for employers and
// institutions to verify a student's marksheet via QR code.
// =========================================================

exports.verifyMarksheet = async (req, res) => {
    try {
        const { marksheetId } = req.params;

        // 1. Parse the Marksheet ID (Format: MS-COURSE-SEM-ROLLNUMBER)
        const parts = marksheetId.split('-');

        if (parts.length !== 4 || parts[0] !== 'MS') {
            return res.status(400).json({
                isValid: false,
                message: "Invalid Marksheet ID format."
            });
        }

        const courseCode = parts[1];
        const sem = parts[2];
        const rollNumber = parts[3];

        // 2. Get College Info
        const adminResult = await db.query(
            `SELECT collagename FROM admin LIMIT 1`
        );

        const adminRows = adminResult.rows;
        const collegeName = adminRows.length ? adminRows[0].collagename : "College";

        // 3. Fetch Student Data
        // Using your exact column names: Courcecode, semoryear
        const studentResult = await db.query(
            `SELECT firstname, lastname, rollnumber, profilepic, fathername, mothername 
             FROM students 
             WHERE rollnumber = $1 AND Courcecode = $2`,
            [rollNumber, courseCode]
        );

        const studentRows = studentResult.rows;

        if (!studentRows.length) {
            return res.status(404).json({
                isValid: false,
                message: "No student found matching this verification ID."
            });
        }

        const student = studentRows[0];

        // 4. Fetch Student Marks
        const marksResult = await db.query(
            `SELECT 
                 m.subjectcode, 
                 m.subjectname,
                 sub.cq_max_marks,
                 sub.mcq_max_marks,
                 sub.theorymarks AS theoryfull, 
                 sub.practicalmarks AS practicalfull, 
                 COALESCE(m.cq_marks, 0) AS cq_marks,
                 COALESCE(m.mcq_marks, 0) AS mcq_marks,
                 m.theorymarks, 
                 m.practicalmarks, 
                 sub.subjecttype
             FROM marks m
             JOIN subject sub 
               ON sub.subjectcode = m.subjectcode
               AND sub.courcecode = m.courcecode
               AND sub.semoryear = m.semoryear
             WHERE m.courcecode = $1 AND m.semoryear = $2 AND m.rollnumber = $3
             ORDER BY m.subjectcode`,
            [courseCode, sem, rollNumber]
        );

        const marksRows = marksResult.rows;

        if (!marksRows.length) {
            return res.status(404).json({
                isValid: false,
                message: "Marksheet data not found for this examination."
            });
        }

        // 5. Bangladesh NCTB Grading Logic
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
        let subjectFailed = false;

        const processedMarks = marksRows.map(r => {
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
                subjectFailed = true;
            }
            totalGradePoints += point;

            return {
                subjectcode: r.subjectcode,
                subjectname: r.subjectname,
                type: r.subjecttype,
                cq: {
                    obtained: cq,
                    max: Number(r.cq_max_marks) || 0
                },
                mcq: {
                    obtained: mcq,
                    max: Number(r.mcq_max_marks) || 0
                },
                theory: {
                    obtained: theory,
                    max: theoryFull
                },
                practical: {
                    obtained: practical,
                    max: practicalFull
                },
                total: {
                    obtained: subjectTotal,
                    max: subjectMax
                },
                grade,
                gradePoint: point.toFixed(2),
                status: (grade !== "F") ? "PASS" : "FAIL"
            };
        });

        // 6. Overall Percentage & GPA Logic
        const percentage = totalMaximum
            ? Number(((totalObtained / totalMaximum) * 100).toFixed(2))
            : 0;

        const gpaVal = processedMarks.length ? (totalGradePoints / processedMarks.length) : 0;
        const finalGpa = subjectFailed ? "0.00" : gpaVal.toFixed(2);

        let finalGrade = "F";
        if (!subjectFailed) {
            if (gpaVal >= 5.0) finalGrade = "A+";
            else if (gpaVal >= 4.0) finalGrade = "A";
            else if (gpaVal >= 3.5) finalGrade = "A-";
            else if (gpaVal >= 3.0) finalGrade = "B";
            else if (gpaVal >= 2.0) finalGrade = "C";
            else if (gpaVal >= 1.0) finalGrade = "D";
        }

        const result = subjectFailed ? "FAILED" : "PASSED";
        const division = subjectFailed ? "FAILED" : (gpaVal >= 5.0 ? "Golden A+" : `GPA ${finalGpa}`);

        // Exam Title
        const isClass10 = String(courseCode).toUpperCase().includes("10");
        const termNum = Number(sem);
        const examName = isClass10
            ? (termNum === 1 ? "Pre-Test Examination" : "Test Examination")
            : (termNum === 1 ? "Half Yearly Examination" : "Final Examination");

        // 8. Send Verification Payload
        res.json({
            isValid: true,
            verificationId: marksheetId,
            collegeName,
            examName,
            student: {
                rollnumber: student.rollnumber,
                name: `${student.firstname} ${student.lastname}`.trim(),
                fathername: student.fathername || "",
                mothername: student.mothername || "",
                profilepic: student.profilepic || "default.png"
            },
            academic: {
                courseCode,
                semester: sem
            },
            performance: {
                marks: processedMarks,
                summary: {
                    totalObtained,
                    totalMaximum,
                    percentage,
                    gpa: finalGpa,
                    finalGrade,
                    division,
                    result
                }
            }
        });

    } catch (error) {
        console.error("Marksheet Verification Error:", error);

        res.status(500).json({
            isValid: false,
            message: "Internal server error during verification."
        });
    }
};