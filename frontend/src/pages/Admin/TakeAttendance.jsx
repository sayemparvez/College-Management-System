import { useEffect, useState, useMemo } from "react";
import api from "../../utils/api";
import ConfirmSaveModal from "../../components/modals/ConfirmSaveModal.jsx";
import Toast from "../../components/ui/Toast.jsx";
import {
    CheckSquare,
    Filter,
    RotateCcw,
    Save,
    AlertCircle,
    ListChecks,
    CheckCircle2,
    Users,
    Calendar,
    BookOpen
} from "lucide-react";

const TakeAttendance = () => {
    const token = localStorage.getItem("token");

    const getTodayString = () => {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, "0");
        const d = String(today.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const [attendanceType, setAttendanceType] = useState("class"); // "class" | "exam"
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [existingDates, setExistingDates] = useState([]);

    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedSem, setSelectedSem] = useState("1");
    // Optional second class for combined attendance (e.g. Class 9 Sci + Class 9 Arts)
    const [selectedCourse2, setSelectedCourse2] = useState("");
    const [selectedDate, setSelectedDate] = useState(getTodayString());

    const [markMode, setMarkMode] = useState("present");
    const [checkedStudents, setCheckedStudents] = useState({});

    const [loadingStudents, setLoadingStudents] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);
    const [showSaveModal, setShowSaveModal] = useState(false);

    // Dynamic subjectcode based on type
    const activeSubjectCode = attendanceType === "class" ? "DAILY_1ST" : `EXAM_TERM_${selectedSem}`;

    /* ================= RESET ================= */
    const handleReset = () => {
        setSelectedCourse("");
        setSelectedSem("1");
        setSelectedCourse2("");
        setSelectedDate(getTodayString());
        setCheckedStudents({});
        setExistingDates([]);
        setStudents([]);
        setError("");
    };

    /* ================= FETCH COURSES ================= */
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const res = await api.get("/api/courses", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCourses(res.data || []);
            } catch {
                setError("Failed to load classes.");
            }
        };
        fetchCourses();
    }, [token]);

    /* ================= DERIVED SEM/YEAR OPTIONS ================= */
    const selectedCourseObj = useMemo(() => {
        return courses.find(c => c.course_code === selectedCourse);
    }, [courses, selectedCourse]);

    const semLabel =
        selectedCourseObj?.sem_or_year?.toLowerCase() === "year"
            ? "Year"
            : "Semester";

    const semesterOptions = useMemo(() => {
        if (!selectedCourseObj) return [];
        const total = Number(selectedCourseObj.total_semesters);
        return Array.from({ length: total }, (_, i) => i + 1);
    }, [selectedCourseObj]);

    /* ================= FETCH STUDENTS ================= */
    useEffect(() => {
        if (!selectedCourse) {
            setStudents([]);
            setCheckedStudents({});
            return;
        }

        const fetchStudents = async () => {
            try {
                setLoadingStudents(true);
                setError("");

                // Build URL: if second class is also selected, use multi-course param
                let url;
                if (selectedCourse2 && selectedCourse2 !== selectedCourse) {
                    url = `/api/attendance/students?courses=${selectedCourse},${selectedCourse2}&sem=${selectedSem}`;
                } else {
                    url = `/api/attendance/students?course=${selectedCourse}&sem=${selectedSem}`;
                }

                const res = await api.get(url, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStudents(res.data || []);
                setCheckedStudents({});
            } catch {
                setError("Failed to load students.");
            } finally {
                setLoadingStudents(false);
            }
        };

        fetchStudents();
    }, [selectedCourse, selectedCourse2, selectedSem, token]);

    /* ================= FETCH EXISTING DATES ================= */
    useEffect(() => {
        if (!selectedCourse) {
            setExistingDates([]);
            return;
        }

        const fetchDates = async () => {
            try {
                const courcecodes = selectedCourse2 && selectedCourse2 !== selectedCourse
                    ? `${selectedCourse},${selectedCourse2}`
                    : selectedCourse;

                const res = await api.get(
                    `/api/attendance/dates?subjectcode=${activeSubjectCode}&courcecode=${courcecodes}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setExistingDates(res.data.map(d => d.date));
            } catch {
                setExistingDates([]);
            }
        };

        fetchDates();
    }, [selectedCourse, selectedCourse2, selectedSem, activeSubjectCode, token]);

    /* ================= TOGGLE ================= */
    const toggleStudent = (id) => {
        setCheckedStudents(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    /* ================= SAVE ================= */
    const saveAttendance = async () => {
        if (!selectedCourse || !selectedDate) {
            setError("Select a class and date.");
            return;
        }

        if (existingDates.includes(selectedDate)) {
            setError(`Attendance already recorded for this ${attendanceType === 'class' ? 'class' : 'exam'} on ${selectedDate}.`);
            return;
        }

        try {
            const records = students.map(student => {
                const isChecked = !!checkedStudents[student.student_id];
                return {
                    student_id: student.student_id,
                    present:
                        markMode === "present"
                            ? (isChecked ? 1 : 0)
                            : (isChecked ? 0 : 1)
                };
            });

            await api.post(
                "/api/attendance",
                {
                    subjectcode: activeSubjectCode,
                    date: selectedDate,
                    courcecode: selectedCourse,
                    semoryear: Number(selectedSem),
                    records
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setToast({ 
                type: "success", 
                message: `${attendanceType === 'class' ? 'দৈনিক ক্লাস হাজিরা' : 'পরীক্ষার হাজিরা'} সফলভাবে সংরক্ষিত হয়েছে!` 
            });
            setError("");
            setCheckedStudents({});

            // Refresh existing dates
            const courcecodes = selectedCourse2 && selectedCourse2 !== selectedCourse
                ? `${selectedCourse},${selectedCourse2}`
                : selectedCourse;

            const res = await api.get(
                `/api/attendance/dates?subjectcode=${activeSubjectCode}&courcecode=${courcecodes}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setExistingDates(res.data.map(d => d.date));

        } catch (err) {
            const apiError = err.response?.data?.message || "Failed to save attendance.";
            setError(apiError);
            setToast({ type: "error", message: apiError });
        }
    };

    // Group students by class for combined view
    const studentsByClass = useMemo(() => {
        const groups = {};
        students.forEach(s => {
            const key = s.courcecode || "Unknown";
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
        return groups;
    }, [students]);

    const isMultiClass = Object.keys(studentsByClass).length > 1;

    // Optional second class choices
    const course2Options = useMemo(() => {
        return courses.filter(c => c.course_code !== selectedCourse);
    }, [courses, selectedCourse]);

    const isFormReady = selectedCourse && selectedDate;
    const isDateAlreadyTaken = existingDates.includes(selectedDate);

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">

            {/* HEADER */}
            <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg shadow-md ${
                            attendanceType === 'class' 
                                ? "bg-blue-600 text-white shadow-blue-500/20" 
                                : "bg-purple-600 text-white shadow-purple-500/20"
                        }`}>
                            <CheckSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">
                                {attendanceType === 'class' 
                                    ? "Daily Class Attendance (1st Period)" 
                                    : "Exam Attendance (পরীক্ষার হাজিরা)"}
                            </h1>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">
                                {attendanceType === 'class' 
                                    ? "Class Teacher • ১ম পিরিয়ড (দৈনিক ক্লাস হাজিরা)" 
                                    : "Exam Hall • পরীক্ষার হলের উপস্থিতি"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reset Form</span>
                    </button>
                </div>
            </header>

            {/* MAIN */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6">

                {/* ATTENDANCE TYPE TOGGLE */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                            হাজিরার ধরন (Attendance Type):
                        </span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => { setAttendanceType("class"); setError(""); }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                attendanceType === "class"
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <CheckSquare className="w-3.5 h-3.5" />
                            ক্লাস হাজিরা (দৈনিক ১ম পিরিয়ড)
                        </button>

                        <button
                            type="button"
                            onClick={() => { setAttendanceType("exam"); setError(""); }}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                attendanceType === "exam"
                                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            পরীক্ষার হাজিরা (Exam Attendance)
                        </button>
                    </div>
                </div>

                {/* Info Banner */}
                {attendanceType === "class" ? (
                    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
                        <CheckSquare className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <div>
                            <span className="font-semibold">বাংলাদেশ বিদ্যালয় নীতিমালা (Daily Attendance Policy):</span>{" "}
                            বিদ্যালয়ে শুধুমাত্র প্রথম পিরিয়ডে শ্রেণি শিক্ষক কর্তৃক শিক্ষার্থীদের নিয়মিত দৈনিক হাজিরা গ্রহণ করা হয়।
                            প্রথম পিরিয়ডে বিজ্ঞান ও মানবিক উভয় গ্রুপের শিক্ষার্থীরা একত্রে উপস্থিত হলে "Combined with another class" ব্যবহার করুন।
                            একবার সাবমিট করার পর শুধুমাত্র অ্যাডমিন হাজিরা এডিট বা সংশোধন করতে পারবেন।
                        </div>
                    </div>
                ) : (
                    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-purple-800 dark:text-purple-300">
                        <BookOpen className="w-4 h-4 mt-0.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <div>
                            <span className="font-semibold">পরীক্ষার হলের উপস্থিতি (Examination Attendance):</span>{" "}
                            পরীক্ষার দিনে হলের পরীক্ষার্থীদের উপস্থিতি নিশ্চিত করার জন্য সংশ্লিষ্ট পরীক্ষা (অর্ধ-বার্ষিক বা বার্ষিক) নির্বাচন করে হাজিরা গ্রহণ করুন।
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold animate-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* Already taken warning */}
                {isDateAlreadyTaken && selectedCourse && (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-sm font-semibold">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>
                            {attendanceType === 'class' ? "দৈনিক ক্লাস হাজিরা" : "পরীক্ষার হাজিরা"} ইতিমধ্যে এই তারিখে ({selectedDate}) গ্রহণ করা হয়েছে। নতুন করে নিতে অন্য তারিখ নির্বাচন করুন।
                        </p>
                    </div>
                )}

                {/* FILTER CARD */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-4 h-4 text-blue-500" />
                        <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                            Parameters & Filters
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                        {/* Class */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Class (শ্রেণি)
                            </label>
                            <select
                                value={selectedCourse}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedCourse(val);
                                    if (val === "CLASS-9-SCI") setSelectedCourse2("CLASS-9-ARTS");
                                    else if (val === "CLASS-9-ARTS") setSelectedCourse2("CLASS-9-SCI");
                                    else if (val === "CLASS-10-SCI") setSelectedCourse2("CLASS-10-ARTS");
                                    else if (val === "CLASS-10-ARTS") setSelectedCourse2("CLASS-10-SCI");
                                    else setSelectedCourse2("");
                                    setError("");
                                }}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-semibold"
                            >
                                <option value="">Select Class / শ্রেণি...</option>
                                {courses.map(course => (
                                    <option key={course.id} value={course.course_code}>
                                        {course.course_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Term / Exam (or Regular Year) */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                {attendanceType === "exam" ? "Examination Term (পরীক্ষা)" : "শিক্ষাবর্ষ (Academic Year)"}
                            </label>
                            <select
                                value={selectedSem}
                                onChange={(e) => { setSelectedSem(e.target.value); setError(""); }}
                                disabled={!selectedCourse}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 disabled:opacity-40 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-semibold"
                            >
                                {attendanceType === "class" ? (
                                    <option value="1">নিয়মিত পাঠদান (Daily Session 1)</option>
                                ) : (
                                    semesterOptions.map(s => (
                                        <option key={s} value={s}>
                                            {s === 1 ? "Half Yearly Exam (অর্ধ-বার্ষিক পরীক্ষা)" : "Final Exam (বার্ষিক পরীক্ষা)"}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Combined Class (optional) */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Combined with (ঐচ্ছিক)
                            </label>
                            <select
                                value={selectedCourse2}
                                onChange={(e) => { setSelectedCourse2(e.target.value); setError(""); }}
                                disabled={!selectedCourse}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 disabled:opacity-40 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                <option value="">— None (একক শ্রেণি) —</option>
                                {course2Options.map(course => (
                                    <option key={course.id} value={course.course_code}>
                                        {course.course_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Date (তারিখ)
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => { setSelectedDate(e.target.value); setError(""); }}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Mode */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Attendance Mode (হাজিরা মোড)
                            </label>
                            <select
                                value={markMode}
                                onChange={(e) => setMarkMode(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                            >
                                <option value="present">Check = Present (টিক = উপস্থিত)</option>
                                <option value="absent">Check = Absent (টিক = অনুপস্থিত)</option>
                            </select>
                        </div>

                        {isMultiClass && (
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 font-semibold self-end">
                                <Users className="w-4 h-4 flex-shrink-0" />
                                <span>
                                    যৌথ হাজিরা (Combined): {Object.keys(studentsByClass).join(" + ")} — মোট {students.length} জন শিক্ষার্থী
                                </span>
                            </div>
                        )}
                    </div>
                </section>

                {/* ATTENDANCE LEDGER */}
                {isFormReady ? (
                    loadingStudents ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center px-4 shadow-sm">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Loading students...</p>
                        </div>
                    ) : (
                        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                                <table className="w-full table-fixed">
                                    <thead>
                                        <tr>
                                            <th className="w-[25%] sm:w-[20%] px-4 sm:px-6 py-4 text-left text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Roll No
                                            </th>
                                            <th className="w-[45%] sm:w-[45%] px-2 sm:px-4 py-4 text-left text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Student Name
                                            </th>
                                            {isMultiClass && (
                                                <th className="hidden sm:table-cell sm:w-[15%] px-2 py-4 text-left text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                    Class
                                                </th>
                                            )}
                                            <th className={`${isMultiClass ? 'w-[30%] sm:w-[20%]' : 'w-[30%] sm:w-[35%]'} px-4 sm:px-6 py-4 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider`}>
                                                {markMode === "present" ? "Present" : "Absent"}
                                            </th>
                                        </tr>
                                    </thead>
                                </table>
                            </div>

                            <div className="w-full">
                                <table className="w-full table-fixed">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {students.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                                                    No students enrolled in this class.
                                                </td>
                                            </tr>
                                        ) : (
                                            students.map((student, idx) => (
                                                <tr
                                                    key={student.student_id}
                                                    className={`${
                                                        idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/50 dark:bg-slate-800/20"
                                                    } hover:bg-blue-50/50 dark:hover:bg-blue-500/5 transition-colors cursor-pointer`}
                                                    onClick={() => toggleStudent(student.student_id)}
                                                >
                                                    <td className="w-[25%] sm:w-[20%] px-4 sm:px-6 py-4">
                                                        <div className="text-[11px] sm:text-xs font-mono font-bold text-slate-600 dark:text-slate-400 truncate">
                                                            {student.rollnumber}
                                                        </div>
                                                    </td>
                                                    <td className="w-[45%] sm:w-[45%] px-2 sm:px-4 py-4">
                                                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                            {student.firstname} {student.lastname}
                                                        </div>
                                                    </td>
                                                    {isMultiClass && (
                                                        <td className="hidden sm:table-cell sm:w-[15%] px-2 py-4">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                student.courcecode?.toUpperCase().includes("SCI")
                                                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                                                    : student.courcecode?.toUpperCase().includes("ARTS")
                                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                                    : "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                                            }`}>
                                                                {student.courcecode?.toUpperCase().includes("SCI")
                                                                    ? "বিজ্ঞান"
                                                                    : student.courcecode?.toUpperCase().includes("ARTS")
                                                                    ? "মানবিক"
                                                                    : student.courcecode}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td
                                                        className={`${isMultiClass ? 'w-[30%] sm:w-[20%]' : 'w-[30%] sm:w-[35%]'} px-4 sm:px-6 py-4 text-center`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={!!checkedStudents[student.student_id]}
                                                            onChange={() => toggleStudent(student.student_id)}
                                                            className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 bg-white dark:bg-slate-900 focus:ring-blue-500 dark:focus:ring-blue-500/50 cursor-pointer transition-colors"
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center px-4 shadow-sm">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-4 border border-slate-100 dark:border-slate-800">
                            <ListChecks className="w-8 h-8 text-blue-500" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                            Awaiting Class Selection
                        </h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-xs">
                            Select a class from above to load the student attendance ledger.
                        </p>
                    </div>
                )}
            </main>

            {/* STICKY BOTTOM ACTION BAR */}
            {isFormReady && students.length > 0 && (
                <div className="sticky bottom-0 mt-auto w-full z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            Recording {attendanceType === 'class' ? "Class Attendance" : "Exam Attendance"} for {students.length} students
                            {isMultiClass && <span className="text-blue-500 ml-1">(Combined Classes)</span>}
                        </div>
                        <button
                            onClick={() => setShowSaveModal(true)}
                            disabled={!isFormReady || isDateAlreadyTaken}
                            className={`w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                isFormReady && !isDateAlreadyTaken
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                            }`}
                        >
                            <Save className="w-4 h-4" />
                            Save Attendance
                        </button>
                    </div>
                </div>
            )}

            {/* MODALS */}
            <ConfirmSaveModal
                show={showSaveModal}
                title="Confirm Data Sync"
                message={`Submit official ${attendanceType === 'class' ? 'Class Attendance' : 'Exam Attendance'} records for ${selectedDate}? This action logs data to the central server.`}
                confirmText="Save Records"
                onCancel={() => setShowSaveModal(false)}
                onConfirm={() => {
                    setShowSaveModal(false);
                    saveAttendance();
                }}
            />

            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
        </div>
    );
};

export default TakeAttendance;
