import { useEffect, useState, useMemo } from "react";
import api from "../../utils/api";
import ConfirmSaveModal from "../../components/modals/ConfirmSaveModal.jsx";
import ConfirmDeleteModal from "../../components/modals/ConfirmDeleteModal.jsx";
import Toast from "../../components/ui/Toast.jsx";
import { calculateNCTBGrade } from "../../utils/academicHelper.js";
import { Edit3, Filter, ListChecks, Save, RotateCcw, Trash2, UserMinus, CheckCircle2, AlertCircle } from "lucide-react";

const EditMarks = () => {
    const token = localStorage.getItem("token");

    const [courses, setCourses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [students, setStudents] = useState([]);

    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedSem, setSelectedSem] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    const [subjectDetails, setSubjectDetails] = useState(null);
    const [marks, setMarks] = useState({});

    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    // Modals
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

    /* ================= ACTION: RESET ================= */
    const handleReset = () => {
        setSelectedCourse(""); setSelectedSem(""); setSelectedSubject("");
        setStudents([]); setMarks({}); setSubjectDetails(null); setError("");
    };

    /* ================= UX HELPERS ================= */
    const preventSymbols = (e) => {
        if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 || (e.keyCode >= 35 && e.keyCode <= 39)) return;
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) e.preventDefault();
    };

    const handleEnterMove = (e) => {
        const table = e.target.closest("table");
        if (!table) return;
        const inputs = Array.from(table.querySelectorAll("input[type='number']"));
        const index = inputs.indexOf(e.target);
        if (e.key === "Enter") {
            e.preventDefault();
            if (inputs[index + 1]) { inputs[index + 1].focus(); inputs[index + 1].select(); }
        }
        if (e.key === "ArrowDown") if (inputs[index + 1]) inputs[index + 1].focus();
        if (e.key === "ArrowUp") if (inputs[index - 1]) inputs[index - 1].focus();
    };

    const handleFocus = (e) => e.target.select();

    /* ================= DATA ENGINE ================= */
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const res = await api.get("/api/courses", { headers: { Authorization: `Bearer ${token}` } });
                setCourses(res.data || []);
            } catch { setCourses([]); }
        };
        fetchCourses();
    }, [token]);

    const isClass10 = useMemo(() => String(selectedCourse).toUpperCase().includes("10"), [selectedCourse]);

    const examOptions = useMemo(() => {
        if (!selectedCourse) return [];
        if (isClass10) {
            return [
                { id: 1, name: "Pre-Test Exam (প্রাক-নির্বাচনী)" },
                { id: 2, name: "Test Exam (নির্বাচনী পরীক্ষা)" }
            ];
        }
        return [
            { id: 1, name: "Half Yearly Exam (অর্ধবার্ষিক)" },
            { id: 2, name: "Final Exam (বার্ষিক পরীক্ষা)" }
        ];
    }, [selectedCourse, isClass10]);

    useEffect(() => {
        if (!selectedCourse || !selectedSem) return;
        const loadSubjects = async () => {
            try {
                const res = await api.get(`/api/subjects?course_code=${selectedCourse}&sem=${selectedSem}`, { headers: { Authorization: `Bearer ${token}` } });
                setSubjects(res.data || []);
                setStudents([]); setMarks({}); setSelectedSubject(""); setSubjectDetails(null);
            } catch { setError("Failed to load subjects."); }
        };
        loadSubjects();
    }, [selectedCourse, selectedSem, token]);

    const handleSubjectChange = async (code) => {
        if (!code) {
            setSelectedSubject("");
            setStudents([]);
            setMarks({});
            return;
        }

        setSelectedSubject(code);
        const subject = subjects.find(s => s.subjectcode === code);
        setSubjectDetails(subject);
        setMarks({});

        try {
            const res = await api.get(`/api/marks/edit?course=${selectedCourse}&sem=${selectedSem}&subject=${code}`, { headers: { Authorization: `Bearer ${token}` } });
            setStudents(res.data || []);
            const existingMarks = {};
            res.data.forEach(student => {
                existingMarks[student.rollnumber] = {
                    cq: (student.cq_marks !== null && student.cq_marks !== undefined) ? student.cq_marks : "",
                    mcq: (student.mcq_marks !== null && student.mcq_marks !== undefined) ? student.mcq_marks : "",
                    theory: (student.theorymarks !== null && student.theorymarks !== undefined) ? student.theorymarks : "",
                    practical: (student.practicalmarks !== null && student.practicalmarks !== undefined) ? student.practicalmarks : ""
                };
            });
            setMarks(existingMarks);
            setError("");
        } catch { setError("Failed to load marks."); }
    };

    const handleMarkChange = (roll, field, value) => {
        const sanitizedValue = value === "" ? "" : Math.max(0, parseInt(value, 10));
        setMarks(prev => ({ ...prev, [roll]: { ...prev[roll], [field]: sanitizedValue } }));
    };

    const hasCQ = Number(subjectDetails?.cq_max_marks || 0) > 0;
    const hasMCQ = Number(subjectDetails?.mcq_max_marks || 0) > 0;
    const hasPractical = Number(subjectDetails?.practicalmarks || 0) > 0;
    const hasLegacyTheory = !hasCQ && !hasMCQ && Number(subjectDetails?.theorymarks || 0) > 0;

    /* ================= ACTIONS ================= */
    const handleOpenModal = () => {
        if (!subjectDetails || students.length === 0) return;
        for (const student of students) {
            const roll = student.rollnumber;
            const m = marks[roll] || {};
            if (hasCQ && (m.cq ?? "") === "") {
                setToast({ type: "error", message: `Missing CQ score for ${student.firstname}` });
                return;
            }
            if (hasMCQ && (m.mcq ?? "") === "") {
                setToast({ type: "error", message: `Missing MCQ score for ${student.firstname}` });
                return;
            }
            if (hasPractical && (m.practical ?? "") === "") {
                setToast({ type: "error", message: `Missing Practical score for ${student.firstname}` });
                return;
            }
            if (hasLegacyTheory && (m.theory ?? "") === "") {
                setToast({ type: "error", message: `Missing Theory score for ${student.firstname}` });
                return;
            }
        }
        setShowSaveModal(true);
    };

    const deleteMarks = async (rollnumber) => {
        try {
            await api.delete("/api/marks/delete", {
                headers: { Authorization: `Bearer ${token}` },
                data: { course: selectedCourse, sem: selectedSem, subject: selectedSubject, rollnumber }
            });
            setStudents(prev => prev.filter(s => s.rollnumber !== rollnumber));
            setToast({ type: "success", message: "Student marks deleted successfully." });
        } catch { setToast({ type: "error", message: "Delete operation failed." }); }
    };

    const deleteAllMarks = async () => {
        try {
            await api.delete("/api/marks/delete-subject", {
                headers: { Authorization: `Bearer ${token}` },
                data: { course: selectedCourse, sem: selectedSem, subject: selectedSubject }
            });
            handleReset();
            setToast({ type: "success", message: "All subject marks purged." });
        } catch { setToast({ type: "error", message: "Bulk delete failed." }); }
    };

    const updateMarks = async () => {
        try {
            const records = students.map(student => {
                const m = marks[student.rollnumber] || {};
                const cq = Number(m.cq) || 0;
                const mcq = Number(m.mcq) || 0;
                const practical = hasPractical ? (Number(m.practical) || 0) : 0;
                const theory = hasLegacyTheory ? (Number(m.theory) || 0) : (cq + mcq);

                return {
                    rollnumber: student.rollnumber,
                    cq_marks: cq,
                    mcq_marks: mcq,
                    theorymarks: theory,
                    practicalmarks: practical
                };
            });

            await api.put("/api/marks/update", {
                course: selectedCourse,
                sem: Number(selectedSem),
                subject: selectedSubject,
                marks: records
            }, { headers: { Authorization: `Bearer ${token}` } });

            setToast({ type: "success", message: "Marks updated successfully!" });
            setShowSaveModal(false);
        } catch { setToast({ type: "error", message: "Synchronization failed." }); }
    };

        const theoryMax = (Number(subjectDetails?.cq_max_marks || 0) + Number(subjectDetails?.mcq_max_marks || 0)) > 0
        ? (Number(subjectDetails?.cq_max_marks || 0) + Number(subjectDetails?.mcq_max_marks || 0))
        : Number(subjectDetails?.theorymarks || 0);
    const practicalMax = Number(subjectDetails?.practicalmarks || 0);
    const maxTotal = theoryMax + practicalMax;

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">

            {/* PLATFORM HEADER */}
            <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-500/20">
                            <Edit3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">Edit Marks (নম্বর সংশোধন)</h1>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">Dimla Government Girls' High School</p>
                        </div>
                    </div>
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset Form</span>
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6">

                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* FILTER CARD */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Record Selection</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Class (শ্রেণি)</label>
                            <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); setSelectedSem(""); setError(""); }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer">
                                <option value="">Select Class...</option>
                                {courses.map(course => <option key={course.id} value={course.course_code}>{course.course_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Examination (পরীক্ষা)</label>
                            <select value={selectedSem} disabled={!selectedCourse} onChange={(e) => { setSelectedSem(e.target.value); setSelectedSubject(""); setError(""); }}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer">
                                <option value="">Select Exam...</option>
                                {examOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Subject (বিষয়)</label>
                            <select value={selectedSubject} disabled={!selectedSem} onChange={(e) => handleSubjectChange(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm disabled:opacity-50 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer">
                                <option value="">Select Subject...</option>
                                {subjects.map(sub => <option key={sub.subjectcode} value={sub.subjectcode}>{sub.subjectname}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {selectedSubject && students.length > 0 ? (
                    /* DATA TABLE */
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
                        
                        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">{subjectDetails?.subjectname}</span>
                                <span className="text-xs text-slate-500 ml-2 font-mono">({selectedSubject})</span>
                            </div>
                            <div className="flex gap-2 text-xs">
                                {hasCQ && <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">CQ: {subjectDetails.cq_max_marks}</span>}
                                {hasMCQ && <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold">MCQ: {subjectDetails.mcq_max_marks}</span>}
                                {hasLegacyTheory && <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold">Written: {subjectDetails.theorymarks}</span>}
                                {hasPractical && <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold">Practical: {subjectDetails.practicalmarks}</span>}
                                <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">Total: {maxTotal}</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-4 py-3.5">Student</th>
                                    {hasCQ && <th className="px-3 py-3.5 text-center">CQ (সৃজনশীল) <br/><span className="text-[10px] text-slate-400">/{subjectDetails.cq_max_marks}</span></th>}
                                    {hasMCQ && <th className="px-3 py-3.5 text-center">MCQ (নৈর্ব্যক্তিক) <br/><span className="text-[10px] text-slate-400">/{subjectDetails.mcq_max_marks}</span></th>}
                                    {hasLegacyTheory && <th className="px-3 py-3.5 text-center">Written (লিখিত) <br/><span className="text-[10px] text-slate-400">/{subjectDetails.theorymarks}</span></th>}
                                    {hasPractical && <th className="px-3 py-3.5 text-center">Practical (ব্যবহারিক) <br/><span className="text-[10px] text-slate-400">/{subjectDetails.practicalmarks}</span></th>}
                                    <th className="px-3 py-3.5 text-center">Total Score <br/><span className="text-[10px] text-slate-400">/{maxTotal}</span></th>
                                    <th className="px-3 py-3.5 text-center">Grade</th>
                                    <th className="px-3 py-3.5 text-center">Purge</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {students.map((student, idx) => {
                                    const m = marks[student.rollnumber] || {};
                                    const cqVal = m.cq;
                                    const mcqVal = m.mcq;
                                    const practVal = m.practical;
                                    const theoryVal = m.theory;

                                    const cqNum = Number(cqVal) || 0;
                                    const mcqNum = Number(mcqVal) || 0;
                                    const practNum = Number(practVal) || 0;
                                    const theoryNum = Number(theoryVal) || 0;

                                    const total = hasLegacyTheory ? (theoryNum + practNum) : (cqNum + mcqNum + practNum);
                                    const { grade } = calculateNCTBGrade(total, maxTotal);

                                    const isCqErr = hasCQ && Number(cqVal) > Number(subjectDetails?.cq_max_marks);
                                    const isMcqErr = hasMCQ && Number(mcqVal) > Number(subjectDetails?.mcq_max_marks);
                                    const isPractErr = hasPractical && Number(practVal) > Number(subjectDetails?.practicalmarks);

                                    return (
                                        <tr key={student.rollnumber} className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/50 dark:bg-slate-800/20'} hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-colors`}>
                                            <td className="px-4 py-3">
                                                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{student.firstname} {student.lastname}</div>
                                                <div className="text-[11px] text-slate-500 font-mono">Roll: {student.rollnumber}</div>
                                            </td>

                                            {hasCQ && (
                                                <td className="px-3 py-3 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        value={cqVal ?? ""}
                                                        onChange={(e) => handleMarkChange(student.rollnumber, "cq", e.target.value)}
                                                        onKeyDown={(e) => { preventSymbols(e); handleEnterMove(e); }}
                                                        onFocus={handleFocus}
                                                        className={`w-16 sm:w-20 px-2 py-1.5 bg-white dark:bg-slate-950 border rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all
                                                            ${isCqErr ? 'border-red-500 ring-2 ring-red-500/50 text-red-600' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'}`}
                                                    />
                                                </td>
                                            )}

                                            {hasMCQ && (
                                                <td className="px-3 py-3 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        value={mcqVal ?? ""}
                                                        onChange={(e) => handleMarkChange(student.rollnumber, "mcq", e.target.value)}
                                                        onKeyDown={(e) => { preventSymbols(e); handleEnterMove(e); }}
                                                        onFocus={handleFocus}
                                                        className={`w-16 sm:w-20 px-2 py-1.5 bg-white dark:bg-slate-950 border rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all
                                                            ${isMcqErr ? 'border-red-500 ring-2 ring-red-500/50 text-red-600' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'}`}
                                                    />
                                                </td>
                                            )}

                                            {hasLegacyTheory && (
                                                <td className="px-3 py-3 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        value={theoryVal ?? ""}
                                                        onChange={(e) => handleMarkChange(student.rollnumber, "theory", e.target.value)}
                                                        onKeyDown={(e) => { preventSymbols(e); handleEnterMove(e); }}
                                                        onFocus={handleFocus}
                                                        className="w-16 sm:w-20 px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all focus:border-indigo-500"
                                                    />
                                                </td>
                                            )}

                                            {hasPractical && (
                                                <td className="px-3 py-3 text-center align-middle">
                                                    <input
                                                        type="number"
                                                        value={practVal ?? ""}
                                                        onChange={(e) => handleMarkChange(student.rollnumber, "practical", e.target.value)}
                                                        onKeyDown={(e) => { preventSymbols(e); handleEnterMove(e); }}
                                                        onFocus={handleFocus}
                                                        className={`w-16 sm:w-20 px-2 py-1.5 bg-white dark:bg-slate-950 border rounded-lg text-sm text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all
                                                            ${isPractErr ? 'border-red-500 ring-2 ring-red-500/50 text-red-600' : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500'}`}
                                                    />
                                                </td>
                                            )}

                                            <td className="px-3 py-3 text-center align-middle">
                                                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                                    {total}
                                                </span>
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                    grade === 'A+' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                                    grade === 'F' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                }`}>
                                                    {grade}
                                                </span>
                                            </td>

                                            <td className="px-3 py-3 text-center align-middle">
                                                <button onClick={() => setStudentToDelete(student.rollnumber)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all" title="Delete record">
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* EMPTY STATE */
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center px-4 shadow-sm">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-4 border border-slate-100 dark:border-slate-800">
                            <ListChecks className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Modify Existing Grades</h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-xs">Complete the parameters above to retrieve student marks for editing.</p>
                    </div>
                )}
            </main>

            {/* STICKY BOTTOM ACTION BAR */}
            {selectedSubject && students.length > 0 && (
                <div className="sticky bottom-0 mt-auto w-full z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Synchronizing {students.length} records
                        </div>
                        <div className="flex w-full sm:w-auto items-center justify-end gap-3">
                            <button onClick={() => setShowDeleteAllModal(true)}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Trash2 className="w-4 h-4" /> Delete All Records
                            </button>
                            <button onClick={handleOpenModal}
                                    className="w-full sm:w-auto px-8 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> Update Subject Marks
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS & TOASTS */}
            <ConfirmSaveModal show={showSaveModal} title="Confirm Update" message="Are you sure you want to update student marks? This will sync changes to the database." confirmText="Update" onCancel={() => setShowSaveModal(false)} onConfirm={updateMarks} />
            <ConfirmDeleteModal show={!!studentToDelete} title="Delete Record" message="Are you sure you want to delete this specific student's score from this subject?" onCancel={() => setStudentToDelete(null)} onConfirm={() => { deleteMarks(studentToDelete); setStudentToDelete(null); }} />
            <ConfirmDeleteModal show={showDeleteAllModal} title="Wipe Subject Data" message="WARNING: This will permanently delete ALL marks recorded for this subject across all students. This cannot be undone." onCancel={() => setShowDeleteAllModal(false)} onConfirm={() => { deleteAllMarks(); setShowDeleteAllModal(false); }} />
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
        </div>
    );
};

export default EditMarks;