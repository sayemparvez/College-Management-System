import { useEffect, useState, useMemo } from "react";
import api from "../../utils/api";
import Toast from "../../components/ui/Toast.jsx";
import {
    GraduationCap,
    ArrowRight,
    Users,
    CheckSquare,
    Square,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    Sparkles,
    ShieldAlert
} from "lucide-react";

export default function PromoteStudents() {
    const token = localStorage.getItem("token");

    const [courses, setCourses] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [fromCourse, setFromCourse] = useState("");
    const [toCourse, setToCourse] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);

    const [loadingCourses, setLoadingCourses] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [promoting, setPromoting] = useState(false);

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    // Progression map for Dimla Government Girls' High School
    const nextClassMap = {
        "CLASS-6": "CLASS-7",
        "CLASS-7": "CLASS-8",
        "CLASS-8": "CLASS-9-SCI", // default or prompt for stream
        "CLASS-9-SCI": "CLASS-10-SCI",
        "CLASS-9-ARTS": "CLASS-10-ARTS",
    };

    // Fetch classes
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                setLoadingCourses(true);
                const res = await api.get("/api/courses", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCourses(res.data || []);
            } catch {
                setError("Failed to load classes.");
            } finally {
                setLoadingCourses(false);
            }
        };
        fetchCourses();
    }, [token]);

    // Fetch students when fromCourse changes
    useEffect(() => {
        if (!fromCourse) {
            setAllStudents([]);
            setSelectedIds([]);
            setToCourse("");
            return;
        }

        // Auto suggest next class
        const suggested = nextClassMap[fromCourse] || "";
        setToCourse(suggested);

        const fetchStudents = async () => {
            try {
                setLoadingStudents(true);
                setError("");
                const res = await api.get("/api/student", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const filtered = (res.data || []).filter(
                    s => s.Courcecode === fromCourse || s.courcecode === fromCourse
                );
                // Sort by roll
                filtered.sort((a, b) => Number(a.rollnumber) - Number(b.rollnumber));
                setAllStudents(filtered);
                // By default select all active students
                setSelectedIds(filtered.map(s => s.sr_no));
            } catch {
                setError("Failed to load students for selected class.");
                setAllStudents([]);
                setSelectedIds([]);
            } finally {
                setLoadingStudents(false);
            }
        };
        fetchStudents();
    }, [fromCourse, token]);

    const handleSelectAll = () => {
        if (selectedIds.length === allStudents.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(allStudents.map(s => s.sr_no));
        }
    };

    const toggleStudent = (sr_no) => {
        setSelectedIds(prev =>
            prev.includes(sr_no) ? prev.filter(id => id !== sr_no) : [...prev, sr_no]
        );
    };

    const handlePromote = async () => {
        if (!fromCourse || !toCourse || selectedIds.length === 0) {
            setError("Please select source class, target class, and at least one student.");
            return;
        }

        try {
            setPromoting(true);
            setShowConfirmModal(false);
            setError("");

            const res = await api.post(
                "/api/student/promote",
                {
                    fromCourse,
                    toCourse,
                    studentIds: selectedIds
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setToast({
                type: "success",
                message: res.data?.message || "Students successfully promoted!"
            });

            // Refresh current student list
            const refreshRes = await api.get("/api/student", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const filtered = (refreshRes.data || []).filter(
                s => s.Courcecode === fromCourse || s.courcecode === fromCourse
            );
            filtered.sort((a, b) => Number(a.rollnumber) - Number(b.rollnumber));
            setAllStudents(filtered);
            setSelectedIds([]);

        } catch (err) {
            const msg = err.response?.data?.message || "Failed to promote students.";
            setError(msg);
            setToast({ type: "error", message: msg });
        } finally {
            setPromoting(false);
        }
    };

    const fromCourseName = useMemo(() => {
        return courses.find(c => c.course_code === fromCourse)?.course_name || fromCourse;
    }, [courses, fromCourse]);

    const toCourseName = useMemo(() => {
        return courses.find(c => c.course_code === toCourse)?.course_name || toCourse;
    }, [courses, toCourse]);

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans pb-16">
            
            {/* PLATFORM HEADER */}
            <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-md shadow-emerald-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">Student Promotion (শ্রেণি উত্তীর্ণকরণ)</h1>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">Dimla Government Girls' High School</p>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setFromCourse("");
                            setToCourse("");
                            setSelectedIds([]);
                            setError("");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset</span>
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6">

                {/* Info Card */}
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                    <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <span className="font-bold text-sm block mb-1">বার্ষিক পরীক্ষা শেষে পরবর্তী শ্রেণিতে পদোন্নতি (Academic Promotion Policy):</span>
                        বার্ষিক পরীক্ষায় (Final Exam) উত্তীর্ণ শিক্ষার্থীদের পরবর্তী শিক্ষাবর্ষের নতুন শ্রেণিতে উত্তীর্ণ করার জন্য নিচের শ্রেণি নির্বাচন করুন। নির্বাচিত শিক্ষার্থীদের স্বয়ংক্রিয়ভাবে পরবর্তী শ্রেণিতে স্থানান্তর করা হবে।
                    </div>
                </div>

                {/* ERROR STATE */}
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold animate-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* PARAMETERS SELECTION */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 transition-all">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
                        
                        {/* From Class */}
                        <div className="lg:col-span-2 space-y-1">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                                Current Class (বর্তমান শ্রেণি)
                            </label>
                            <select
                                value={fromCourse}
                                onChange={(e) => setFromCourse(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer font-medium"
                            >
                                <option value="">Select Current Class / শ্রেণি নির্বাচন করুন...</option>
                                {courses.map(c => (
                                    <option key={c.id} value={c.course_code}>{c.course_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Arrow indicator */}
                        <div className="hidden lg:flex items-center justify-center pt-5">
                            <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>

                        {/* To Class */}
                        <div className="lg:col-span-2 space-y-1">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                                Target Class (উত্তীর্ণ শ্রেণি)
                            </label>
                            <select
                                value={toCourse}
                                onChange={(e) => setToCourse(e.target.value)}
                                disabled={!fromCourse}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 disabled:opacity-40 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer font-medium"
                            >
                                <option value="">Select Target Class / নতুন শ্রেণি...</option>
                                {courses.filter(c => c.course_code !== fromCourse).map(c => (
                                    <option key={c.id} value={c.course_code}>{c.course_name}</option>
                                ))}
                            </select>
                        </div>

                    </div>
                </section>

                {/* STUDENTS LIST */}
                {fromCourse && (
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* Table Header Bar */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSelectAll}
                                    className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                    {selectedIds.length === allStudents.length && allStudents.length > 0 ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                        <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                    <span>Select All ({allStudents.length} Students)</span>
                                </button>
                                <span className="text-xs text-slate-400">|</span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    {selectedIds.length} Selected for Promotion
                                </span>
                            </div>

                            {/* Action Button */}
                            <button
                                onClick={() => setShowConfirmModal(true)}
                                disabled={selectedIds.length === 0 || !toCourse || promoting}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                            >
                                <GraduationCap className="w-4 h-4" />
                                <span>Promote {selectedIds.length} Students</span>
                            </button>
                        </div>

                        {/* Students Table */}
                        {loadingStudents ? (
                            <div className="py-20 text-center text-sm text-slate-500">
                                Loading students list...
                            </div>
                        ) : allStudents.length === 0 ? (
                            <div className="py-16 text-center text-sm text-slate-500">
                                No students currently registered in {fromCourseName}.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="w-12 px-4 py-3 text-center">Select</th>
                                            <th className="px-4 py-3">Roll No</th>
                                            <th className="px-4 py-3">Student Name</th>
                                            <th className="px-4 py-3">Parents' Name</th>
                                            <th className="px-4 py-3">Contact</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {allStudents.map((student, idx) => {
                                            const isSelected = selectedIds.includes(student.sr_no);
                                            return (
                                                <tr
                                                    key={student.sr_no}
                                                    onClick={() => toggleStudent(student.sr_no)}
                                                    className={`cursor-pointer transition-colors ${
                                                        isSelected
                                                            ? "bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/60"
                                                            : idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/40 dark:bg-slate-900/40"
                                                    } hover:bg-slate-100/60 dark:hover:bg-slate-800/40`}
                                                >
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}} // handled by row click
                                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                        {student.rollnumber}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                                                            {student.firstname} {student.lastname}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                        <div>{student.fathername || "—"}</div>
                                                        <div className="text-[11px] text-slate-400">{student.mothername || ""}</div>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                                                        {student.contactnumber || "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                            Active
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

            </main>

            {/* CONFIRMATION MODAL */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                        <div className="flex items-center gap-3 text-emerald-600">
                            <GraduationCap className="w-6 h-6" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                Confirm Student Promotion
                            </h3>
                        </div>
                        
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            Are you sure you want to promote <span className="font-bold text-emerald-600">{selectedIds.length}</span> student(s) from <span className="font-bold">{fromCourseName}</span> to <span className="font-bold text-indigo-600">{toCourseName}</span>?
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 text-[11px] text-amber-800 dark:text-amber-300">
                            <strong>Note:</strong> Promoted students will be assigned to the new class with their academic session reset to start the new grade.
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePromote}
                                disabled={promoting}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors"
                            >
                                {promoting ? "Promoting..." : "Yes, Promote Students"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST NOTIFICATION */}
            {toast && (
                <Toast
                    type={toast.type}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

        </div>
    );
}
