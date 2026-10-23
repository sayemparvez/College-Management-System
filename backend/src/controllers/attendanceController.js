const db = require("../config/db");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");

/* ================= PROFILE PIC HELPER ================= */

const studentUploadDir = path.resolve(__dirname, "../../uploads/students");

const getStudentImage = (rollnumber) => {
    if (!fs.existsSync(studentUploadDir)) return "default.png";

    const files = fs.readdirSync(studentUploadDir);

    const match = files.find(file => {
        const name = path.basename(file, path.extname(file));
        return name.trim().toLowerCase() === String(rollnumber).trim().toLowerCase();
    });

    return match || "default.png";
};


const getTodayDate = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};

const getUserRole = (req) => {
    return String(
        req.user?.role ||
        req.user?.usertype ||
        req.user?.userType ||
        req.user?.type ||
        ""
    ).toLowerCase();
};

/* ============================================================
   GET STUDENTS FOR ATTENDANCE
   Supports:
   - ?courses=X,Y&sem=Z → returns students from multiple courses (comma-separated), same sem
   - ?course=X&sem=Y    → returns students from a single course/sem
   Note: subjectcode is no longer used for routing since attendance is always DAILY_1ST
============================================================ */

exports.getStudents = async (req, res) => {
    const { course, courses, sem } = req.query;

    try {
        let result;

        if (courses && sem) {
            // Multi-course: comma-separated list of course codes
            const courseList = courses.split(",").map(c => c.trim()).filter(Boolean);

            if (courseList.length === 0) {
                return res.status(400).json({ message: "No valid courses provided" });
            }

            const conditions = courseList.map((_, i) =>
                `s.Courcecode = $${i + 2}`
            ).join(" OR ");

            result = await db.query(
                `SELECT sr_no, rollnumber, firstname, lastname, Courcecode AS courcecode, semoryear
                 FROM students s
                 WHERE s.semoryear = $1
                   AND (${conditions})
                 ORDER BY s.Courcecode, s.rollnumber`,
                [sem, ...courseList]
            );
        } else if (course && sem) {
            // Single course
            result = await db.query(
                `SELECT sr_no, rollnumber, firstname, lastname, Courcecode AS courcecode, semoryear
                 FROM students
                 WHERE Courcecode = $1 AND semoryear = $2
                 ORDER BY rollnumber`,
                [course, sem]
            );
        } else {
            return res.status(400).json({ message: "Course and semester are required" });
        }

        const formatted = result.rows.map(student => ({
            student_id: student.sr_no,
            rollnumber: student.rollnumber,
            firstname: student.firstname,
            lastname: student.lastname,
            courcecode: student.courcecode,
            semoryear: student.semoryear,
            profilepic: getStudentImage(student.rollnumber)
        }));

        res.json(formatted);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch students" });
    }
};

/* ============================================================
   GET ATTENDANCE BY DATE
   Accepts courcecodes as comma-separated string for multi-course support.
   Joins attendance by student_id + subjectcode + date only (no courcecode
   filter in JOIN, since each student's record has their own courcecode).
============================================================ */

