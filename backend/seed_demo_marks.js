const db = require('./src/config/db');

async function seedMarks() {
    // 1. Clean up unused courses
    await db.query("DELETE FROM courses WHERE course_code IN ('CLASS-9', 'CLASS-10')");

    // 2. Add sample students for Humanities (Arts)
    await db.query(`
        INSERT INTO students (courcecode, semoryear, rollnumber, firstname, lastname, emailid, contactnumber, dateofbirth, gender, fathername, mothername, password, activestatus)
        VALUES 
            ('CLASS-9-ARTS', 1, 951, 'Maksuda', 'Khatun', 'maksuda@dimlagirls.edu.bd', '01711000001', '2010-04-12', 'Female', 'Md. Mokbul Hossain', 'Mst. Moriyom Begum', '$2b$10$9yiGT7TqohIQ9fgbmf0IsOayhaO7WY4dlKcI0lfLR/Ea.Aq.pbvcm', 1),
            ('CLASS-10-ARTS', 1, 1051, 'Sharmin', 'Akter', 'sharmin@dimlagirls.edu.bd', '01711000002', '2009-02-18', 'Female', 'Md. Shofiul Alam', 'Mst. Salma Begum', '$2b$10$9yiGT7TqohIQ9fgbmf0IsOayhaO7WY4dlKcI0lfLR/Ea.Aq.pbvcm', 1)
        ON CONFLICT (rollnumber) DO NOTHING
    `);

    // 3. Ensure all students have father and mother names
    await db.query(`
        UPDATE students 
        SET fathername = COALESCE(fathername, 'Md. Rafiqul Islam'),
            mothername = COALESCE(mothername, 'Mst. Rehana Begum')
    `);

    // 4. Seed demo marks for Class 10 Science (Roll 1001, Pre-Test Exam = 1)
    const demoMarks10 = [
        { sub: 'BAN-101', name: 'Bangla 1st Paper (বাংলা ১ম পত্র)', cq: 62, mcq: 26, prac: 0 },
        { sub: 'BAN-102', name: 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cq: 64, mcq: 27, prac: 0 },
        { sub: 'ENG-107', name: 'English 1st Paper (ইংরেজি ১ম পত্র)', cq: 88, mcq: 0, prac: 0 },
        { sub: 'ENG-108', name: 'English 2nd Paper (ইংরেজি ২য় পত্র)', cq: 85, mcq: 0, prac: 0 },
        { sub: 'MAT-109', name: 'Mathematics (গণিত)', cq: 68, mcq: 28, prac: 0 },
        { sub: 'PHY-136', name: 'Physics (পদার্থবিজ্ঞান)', cq: 46, mcq: 23, prac: 24 },
        { sub: 'CHE-137', name: 'Chemistry (রসায়ন)', cq: 45, mcq: 24, prac: 25 },
        { sub: 'BIO-138', name: 'Biology (জীববিজ্ঞান)', cq: 48, mcq: 23, prac: 24 },
        { sub: 'HMT-126', name: 'Higher Mathematics (উচ্চতর গণিত)', cq: 47, mcq: 24, prac: 25 },
        { sub: 'BGS-150', name: 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', cq: 65, mcq: 27, prac: 0 },
        { sub: 'ICT-154', name: 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cq: 0, mcq: 24, prac: 24 },
        { sub: 'REL-111', name: 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cq: 66, mcq: 28, prac: 0 }
    ];

    for (const m of demoMarks10) {
        const theory = m.cq + m.mcq;
        await db.query(`
            INSERT INTO marks (courcecode, semoryear, subjectcode, subjectname, rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks)
            VALUES ('CLASS-10-SCI', 1, $1, $2, 1001, $3, $4, $5, $6)
            ON CONFLICT (courcecode, semoryear, subjectcode, rollnumber)
            DO UPDATE SET 
                theorymarks = EXCLUDED.theorymarks,
                practicalmarks = EXCLUDED.practicalmarks,
                cq_marks = EXCLUDED.cq_marks,
                mcq_marks = EXCLUDED.mcq_marks
        `, [m.sub, m.name, theory, m.prac, m.cq, m.mcq]);
    }

    // 5. Seed demo marks for Class 8 (Roll 801, Half Yearly Exam = 1)
    const demoMarks8 = [
        { sub: 'BAN-101', name: 'Bangla 1st Paper (বাংলা ১ম পত্র)', cq: 60, mcq: 27, prac: 0 },
        { sub: 'BAN-102', name: 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cq: 62, mcq: 26, prac: 0 },
        { sub: 'ENG-107', name: 'English 1st Paper (ইংরেজি ১ম পত্র)', cq: 75, mcq: 18, prac: 0 },
        { sub: 'ENG-108', name: 'English 2nd Paper (ইংরেজি ২য় পত্র)', cq: 72, mcq: 17, prac: 0 },
        { sub: 'MAT-109', name: 'Mathematics (গণিত)', cq: 66, mcq: 28, prac: 0 },
        { sub: 'SCI-127', name: 'General Science (সাধারণ বিজ্ঞান)', cq: 63, mcq: 27, prac: 0 },
        { sub: 'BGS-150', name: 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', cq: 64, mcq: 26, prac: 0 },
        { sub: 'REL-111', name: 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cq: 65, mcq: 28, prac: 0 },
        { sub: 'ICT-154', name: 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cq: 0, mcq: 23, prac: 24 },
        { sub: 'AGR-134', name: 'Agriculture Studies (কৃষি শিক্ষা)', cq: 44, mcq: 23, prac: 24 }
    ];

    for (const m of demoMarks8) {
        const theory = m.cq + m.mcq;
        await db.query(`
            INSERT INTO marks (courcecode, semoryear, subjectcode, subjectname, rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks)
            VALUES ('CLASS-8', 1, $1, $2, 801, $3, $4, $5, $6)
            ON CONFLICT (courcecode, semoryear, subjectcode, rollnumber)
            DO UPDATE SET 
                theorymarks = EXCLUDED.theorymarks,
                practicalmarks = EXCLUDED.practicalmarks,
                cq_marks = EXCLUDED.cq_marks,
                mcq_marks = EXCLUDED.mcq_marks
        `, [m.sub, m.name, theory, m.prac, m.cq, m.mcq]);
    }

    console.log('Seeded demo marks and parent info successfully!');
    process.exit(0);
}

seedMarks().catch(e => {
    console.error(e);
    process.exit(1);
});
