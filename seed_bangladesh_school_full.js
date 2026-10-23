const db = require('./backend/src/config/db');

async function setupBangladeshSchool() {
  console.log("=== Setting up Dimla Government Girls' High School Data ===");

  // 1. Database schema fixes and alterations
  try {
    await db.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026';
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20) DEFAULT '2026';
      
      -- Expand columns
      ALTER TABLE subject ALTER COLUMN subjectcode TYPE VARCHAR(50);
      ALTER TABLE subject ALTER COLUMN subjectname TYPE VARCHAR(150);
      ALTER TABLE subject ALTER COLUMN courcecode TYPE VARCHAR(50);
      ALTER TABLE marks ALTER COLUMN subjectcode TYPE VARCHAR(50);
      ALTER TABLE marks ALTER COLUMN courcecode TYPE VARCHAR(50);

      -- Add CQ and MCQ columns
      ALTER TABLE subject ADD COLUMN IF NOT EXISTS cq_max_marks INTEGER DEFAULT 0;
      ALTER TABLE subject ADD COLUMN IF NOT EXISTS mcq_max_marks INTEGER DEFAULT 0;
      ALTER TABLE marks ADD COLUMN IF NOT EXISTS cq_marks INTEGER DEFAULT 0;
      ALTER TABLE marks ADD COLUMN IF NOT EXISTS mcq_marks INTEGER DEFAULT 0;

      -- Relax unique constraints on subjectcode and student email
      ALTER TABLE marks DROP CONSTRAINT IF EXISTS fk_marks_subject;
      ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_subject;
      ALTER TABLE subject DROP CONSTRAINT IF EXISTS subject_subjectcode_unique;
      ALTER TABLE students DROP CONSTRAINT IF EXISTS students_emailid_unique;
      ALTER TABLE students ALTER COLUMN emailid DROP NOT NULL;
    `);
    console.log("Schema alterations executed successfully!");
  } catch (e) {
    console.log("Schema alteration note:", e.message);
  }

  // 2. Clear out legacy college data (BCA, IT, CSE)
  await db.query(`DELETE FROM marks`);
  await db.query(`DELETE FROM attendance`);
  await db.query(`DELETE FROM subject`);
  await db.query(`DELETE FROM students`);
  await db.query(`DELETE FROM courses`);

  // 3. Insert Bangladesh Secondary School Classes
  const schoolClasses = [
    { code: 'CLASS-6', name: 'Class 6 (৬ষ্ঠ শ্রেণি)', year: '2026' },
    { code: 'CLASS-7', name: 'Class 7 (৭ম শ্রেণি)', year: '2026' },
    { code: 'CLASS-8', name: 'Class 8 (৮ম শ্রেণি)', year: '2026' },
    { code: 'CLASS-9-SCI', name: 'Class 9 - Science (৯ম শ্রেণি - বিজ্ঞান)', year: '2026' },
    { code: 'CLASS-9-ARTS', name: 'Class 9 - Humanities/Arts (৯ম শ্রেণি - মানবিক)', year: '2026' },
    { code: 'CLASS-10-SCI', name: 'Class 10 - Science (১০ম শ্রেণি - বিজ্ঞান)', year: '2026' },
    { code: 'CLASS-10-ARTS', name: 'Class 10 - Humanities/Arts (১০ম শ্রেণি - মানবিক)', year: '2026' },
  ];

  for (const c of schoolClasses) {
    await db.query(`
      INSERT INTO courses (course_code, course_name, total_semesters, sem_or_year, academic_year)
      VALUES ($1, $2, 2, 'sem', $3)
      ON CONFLICT (course_code)
      DO UPDATE SET course_name = EXCLUDED.course_name, total_semesters = 2, academic_year = EXCLUDED.academic_year
    `, [c.code, c.name, c.year]);
  }
  console.log('Classes created successfully!');

  // 4. Populate Subjects for all classes
  async function addSub(code, name, cource, sem, type, th, pr, cq, mcq) {
    await db.query(`
      INSERT INTO subject 
      (subjectcode, subjectname, courcecode, semoryear, subjecttype, theorymarks, practicalmarks, cq_max_marks, mcq_max_marks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [code, name, cource, sem, type, th, pr, cq, mcq]);
  }

  // --- Classes 6, 7, 8 (General, identical NCTB curriculum) ---
  const juniorClasses = ['CLASS-6', 'CLASS-7', 'CLASS-8'];
  for (const cls of juniorClasses) {
    for (const term of [1, 2]) {
      await addSub('BAN-101', 'Bangla 1st Paper (বাংলা ১ম পত্র)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('BAN-102', 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ENG-107', 'English 1st Paper (ইংরেজি ১ম পত্র)', cls, term, 'core', 100, 0, 0, 0);
      await addSub('ENG-108', 'English 2nd Paper (ইংরেজি ২য় পত্র)', cls, term, 'core', 100, 0, 0, 0);
      await addSub('MAT-109', 'Mathematics (গণিত)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('SCI-127', 'General Science (সাধারণ বিজ্ঞান)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('BGS-150', 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('REL-111', 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ICT-154', 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cls, term, 'core', 25, 25, 0, 25);
      await addSub('AGR-134', 'Agriculture Studies (কৃষি শিক্ষা)', cls, term, 'core', 100, 0, 70, 30);
    }
  }
  console.log('Junior classes (6-8) subjects inserted!');

  // --- Class 9 & 10 Science ---
  const sciClasses = ['CLASS-9-SCI', 'CLASS-10-SCI'];
  for (const cls of sciClasses) {
    for (const term of [1, 2]) {
      await addSub('BAN-101', 'Bangla 1st Paper (বাংলা ১ম পত্র)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('BAN-102', 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ENG-107', 'English 1st Paper (ইংরেজি ১ম পত্র)', cls, term, 'core', 100, 0, 0, 0);
      await addSub('ENG-108', 'English 2nd Paper (ইংরেজি ২য় পত্র)', cls, term, 'core', 100, 0, 0, 0);
      await addSub('MAT-109', 'Mathematics (গণিত)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('PHY-136', 'Physics (পদার্থবিজ্ঞান)', cls, term, 'core', 75, 25, 50, 25);
      await addSub('CHE-137', 'Chemistry (রসায়ন)', cls, term, 'core', 75, 25, 50, 25);
      await addSub('BIO-138', 'Biology (জীববিজ্ঞান)', cls, term, 'core', 75, 25, 50, 25);
      await addSub('HMT-126', 'Higher Mathematics (উচ্চতর গণিত)', cls, term, 'core', 75, 25, 50, 25);
      await addSub('BGS-150', 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('REL-111', 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ICT-154', 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cls, term, 'core', 25, 25, 0, 25);
    }
  }
  console.log('Science classes (9-10) subjects inserted!');

  // --- Class 9 & 10 Humanities/Arts ---
  const artsClasses = ['CLASS-9-ARTS', 'CLASS-10-ARTS'];
  for (const cls of artsClasses) {
    for (const term of [1, 2]) {
      await addSub('BAN-101', 'Bangla 1st Paper (বাংলা ১ম পত্র)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('BAN-102', 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ENG-107', 'English 1st Paper (ইংরেজি ১ম পত্র)', cls, term, 'core', 100, 0, 0, 0);
      await addSub('ENG-108', 'English 2nd Paper (ইংরেজি ২য় পত্র)', cls, term, 'core', 100, 0, 0, 0);
      await addSub('MAT-109', 'Mathematics (গণিত)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('SCI-127', 'General Science (সাধারণ বিজ্ঞান)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('HIS-153', 'History of Bangladesh & World Civilization (বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('GEO-110', 'Geography & Environment (ভূগোল ও পরিবেশ)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('CIV-140', 'Civics & Citizenship (পৌরনীতি ও নাগরিকতা)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ECO-141', 'Economics (অর্থনীতি)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('REL-111', 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cls, term, 'core', 100, 0, 70, 30);
      await addSub('ICT-154', 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cls, term, 'core', 25, 25, 0, 25);
      await addSub('AGR-134', 'Agriculture Studies (কৃষি শিক্ষা)', cls, term, 'core', 75, 25, 50, 25);
    }
  }
  console.log('Humanities classes (9-10) subjects inserted!');

  // 5. Insert Students for Dimla Government Girls' High School
  const bcrypt = require('./backend/node_modules/bcrypt');
  const defaultPass = await bcrypt.hash('123456', 10);

  const sampleStudents = [
    // Class 6
    { roll: 601, fn: 'Nusrat', ln: 'Jahan', cls: 'CLASS-6', dob: '2014-02-10', dad: 'Md. Nazrul Islam', mom: 'Mst. Nasima Begum', ph: '01711000601' },
    { roll: 602, fn: 'Farhana', ln: 'Akter', cls: 'CLASS-6', dob: '2014-04-15', dad: 'Md. Faruk Hossain', mom: 'Mst. Parvin Akter', ph: '01711000602' },
    
    // Class 7
    { roll: 701, fn: 'Tanjila', ln: 'Islam', cls: 'CLASS-7', dob: '2013-03-20', dad: 'Md. Tariqul Islam', mom: 'Mst. Taslima Khatun', ph: '01711000701' },
    { roll: 702, fn: 'Marufa', ln: 'Yeasmin', cls: 'CLASS-7', dob: '2013-05-12', dad: 'Md. Mizanur Rahman', mom: 'Mst. Moriyom Begum', ph: '01711000702' },

    // Class 8
    { roll: 801, fn: 'Jannatul', ln: 'Ferdous', cls: 'CLASS-8', dob: '2012-01-18', dad: 'Md. Rafiqul Islam', mom: 'Mst. Rehana Begum', ph: '01711000801' },
    { roll: 802, fn: 'Sadia', ln: 'Afrin', cls: 'CLASS-8', dob: '2012-07-22', dad: 'Md. Shahjahan Ali', mom: 'Mst. Salma Khatun', ph: '01711000802' },

    // Class 9 Science
    { roll: 901, fn: 'Tasnim', ln: 'Rahman', cls: 'CLASS-9-SCI', dob: '2011-06-14', dad: 'Md. Touhidur Rahman', mom: 'Mst. Tahmina Begum', ph: '01711000901' },
    { roll: 902, fn: 'Ritu', ln: 'Roy', cls: 'CLASS-9-SCI', dob: '2011-09-05', dad: 'Bikash Chandra Roy', mom: 'Shikha Rani Roy', ph: '01711000902' },

    // Class 9 Arts
    { roll: 951, fn: 'Amina', ln: 'Khatun', cls: 'CLASS-9-ARTS', dob: '2011-08-11', dad: 'Md. Abdul Alim', mom: 'Mst. Asma Bibi', ph: '01711000951' },
    { roll: 952, fn: 'Ruksana', ln: 'Parvin', cls: 'CLASS-9-ARTS', dob: '2011-12-01', dad: 'Md. Rezaul Karim', mom: 'Mst. Rahima Begum', ph: '01711000952' },

    // Class 10 Science
    { roll: 1001, fn: 'Sumaiya', ln: 'Akter', cls: 'CLASS-10-SCI', dob: '2010-03-25', dad: 'Md. Rafiqul Islam', mom: 'Mst. Rehana Begum', ph: '01711001001' },
    { roll: 1002, fn: 'Sharmin', ln: 'Sultana', cls: 'CLASS-10-SCI', dob: '2010-05-19', dad: 'Md. Shahidul Islam', mom: 'Mst. Shirin Akter', ph: '01711001002' },

    // Class 10 Arts
    { roll: 1051, fn: 'Mst. Bilkis', ln: 'Banu', cls: 'CLASS-10-ARTS', dob: '2010-07-14', dad: 'Md. Belal Hossain', mom: 'Mst. Bano Begum', ph: '01711001051' },
    { roll: 1052, fn: 'Fatema', ln: 'Tuj Johura', cls: 'CLASS-10-ARTS', dob: '2010-11-30', dad: 'Md. Fazlul Haque', mom: 'Mst. Jahanara Begum', ph: '01711001052' },
  ];

  for (const s of sampleStudents) {
    await db.query(`
      INSERT INTO students 
      (courcecode, semoryear, rollnumber, firstname, lastname, emailid, contactnumber, dateofbirth, gender, state, city, fathername, mothername, password, activestatus, admissiondate, academic_year)
      VALUES ($1, 1, $2, $3, $4, NULL, $5, $6, 'Female', 'Rangpur', 'Nilphamari', $7, $8, $9, 1, '2026-01-01', '2026')
    `, [s.cls, s.roll, s.fn, s.ln, s.ph, s.dob, s.dad, s.mom, defaultPass]);
  }
  console.log('Sample students created across all classes!');

  // 6. Seed demo marks for student 1001 (Class 10 Science)
  const demoMarks1001 = [
    { code: 'BAN-101', name: 'Bangla 1st Paper (বাংলা ১ম পত্র)', cq: 62, mcq: 26, pr: 0, th: 88 },
    { code: 'BAN-102', name: 'Bangla 2nd Paper (বাংলা ২য় পত্র)', cq: 64, mcq: 27, pr: 0, th: 91 },
    { code: 'ENG-107', name: 'English 1st Paper (ইংরেজি ১ম পত্র)', cq: 0, mcq: 0, pr: 0, th: 88 },
    { code: 'ENG-108', name: 'English 2nd Paper (ইংরেজি ২য় পত্র)', cq: 0, mcq: 0, pr: 0, th: 85 },
    { code: 'MAT-109', name: 'Mathematics (গণিত)', cq: 68, mcq: 28, pr: 0, th: 96 },
    { code: 'PHY-136', name: 'Physics (পদার্থবিজ্ঞান)', cq: 46, mcq: 23, pr: 24, th: 69 },
    { code: 'CHE-137', name: 'Chemistry (রসায়ন)', cq: 45, mcq: 24, pr: 25, th: 69 },
    { code: 'BIO-138', name: 'Biology (জীববিজ্ঞান)', cq: 48, mcq: 23, pr: 24, th: 71 },
    { code: 'HMT-126', name: 'Higher Mathematics (উচ্চতর গণিত)', cq: 47, mcq: 24, pr: 25, th: 71 },
    { code: 'BGS-150', name: 'Bangladesh & Global Studies (বাংলাদেশ ও বিশ্বপরিচয়)', cq: 65, mcq: 27, pr: 0, th: 92 },
    { code: 'REL-111', name: 'Islam & Moral Education (ইসলাম ও নৈতিক শিক্ষা)', cq: 66, mcq: 28, pr: 0, th: 94 },
    { code: 'ICT-154', name: 'Information & Communication Technology (তথ্য ও যোগাযোগ প্রযুক্তি)', cq: 0, mcq: 24, pr: 24, th: 24 },
  ];

  for (const m of demoMarks1001) {
    await db.query(`
      INSERT INTO marks (courcecode, semoryear, subjectcode, subjectname, rollnumber, theorymarks, practicalmarks, cq_marks, mcq_marks)
      VALUES ('CLASS-10-SCI', 1, $1, $2, 1001, $3, $4, $5, $6)
    `, [m.code, m.name, m.th, m.pr, m.cq, m.mcq]);
  }
  console.log('Demo marks seeded for Roll 1001!');

  console.log("=== All setup completed successfully! ===");
  process.exit(0);
}

setupBangladeshSchool().catch(err => {
  console.error("Setup error:", err);
  process.exit(1);
});
