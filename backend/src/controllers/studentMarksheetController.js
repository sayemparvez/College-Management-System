const db = require("../config/db");

exports.getStudentMarks = async (req, res) => {

  try {

    const email = req.user.email;

    // optional filters from frontend
    const { sem, subject } = req.query;

    const studentResult = await db.query(
        "SELECT rollnumber, Courcecode FROM students WHERE emailid = $1",
        [email]
    );

    const student = studentResult.rows;

    if (!student.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { rollnumber, Courcecode } = student[0];

    // dynamic query
    let query = `
      SELECT
        m.subjectname,
        m.subjectcode,
        m.courcecode,
        m.semoryear,
        COALESCE(m.cq_marks, 0) AS cq_marks,
        COALESCE(m.mcq_marks, 0) AS mcq_marks,
        m.theorymarks,
        m.practicalmarks,
        sub.cq_max_marks,
        sub.mcq_max_marks,
        sub.theorymarks AS theoryfull,
        sub.practicalmarks AS practicalfull,
        (COALESCE(m.theorymarks, 0) + COALESCE(m.practicalmarks, 0)) AS total_marks
      FROM marks m
      LEFT JOIN subject sub 
        ON m.subjectcode = sub.subjectcode 
        AND m.courcecode = sub.courcecode 
        AND m.semoryear = sub.semoryear
      WHERE m.rollnumber = $1
        AND m.Courcecode = $2
    `;

    const params = [rollnumber, Courcecode];

    if (sem) {
      params.push(sem);
      query += ` AND m.semoryear = $${params.length}`;
    }

    if (subject) {
      params.push(subject);
      query += ` AND m.subjectcode = $${params.length}`;
    }

    query += ` ORDER BY m.subjectcode`;

    const result = await db.query(query, params);

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

    const rows = result.rows.map(r => {
        const cq = Number(r.cq_marks) || 0;
        const mcq = Number(r.mcq_marks) || 0;
        const practical = Number(r.practicalmarks) || 0;
        const theory = (r.cq_marks !== null || r.mcq_marks !== null) ? (cq + mcq) : (Number(r.theorymarks) || 0);

        const theoryFull = Number(r.theoryfull) || 0;
        const practicalFull = Number(r.practicalfull) || 0;
        const subjectTotal = theory + practical;
        const subjectMax = theoryFull + practicalFull;

        const { grade, point } = getBangladeshGrade(subjectTotal, subjectMax);

        return {
            ...r,
            cq_marks: cq,
            mcq_marks: mcq,
            theorymarks: theory,
            practicalmarks: practical,
            total_marks: subjectTotal,
            max_marks: subjectMax,
            grade,
            grade_point: point.toFixed(2)
        };
    });

    res.json({
      marks: rows,
      course: Courcecode,
      roll: rollnumber
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }

};