exports.getAttendanceByDate = async (req, res) => {
    let { subjectcode, date, courcecode, semoryear } = req.query;

    if (!subjectcode || !date) {
        return res.status(400).json({ message: "Missing required filters" });
    }

    date = String(date).slice(0, 10);

    try {
        // Support comma-separated courcecodes for multi-class view
        const courcecodes = courcecode ? courcecode.split(",").map(c => c.trim()).filter(Boolean) : [];

        if (courcecodes.length === 0) {
            return res.status(400).json({ message: "Missing courcecode" });
        }

        const courseConditions = courcecodes.map((_, i) =>
            `s.Courcecode = $${i + 3}`
        ).join(" OR ");

        const params = [subjectcode, date, ...courcecodes];

        const result = await db.query(
            `
            SELECT
                s.sr_no AS student_id,
                COALESCE(a.present, 0) AS present
            FROM students s
            LEFT JOIN attendance a
                ON s.sr_no = a.student_id
                AND a.subjectcode = $1
                AND a.attendance_date = $2
            WHERE (${courseConditions})
            ORDER BY s.Courcecode, s.rollnumber
            `,
            params
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch attendance" });
    }
};

/* ============================================================
   SAVE / UPDATE ATTENDANCE
   Each student's attendance is saved with their OWN courcecode/semoryear,
   looked up from the students table. This supports shared-subject scenarios
   where students from multiple classes appear in one attendance sheet.
============================================================ */

exports.saveAttendance = async (req, res) => {
    let { subjectcode, date, courcecode, semoryear, records } = req.body;

    if (!subjectcode || !date || !Array.isArray(records)) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    date = String(date).slice(0, 10);

    const todayDate = getTodayDate();
    const userRole = getUserRole(req);

    if (userRole === "faculty") {
        if (date !== todayDate) {
            return res.status(403).json({
                message: "Faculty can take attendance only for today's date"
            });
        }

        // Check if attendance is already submitted for these students on this date
        const studentIds = records.map(r => r.student_id);
        const existingCheck = await db.query(
            `SELECT 1 FROM attendance WHERE subjectcode = $1 AND attendance_date = $2 AND student_id = ANY($3::int[]) LIMIT 1`,
            [subjectcode, date, studentIds]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(403).json({
                message: "হাজিরা ইতিমধ্যে জমা দেওয়া হয়েছে। সাবমিট করার পর শুধুমাত্র অ্যাডমিন হাজিরা এডিট বা সংশোধন করতে পারবেন।"
            });
        }
    }

    try {
        // Fetch each student's own courcecode and semoryear from the DB
        const studentIds = records.map(r => r.student_id);

        const studentResult = await db.query(
            `SELECT sr_no, Courcecode AS courcecode, semoryear FROM students WHERE sr_no = ANY($1::int[])`,
            [studentIds]
        );

        const studentMap = new Map(
            studentResult.rows.map(s => [s.sr_no, { courcecode: s.courcecode, semoryear: s.semoryear }])
        );

        const values = records.map(r => {
            const studentInfo = studentMap.get(r.student_id);
            const studentCourcecode = studentInfo?.courcecode || courcecode;
            const studentSemoryear = studentInfo?.semoryear ?? Number(semoryear);

            return [
                r.student_id,
                subjectcode,
                date,
                r.present,
                studentCourcecode,
                studentSemoryear
            ];
        });

        if (values.length > 0) {
            const placeholders = values.map((_, index) => {
                const offset = index * 6;
                return `(
                    $${offset + 1},
                    $${offset + 2},
                    $${offset + 3},
                    $${offset + 4},
                    $${offset + 5},
                    $${offset + 6}
                )`;
            }).join(", ");

            const flattenedValues = values.flat();

            await db.query(
                `
                    INSERT INTO attendance
                    (student_id, subjectcode, attendance_date, present, courcecode, semoryear)
                    VALUES ${placeholders}
                    ON CONFLICT
                    (student_id, subjectcode, attendance_date, courcecode, semoryear)
                    DO UPDATE SET present = EXCLUDED.present
                `,
                flattenedValues
            );
        }

        res.json({ message: "Attendance saved successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to save attendance" });
    }
};

/* ============================================================
   GET ATTENDANCE REPORT
============================================================ */

exports.getReport = async (req, res) => {
    const { course, sem, subject } = req.query;

    if (!course || !sem || !subject) {
        return res.status(400).json({ message: "Missing filters" });
    }

    try {
        const result = await db.query(
            `
                SELECT
                    s.rollnumber,
                    CONCAT(s.firstname, ' ', s.lastname) AS name,
                    COUNT(a.attendance_date) AS total_classes,
                    SUM(a.present) AS present_count,
                    ROUND(
                            COALESCE(
                                    (SUM(a.present)::numeric /
                                     NULLIF(COUNT(a.attendance_date), 0)) * 100,
                                    0
                            ),
                            2
                    ) AS percentage
                FROM students s
                         LEFT JOIN attendance a
                                   ON s.sr_no = a.student_id
                                       AND a.subjectcode = $1
                WHERE s.Courcecode = $2
                  AND s.semoryear = $3
                GROUP BY s.sr_no
                ORDER BY s.rollnumber
            `,
            [subject, course, sem]
        );

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to generate report" });
    }
};

/* ============================================================
   GET EXISTING ATTENDANCE DATES
   When subjectcode is provided, returns dates across all courses sharing
   that subject. Optionally filtered by comma-separated courcecodes.
============================================================ */

exports.getAttendanceDates = async (req, res) => {
    const { subjectcode, courcecode, semoryear } = req.query;

    if (!subjectcode) {
        return res.status(400).json({ message: "Missing subjectcode" });
    }

    try {
        let result;

        if (courcecode) {
            // Filter by specific course(s) — supports comma-separated list
            const courcecodes = courcecode.split(",").map(c => c.trim());
            const placeholders = courcecodes.map((_, i) => `$${i + 2}`).join(", ");

            result = await db.query(
                `
                SELECT DISTINCT TO_CHAR(attendance_date, 'YYYY-MM-DD') AS date
                FROM attendance
                WHERE subjectcode = $1
                  AND courcecode IN (${placeholders})
                ORDER BY date DESC
                `,
                [subjectcode, ...courcecodes]
            );
        } else {
            // All courses for this subject (shared subject scenario)
            result = await db.query(
                `
                SELECT DISTINCT TO_CHAR(attendance_date, 'YYYY-MM-DD') AS date
                FROM attendance
                WHERE subjectcode = $1
                ORDER BY date DESC
                `,
                [subjectcode]
            );
        }

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch dates" });
    }
};

/* ============================================================
   DELETE ATTENDANCE
   Supports comma-separated courcecodes. If none provided, deletes
   attendance for the subjectcode + date across all courses.
============================================================ */

exports.deleteAttendance = async (req, res) => {
    let { subjectcode, date, courcecode, semoryear } = req.body;

    if (!subjectcode || !date) {
        return res.status(400).json({ message: "Missing required filters" });
    }

    date = String(date).slice(0, 10);

    try {
        if (courcecode) {
            const courcecodes = courcecode.split(",").map(c => c.trim());
            const placeholders = courcecodes.map((_, i) => `$${i + 3}`).join(", ");

            await db.query(
                `
                DELETE FROM attendance
                WHERE subjectcode = $1
                  AND attendance_date = $2
                  AND courcecode IN (${placeholders})
                `,
                [subjectcode, date, ...courcecodes]
            );
        } else {
            await db.query(
                `
                DELETE FROM attendance
                WHERE subjectcode = $1
                  AND attendance_date = $2
                `,
                [subjectcode, date]
            );
        }

        res.json({ message: "Attendance deleted successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete attendance" });
    }
};



/* ============================================================
   DOWNLOAD ATTENDANCE TEMPLATE
============================================================ */

exports.downloadAttendanceTemplate = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Attendance Template");

        worksheet.columns = [
            { header: "rollnumber", key: "rollnumber", width: 18 },
            { header: "present", key: "present", width: 12 },
            { header: "absent", key: "absent", width: 12 }
        ];

        // one demo row only
        worksheet.addRow({
            rollnumber: 23011006,
            present: 1,
            absent: 0
        });

        worksheet.getRow(1).font = { bold: true };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="attendance_template.xlsx"'
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("Download attendance template error:", err);
        res.status(500).json({ message: "Failed to download template" });
    }
};

