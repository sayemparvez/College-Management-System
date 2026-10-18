import { QRCodeCanvas } from "qrcode.react";
import api from "../../utils/api";
import { calculateNCTBGrade, getExamName } from "../../utils/academicHelper.js";

const MarksheetLayout = ({
                             marksheet,
                             semLabel,
                             selectedSem,
                             marksheetCode,
                             verificationUrl,
                             summary,
                             hash,
                             courseDisplay,
                             getGrade
                         }) => {

    const isClass10 = String(courseDisplay || "").toUpperCase().includes("10");
    const examTitle = marksheet?.examName || getExamName(courseDisplay, selectedSem);

    return (
        <div
            id="marksheet"
            className="relative bg-white text-black mx-auto border-2 border-slate-700 flex flex-col justify-between overflow-hidden shadow-2xl"
            style={{
                width: "794px",
                height: "1123px",
                padding: "24px 28px",
                boxSizing: "border-box"
            }}
        >
            {/* BACKGROUND WATERMARK */}
            <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 0 }}
            >
                <div className="text-center opacity-[0.04] select-none">
                    <h1 className="text-6xl font-black uppercase tracking-widest text-slate-900 leading-tight">
                        DIMLA GOVT GIRLS'<br />HIGH SCHOOL
                    </h1>
                </div>
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">

                {/* 1. INSTITUTIONAL HEADER */}
                <div className="text-center border-b-2 border-slate-800 pb-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                        <div className="w-16 h-16 rounded-full border border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 p-1">
                            <img
                                src={`${api.defaults.baseURL}/uploads/admin/admin.jpg`}
                                alt="School Logo"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = `${api.defaults.baseURL}/uploads/admin/default.png`;
                                }}
                            />
                        </div>

                        <div className="flex-1 px-4 text-center">
                            <h1 className="text-[21px] font-black uppercase tracking-wide text-slate-900">
                                Dimla Government Girls' High School
                            </h1>
                            <p className="text-[13px] font-bold text-slate-700 mt-0.5">
                                ডিমলা সরকারি বালিকা উচ্চ বিদ্যালয়
                            </p>
                            <p className="text-[11px] text-slate-600 font-medium">
                                Dimla, Nilphamari, Rangpur, Bangladesh • Estd: 1973
                            </p>
                        </div>

                        {/* Grading Scale Badge / Box */}
                        <div className="border border-slate-700 rounded text-[9px] leading-tight p-1 bg-slate-50 text-left">
                            <div className="font-bold text-center border-b border-slate-300 pb-0.5 mb-0.5">NCTB GRADING</div>
                            <div className="grid grid-cols-2 gap-x-2">
                                <div>80-100: A+ (5.0)</div>
                                <div>50-59: B (3.0)</div>
                                <div>70-79: A (4.0)</div>
                                <div>40-49: C (2.0)</div>
                                <div>60-69: A- (3.5)</div>
                                <div>33-39: D (1.0)</div>
                                <div className="col-span-2 text-center text-red-600 font-bold">00-32: F (0.0)</div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 py-1 bg-slate-800 text-white rounded font-bold uppercase text-[12px] tracking-wider">
                        Academic Progress Report • {examTitle}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-600 mt-1 px-1">
                        <span>Academic Session: <strong>2026</strong></span>
                        <span>ID: <strong className="font-mono">{marksheetCode}</strong></span>
                    </div>
                </div>

                {/* 2. STUDENT INFORMATION & PHOTO */}
                <div className="grid grid-cols-4 gap-4 mb-3 items-stretch">
                    <div className="col-span-3">
                        <table className="w-full text-xs border border-slate-400">
                            <tbody>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1 bg-slate-100 font-bold w-36 text-slate-700">
                                    Student Name (শিক্ষার্থী)
                                </td>
                                <td className="border border-slate-300 px-3 py-1 font-bold text-slate-900">
                                    {marksheet?.marks?.[0]?.firstname} {marksheet?.marks?.[0]?.lastname}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1 bg-slate-100 font-bold text-slate-700">
                                    Father's Name (পিতার নাম)
                                </td>
                                <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">
                                    {marksheet?.marks?.[0]?.fathername || "Md. Rafiqul Islam"}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1 bg-slate-100 font-bold text-slate-700">
                                    Mother's Name (মাতার নাম)
                                </td>
                                <td className="border border-slate-300 px-3 py-1 font-semibold text-slate-800">
                                    {marksheet?.marks?.[0]?.mothername || "Mst. Rehana Begum"}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1 bg-slate-100 font-bold text-slate-700">
                                    Class (শ্রেণি)
                                </td>
                                <td className="border border-slate-300 px-3 py-1 font-semibold">
                                    {courseDisplay}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1 bg-slate-100 font-bold text-slate-700">
                                    Roll Number (রোল)
                                </td>
                                <td className="border border-slate-300 px-3 py-1 font-mono font-bold text-indigo-700">
                                    {marksheet?.marks?.[0]?.rollnumber}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-slate-300 px-3 py-1 bg-slate-100 font-bold text-slate-700">
                                    Examination (পরীক্ষা)
                                </td>
                                <td className="border border-slate-300 px-3 py-1 font-bold text-slate-800">
                                    {examTitle}
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* PHOTO */}
                    <div className="flex justify-center items-center">
                        <div className="w-[100px] h-[115px] border-2 border-slate-700 p-0.5 rounded shadow-sm bg-white overflow-hidden">
                            <img
                                src={`${api.defaults.baseURL}/uploads/students/${marksheet?.marks?.[0]?.profilepic}`}
                                alt="Student"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = `${api.defaults.baseURL}/uploads/students/default.png`;
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. MARKS TABLE WITH CQ, MCQ, PRACTICAL */}
                <div className="flex-1 mb-2">
                    <table className="w-full border-2 border-slate-700 text-[11px] border-collapse">
                        <thead>
                        <tr className="bg-slate-800 text-white text-center font-bold">
                            <th className="border border-slate-600 px-2 py-1.5 w-8">#</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-16">Code</th>
                            <th className="border border-slate-600 px-3 py-1.5 text-left">Subject Name (বিষয়)</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-16">CQ (সৃজনশীল)</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-16">MCQ (নৈর্ব্যক্তিক)</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-16">Practical</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-20">Total Marks</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-14">Grade</th>
                            <th className="border border-slate-600 px-2 py-1.5 w-14">GP</th>
                        </tr>
                        </thead>
                        <tbody>
                        {marksheet?.marks?.map((m, i) => {
                            const cq = m.cq_marks !== undefined ? Number(m.cq_marks) : null;
                            const mcq = m.mcq_marks !== undefined ? Number(m.mcq_marks) : null;
                            const practical = Number(m.practicalmarks) || 0;
                            const total = Number(m.totalmarks) || (Number(m.theorymarks || 0) + practical);
                            const maxTotal = Number(m.maxmarks) || (Number(m.theoryfull || 0) + Number(m.practicalfull || 0));

                            const grade = m.grade || (getGrade ? getGrade((total / maxTotal) * 100) : calculateNCTBGrade(total, maxTotal).grade);
                            const gp = m.gradepoint || calculateNCTBGrade(total, maxTotal).point.toFixed(2);

                            const cqMax = Number(m.cq_max_marks || 0);
                            const mcqMax = Number(m.mcq_max_marks || 0);
                            const practMax = Number(m.practicalfull || 0);

                            return (
                                <tr key={i} className={`text-center ${i % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-slate-100`}>
                                    <td className="border border-slate-300 px-2 py-1 font-semibold">{i + 1}</td>
                                    <td className="border border-slate-300 px-2 py-1 font-mono text-[10px] text-slate-600">{m.subjectcode}</td>
                                    <td className="border border-slate-300 px-3 py-1 text-left font-bold text-slate-800">{m.subjectname}</td>
                                    
                                    {/* CQ */}
                                    <td className="border border-slate-300 px-2 py-1">
                                        {cqMax > 0 ? (
                                            <span><strong>{cq ?? m.theorymarks}</strong><span className="text-[9px] text-slate-400">/{cqMax}</span></span>
                                        ) : "-"}
                                    </td>

                                    {/* MCQ */}
                                    <td className="border border-slate-300 px-2 py-1">
                                        {mcqMax > 0 ? (
                                            <span><strong>{mcq ?? 0}</strong><span className="text-[9px] text-slate-400">/{mcqMax}</span></span>
                                        ) : "-"}
                                    </td>

                                    {/* Practical */}
                                    <td className="border border-slate-300 px-2 py-1">
                                        {practMax > 0 ? (
                                            <span><strong>{practical}</strong><span className="text-[9px] text-slate-400">/{practMax}</span></span>
                                        ) : "-"}
                                    </td>

                                    {/* Total */}
                                    <td className="border border-slate-300 px-2 py-1 font-bold text-slate-900 bg-slate-50">
                                        {total}<span className="text-[9px] font-normal text-slate-500">/{maxTotal}</span>
                                    </td>

                                    {/* Grade */}
                                    <td className={`border border-slate-300 px-2 py-1 font-black ${
                                        grade === "A+" ? "text-emerald-700" :
                                        grade === "F" ? "text-red-700 bg-red-50" : "text-blue-700"
                                    }`}>
                                        {grade}
                                    </td>

                                    {/* Grade Point */}
                                    <td className="border border-slate-300 px-2 py-1 font-mono font-bold text-slate-800">
                                        {gp}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                {/* 4. PERFORMANCE SUMMARY */}
                {summary && (
                    <div className="border-2 border-slate-700 rounded bg-slate-50 p-2 mb-3">
                        <div className="grid grid-cols-5 text-center divide-x-2 divide-slate-300 text-xs">
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">Total Marks</div>
                                <div className="text-sm font-black text-slate-900 mt-0.5">
                                    {summary.totalObtained} / {summary.totalMaximum}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">Percentage</div>
                                <div className="text-sm font-black text-slate-900 mt-0.5">
                                    {summary.percentage}%
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">GPA (গ্রেড পয়েন্ট)</div>
                                <div className="text-sm font-black text-indigo-700 mt-0.5 font-mono">
                                    {summary.gpa || "0.00"}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">Final Grade</div>
                                <div className={`text-sm font-black mt-0.5 ${summary.finalGrade === "A+" ? "text-emerald-700" : summary.finalGrade === "F" ? "text-red-700" : "text-blue-700"}`}>
                                    {summary.finalGrade}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase font-bold text-slate-500">Result (ফলাফল)</div>
                                <div className={`text-sm font-black mt-0.5 ${summary.result === "PASSED" ? "text-emerald-700" : "text-red-700"}`}>
                                    {summary.result}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. FOOTER & AUTHENTICATION SIGNATURES */}
                <div className="border-t-2 border-slate-800 pt-2 text-[10px] text-slate-700">
                    <div className="grid grid-cols-3 items-end gap-2">
                        {/* Class Teacher */}
                        <div className="text-center">
                            <div className="h-10"></div>
                            <div className="border-t border-slate-700 w-36 mx-auto pt-1 font-bold text-slate-800">
                                শ্রেণি শিক্ষকের স্বাক্ষর
                                <p className="text-[9px] font-normal text-slate-500">Class Teacher</p>
                            </div>
                        </div>

                        {/* QR Verification */}
                        <div className="flex flex-col items-center">
                            <div className="border border-slate-300 rounded p-1.5 bg-white text-center shadow-sm">
                                <QRCodeCanvas
                                    value={
                                        `DIMLA GOVT GIRLS' HIGH SCHOOL\n` +
                                        `Student: ${marksheet?.marks?.[0]?.firstname || ''} ${marksheet?.marks?.[0]?.lastname || ''}\n` +
                                        `Class: ${courseDisplay}\n` +
                                        `Roll: ${marksheet?.marks?.[0]?.rollnumber || ''}\n` +
                                        `Exam: ${examTitle}\n` +
                                        `GPA: ${summary?.gpa || 'N/A'} (${summary?.finalGrade || ''})\n` +
                                        `Result: ${summary?.result || 'N/A'}\n` +
                                        `Verify: ${verificationUrl || window.location.href}`
                                    }
                                    size={68}
                                    includeMargin={false}
                                />
                                <p className="text-[8px] font-mono text-slate-500 mt-1">Scan for Info & Verify</p>
                            </div>
                        </div>

                        {/* Headmaster */}
                        <div className="text-center">
                            <div className="h-10 flex items-center justify-center">
                                <img
                                    src={`${api.defaults.baseURL}/uploads/admin/signature.png`}
                                    alt="headmaster signature"
                                    className="h-8 object-contain"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>
                            <div className="border-t border-slate-700 w-36 mx-auto pt-1 font-bold text-slate-800">
                                প্রধান শিক্ষকের স্বাক্ষর
                                <p className="text-[9px] font-normal text-slate-500">Headmaster</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-2 text-center text-[8px] text-slate-400 font-mono">
                        This academic progress report is verified and securely stored in Dimla Government Girls' High School Digital Academic System.
                    </div>
                </div>

            </div>
        </div>
    );
};

export default MarksheetLayout;