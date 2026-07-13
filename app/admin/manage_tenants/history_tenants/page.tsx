"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface HistoryTenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  pastRoom: string;
  tenantStatus: string;
  isDeleted?: boolean;
  movedOutAt?: any;
}

export default function TenantHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [historyList, setHistoryList] = useState<HistoryTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // ดึงผู้ใช้ที่มีสถานะ moved_out หรือ isDeleted == true
        // แต่ใน Firebase Firestore เราอาจจะใช้ multiple where queries ค่อนข้างยากถ้ามันเป็น OR
        // เพื่อให้ง่าย, เราดึง role == "tenant" หรือ role == "user" มา กรองในฝั่ง client 
        // หรือจะสร้าง query เฉพาะ 
        const q = query(collection(db, "users"), where("tenantStatus", "==", "moved_out"));
        const snapshot1 = await getDocs(q);
        
        const deletedQuery = query(collection(db, "users"), where("isDeleted", "==", true));
        const snapshot2 = await getDocs(deletedQuery);

        // รวมผู้ใช้ เพื่อป้องกันการซ้ำ
        const userMap = new Map<string, HistoryTenant>();

        const processDoc = (userDoc: any) => {
          const uData = userDoc.data();
          userMap.set(userDoc.id, {
            id: userDoc.id,
            name: uData.name || "ไม่ทราบชื่อ",
            email: uData.email || "-",
            phone: uData.phone || "-",
            pastRoom: uData.pastRoom || "ไม่ระบุ",
            tenantStatus: uData.tenantStatus || "unknown",
            isDeleted: uData.isDeleted || false,
            movedOutAt: uData.movedOutAt || null
          });
        };

        snapshot1.docs.forEach(processDoc);
        snapshot2.docs.forEach(processDoc);

        const mergedList = Array.from(userMap.values());
        
        // เรียงลำดับตามเวลาล่าสุด
        mergedList.sort((a, b) => {
          const timeA = a.movedOutAt?.toMillis?.() || 0;
          const timeB = b.movedOutAt?.toMillis?.() || 0;
          return timeB - timeA;
        });

        setHistoryList(mergedList);
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงประวัติ:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "-";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).format(date);
  };

  const filteredHistory = historyList.filter(t => 
    t.name.includes(searchQuery) || t.pastRoom.includes(searchQuery) || t.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">
      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
             <Link href="/admin/manage_tenants" className="text-[var(--text-muted)] hover:text-[var(--accent-brown)] transition-colors p-2 -ml-2 rounded-full hover:bg-black/5">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
             </Link>
             <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">ประวัติผู้เช่าห้องพัก</h1>
          </div>
          <p className="text-[var(--text-muted)] mt-1 ml-11">ประวัติผู้เช่าที่ย้ายออกหรือถูกลบออกจากระบบไปแล้ว</p>
        </div>
      </div>

      {/* การ์ดเนื้อหาหลัก */}
      <div className="glass-panel overflow-hidden rounded-3xl flex flex-col">
        {/* แถบเครื่องมือ */}
        <div className="p-5 border-b border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-center justify-between relative z-10">
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-brown)] transition-colors"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
            </div>
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, ห้องเก่า, หรือเบอร์โทร..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-11 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
          </div>
        </div>

        {/* ข้อมูลตาราง */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left relative z-10 border-collapse block md:table">
            <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ห้องที่เคยพัก</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ช่องทางติดต่อ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">วันที่ย้ายออก</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">สถานะบัญชี</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin mb-2"></div>
                      <span>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span>ไม่พบข้อมูลประวัติ</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((tenant) => (
                  <tr key={tenant.id} className="block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b hover:bg-white/60 md:hover:bg-white/40 transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group">
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                        <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ห้องที่เคยพัก</span>
                        <div className="flex items-center gap-3">
                            <div className="h-9 px-3 border border-[var(--glass-border)] rounded-xl bg-[var(--glass-bg)] text-[var(--text-main)] flex items-center justify-center font-bold text-sm shadow-sm backdrop-blur-sm">
                                {tenant.pastRoom}
                            </div>
                        </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--text-main)] text-base border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ชื่อ-นามสกุล</span>
                      {tenant.name}
                    </td>
                    <td className="flex flex-col md:table-cell items-end md:items-start px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0 text-right md:text-left gap-1 md:gap-0">
                       <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase mb-1">ช่องทางติดต่อ</span>
                       <span className="flex items-center justify-end md:justify-start gap-2"><span className="text-[var(--accent-brown)]">📞</span> {tenant.phone}</span>
                       <span className="flex items-center justify-end md:justify-start gap-2 md:mt-1"><span className="text-[var(--accent-brown)]">✉️</span> {tenant.email}</span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">วันที่ย้ายออก</span>
                      <span className="text-[var(--text-main)] font-medium bg-black/5 rounded-lg inline-block md:my-3 font-mono px-3 py-1.5 border border-black/5">
                        {formatDate(tenant.movedOutAt)}
                      </span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">สถานะบัญชี</span>
                      {tenant.isDeleted ? (
                         <span className="px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-red-50/80 text-red-700 border-red-200 backdrop-blur-sm">บัญชีถูกลบ</span>
                      ) : (
                         <span className="px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-slate-50/80 text-slate-700 border-slate-200 backdrop-blur-sm">ย้ายออกแล้ว</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