/* ============================================================
   IMPORT ATTENDANCE FROM EXCEL
   Supports shared-subject: looks up students from all courses that
   have this subject, and saves each student's attendance with their
   own courcecode.
============================================================ */

exports.importAttendance = async (req, res) => {
    let { subjectcode, date, courcecode, semoryear } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "Excel file is required" });
    }

    if (!subjectcode || !date) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    // Check for existing attendance (across all courses sharing this subject)
    const existingAttendanceResult = await db.query(
        `
            SELECT 1
            FROM attendance
            WHERE subjectcode = $1
              AND attendance_date = $2
            LIMIT 1
        `,
        [subjectcode, date]
    );

    const existingAttendance = existingAttendanceResult.rows;

    if (existingAttendance.length > 0) {
        return res.status(400).json({
            message: "Attendance is already taken for this date, so import is not allowed."
        });
    }

    date = String(date).slice(0, 10);

    const todayDate = getTodayDate();
    const userRole = getUserRole(req);

    if (userRole === "faculty" && date !== todayDate) {
        return res.status(403).json({
            message: "Faculty can import attendance only for today's date"
        });
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rows.length) {
            return res.status(400).json({ message: "Excel file is empty" });
        }

        // Get ALL students from all courses that share this subject
        let studentsResult;
        if (courcecode) {
            studentsResult = await db.query(
                `SELECT sr_no, rollnumber, Courcecode AS courcecode, semoryear FROM students WHERE Courcecode = $1`,
                [courcecode]
            );
        } else {
            // Fetch students from all courses that have this subject
            const courseResult = await db.query(
                `SELECT DISTINCT courcecode, semoryear FROM subject WHERE subjectcode = $1`,
                [subjectcode]
            );
            const coursePairs = courseResult.rows;

            if (coursePairs.length > 0) {
                const conditions = coursePairs.map((_, i) =>
                    `(Courcecode = $${i * 2 + 1} AND semoryear = $${i * 2 + 2})`
                ).join(" OR ");
                const params = coursePairs.flatMap(p => [p.courcecode, p.semoryear]);
                studentsResult = await db.query(
                    `SELECT sr_no, rollnumber, Courcecode AS courcecode, semoryear FROM students WHERE ${conditions}`,
                    params
                );
            } else {
                studentsResult = { rows: [] };
            }
        }

        const students = studentsResult.rows;

        const rollMap = new Map(
            students.map((student) => [
                String(student.rollnumber).trim(),
                { sr_no: student.sr_no, courcecode: student.courcecode, semoryear: student.semoryear }
            ])
        );

        const values = [];
        const errors = [];
        let invalidRows = 0;

        rows.forEach((row, index) => {
            const excelRowNumber = index + 2;

            const rollnumber = String(row.rollnumber || "").trim();
            const presentValue = String(row.present ?? "").trim();
            const absentValue = String(row.absent ?? "").trim();

            if (!rollnumber) {
                invalidRows++;
                errors.push({
                    row: excelRowNumber,
                    reason: "rollnumber is required"
                });
                return;
            }

            if (!rollMap.has(rollnumber)) {
                invalidRows++;
                errors.push({
                    row: excelRowNumber,
                    reason: `Student not found for rollnumber ${rollnumber}`
                });
                return;
            }

            const hasPresent = presentValue !== "";
            const hasAbsent = absentValue !== "";

            // both filled -> invalid
            if (hasPresent && hasAbsent) {
                invalidRows++;
                errors.push({
                    row: excelRowNumber,
                    reason: "Both present and absent are filled"
                });
                return;
            }

            // both empty -> invalid
            if (!hasPresent && !hasAbsent) {
                invalidRows++;
                errors.push({
                    row: excelRowNumber,
                    reason: "Either present or absent must be filled"
                });
                return;
            }

            // validate the filled field only
            if (hasPresent && !["1", "0"].includes(presentValue)) {
                invalidRows++;
                errors.push({
                    row: excelRowNumber,
                    reason: "Present must be 0 or 1"
                });
                return;
            }

            if (hasAbsent && !["1", "0"].includes(absentValue)) {
                invalidRows++;
                errors.push({
                    row: excelRowNumber,
                    reason: "Absent must be 0 or 1"
                });
                return;
            }

            // only one field is filled -> accept row
            let normalizedPresent;

            if (hasPresent) {
                normalizedPresent = 1;
            } else if (hasAbsent) {
                normalizedPresent = 0;
            }

            const studentInfo = rollMap.get(rollnumber);

            values.push([
                studentInfo.sr_no,
                subjectcode,
                date,
                normalizedPresent,
                studentInfo.courcecode,
                Number(studentInfo.semoryear)
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


        if (invalidRows > 0) {
            return res.status(400).json({
                message: "Some rows are invalid. Please fix them and import again.",
                totalRows: rows.length,
                inserted: 0,
                invalidRows,
                errors
            });
        }

        const placeholders = values.map((_, index) => {
            const offset = index * 6;

            return `(
                $${offset + 1},
                $${offset + 2},
                $${offset + 3},
                $${offset + 4},
                $${offset + 5},
                $${offset + 6}
            )`;
        }).join(", ");

        const flattenedValues = values.flat();

        await db.query(
            `
                INSERT INTO attendance
                (student_id, subjectcode, attendance_date, present, courcecode, semoryear)
                VALUES ${placeholders}
                    ON CONFLICT
                (student_id, subjectcode, attendance_date, courcecode, semoryear)
                DO UPDATE SET present = EXCLUDED.present
            `,
            flattenedValues
        );

        return res.json({
            message: "Attendance imported successfully",
            totalRows: rows.length,
            inserted: values.length,
            invalidRows,
            errors
        });

    } catch (err) {
        console.error("Import attendance error:", err);
        res.status(500).json({ message: "Failed to import attendance" });
    }
};
