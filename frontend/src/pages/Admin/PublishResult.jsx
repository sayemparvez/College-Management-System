import { useEffect, useState, useMemo } from "react";
import api from "../../utils/api";
import Toast from "../../components/ui/Toast.jsx";
import ConfirmSaveModal from "../../components/modals/ConfirmSaveModal.jsx";
import {
    Award,
    Filter,
    CheckCircle2,
    AlertCircle,
    Clock,
    Lock,
    Unlock,
    RotateCcw,
    Users,
    BookOpen,
    Send
} from "lucide-react";

export default function PublishResult() {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedSem, setSelectedSem] = useState("1");

    const [loading, setLoading] = useState(false);
    const [statusData, setStatusData] = useState(null);
    const [error, setError] = useState("");
    const [toast, setToast] = useState(null);

    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showUnpublishModal, setShowUnpublishModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Fetch classes
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                const res = await api.get("/api/courses", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setCourses(res.data || []);
                if (res.data && res.data.length > 0) {
                    setSelectedCourse(res.data[0].course_code);
                }
            } catch (err) {
                console.error("Failed to load courses:", err);
                setError("Failed to load classes from the server.");
            }
        };
        if (token) fetchCourses();
    }, [token]);

    const selectedCourseObj = useMemo(() => {
        return courses.find(c => c.course_code === selectedCourse);
    }, [courses, selectedCourse]);

    const semesterOptions = useMemo(() => {
        if (!selectedCourseObj) return [1, 2];
        const total = Number(selectedCourseObj.total_semesters) || 2;
        return Array.from({ length: total }, (_, i) => i + 1);
    }, [selectedCourseObj]);

    // Fetch result & marks submission status
    const fetchStatus = async () => {
        if (!selectedCourse || !selectedSem) return;
        try {
            setLoading(true);
            setError("");
            const res = await api.get(
                `/api/result/status?course=${selectedCourse}&sem=${selectedSem}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStatusData(res.data);
        } catch (err) {
            console.error("Failed to fetch result status:", err);
            setError(err.response?.data?.message || "Failed to load result status.");
            setStatusData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, [selectedCourse, selectedSem, token]);

    // Handle Publish
    const handlePublish = async () => {
        try {
            setActionLoading(true);
            setShowPublishModal(false);
            const res = await api.post(
                "/api/result/publish",
                { course: selectedCourse, sem: Number(selectedSem) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setToast({ type: "success", message: res.data.message || "Result published successfully!" });
            fetchStatus();
        } catch (err) {
            console.error("Publish error:", err);
            const msg = err.response?.data?.message || "Failed to publish result.";
            setError(msg);
            setToast({ type: "error", message: msg });
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Unpublish
    const handleUnpublish = async () => {
        try {
            setActionLoading(true);
            setShowUnpublishModal(false);
            const res = await api.post(
                "/api/result/unpublish",
                { course: selectedCourse, sem: Number(selectedSem) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setToast({ type: "success", message: res.data.message || "Result unpublished successfully." });
            fetchStatus();
        } catch (err) {
            console.error("Unpublish error:", err);
            const msg = err.response?.data?.message || "Failed to unpublish result.";
            setError(msg);
            setToast({ type: "error", message: msg });
        } finally {
            setActionLoading(false);
        }
    };

    const isPublished = statusData?.isdeclared === true;
    const canPublish = statusData?.allSubmitted === true && statusData?.isAuthorizedToPublish;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16">
            
            {/* HEADER */}
            <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-md shadow-emerald-500/20">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">
                                Result Approval & Publication
                            </h1>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">
                                প্রধান শিক্ষক ও অ্যাডমিন অনুমোদন পোর্টাল • ফলাফল প্রকাশ
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchStatus}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Refresh Status</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">

                {/* Workflow Guidance Banner */}
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-300">
                    <Award className="w-5 h-5 mt-0.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                    <div className="space-y-1">
                        <p className="font-bold text-sm">বিদ্যালয় ফলাফল অনুমোদন ও প্রকাশ নীতিমালা (Result Approval Policy):</p>
                        <p>
                            ১. বিষয়ভিত্তিক শিক্ষকগণ নম্বর এন্ট্রি সম্পন্ন করার পর তা গোপন থাকবে। অন্য কোনো শিক্ষক বা শিক্ষার্থী ফলাফল প্রকাশের পূর্বে কোনো নম্বর দেখতে পাবেন না।
                        </p>
                        <p>
                            ২. একটি শ্রেণির সকল বিষয়ের নম্বর প্রদান সম্পন্ন হলে প্রধান শিক্ষক (Head Teacher) অথবা অ্যাডমিন ফলাফল অনুমোদন ও প্রকাশ করতে পারবেন।
                        </p>
                        <p>
                            ৩. অনুমোদন ও প্রকাশের সাথে সাথে সংশ্লিষ্ট শ্রেণির শিক্ষার্থী ও শিক্ষকদের কাছে স্বয়ংক্রিয় নোটিফিকেশন পৌঁছে যাবে এবং শিক্ষার্থীরা মার্কশিট দেখতে পাবেন।
                        </p>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold animate-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* FILTER CARD */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-4 h-4 text-emerald-500" />
                        <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                            Select Class & Term (শ্রেণি ও পরীক্ষা নির্বাচন)
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Class (শ্রেণি)
                            </label>
                            <select
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer font-semibold"
                            >
                                {courses.map((course) => (
                                    <option key={course.id} value={course.course_code}>
                                        {course.course_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                Examination Term (পরীক্ষা)
                            </label>
                            <select
                                value={selectedSem}
                                onChange={(e) => setSelectedSem(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer font-semibold"
                            >
                                {semesterOptions.map((s) => (
                                    <option key={s} value={s}>
                                        {s === 1 ? "1st Term / Half Yearly (অর্ধ-বার্ষিক পরীক্ষা)" : "2nd Term / Final (বার্ষিক পরীক্ষা)"}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* STATUS & ACTION BANNER */}
                {statusData && (
                    <section className={`p-6 rounded-2xl border transition-all ${
                        isPublished 
                            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                            : statusData.allSubmitted
                            ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                            : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    }`}>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                        isPublished
                                            ? "bg-emerald-600 text-white shadow-sm"
                                            : statusData.allSubmitted
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "bg-amber-500 text-white shadow-sm"
                                    }`}>
                                        {isPublished ? (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Result Published (ফলাফল প্রকাশিত)
                                            </>
                                        ) : statusData.allSubmitted ? (
                                            <>
                                                <Clock className="w-3.5 h-3.5" />
                                                Ready for Approval (অনুমোদনের জন্য প্রস্তুত)
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-3.5 h-3.5" />
                                                Marks Entry Incomplete (নম্বর এন্ট্রি বাকি)
                                            </>
                                        )}
                                    </span>
                                </div>

                                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                                    {selectedCourseObj?.course_name || selectedCourse} — {Number(selectedSem) === 1 ? "অর্ধ-বার্ষিক পরীক্ষা" : "বার্ষিক পরীক্ষা"}
                                </h3>

                                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        শিক্ষার্থী সংখ্যা: <strong className="text-slate-800 dark:text-slate-200">{statusData.totalStudents}</strong>
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                        মোট বিষয়: <strong className="text-slate-800 dark:text-slate-200">{statusData.totalSubjects}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                        নম্বর প্রদান সম্পন্ন বিষয়: <strong className="text-emerald-600 dark:text-emerald-400">{statusData.submittedSubjects} / {statusData.totalSubjects}</strong>
                                    </span>
                                </div>

                                {isPublished && statusData.declared_by && (
                                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
                                        অনুমোদনকারী: {statusData.declared_by} • প্রকাশের তারিখ: {statusData.declared_at || "N/A"}
                                    </p>
                                )}
                            </div>

                            {/* ACTION BUTTON */}
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                {!isPublished ? (
                                    <button
                                        onClick={() => setShowPublishModal(true)}
                                        disabled={!canPublish || actionLoading}
                                        className={`w-full md:w-auto px-6 py-3 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${
                                            canPublish
                                                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-500/20"
                                                : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                        }`}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve & Publish Result (অনুমোদন ও প্রকাশ করুন)
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setShowUnpublishModal(true)}
                                        disabled={actionLoading || !statusData.isAuthorizedToPublish}
                                        className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Lock className="w-3.5 h-3.5" />
                                        Unpublish Result (ফলাফল স্থগিত করুন)
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* SUBJECTS STATUS BREAKDOWN */}
                {statusData && (
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                    বিষয়ভিত্তিক নম্বর এন্ট্রি স্ট্যাটাস (Subject Marks Status)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    সকল শিক্ষক নম্বর জমা দেওয়ার পরেই ফলাফল প্রকাশ বোতাম কার্যকর হবে।
                                </p>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg">
                                {statusData.submittedSubjects} of {statusData.totalSubjects} Subjects Entered
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {statusData.subjects.map((sub, idx) => {
                                const hasMarks = sub.enteredStudents > 0;
                                return (
                                    <div
                                        key={sub.subjectcode}
                                        className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg text-xs font-mono font-bold ${
                                                hasMarks 
                                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                            }`}>
                                                {sub.subjectcode}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                    {sub.subjectname}
                                                </h4>
                                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                    {sub.subjecttype}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                                                hasMarks
                                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                            }`}>
                                                {hasMarks ? (
                                                    <>
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        নম্বর এন্ট্রি সম্পন্ন ({sub.enteredStudents} জন)
                                                    </>
                                                ) : (
                                                    <>
                                                        <Clock className="w-3.5 h-3.5" />
                                                        অপেক্ষমাণ (Pending)
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </main>

            {/* CONFIRM PUBLISH MODAL */}
            <ConfirmSaveModal
                show={showPublishModal}
                title="ফলাফল অনুমোদন ও প্রকাশ নিশ্চিত করুন"
                message={`আপনি কি নিশ্চিতভাবে ${selectedCourseObj?.course_name || selectedCourse}-এর ফলাফল অনুমোদন ও প্রকাশ করতে চান? ফলাফল প্রকাশের সাথে সাথেই শিক্ষার্থীরা মার্কশিট দেখতে পাবেন এবং সকল শিক্ষক ও শিক্ষার্থীর কাছে স্বয়ংক্রিয় নোটিফিকেশন প্রেরিত হবে।`}
                confirmText="হ্যাঁ, ফলাফল প্রকাশ করুন"
                loading={actionLoading}
                onCancel={() => setShowPublishModal(false)}
                onConfirm={handlePublish}
            />

            {/* CONFIRM UNPUBLISH MODAL */}
            <ConfirmSaveModal
                show={showUnpublishModal}
                title="ফলাফল স্থগিত/অপ্রকাশিত করুন"
                message={`আপনি কি এই ফলাফল স্থগিত করতে চান? স্থগিত করলে শিক্ষার্থীরা আর মার্কশিট দেখতে পাবেন না।`}
                confirmText="স্থগিত করুন"
                loading={actionLoading}
                onCancel={() => setShowUnpublishModal(false)}
                onConfirm={handleUnpublish}
            />

            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
        </div>
    );
}
