import { useEffect, useMemo, useState } from "react";
import api from "../../utils/api";
import ImportAttendanceModal from "./ImportAttendanceModal";
import ConfirmSaveModal from "../../components/modals/ConfirmSaveModal";
import {
    CheckSquare,
    Filter,
    RotateCcw,
    Save,
    AlertCircle,
    ListChecks,
    CheckCircle2,
    FileUp,
    Calendar,
    Lock,
    BookOpen,
    Users
} from "lucide-react";

const DAILY_1ST = "DAILY_1ST";

export default function FacultyTakeAttendance() {
  const token = localStorage.getItem("token");

  const [attendanceType, setAttendanceType] = useState("class"); // "class" | "exam"
  const [assignedClass, setAssignedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [existingDates, setExistingDates] = useState([]);

  // For Class 9 and 10: combined Science and Arts attendance in 1st period
  const [combineGroups, setCombineGroups] = useState(true);

  const [markMode, setMarkMode] = useState("present");
  const [checkedStudents, setCheckedStudents] = useState({});

  const [loadingClass, setLoadingClass] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const todayDate = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  /* ── Load faculty's assigned class ── */
  useEffect(() => {
    const fetchAssignedClass = async () => {
      try {
        setLoadingClass(true);
        setError("");
        const res = await api.get("/api/faculty/assigned-subjects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data && res.data.length > 0) {
          setAssignedClass(res.data[0]);
        } else {
          setAssignedClass(null);
        }
      } catch (err) {
        console.error("Assigned class fetch error:", err);
        setAssignedClass(null);
        setError("Failed to load assigned class information.");
      } finally {
        setLoadingClass(false);
      }
    };
    if (token) fetchAssignedClass();
  }, [token]);

  const selectedCourse = assignedClass?.courcecode || "";
  const selectedSem = assignedClass?.semoryear || "1";
  const activeSubjectCode = attendanceType === "class" ? DAILY_1ST : `EXAM_TERM_${selectedSem}`;

  const isClass9 = selectedCourse.toUpperCase().includes("CLASS-9");
  const isClass10 = selectedCourse.toUpperCase().includes("CLASS-10");
  const isHighSchoolGrouped = isClass9 || isClass10;

  // Compute courses to query
  const effectiveCourses = useMemo(() => {
    if (!selectedCourse) return "";
    if (attendanceType === "class" && combineGroups) {
      if (isClass9) return "CLASS-9-SCI,CLASS-9-ARTS";
      if (isClass10) return "CLASS-10-SCI,CLASS-10-ARTS";
    }
    return selectedCourse;
  }, [selectedCourse, attendanceType, combineGroups, isClass9, isClass10]);

  const isMultiClass = effectiveCourses.includes(",");

  /* ── Fetch students ── */
  useEffect(() => {
    if (!effectiveCourses || !selectedSem) {
      setStudents([]);
      setCheckedStudents({});
      return;
    }
    const fetchStudents = async () => {
      try {
        setLoadingStudents(true);
        setError("");
        setSuccess("");

        const url = isMultiClass
          ? `/api/attendance/students?courses=${effectiveCourses}&sem=${selectedSem}`
          : `/api/attendance/students?course=${effectiveCourses}&sem=${selectedSem}`;

        const res = await api.get(url, { headers: { Authorization: `Bearer ${token}` } });
        setStudents(res.data || []);
        setCheckedStudents({});
      } catch (err) {
        console.error("Students fetch error:", err);
        setStudents([]);
        setError("Failed to load students.");
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [effectiveCourses, selectedSem, isMultiClass, token]);

  /* ── Fetch existing attendance dates ── */
  useEffect(() => {
    if (!effectiveCourses || !selectedSem) {
      setExistingDates([]);
      return;
    }
    const fetchDates = async () => {
      try {
        const res = await api.get(
          `/api/attendance/dates?subjectcode=${activeSubjectCode}&courcecode=${effectiveCourses}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setExistingDates((res.data || []).map((item) => item.date));
      } catch (err) {
        console.error("Existing dates fetch error:", err);
        setExistingDates([]);
      }
    };
    fetchDates();
  }, [effectiveCourses, selectedSem, activeSubjectCode, token]);

  const toggleStudent = (id) => {
    setCheckedStudents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetForm = () => {
    setMarkMode("present");
    setCheckedStudents({});
    setError("");
    setSuccess("");
  };

  const isTodayAlreadyTaken = existingDates.includes(todayDate);

  const saveAttendance = async () => {
    if (!selectedCourse || !selectedSem) {
      setError("No class assigned to your account.");
      return;
    }
    if (isTodayAlreadyTaken) {
      setError("আজকের হাজিরা ইতিমধ্যে সাবমিট করা হয়েছে। নীতিমালা অনুযায়ী, একবার সাবমিট করার পর শুধুমাত্র অ্যাডমিন হাজিরা এডিট বা সংশোধন করতে পারবেন।");
      return;
    }
    try {
      setSavingAttendance(true);
      setShowConfirmModal(false);
      const records = students.map((student) => {
        const isChecked = !!checkedStudents[student.student_id];
        return {
          student_id: student.student_id,
          present: markMode === "present" ? (isChecked ? 1 : 0) : (isChecked ? 0 : 1),
        };
      });

      await api.post(
        "/api/attendance",
        {
          subjectcode: activeSubjectCode,
          date: todayDate,
          courcecode: effectiveCourses,
          semoryear: Number(selectedSem),
          records,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(`${attendanceType === 'class' ? 'দৈনিক ১ম পিরিয়ড ক্লাস হাজিরা' : 'পরীক্ষার হাজিরা'} সফলভাবে সাবমিট করা হয়েছে!`);
      setError("");

      // Refresh dates
      const res = await api.get(
        `/api/attendance/dates?subjectcode=${activeSubjectCode}&courcecode=${effectiveCourses}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExistingDates((res.data || []).map((item) => item.date));
      setCheckedStudents({});
    } catch (err) {
      console.error("Save attendance error:", err);
      setError(err?.response?.data?.message || "Failed to save attendance.");
    } finally {
      setSavingAttendance(false);
    }
  };

  const isReady = !!selectedCourse;
  const isFormReady = isReady && students.length > 0;

  return (
    <div className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 font-sans">

      {/* HEADER */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 shadow-sm">
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
                {attendanceType === 'class' ? "Daily Class Attendance (1st Period)" : "Exam Attendance (পরীক্ষার হাজিরা)"}
              </h1>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest hidden sm:block">
                Class Teacher Portal • {attendanceType === 'class' ? "১ম পিরিয়ড (দৈনিক ক্লাস হাজিরা)" : "পরীক্ষার হলের উপস্থিতি"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => { setError(""); setSuccess(""); setShowImportModal(true); }}
              disabled={!isReady || isTodayAlreadyTaken}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-30"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Import Excel</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <button
              onClick={resetForm}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Form</span>
            </button>
          </div>
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

        {/* Policy Warning Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
          <CheckSquare className="w-4 h-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <span className="font-semibold">বাংলাদেশ বিদ্যালয় নীতিমালা (Daily Attendance & Locking Policy):</span>{" "}
            বিদ্যালয়ে শুধুমাত্র প্রথম পিরিয়ডে শ্রেণি শিক্ষক দৈনিক হাজিরা গ্রহণ করেন।
            <strong> একবার হাজিরা সাবমিট করার পর তা শিক্ষক অ্যাকাউন্ট থেকে আর পরিবর্তন বা এডিট করা যাবে না।</strong> যেকোনো সংশোধন বা পরিবর্তনের জন্য স্কুলের অ্যাডমিন মহোদয়ের সাথে যোগাযোগ করুন।
          </div>
        </div>

        {/* Locked State if Today Already Taken */}
        {isTodayAlreadyTaken && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300 text-sm font-semibold">
            <Lock className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              আজকের ({todayDate}) {attendanceType === 'class' ? "দৈনিক ক্লাস হাজিরা" : "পরীক্ষার হাজিরা"} ইতিমধ্যে সাবমিট করা হয়েছে। নীতিমালা অনুযায়ী, সাবমিট করার পর এটি সংরক্ষিত ও লক করা হয়েছে। শুধুমাত্র অ্যাডমিন এটি সংশোধন করতে পারবেন।
            </p>
          </div>
        )}

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-semibold animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm font-semibold animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {/* CLASS INFO CARD */}
        {loadingClass ? (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500">
            Loading assigned class...
          </section>
        ) : assignedClass ? (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-500" />
                <h2 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Assigned Class Parameters (নির্ধারিত শ্রেণি)
                </h2>
              </div>
              {isHighSchoolGrouped && attendanceType === "class" && (
                <label className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 cursor-pointer bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  <input
                    type="checkbox"
                    checked={combineGroups}
                    onChange={(e) => setCombineGroups(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span>বিজ্ঞান ও মানবিক যৌথ ১ম পিরিয়ড হাজিরা</span>
                </label>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-wider">
                  Assigned Class (শ্রেণি)
                </label>
                <div className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>{selectedCourse}</span>
                  {isMultiClass && (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Users className="w-3 h-3" /> যৌথ হাজিরা
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-wider">
                  Attendance Type & Term
                </label>
                <div className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {attendanceType === "class" ? "নিয়মিত ক্লাস হাজিরা (১ম পিরিয়ড)" : `পরীক্ষার হাজিরা (Term ${selectedSem})`}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-wider">
                  Today's Date (আজকের তারিখ)
                </label>
                <div className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {todayDate}
                </div>
              </div>
            </div>

            {/* Attendance Mode */}
            <div className="mt-4 max-w-xs space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 ml-1 tracking-wider">
                Attendance Mode
              </label>
              <select
                value={markMode}
                onChange={(e) => setMarkMode(e.target.value)}
                disabled={isTodayAlreadyTaken}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer disabled:opacity-50"
              >
                <option value="present">Check = Present (টিক = উপস্থিত)</option>
                <option value="absent">Check = Absent (টিক = অনুপস্থিত)</option>
              </select>
            </div>
          </section>
        ) : (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 dark:text-slate-200">কোনো শ্রেণি নির্ধারিত নেই</h3>
            <p className="text-xs text-slate-400 mt-1">
              আপনার শিক্ষক অ্যাকাউন্টে এখনও কোনো শ্রেণি যুক্ত করা হয়নি। অনুগ্রহ করে বিদ্যালয় অ্যাডমিনের সাথে যোগাযোগ করুন।
            </p>
          </section>
        )}

        {/* ATTENDANCE LEDGER */}
        {isReady && (
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
                          বিভাগ (Group)
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
                        <td colSpan={isMultiClass ? "4" : "3"} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
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
                          onClick={() => !isTodayAlreadyTaken && toggleStudent(student.student_id)}
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
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}>
                                {student.courcecode?.toUpperCase().includes("SCI") ? "বিজ্ঞান" : "মানবিক"}
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
                              onChange={() => !isTodayAlreadyTaken && toggleStudent(student.student_id)}
                              disabled={isTodayAlreadyTaken}
                              className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 bg-white dark:bg-slate-900 focus:ring-blue-500 dark:focus:ring-blue-500/50 cursor-pointer transition-colors disabled:opacity-40"
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
        )}
      </main>

      {/* STICKY BOTTOM ACTION BAR */}
      {isFormReady && (
        <div className="sticky bottom-0 mt-auto w-full z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 p-4 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Recording for {students.length} students {isMultiClass && "(বিজ্ঞান ও মানবিক যৌথ)"}
            </div>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={!isReady || students.length === 0 || savingAttendance || isTodayAlreadyTaken}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                isTodayAlreadyTaken
                  ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              }`}
            >
              {isTodayAlreadyTaken ? (
                <>
                  <Lock className="w-4 h-4" />
                  আজকের হাজিরা সংরক্ষিত ও লক করা
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {savingAttendance ? "Processing..." : "Save Attendance"}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {showImportModal && (
        <ImportAttendanceModal
          onClose={() => setShowImportModal(false)}
          token={token}
          subjectcode={activeSubjectCode}
          courcecode={effectiveCourses}
          semoryear={selectedSem}
          date={todayDate}
          onImportSuccess={() => {
            setSuccess("Attendance imported successfully.");
            setError("");
            setTimeout(() => {
              setMarkMode("present");
              setCheckedStudents({});
              setStudents([]);
              setExistingDates([]);
              setSuccess("");
              setShowImportModal(false);
            }, 1500);
          }}
        />
      )}

      <ConfirmSaveModal
        show={showConfirmModal}
        title="Confirm Data Sync"
        message={`Are you sure you want to save today's ${attendanceType === 'class' ? '1st Period Class' : 'Exam'} attendance for this class? Note: Once submitted, it will be locked and can only be modified by Admin.`}
        confirmText="Save Attendance"
        loading={savingAttendance}
        onCancel={() => setShowConfirmModal(false)}
        onConfirm={saveAttendance}
      />
    </div>
  );
}
