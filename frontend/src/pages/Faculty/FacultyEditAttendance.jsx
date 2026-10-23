import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import { 
    ClipboardEdit, 
    Filter, 
    RotateCcw, 
    AlertCircle, 
    ListChecks, 
    Calendar,
    BookOpen,
    Loader2,
    Lock
} from "lucide-react";

function InfoCard({ label, value, icon: Icon }) {
    return (
        <div className="bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4">
            {Icon && (
                <div className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-indigo-500">
                    <Icon className="w-4 h-4" />
                </div>
            )}
            <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{value || "-"}</p>
            </div>
        </div>
    );
}

export default function FacultyEditAttendance() {
    const token = localStorage.getItem("token");

    const [assignedSubjects, setAssignedSubjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [attendanceDates, setAttendanceDates] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [checkedStudents, setCheckedStudents] = useState({});
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [error, setError] = useState("");

    const handleReset = () => {
        setSelectedSubject("");
        setSelectedDate("");
        setCheckedStudents({});
        setStudents([]);
        setAttendanceDates([]);
        setError("");
    };

    useEffect(() => {
        const fetchAssignedSubjects = async () => {
            try {
                setLoadingSubjects(true);
                setError("");
                const res = await api.get("/api/faculty/assigned-subjects", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setAssignedSubjects(res.data || []);
                if (res.data && res.data.length === 1) {
                    setSelectedSubject(res.data[0].subjectcode);
                }
            } catch (err) {
                setAssignedSubjects([]);
                setError("Failed to load assigned subjects.");
            } finally {
                setLoadingSubjects(false);
            }
        };
        if (token) fetchAssignedSubjects();
    }, [token]);

    const selectedSubjectObj = useMemo(() => {
        return assignedSubjects.find((item) => String(item.subjectcode) === String(selectedSubject));
    }, [assignedSubjects, selectedSubject]);

    const selectedCourse = selectedSubjectObj?.courcecode || "";
    const selectedSem = selectedSubjectObj?.semoryear || "";

    useEffect(() => {
        if (!selectedSubject || !selectedCourse || !selectedSem) {
            setStudents([]);
            setAttendanceDates([]);
            setSelectedDate("");
            setCheckedStudents({});
            return;
        }
        const fetchStudents = async () => {
            try {
                setLoadingStudents(true);
                setError("");
                const res = await api.get(`/api/attendance/students?course=${selectedCourse}&sem=${selectedSem}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setStudents(res.data || []);
            } catch (err) {
                setStudents([]);
                setError("Failed to load students.");
            } finally {
                setLoadingStudents(false);
            }
        };
        fetchStudents();
    }, [selectedCourse, selectedSem, selectedSubject, token]);

    useEffect(() => {
        if (!selectedSubject || !selectedCourse || !selectedSem) {
            setAttendanceDates([]);
            return;
        }
        const fetchDates = async () => {
            try {
                const res = await api.get(`/api/attendance/dates?subjectcode=DAILY_1ST&courcecode=${selectedCourse}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setAttendanceDates((res.data || []).map((item) => item.date));
            } catch (err) {
                setAttendanceDates([]);
            }
        };
        fetchDates();
    }, [selectedSubject, selectedCourse, selectedSem, token]);

    useEffect(() => {
        if (!selectedCourse || !selectedSem || !selectedSubject || !selectedDate || students.length === 0) return;
        const loadAttendance = async () => {
            try {
                setLoadingAttendance(true);
                const res = await api.get(`/api/attendance?subjectcode=DAILY_1ST&date=${selectedDate}&courcecode=${selectedCourse}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const map = {};
                students.forEach((s) => map[Number(s.student_id)] = false);
                (res.data || []).forEach((record) => {
                    map[Number(record.student_id)] = Number(record.present) === 1;
                });
                setCheckedStudents(map);
            } catch (err) {
                setError("Failed to load attendance.");
            } finally {
                setLoadingAttendance(false);
            }
        };
        loadAttendance();
    }, [selectedCourse, selectedSem, selectedSubject, selectedDate, students, token]);

    const isReady = selectedSubject && selectedCourse && selectedSem && selectedDate;

    return (
        <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">
            
            <header className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-500/20">
                            <ClipboardEdit className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight">Faculty Portal</h1>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">View Attendance Record</p>
                        </div>
                    </div>
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reset Form</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6 pb-24">
                
                {/* POLICY LOCK BANNER */}
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                    <Lock className="w-5 h-5 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <div className="space-y-1">
                        <p className="font-bold text-sm">স্কুল হাজিরা লক নীতিমালা (Attendance Edit Policy):</p>
                        <p>
                            শ্রেণি শিক্ষক কর্তৃক একবার হাজিরা সাবমিট করার পর তা শিক্ষক অ্যাকাউন্ট থেকে আর পরিবর্তন বা এডিট করা যাবে না।
                        </p>
                        <p>
                            যেকোনো সংশোধন বা ভুল সংশোধনের জন্য শুধুমাত্র স্কুলের প্রধান শিক্ষক বা অ্যাডমিন মহোদয়ের সাথে যোগাযোগ করুন। অ্যাডমিন পোর্টাল থেকে যেকোনো হাজিরা সংশোধন করা সম্ভব।
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {/* FILTER CARD */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 transition-all">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Selection Filters</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Class / Subject</label>
                            <select 
                                value={selectedSubject} 
                                onChange={(e) => { setSelectedSubject(e.target.value); setSelectedDate(""); setCheckedStudents({}); setError(""); }}
                                disabled={loadingSubjects}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <option value="">{loadingSubjects ? "Loading..." : "Choose Class / Subject"}</option>
                                {assignedSubjects.map((sub, idx) => (
                                    <option key={`${sub.subjectcode}-${idx}`} value={sub.subjectcode}>{sub.subjectname} ({sub.courcecode})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Attendance Date (তারিখ)</label>
                            <select 
                                value={selectedDate} 
                                onChange={(e) => { setSelectedDate(e.target.value); setError(""); }}
                                disabled={!selectedSubject}
                                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <option value="">Select Date</option>
                                {attendanceDates.map((date, idx) => (
                                    <option key={`${date}-${idx}`} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* INFO CARDS */}
                {selectedSubjectObj && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-500">
                        <InfoCard label="Class" value={selectedCourse} icon={BookOpen} />
                        <InfoCard label="Term" value={`Term ${selectedSem}`} icon={RotateCcw} />
                        <InfoCard label="Status" value="Read Only (Locked by Policy)" icon={Lock} />
                    </div>
                )}

                {/* ATTENDANCE TABLE */}
                {isReady ? (
                    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                            <table className="w-full table-fixed">
                                <thead>
                                    <tr>
                                        <th className="w-[35%] sm:w-[25%] px-4 sm:px-6 py-4 text-left text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Roll No</th>
                                        <th className="w-[45%] sm:w-[50%] px-2 sm:px-4 py-4 text-left text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                                        <th className="w-[20%] sm:w-[25%] px-4 sm:px-6 py-4 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">Present</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>

                        <div className="w-full">
                            <table className="w-full table-fixed">
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {loadingStudents || loadingAttendance ? (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-12 text-center">
                                                <div className="flex flex-col items-center gap-2 text-slate-500">
                                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                                    <p className="text-sm font-medium tracking-tight">Syncing records...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : students.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-12 text-center text-slate-500 text-sm">No students enrolled.</td>
                                        </tr>
                                    ) : (
                                        students.map((student, idx) => (
                                            <tr 
                                                key={student.student_id} 
                                                className={`${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/30 dark:bg-slate-800/10'}`}
                                            >
                                                <td className="w-[35%] sm:w-[25%] px-4 sm:px-6 py-4">
                                                    <div className="text-[11px] sm:text-xs font-mono font-bold text-slate-600 dark:text-slate-400 truncate">{student.rollnumber}</div>
                                                </td>
                                                <td className="w-[45%] sm:w-[50%] px-2 sm:px-4 py-4">
                                                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                                        {student.firstname} {student.lastname}
                                                    </div>
                                                </td>
                                                <td className="w-[20%] sm:w-[25%] px-4 sm:px-6 py-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!checkedStudents[student.student_id]}
                                                        disabled={true}
                                                        className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 bg-white dark:bg-slate-900 opacity-60 cursor-not-allowed"
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center px-4 shadow-sm">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-4 border border-slate-100 dark:border-slate-800">
                            <ListChecks className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Fetch Records</h2>
                        <p className="text-sm text-slate-500 mt-1 max-w-xs">Select a class/subject and date to view submitted attendance records.</p>
                    </div>
                )}
            </main>

            {/* ACTION BAR (READ ONLY) */}
            {isReady && students.length > 0 && (
                <div className="sticky bottom-0 mt-auto w-full z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
                    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                            <Lock className="w-4 h-4" />
                            <span>Submitted records are locked • Only School Admin can edit or modify</span>
                        </div>
                        <div className="text-xs text-slate-500 font-semibold">
                            Viewing {students.length} students for {selectedDate}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
