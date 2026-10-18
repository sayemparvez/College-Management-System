const db = require('./src/config/db');

async function fixAllSubjects() {
  console.log('Fixing all subjects marks according to Bangladesh NCTB secondary standards...');
  
  // 1. Class 6 to Class 8
  // English 1 & 2: Written only (cq=0, mcq=0, theory=100, practical=0)
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 0, mcq_max_marks = 0, theorymarks = 100, practicalmarks = 0
    WHERE courcecode IN ('CLASS-6', 'CLASS-7', 'CLASS-8')
      AND subjectcode IN ('ENG-107', 'ENG-108')
  `);

  // ICT: MCQ 25, Practical 25, Total 50
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 0, mcq_max_marks = 25, theorymarks = 25, practicalmarks = 25
    WHERE courcecode IN ('CLASS-6', 'CLASS-7', 'CLASS-8')
      AND subjectcode = 'ICT-154'
  `);

  // All other subjects in Class 6 to 8: NO PRACTICAL, CQ 70, MCQ 30, Total 100
  // (Bangla 1st, Bangla 2nd, Math, Science, BGS, Religion, Agriculture)
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 70, mcq_max_marks = 30, theorymarks = 100, practicalmarks = 0
    WHERE courcecode IN ('CLASS-6', 'CLASS-7', 'CLASS-8')
      AND subjectcode NOT IN ('ENG-107', 'ENG-108', 'ICT-154')
  `);

  // 2. Class 9 & Class 10 (Science and Arts)
  // English 1 & 2: Written only (cq=0, mcq=0, theory=100, practical=0)
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 0, mcq_max_marks = 0, theorymarks = 100, practicalmarks = 0
    WHERE courcecode IN ('CLASS-9-SCI', 'CLASS-9-ARTS', 'CLASS-10-SCI', 'CLASS-10-ARTS')
      AND subjectcode IN ('ENG-107', 'ENG-108')
  `);

  // Practical subjects in 9 & 10 (Physics, Chemistry, Biology, Higher Math, Agriculture)
  // CQ 50, MCQ 25 (Theory 75), Practical 25, Total 100
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 50, mcq_max_marks = 25, theorymarks = 75, practicalmarks = 25
    WHERE courcecode IN ('CLASS-9-SCI', 'CLASS-9-ARTS', 'CLASS-10-SCI', 'CLASS-10-ARTS')
      AND subjectcode IN ('PHY-136', 'CHE-137', 'BIO-138', 'HMT-126', 'AGR-134')
  `);

  // ICT in 9 & 10: MCQ 25, Practical 25, Total 50
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 0, mcq_max_marks = 25, theorymarks = 25, practicalmarks = 25
    WHERE courcecode IN ('CLASS-9-SCI', 'CLASS-9-ARTS', 'CLASS-10-SCI', 'CLASS-10-ARTS')
      AND subjectcode = 'ICT-154'
  `);

  // All other subjects in 9 & 10: CQ 70, MCQ 30, Theory 100, Practical 0
  // (Bangla 1st, Bangla 2nd, Math, BGS, Religion, History, Geography, Civics, Economics, Science in Arts)
  await db.query(`
    UPDATE subject 
    SET cq_max_marks = 70, mcq_max_marks = 30, theorymarks = 100, practicalmarks = 0
    WHERE courcecode IN ('CLASS-9-SCI', 'CLASS-9-ARTS', 'CLASS-10-SCI', 'CLASS-10-ARTS')
      AND subjectcode NOT IN ('ENG-107', 'ENG-108', 'ICT-154', 'PHY-136', 'CHE-137', 'BIO-138', 'HMT-126', 'AGR-134')
  `);

  console.log('All subjects successfully updated in database!');
  process.exit(0);
}

fixAllSubjects().catch(err => {
  console.error(err);
  process.exit(1);
});
