"use client";

import { useState, useEffect } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/ReportPDF";

interface ReportData {
  month: string;
  revenue: number;
  expenses: number;
  occupancyRate: number;
  newTenants: number;
}

export default function ReportPage() {
  const [reportData] = useState<ReportData[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const exportCSV = () => {
    const headers = ["เดือน", "รายรับ (บาท)", "รายจ่าย (บาท)", "อัตราการเข้าพัก (%)", "ผู้เช่าใหม่ (คน)"];
    const csvContent = [
      headers.join(","),
      ...reportData.map(row => `${row.month},${row.revenue},${row.expenses},${row.occupancyRate},${row.newTenants}`)
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `dormitory_report_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">

      

      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">รายงานและสถิติ</h1>
          <p className="text-lg text-[var(--text-muted)] mt-1">สรุปข้อมูลผลประกอบการและการดำเนินงาน</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="glass-button-outline flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all hover:-translate-y-0.5 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 18H3"/><path d="m9 14 3 4-3 4"/><path d="M21 15v-1a2 2 0 0 0-2-2H9"/><path d="M14 2H6a2 2 0 0 0-2 2v6"/></svg>
            ส่งออก CSV
          </button>
          {mounted && (
            <PDFDownloadLink
              document={<ReportPDF reportData={reportData} />}
              fileName={`dormitory_report_${new Date().getTime()}.pdf`}
              className="glass-button flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-md group"
            >
              {({ loading }) => (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-y-0.5 transition-transform"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                  {loading ? 'กำลังเตรียม...' : 'ส่งออก PDF'}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* สรุปสถิติ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-2xl opacity-40 group-hover:opacity-60 transition-opacity" />
          <p className="text-sm font-bold text-[var(--text-muted)] mb-2 relative z-10">รายรับเฉลี่ย</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-extrabold text-[var(--text-main)] drop-shadow-sm">0</span>
            <span className="text-sm font-semibold text-[var(--text-muted)]">บ./เดือน</span>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 group-hover:opacity-50 transition-opacity" />
          <p className="text-sm font-bold text-[var(--text-muted)] mb-2 relative z-10">ค่าใช้จ่ายเฉลี่ย</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-extrabold text-[var(--text-main)] drop-shadow-sm">0</span>
            <span className="text-sm font-semibold text-[var(--text-muted)]">บ./เดือน</span>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
          <p className="text-sm font-bold text-[var(--text-muted)] mb-2 relative z-10">อัตราเข้าพักเฉลี่ย</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-extrabold text-[var(--text-main)] drop-shadow-sm">0</span>
            <span className="text-sm font-semibold text-[var(--text-muted)]">%</span>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200 rounded-full mix-blend-multiply filter blur-2xl opacity-30 group-hover:opacity-50 transition-opacity" />
          <p className="text-sm font-bold text-[var(--text-muted)] mb-2 relative z-10">ผู้เช่าใหม่ปีนี้</p>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-extrabold text-[var(--text-main)] drop-shadow-sm">0</span>
            <span className="text-sm font-semibold text-[var(--text-muted)]">คน</span>
          </div>
        </div>
      </div>

      {/* ข้อมูลตาราง */}
      <div className="glass-panel rounded-3xl overflow-hidden relative z-10">
        <div className="p-6 border-b border-[var(--glass-border)] bg-white/40 backdrop-blur-sm">
          <h3 className="text-lg font-bold text-[var(--text-main)]">ข้อมูลรายเดือน ปี 2026</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs font-bold text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)]">
              <tr>
                <th className="px-6 py-4 font-bold text-center">เดือน</th>
                <th className="px-6 py-4 font-bold text-right">รายรับ (บาท)</th>
                <th className="px-6 py-4 font-bold text-right">รายจ่าย (บาท)</th>
                <th className="px-6 py-4 font-bold text-center">อัตราการเข้าพัก (%)</th>
                <th className="px-6 py-4 font-bold text-center">ผู้เช่าใหม่ (คน)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/60 transition-colors border-b border-[var(--glass-border)]">
                  <td className="px-6 py-4 font-bold text-[var(--text-main)] text-center">{row.month}</td>
                  <td className="px-6 py-4 text-right text-emerald-700 font-bold">{row.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-red-700 font-bold">{row.expenses.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center text-[var(--text-main)] font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 h-2 bg-white/60 rounded-full overflow-hidden border border-[var(--glass-border)] shadow-inner">
                        <div className="h-full bg-gradient-to-r from-[var(--accent-brown)] to-[var(--accent-dark)] rounded-full" style={{ width: `${row.occupancyRate}%` }} />
                      </div>
                      <span>{row.occupancyRate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-[var(--text-main)] font-bold">{row.newTenants}</td>
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[var(--text-muted)]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 18H3"/><path d="m9 14 3 4-3 4"/><path d="M21 15v-1a2 2 0 0 0-2-2H9"/><path d="M14 2H6a2 2 0 0 0-2 2v6"/></svg>
                      <p className="font-bold">ไม่มีข้อมูลรายงาน</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
