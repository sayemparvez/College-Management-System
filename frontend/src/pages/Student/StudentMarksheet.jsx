import { useEffect, useState } from "react";
import api from "../../utils/api";
import {
    BarChart3,
    Filter,
    BookOpen,
    Percent,
    Trophy,
    RotateCcw,
    ChevronDown,
    ListChecks,
    Lock,
    Clock,
    AlertCircle
} from "lucide-react";
import { calculateNCTBGrade, getExamShortName } from "../../utils/academicHelper";

const gradeColor = (grade) => {
    if (grade === "A+") return "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200";
    if (grade === "A") return "text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200";
    if (grade === "A-") return "text-sky-600 bg-sky-50 dark:bg-sky-500/10 border-sky-200";
    if (grade === "B") return "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200";
    if (grade === "C") return "text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200";
    if (grade === "D") return "text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-200";
    return "text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200";
};

const StudentMarksheet = () => {
    const token = localStorage.getItem("token");

    const [marks, setMarks] = useState([]);
    const [allMarks, setAllMarks] = useState([]);
    const [selectedSem, setSelectedSem] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [courseCode, setCourseCode] = useState("");
    const [isPublished, setIsPublished] = useState(true);
    const [pendingMessage, setPendingMessage] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchMarks = async (sem = "") => {
        try {
            setLoading(true);
            const url = sem ? `/api/student/marks?sem=${sem}` : "/api/student/marks";
            const res = await api.get(url, {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            if (res.data.isPublished === false) {
                setIsPublished(false);
                setPendingMessage(res.data.message || "ফলাফল এখনও প্রধান শিক্ষক বা অ্যাডমিন কর্তৃক অনুমোদন ও প্রকাশ করা হয়নি।");
                setAllMarks([]);
                setMarks([]);
            } else {
                setIsPublished(true);
                setPendingMessage("");
                setAllMarks(res.data.marks || []);
                setMarks(res.data.marks || []);
                if (res.data.course) setCourseCode(res.data.course);
                else if (res.data.marks?.length) setCourseCode(res.data.marks[0].courcecode || "");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMarks(selectedSem);
    }, [selectedSem]);

    useEffect(() => {
        if (!isPublished) return;
        let filtered = allMarks;
        if (selectedSubject) {
            filtered = filtered.filter(m => String(m.subjectcode) === String(selectedSubject));
        }
        setMarks(filtered);
    }, [selectedSubject, allMarks, isPublished]);

    const semesters = [1, 2];
    const subjects = [
        ...new Map(
            allMarks
                .filter(m => !selectedSem || String(m.semoryear) === String(selectedSem))
                .map(m => [m.subjectcode, { name: m.subjectname, code: m.subjectcode }])
        ).values()
    ];

    /* ================= SUMMARY LOGIC ================= */
    const totalSubjects = marks.length;
    const totalMarks = marks.reduce((acc, m) => acc + (Number(m.theorymarks || 0) + Number(m.practicalmarks || 0)), 0);
    const avgMarks = totalSubjects ? (totalMarks / totalSubjects).toFixed(1) : 0;
    const highest = totalSubjects ? Math.max(...marks.map(m => Number(m.theorymarks || 0) + Number(m.practicalmarks || 0))) : 0;

    const handleReset = () => {
        setSelectedSem("");
        setSelectedSubject("");
    };

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">

            {/* PLATFORM HEADER */}
            <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-500/20">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">My Marksheet</h1>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">Academic Performance • পরীক্ষার ফলাফল ও মার্কশিট</p>
                        </div>
                    </div>
                    {(selectedSem || selectedSubject) && (
                        <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Clear Filters</span>
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6">

                {/* RESULT NOT PUBLISHED NOTICE */}
                {!isPublished && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 text-center space-y-3 shadow-sm animate-in fade-in duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                            <Lock className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                            ফলাফল অনুমোদন ও প্রকাশের অপেক্ষায় রয়েছে
                        </h3>
                        <p className="text-sm text-amber-700 dark:text-amber-300 max-w-xl mx-auto leading-relaxed">
                            {pendingMessage || "আপনার শ্রেণির ফলাফল এখনও প্রধান শিক্ষক বা অ্যাডমিন কর্তৃক অনুমোদন ও প্রকাশ করা হয়নি। বিদ্যালয় কর্তৃপক্ষ কর্তৃক ফলাফল অনুমোদন ও প্রকাশের সাথে সাথে এখানে পূর্ণাঙ্গ নম্বর ও মার্কশিট দেখতে পাবেন।"}
                        </p>
                    </div>
                )}

                {/* FILTER CARD */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Select Examination (পরীক্ষা নির্বাচন)</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="relative">
                            <select
                                value={selectedSem}
                                onChange={(e) => { setSelectedSem(e.target.value); setSelectedSubject(""); }}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer font-medium"
                            >
                                <option value="">Select Exam / পরীক্ষা...</option>
                                <option value="1">Half Yearly Exam (অর্ধ-বার্ষিক পরীক্ষা)</option>
                                <option value="2">Final Exam (বার্ষিক পরীক্ষা)</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>

                        <div className="relative">
                            <select
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value)}
                                disabled={!isPublished || marks.length === 0}
                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer disabled:opacity-40 font-medium"
                            >
                                <option value="">All Subjects (সকল বিষয়)</option>
                                {subjects.map((sub) => <option key={sub.code} value={sub.code}>{sub.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                </section>

                {/* SUMMARY CARDS (only if published) */}
                {isPublished && marks.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Subjects", value: totalSubjects, icon: BookOpen },
                            { label: "Total Marks", value: totalMarks, icon: Percent },
                            { label: "Avg. Score", value: avgMarks, icon: BarChart3 },
                            { label: "Highest Score", value: highest, icon: Trophy },
                        ].map((item, i) => (
                            <div key={i} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                                <div className="flex justify-between mb-2">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{item.label}</p>
                                    <item.icon className="w-3.5 h-3.5 text-indigo-500" />
                                </div>
                                <p className="text-xl font-black text-slate-900 dark:text-slate-100">{item.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* DATA TABLE */}
                {isPublished && marks.length > 0 ? (
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px]">
                                <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-4 sm:px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject</th>
                                        <th className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">CQ</th>
                                        <th className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">MCQ</th>
                                        <th className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Practical</th>
                                        <th className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
                                        <th className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Grade</th>
                                        <th className="px-3 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">GP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {marks.map((item, index) => {
                                        const total = Number(item.theorymarks || 0) + Number(item.practicalmarks || 0);
                                        const max = (Number(item.theoryfull || 0) + Number(item.practicalfull || 0)) || 100;
                                        const { grade, point } = item.grade
                                            ? { grade: item.grade, point: item.grade_point ?? 0 }
                                            : calculateNCTBGrade(total, max);
                                        const colorClass = gradeColor(grade);

                                        return (
                                            <tr key={index} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-colors">
                                                <td className="px-4 sm:px-6 py-4">
                                                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{item.subjectname}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wide">
                                                        {item.subjectcode} &bull; {getExamShortName(item.courcecode, item.semoryear)}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {item.cq_marks != null ? item.cq_marks : "—"}
                                                </td>
                                                <td className="px-3 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {item.mcq_marks != null ? item.mcq_marks : "—"}
                                                </td>
                                                <td className="px-3 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                    {Number(item.practicalmarks) > 0 ? item.practicalmarks : "—"}
                                                </td>
                                                <td className="px-3 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black border border-indigo-100 dark:border-indigo-900/30">
                                                        {total}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-black border ${colorClass}`}>
                                                        {grade}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-4 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                                    {Number(point).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ) : isPublished && !loading ? (
                    /* EMPTY STATE */
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center px-4 shadow-sm">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-4">
                            <ListChecks className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Records Found</h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-xs">পরীক্ষার নাম নির্বাচন করুন অথবা ফিল্টার পরিবর্তন করুন।</p>
                    </div>
                ) : null}
            </main>
        </div>
    );
};

export default StudentMarksheet;
