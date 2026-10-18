const db = require('./src/config/db');

async function migrate() {
    console.log('--- Starting Secondary School Structure Migration ---');

    // 1. Relax email requirement and unique constraint on students table
    try {
        await db.query('ALTER TABLE students DROP CONSTRAINT IF EXISTS students_emailid_unique');
        console.log('Dropped students_emailid_unique constraint');
    } catch (e) {
        console.log('Constraint drop note:', e.message);
    }
    await db.query('ALTER TABLE students ALTER COLUMN emailid DROP NOT NULL');

    // Drop restrictive subject_subjectcode_unique constraint because subject codes repeat across classes/exams
    try {
        await db.query('ALTER TABLE marks DROP CONSTRAINT IF EXISTS fk_marks_subject');
        await db.query('ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_subject');
        await db.query('ALTER TABLE subject DROP CONSTRAINT IF EXISTS subject_subjectcode_unique');
        console.log('Dropped subject_subjectcode_unique and referencing foreign keys');
    } catch (e) {
        console.log('Constraint drop note:', e.message);
    }

    // 2. Expand subject columns if needed
    await db.query('ALTER TABLE subject ALTER COLUMN subjectcode TYPE VARCHAR(50)');
    await db.query('ALTER TABLE subject ALTER COLUMN subjectname TYPE VARCHAR(150)');
    await db.query('ALTER TABLE subject ALTER COLUMN courcecode TYPE VARCHAR(50)');
    await db.query('ALTER TABLE marks ALTER COLUMN subjectcode TYPE VARCHAR(50)');
    await db.query('ALTER TABLE marks ALTER COLUMN courcecode TYPE VARCHAR(50)');

    // 3. Clear old marks & subjects to install authentic NCTB curriculum
    await db.query('DELETE FROM marks');
    await db.query('DELETE FROM attendance');
    await db.query('DELETE FROM subject');

    // Courses: Classes 6, 7, 8 (General, no section/semester, 2 exams: Half Yearly & Final)
    // Class 9 & Class 10 (Science & Humanities/Arts sections)
    const courses = [
        { code: 'CLASS-6', name: 'Class 6 (৬ষ্ঠ শ্রেণি)' },
        { code: 'CLASS-7', name: 'Class 7 (৭ম শ্রেণি)' },
        { code: 'CLASS-8', name: 'Class 8 (৮ম শ্রেণি)' },
        { code: 'CLASS-9-SCI', name: 'Class 9 - Science (৯ম শ্রেণি - বিজ্ঞান)' },
        { code: 'CLASS-9-ARTS', name: 'Class 9 - Humanities/Arts (৯ম শ্রেণি - মানবিক)' },
        { code: 'CLASS-10-SCI', name: 'Class 10 - Science (১০ম শ্রেণি - বিজ্ঞান)' },
        { code: 'CLASS-10-ARTS', name: 'Class 10 - Humanities/Arts (১০ম শ্রেণি - মানবিক)' }
    ];

    for (const c of courses) {
        await db.query(`
            INSERT INTO courses (course_code, course_name, total_semesters, sem_or_year)
            VALUES ($1, $2, 2, 'sem')
            ON CONFLICT (course_code) 
            DO UPDATE SET course_name = EXCLUDED.course_name, total_semesters = 2
        `, [c.code, c.name]);
    }

    // Also update existing students' course codes if they had CLASS-9 or CLASS-10
    await db.query(`UPDATE students SET Courcecode = 'CLASS-9-SCI' WHERE Courcecode = 'CLASS-9'`);
    await db.query(`UPDATE students SET Courcecode = 'CLASS-10-SCI' WHERE Courcecode = 'CLASS-10'`);

    // Helper for inserting subject
    const insertSub = async (code, name, course, exam, cq, mcq, prac, theory) => {
        await db.query(`
            INSERT INTO subject (subjectcode, subjectname, courcecode, semoryear, subjecttype, cq_max_marks, mcq_max_marks, practicalmarks, theorymarks)
            VALUES ($1, $2, $3, $4, 'core', $5, $6, $7, $8)
            ON CONFLICT (subjectcode, courcecode, semoryear)
            DO UPDATE SET 
                subjectname = EXCLUDED.subjectname,
                cq_max_marks = EXCLUDED.cq_max_marks,
                mcq_max_marks = EXCLUDED.mcq_max_marks,
                practicalmarks = EXCLUDED.practicalmarks,
                theorymarks = EXCLUDED.theorymarks
        `, [code, name, course, exam, cq, mcq, prac, theory]);
    };

    // Class 6 to 8 NCTB Standard Subjects (Exams 1 = Half Yearly, 2 = Final)
    const juniorClasses = ['CLASS-6', 'CLASS-7', 'CLASS-8'];
    for (const cls of juniorClasses) {
        for (const term of [1, 2]) {
            await insertSub('BAN-101', 'Bangla 1st Paper (বাংলা ১ম পত্র)', cls, term, 70, 30, 0, 100);
            await insertSub('BAN-102', 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cls, term, 70, 30, 0, 100);
            await insertSub('ENG-107', 'English 1st Paper (ইংরেজি ১ম পত্র)', cls, term, 80, 20, 0, 100);
            await insertSub('ENG-108', 'English 2nd Paper (ইংরেজি ২য় পত্র)', cls, term, 80, 20, 0, 100);
            await insertSub('MAT-109', 'Mathematics (গণিত)', cls, term, 70, 30, 0, 100);
            await insertSub('SCI-127', 'General Science (সাধারণ বিজ্ঞান)', cls, term, 70, 30, 0, 100);
            await insertSub('BGS-150', 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', cls, term, 70, 30, 0, 100);
            await insertSub('REL-111', 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cls, term, 70, 30, 0, 100);
            await insertSub('ICT-154', 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cls, term, 0, 25, 25, 25);
            await insertSub('AGR-134', 'Agriculture Studies (কৃষি শিক্ষা)', cls, term, 50, 25, 25, 75);
        }
    }

    // Class 9 & 10 (Exams: for Class 9: 1=Half Yearly, 2=Final; for Class 10: 1=Pre-Test, 2=Test)
    const seniorSet = [
        { cls: 'CLASS-9-SCI', type: 'SCI' },
        { cls: 'CLASS-9-ARTS', type: 'ARTS' },
        { cls: 'CLASS-10-SCI', type: 'SCI' },
        { cls: 'CLASS-10-ARTS', type: 'ARTS' }
    ];

    for (const item of seniorSet) {
        for (const term of [1, 2]) {
            // Common compulsory subjects
            await insertSub('BAN-101', 'Bangla 1st Paper (বাংলা ১ম পত্র)', item.cls, term, 70, 30, 0, 100);
            await insertSub('BAN-102', 'Bangla 2nd Paper (বাংলা ২য় পত্র)', item.cls, term, 70, 30, 0, 100);
            await insertSub('ENG-107', 'English 1st Paper (ইংরেজি ১ম পত্র)', item.cls, term, 100, 0, 0, 100);
            await insertSub('ENG-108', 'English 2nd Paper (ইংরেজি ২য় পত্র)', item.cls, term, 100, 0, 0, 100);
            await insertSub('MAT-109', 'Mathematics (গণিত)', item.cls, term, 70, 30, 0, 100);
            await insertSub('REL-111', 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', item.cls, term, 70, 30, 0, 100);
            await insertSub('ICT-154', 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', item.cls, term, 0, 25, 25, 25);

            if (item.type === 'SCI') {
                // Science Section Subjects
                await insertSub('PHY-136', 'Physics (পদার্থবিজ্ঞান)', item.cls, term, 50, 25, 25, 75);
                await insertSub('CHE-137', 'Chemistry (রসায়ন)', item.cls, term, 50, 25, 25, 75);
                await insertSub('BIO-138', 'Biology (জীববিজ্ঞান)', item.cls, term, 50, 25, 25, 75);
                await insertSub('HMT-126', 'Higher Mathematics (উচ্চতর গণিত)', item.cls, term, 50, 25, 25, 75);
                await insertSub('BGS-150', 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', item.cls, term, 70, 30, 0, 100);
            } else {
                // Humanities / Arts Section Subjects
                await insertSub('HIS-153', 'History of Bangladesh & World Civilization (বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা)', item.cls, term, 70, 30, 0, 100);
                await insertSub('GEO-110', 'Geography & Environment (ভূগোল ও পরিবেশ)', item.cls, term, 70, 30, 0, 100);
                await insertSub('CIV-140', 'Civics & Citizenship (পৌরনীতি ও নাগরিকতা)', item.cls, term, 70, 30, 0, 100);
                await insertSub('ECO-141', 'Economics (অর্থনীতি)', item.cls, term, 70, 30, 0, 100);
                await insertSub('SCI-127', 'General Science (সাধারণ বিজ্ঞান)', item.cls, term, 70, 30, 0, 100);
                await insertSub('AGR-134', 'Agriculture Studies (কৃষি শিক্ষা)', item.cls, term, 50, 25, 25, 75);
            }
        }
    }

    // 4. Update student records with parent names if null
    await db.query(`
        UPDATE students 
        SET fathername = COALESCE(fathername, 'Md. Rafiqul Islam'),
            mothername = COALESCE(mothername, 'Mst. Rehana Begum')
        WHERE fathername IS NULL OR mothername IS NULL
    `);

    // 5. Seed marks for demonstration
    // Class 10 Science (Roll 1001, Pre-Test Exam = 1)
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
        `, [m.sub, m.name, theory, m.prac, m.cq, m.mcq]);
    }

    // Class 8 (Roll 801, Half Yearly Exam = 1)
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
        `, [m.sub, m.name, theory, m.prac, m.cq, m.mcq]);
    }

    console.log('--- Migration completed successfully! ---');
    process.exit(0);
}

migrate().catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
});
