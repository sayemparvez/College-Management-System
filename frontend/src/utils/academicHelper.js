// Bangladesh Secondary Education (NCTB) Grading and Academic Helper

export const calculateNCTBGrade = (obtained, max) => {
    if (!max || max <= 0) return { grade: "N/A", point: 0 };
    const percentage = (obtained / max) * 100;
    if (percentage >= 80) return { grade: "A+", point: 5.0 };
    if (percentage >= 70) return { grade: "A", point: 4.0 };
    if (percentage >= 60) return { grade: "A-", point: 3.5 };
    if (percentage >= 50) return { grade: "B", point: 3.0 };
    if (percentage >= 40) return { grade: "C", point: 2.0 };
    if (percentage >= 33) return { grade: "D", point: 1.0 };
    return { grade: "F", point: 0.0 };
};

export const getGradePointAverage = (subjectsMarks) => {
    if (!subjectsMarks || subjectsMarks.length === 0) return { gpa: "0.00", grade: "F", result: "FAILED" };
    
    let totalPoints = 0;
    let hasFailed = false;

    for (const sub of subjectsMarks) {
        const total = (Number(sub.theorymarks || 0) + Number(sub.practicalmarks || 0)) || Number(sub.total || 0);
        const max = (Number(sub.theoryfull || 0) + Number(sub.practicalfull || 0)) || Number(sub.max || 100);
        const { grade, point } = calculateNCTBGrade(total, max);
        if (grade === "F") {
            hasFailed = true;
        }
        totalPoints += point;
    }

    if (hasFailed) {
        return { gpa: "0.00", grade: "F", result: "FAILED" };
    }

    const gpaVal = totalPoints / subjectsMarks.length;
    let overallGrade = "F";
    if (gpaVal >= 5.0) overallGrade = "A+";
    else if (gpaVal >= 4.0) overallGrade = "A";
    else if (gpaVal >= 3.5) overallGrade = "A-";
    else if (gpaVal >= 3.0) overallGrade = "B";
    else if (gpaVal >= 2.0) overallGrade = "C";
    else if (gpaVal >= 1.0) overallGrade = "D";

    return {
        gpa: gpaVal.toFixed(2),
        grade: overallGrade,
        result: "PASSED"
    };
};

export const getExamName = (classCode, sem) => {
    const term = Number(sem);
    const isClass10 = String(classCode || "").toUpperCase().includes("10");
    if (isClass10) {
        return term === 1 ? "Pre-Test Examination" : "Test Examination";
    }
    return term === 1 ? "Half Yearly Examination" : "Final Examination";
};

export const getExamShortName = (classCode, sem) => {
    const term = Number(sem);
    const isClass10 = String(classCode || "").toUpperCase().includes("10");
    if (isClass10) {
        return term === 1 ? "Pre-Test" : "Test";
    }
    return term === 1 ? "Half Yearly" : "Final";
};

export const SCHOOL_INFO = {
    name: "Dimla Government Girls' High School",
    nameBangla: "ডিমলা সরকারি বালিকা উচ্চ বিদ্যালয়",
    address: "Dimla, Nilphamari, Rangpur, Bangladesh",
    eiin: "125010",
    established: "1973"
};

