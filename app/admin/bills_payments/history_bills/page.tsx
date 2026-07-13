"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface PaymentRecord {
  id: string;
  billId: string;
  tenantName: string;
  room: string;
  building: string;
  amount: number;
  paidAt: string; // วันที่ชำระ
  method: "cash" | "transfer" | "promptpay";
  note?: string;
}

import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ข้อมูลตัวอย่าง (เชื่อมต่อ Firestore แล้ว — ไม่ใช้งานแล้ว)
// const mockPayments: PaymentRecord[] = [];

const methodLabel: Record<PaymentRecord["method"], string> = {
  cash: "เงินสด",
  transfer: "โอนเงิน",
  promptpay: "พร้อมเพย์",
};

const methodColor: Record<PaymentRecord["method"], string> = {
  cash: "bg-emerald-50/80 text-emerald-700 border-emerald-200",
  transfer: "bg-blue-50/80 text-blue-700 border-blue-200",
  promptpay: "bg-purple-50/80 text-purple-700 border-purple-200",
};

export default function PaymentHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // โหลดข้อมูลล่าสุดจาก Firebase
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        // ดึงบิลทั้งหมดเพื่อแมปเลขที่บิลให้ตรงกับหน้าหลัก
        const q = query(collection(db, "bills"));
        const snapshot = await getDocs(q);
        const tempBills: any[] = [];
        
        snapshot.forEach((doc) => {
          tempBills.push({ id: doc.id, ...doc.data() });
        });
        
        // เรียงตามเวลาเพื่อหาลำดับที่ถูกต้อง
        tempBills.sort((a, b) => {
          return (a.createdAt || "").localeCompare(b.createdAt || "");
        });
        
        const fetched: PaymentRecord[] = [];
        tempBills.forEach((data, index) => {
          if (data.status === "paid") {
            const displayBillNumber = data.billNumber ? data.billNumber : `INV-${String(index + 1).padStart(4, '0')}`;
            fetched.push({
              id: data.id,
              billId: displayBillNumber,
              tenantName: data.tenantName || "ไม่ระบุ",
              room: data.roomNumber || "-",
              building: data.building || "-",
              amount: data.totalAmount || 0,
              paidAt: data.paymentDate || data.updatedAt || data.createdAt?.split("T")[0] || "-",
              method: data.paymentMethod || "transfer",
              note: data.note || "",
            });
          }
        });
        
        // เรียงใหม่ล่าสุด
        fetched.sort((a, b) => b.paidAt.localeCompare(a.paidAt));
        setPayments(fetched);
      } catch (error) {
        console.error("Error fetching payments:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  // กรองข้อมูล
  const filtered = payments.filter((p) => {
    const matchSearch =
      p.tenantName.includes(searchQuery) ||
      p.room.includes(searchQuery) ||
      p.billId.includes(searchQuery) ||
      p.id.includes(searchQuery);
    const matchMonth = filterMonth
      ? p.paidAt.startsWith(filterMonth)
      : true;
    return matchSearch && matchMonth;
  });

  const totalPaid = filtered.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">
      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/bills_payments"
            className="glass-button-outline flex items-center justify-center p-2 rounded-lg hover:bg-white/50 transition-all"
            title="ย้อนกลับ"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">
              ประวัติการชำระเงิน
            </h1>
            <p className="text-[var(--text-muted)] mt-1">
              บันทึกการชำระค่าเช่าและค่าใช้จ่ายทั้งหมดของผู้เช่า
            </p>
          </div>
        </div>
      </div>

      {/* สถิติรวม */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* ยอดรวมที่ชำระ */}
        <div className="glass-panel p-6 rounded-3xl flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-sm backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">ยอดชำระรวม</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--text-main)]">
                ฿{totalPaid.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* จำนวนรายการ */}
        <div className="glass-panel p-6 rounded-3xl flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-600 flex items-center justify-center shadow-sm backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">จำนวนรายการ</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--text-main)]">{filtered.length}</span>
              <span className="text-sm font-medium text-[var(--text-muted)]">รายการ</span>
            </div>
          </div>
        </div>

        {/* รายการล่าสุด */}
        <div className="glass-panel p-6 rounded-3xl flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-600 flex items-center justify-center shadow-sm backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">รายการล่าสุด</p>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-[var(--text-main)]">
                {filtered.length > 0 ? filtered[0].paidAt : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* การ์ดตารางรายการ */}
      <div className="glass-panel overflow-hidden rounded-3xl flex flex-col">
        {/* แถบเครื่องมือ */}
        <div className="p-5 border-b border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* ค้นหา */}
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-brown)] transition-colors">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้เช่า, ห้อง, เลขที่บิล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-11 pr-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
          </div>

          {/* กรองตามเดือน */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="glass-input px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--text-main)] w-full sm:w-auto bg-white/50 backdrop-blur-md"
            />
            {filterMonth && (
              <button
                onClick={() => setFilterMonth("")}
                className="glass-button-outline px-3 py-2.5 rounded-xl text-sm font-bold hover:bg-white/50 transition-all whitespace-nowrap"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* ตาราง */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left border-collapse block md:table">
            <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">เลขที่รายการ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">เลขที่บิล</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ห้อง</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ผู้เช่า</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ยอดชำระ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">วันที่ชำระ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ช่องทาง</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>ไม่พบประวัติการชำระเงิน</span>
                      <span className="text-sm font-normal opacity-60">ยังไม่มีรายการชำระเงินในระบบ</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b hover:bg-white/60 md:hover:bg-white/40 transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group"
                  >
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--accent-dark)] text-base border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">เลขที่รายการ</span>
                      {p.id}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-medium text-[var(--text-muted)] border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">เลขที่บิล</span>
                      {p.billId}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ห้อง</span>
                      <div className="w-9 h-9 border border-[var(--accent-brown)]/30 rounded-xl bg-[var(--accent-light)]/40 text-[var(--accent-dark)] flex items-center justify-center font-bold text-sm shadow-sm backdrop-blur-sm">
                        {p.room}
                      </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--text-main)] border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ผู้เช่า</span>
                      {p.tenantName}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-emerald-700 text-base border-b border-[var(--glass-border)] md:border-0 mt-2 md:mt-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ยอดชำระ</span>
                      ฿{p.amount.toLocaleString()}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium whitespace-nowrap border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">วันที่ชำระ</span>
                      <span><span className="text-[var(--accent-brown)] mr-1">📅</span>{p.paidAt}</span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ช่องทาง</span>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${methodColor[p.method]}`}>
                        {methodLabel[p.method]}
                      </span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">หมายเหตุ</span>
                      {p.note || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ส่วนท้าย */}
        <div className="p-5 border-t border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex items-center justify-between text-sm text-[var(--text-muted)] font-medium">
          <div>
            แสดงผล {filtered.length} จาก {payments.length} รายการ
          </div>
          <div className="flex gap-2">
            <button className="glass-button-outline px-4 py-2 rounded-lg border border-slate-200 hover:bg-white/50 hover:border-slate-300 disabled:opacity-50 transition-all font-semibold" disabled>
              ก่อนหน้า
            </button>
            <button className="glass-button px-4 py-2 border border-transparent rounded-lg text-white font-bold shadow-sm">
              1
            </button>
            <button className="glass-button-outline px-4 py-2 rounded-lg border border-slate-200 hover:bg-white/50 hover:border-slate-300 disabled:opacity-50 transition-all font-semibold" disabled>
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
