"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

// โครงสร้างข้อมูลบิล
interface Bill {
  id: string;
  month: string;
  dueDate: string;
  roomNumber: string;
  building: string;
  tenantName?: string;
  rentAmount: number;
  waterFee: number;
  electricFee: number;
  garbageFee: number;
  totalAmount: number;
  status: "paid" | "pending" | "overdue";
}

// โครงสร้างข้อมูลบัญชีธนาคาร
interface BankAccount {
  accountName: string;
  accountNumber: string;
  bankName: string;
  promptPayNumber: string;
  qrImageUrl: string;
}

export default function TenantBillsPaymentsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // ============ ชำระเงิน ============
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  useEffect(() => {
    const fetchBills = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(collection(db, "bills"), where("tenantId", "==", user.uid));
        const snapshot = await getDocs(q);
        const data: Bill[] = [];
        snapshot.forEach((d) => data.push({ id: d.id, ...d.data() } as Bill));
        data.sort((a, b) => b.month.localeCompare(a.month));
        setBills(data);
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลบิล:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchBankAccount = async () => {
      try {
        const docRef = doc(db, "bankAccount", "owner");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setBankAccount(docSnap.data() as BankAccount);
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลบัญชีธนาคาร:", error);
      }
    };

    fetchBills();
    fetchBankAccount();
  }, [user]);

  const openPayModal = (bill: Bill) => {
    setSelectedBill(bill);
    setIsPayModalOpen(true);
  };

  const handleUploadSlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBill) return;

    setIsVerifying(true);
    try {
      const formData = new FormData();
      formData.append("slip", file);
      formData.append("billId", selectedBill.id);

      const res = await fetch("/api/verify-slip", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "เกิดข้อผิดพลาดในการตรวจสอบสลิป");
        return;
      }

      // ตรวจสอบความสำเร็จจาก API
      const isSlipValid = data.success === true && (data.data?.success === true || data.data?.data?.success === true);

      if (isSlipValid) {
        toast.success("อัปโหลดหลักฐานสำเร็จ! ขอขอบคุณที่ชำระเงินเรียบร้อยแล้ว ✨");
        // อัปเดตสถานะในหน้าจอทันที
        setBills((prev) => prev.map(b => b.id === selectedBill.id ? { ...b, status: "paid" } : b));
        
        // รีเซ็ตการจ่ายเงิน
        setIsPayModalOpen(false);
      } else {
        toast.error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Error verifying slip:", error);
      alert(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการอัปโหลดสลิป");
    } finally {
      setIsVerifying(false);
      e.target.value = ""; // รีเซ็ต input
    }
  };

  const filteredBills = bills.filter((bill) => {
    const matchSearch =
      bill.month.includes(searchQuery) ||
      bill.roomNumber.includes(searchQuery) ||
      bill.id.includes(searchQuery);
    const matchStatus = filterStatus === "all" || bill.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPaid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.totalAmount, 0);
  const totalPending = bills.filter((b) => b.status === "pending").reduce((s, b) => s + b.totalAmount, 0);
  const totalOverdue = bills.filter((b) => b.status === "overdue").reduce((s, b) => s + b.totalAmount, 0);

  const formatMonth = (monthStr: string) => {
    if (!monthStr) return "-";
    const [year, month] = monthStr.split("-");
    const thaiMonths = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    return `${thaiMonths[parseInt(month)]} ${parseInt(year) + 543}`;
  };

  const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
    paid:    { label: "ชำระแล้ว",  dot: "bg-emerald-500", badge: "bg-emerald-50/80 text-emerald-700 border-emerald-200" },
    pending: { label: "รอชำระ",    dot: "bg-amber-500",   badge: "bg-amber-50/80 text-amber-700 border-amber-200" },
    overdue: { label: "ค้างชำระ",  dot: "bg-red-500",     badge: "bg-red-50/80 text-red-700 border-red-200" },
  };
  // fallback สำหรับ status ที่ไม่รู้จัก (ป้องกัน crash โดยอัตโนมัติ)
  const getStatus = (status: string) =>
    statusConfig[status] ?? { label: status || "ไม่ทราบ", dot: "bg-slate-400", badge: "bg-slate-50/80 text-slate-600 border-slate-200" };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-3 sm:p-6 relative z-10 w-full">

      {/* ส่วนหัว */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] tracking-tight">ยอดชำระและบิล</h1>
        <p className="text-[var(--text-muted)] mt-1 text-sm sm:text-base">ตรวจสอบบิลค่าเช่าและสถานะการชำระเงินของคุณ</p>
      </div>

      {/* การ์ดสรุปสถิติ */}
      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        {[
          { label: "ชำระแล้ว", value: totalPaid, color: "emerald", icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
          { label: "รอชำระ",   value: totalPending, color: "amber",   icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
          { label: "ค้างชำระ", value: totalOverdue, color: "red",     icon: <><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-panel p-3 sm:p-5 rounded-2xl sm:rounded-3xl flex items-center gap-2 sm:gap-4 hover:-translate-y-1 transition-transform duration-300">
            <div className={`w-8 h-8 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl bg-${color}-50/80 border border-${color}-200 text-${color}-600 flex items-center justify-center shadow-sm`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" className="sm:w-6 sm:h-6 w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {icon}
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] mb-0.5 truncate">{label}</p>
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className="text-base sm:text-2xl font-bold text-[var(--text-main)] truncate">{value.toLocaleString()}</span>
                <span className="text-[10px] sm:text-sm text-[var(--text-muted)] shrink-0">บาท</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* การ์ดหลัก */}
      <div className="glass-panel overflow-hidden rounded-2xl sm:rounded-3xl">

        {/* แถบค้นหา */}
        <div className="p-3 sm:p-5 border-b border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative group flex-1 sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
                <circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาเดือน, ห้อง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="glass-input px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent-brown)] bg-white/50 cursor-pointer"
          >
            <option value="all" className="bg-white">สถานะทั้งหมด</option>
            <option value="paid" className="bg-white">ชำระแล้ว</option>
            <option value="pending" className="bg-white">รอชำระ</option>
            <option value="overdue" className="bg-white">ค้างชำระ</option>
          </select>
        </div>

        {/* เนื้อหา */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--text-muted)]">
            <div className="w-8 h-8 border-2 border-[var(--accent-brown)]/30 border-t-[var(--accent-brown)] rounded-full animate-spin" />
            <span className="text-sm font-medium">กำลังโหลดข้อมูล...</span>
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-[var(--text-muted)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-25">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
            </svg>
            <span className="font-medium">ไม่พบข้อมูลบิล</span>
          </div>
        ) : (
          <>
            {/* === เค้าโครงแบบการ์ด (มือถือ < md) === */}
            <div className="md:hidden divide-y divide-[var(--glass-border)]">
              {filteredBills.map((bill) => {
                const st = getStatus(bill.status);
                return (
                  <div key={bill.id} className="p-4 hover:bg-white/40 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-[var(--text-main)] text-base">{formatMonth(bill.month)}</p>
                        <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-lg bg-[var(--accent-light)]/40 border border-[var(--accent-brown)]/20 text-[var(--accent-dark)] font-bold text-xs">
                          {bill.building && <span className="font-normal text-[var(--text-muted)]">ตึก {bill.building}</span>}
                          ห้อง {bill.roomNumber}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shrink-0 ${st.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>
                        {st.label}
                      </span>
                    </div>

                    {/* รายละเอียดค่าใช้จ่าย */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">ค่าเช่า</span>
                        <span className="font-medium text-[var(--text-main)]">฿{(bill.rentAmount||0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">ค่าน้ำ</span>
                        <span className="font-medium text-[var(--text-main)]">฿{(bill.waterFee||0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">ค่าไฟ</span>
                        <span className="font-medium text-[var(--text-main)]">฿{(bill.electricFee||0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">ค่าขยะ</span>
                        <span className="font-medium text-[var(--text-main)]">฿{(bill.garbageFee||0).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--glass-border)]">
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">ยอดรวม </span>
                        <span className="font-bold text-[var(--text-main)] text-base">฿{(bill.totalAmount||0).toLocaleString()}</span>
                        <span className="text-xs text-[var(--text-muted)] ml-2">📅 {bill.dueDate||"-"}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewBill(bill)}
                          className="glass-button-outline px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          ดูบิล
                        </button>
                        {bill.status !== "paid" && (
                          <button
                            onClick={() => openPayModal(bill)}
                            className="glass-button px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                            </svg>
                            ชำระเงิน
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* === เค้าโครงแบบตาราง (แท็บเล็ต/พีซี >= md) === */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">เดือน</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">ห้อง</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">ค่าเช่า</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">ค่าน้ำ</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">ค่าไฟ</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">ค่าขยะ</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">ยอดรวม</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">กำหนดชำระ</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">สถานะ</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBills.map((bill) => {
                    const st = getStatus(bill.status);
                    return (
                      <tr key={bill.id} className="border-b border-[var(--glass-border)] hover:bg-white/40 transition-colors last:border-0 group">
                        <td className="px-5 py-4 font-semibold text-[var(--text-main)] whitespace-nowrap">{formatMonth(bill.month)}</td>
                        <td className="px-5 py-4">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--accent-light)]/40 border border-[var(--accent-brown)]/20 text-[var(--accent-dark)] font-bold text-sm whitespace-nowrap">
                            {bill.building && <span className="text-xs font-medium text-[var(--text-muted)]">ตึก {bill.building}</span>}
                            {bill.roomNumber}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[var(--text-main)] font-medium">฿{(bill.rentAmount||0).toLocaleString()}</td>
                        <td className="px-5 py-4 text-[var(--text-muted)]">฿{(bill.waterFee||0).toLocaleString()}</td>
                        <td className="px-5 py-4 text-[var(--text-muted)]">฿{(bill.electricFee||0).toLocaleString()}</td>
                        <td className="px-5 py-4 text-[var(--text-muted)]">฿{(bill.garbageFee||0).toLocaleString()}</td>
                        <td className="px-5 py-4 font-bold text-[var(--text-main)] text-base">฿{(bill.totalAmount||0).toLocaleString()}</td>
                        <td className="px-5 py-4 text-[var(--text-muted)] font-medium whitespace-nowrap">📅 {bill.dueDate||"-"}</td>
                        <td className="px-5 py-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit border shadow-sm ${st.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setPreviewBill(bill)}
                              className="p-2 text-[var(--text-muted)] hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg transition-all"
                              title="ดูใบเสร็จ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </button>
                            {bill.status !== "paid" && (
                              <button
                                onClick={() => openPayModal(bill)}
                                className="glass-button px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                                </svg>
                                ชำระเงิน
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* แถบด้านล่าง */}
        {!loading && (
          <div className="p-4 border-t border-[var(--glass-border)] bg-white/30 backdrop-blur-md text-sm text-[var(--text-muted)] font-medium">
            แสดง {filteredBills.length} จาก {bills.length} รายการ
          </div>
        )}
      </div>

      {/* ============ Modal ดูบิล (Preview) ============ */}
      {previewBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewBill(null)} />
          <div className="relative bg-white w-[95%] max-w-lg rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="h-2 bg-gradient-to-r from-[#8B5E3C] via-[#C4874F] to-[#E5B07A]" />
            <div className="p-6 sm:p-8">
              {/* หัวบิล */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-[#8B5E3C] flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">ใบเสร็จรับเงิน</h2>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">หอพักหยาหยี๋ (Yayee Dormitory)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">เดือน</p>
                  <p className="text-lg font-extrabold text-[#8B5E3C]">{formatMonth(previewBill.month)}</p>
                </div>
              </div>
              {/* ข้อมูลผู้เช่า */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {previewBill.tenantName && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 col-span-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ผู้เช่า</p>
                    <p className="text-sm font-bold text-gray-800">{previewBill.tenantName}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ห้องพัก</p>
                  <p className="text-sm font-bold text-gray-800">ตึก {previewBill.building} ห้อง {previewBill.roomNumber}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">กำหนดชำระเงิน</p>
                  <p className="text-sm font-bold text-gray-800">📅 {previewBill.dueDate}</p>
                </div>
              </div>
              {/* รายการ */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden mb-6">
                <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">รายละเอียดค่าใช้จ่าย</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {[{icon:'🏠',label:'ค่าเช่าห้องพัก',val:previewBill.rentAmount},{icon:'💧',label:'ค่าน้ำประปา',val:previewBill.waterFee},{icon:'⚡',label:'ค่าไฟฟ้า',val:previewBill.electricFee},{icon:'🗑️',label:'ค่าขยะ',val:previewBill.garbageFee}].map(item=>(
                    <div key={item.label} className="flex justify-between items-center px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-sm border border-gray-100">{item.icon}</span>
                        <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">฿{(item.val||0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-gradient-to-r from-[#8B5E3C]/10 to-[#C4874F]/10 px-5 py-4 border-t-2 border-[#8B5E3C]/20 flex justify-between items-center">
                  <span className="text-base font-extrabold text-gray-800">ยอดรวมทั้งสิ้น</span>
                  <span className="text-2xl font-extrabold text-[#8B5E3C]">฿{(previewBill.totalAmount||0).toLocaleString()}</span>
                </div>
              </div>
              {/* สถานะ */}
              <div className="flex items-center justify-center mb-6">
                {previewBill.status === 'paid' ? (
                  <span className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-50 text-emerald-700 border-2 border-emerald-300 rounded-full font-bold text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ชำระเงินแล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-5 py-2 bg-amber-50 text-amber-700 border-2 border-amber-200 rounded-full font-bold text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    รอการชำระเงิน
                  </span>
                )}
              </div>
              <p className="text-center text-[10px] text-gray-300 font-medium">ขอบคุณที่ใช้บริการ · Yayee Dormitory Management System</p>
            </div>
            <div className="px-6 sm:px-8 pb-6 flex justify-end gap-3">
              <button onClick={() => setPreviewBill(null)} className="px-5 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold transition-colors text-sm">ปิด</button>
              {previewBill.status !== 'paid' && (
                <button onClick={() => { setPreviewBill(null); openPayModal(previewBill); }} className="px-5 py-2.5 bg-[#8B5E3C] hover:bg-[#734A2E] text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                  ชำระเงิน
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ Modal ชำระเงิน ============ */}
      {isPayModalOpen && selectedBill && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsPayModalOpen(false)} />
          <div className="relative glass-panel w-full sm:w-[95%] sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 max-h-[92vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {/* หัว */}
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-light)]/50 border border-[var(--accent-brown)]/20 text-[var(--accent-dark)] flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-main)]">ชำระเงิน</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {formatMonth(selectedBill.month)} — ตึก {selectedBill.building} ห้อง {selectedBill.roomNumber}
              </p>
            </div>

            {/* ยอดชำระ */}
            <div className="bg-[var(--accent-light)]/40 border border-[var(--accent-brown)]/20 rounded-2xl px-5 py-4 text-center">
              <p className="text-xs font-bold text-[var(--text-muted)] mb-1">ยอดที่ต้องชำระ</p>
              <p className="text-3xl font-bold text-[var(--accent-dark)]">฿{(selectedBill.totalAmount||0).toLocaleString()}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">กำหนดชำระ: {selectedBill.dueDate}</p>
            </div>

            {bankAccount ? (
              <>
                {(bankAccount.promptPayNumber || bankAccount.qrImageUrl) && (
                  <div className="flex flex-col items-center gap-3">
                    <img 
                      src={bankAccount.promptPayNumber ? `https://promptpay.io/${bankAccount.promptPayNumber}/${selectedBill.totalAmount}.png` : bankAccount.qrImageUrl} 
                      alt="QR PromptPay" 
                      className="w-48 h-48 object-contain rounded-2xl border border-[var(--glass-border)] bg-white p-2 shadow-[0_4px_10px_rgba(0,0,0,0.05)]" 
                    />
                  </div>
                )}

                
                <div className="pt-2">
                  <label className={`w-full glass-button flex flex-col items-center justify-center py-3 rounded-xl font-bold cursor-pointer transition-all ${isVerifying ? 'opacity-70 pointer-events-none' : ''}`}>
                    {isVerifying ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mb-1" />กำลังอัปโหลด...</>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" x2="12" y1="3" y2="15"/>
                        </svg>
                        อัปโหลดสลิปยืนยันการชำระเงิน
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadSlip} disabled={isVerifying} />
                  </label>
                  <p className="text-[10px] text-center text-[var(--text-muted)] mt-2">ระบบจะปรับสถานะเป็นชำระแล้วอัตโนมัติ</p>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-[var(--text-muted)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-30 mb-3">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
                <p className="text-sm font-medium">ยังไม่มีข้อมูลบัญชีธนาคาร</p>
                <p className="text-xs mt-1">กรุณาติดต่อแอดมินเพื่อรับข้อมูลการชำระเงิน</p>
              </div>
            )}

            <button onClick={() => setIsPayModalOpen(false)} className="w-full glass-button-outline py-2.5 rounded-xl font-bold">
              ปิด
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
