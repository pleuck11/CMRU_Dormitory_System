"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { collection, query, getDocs, getCountFromServer, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminNotificationBell from "@/components/AdminNotificationBell";

interface RepairItem {
  id: string;
  room: string;
  issue: string;
  status: string;
  date: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { name: "อัตราการเข้าพัก", value: "0%", change: "0%", changeType: "neutral", icon: "room" },
    { name: "ยอดค้างชำระ", value: "฿0", change: "0", changeType: "neutral", icon: "money" },
    { name: "รายรับเดือนนี้", value: "฿0", change: "0", changeType: "neutral", icon: "revenue" },
    { name: "คิวงานซ่อม", value: "0 งาน", change: "0", changeType: "neutral", icon: "wrench" },
  ]);
  const [recentRepairs, setRecentRepairs] = useState<RepairItem[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // ดึงสถิติจริงจาก Firestore ที่นี่
        
        // ตัวอย่าง: นับจำนวนการแจ้งซ่อมทั้งหมด
        const repairsCol = collection(db, "repairs");
        const snapshot = await getCountFromServer(repairsCol);
        const totalRepairs = snapshot.data().count;

        setStats([
            { name: "อัตราการเข้าพัก", value: "0%", change: "0%", changeType: "neutral", icon: "room" },
            { name: "ยอดค้างชำระ", value: "฿0", change: "0", changeType: "neutral", icon: "money" },
            { name: "รายรับเดือนนี้", value: "฿0", change: "0", changeType: "neutral", icon: "revenue" },
            { name: "คิวงานซ่อม", value: `${totalRepairs} งาน`, change: "0", changeType: "neutral", icon: "wrench" },
        ]);

        // ดึงข้อมูลห้องทั้งหมดเพื่อแมป tenantId กับหมายเลขห้อง
        const roomsSnap = await getDocs(collection(db, "rooms"));
        const roomsMap = new Map();
        roomsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.tenantId) {
                roomsMap.set(data.tenantId, `${data.building}${data.roomNumber}`);
            }
        });

        // ดึงข้อมูลการแจ้งซ่อมล่าสุด
        const repairsQuery = query(repairsCol, orderBy("createdAt", "desc"));
        const repairsDocs = await getDocs(repairsQuery);
        const repairsList: RepairItem[] = [];
        
        repairsDocs.forEach(doc => {
            const data = doc.data();
            const tenantId = data.tenantId;
            const roomNumber = roomsMap.get(tenantId) || "-";

            repairsList.push({ 
                id: doc.id, 
                room: roomNumber,
                issue: data.type || data.issue || "ไม่ระบุ",
                status: data.status || "ใหม่",
                date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('th-TH') : "-",
                ...data 
            } as any);
        });
        setRecentRepairs(repairsList);

      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
          setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">ภาพรวมระบบ</h1>
          <p className="text-[var(--text-muted)] mt-1">ข้อมูลสรุปสถิติและการดำเนินการที่สำคัญ</p>
        </div>
        <div className="hidden md:flex items-center">
          <AdminNotificationBell />
        </div>
      </div>

      {/* การ์ดสถิติ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={stat.name} className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
            <div className={`absolute top-0 right-0 p-4 opacity-5 rounded-bl-full w-24 h-24 -mt-8 -mr-8 group-hover:scale-110 transition-transform ${
              stat.icon === "room" ? ".bg-[var(--accent-brown)]" :
              stat.icon === "money" ? "bg-red-500" :
              stat.icon === "revenue" ? "bg-emerald-500" :
              "bg-amber-500"
            }`}></div>
            <div className="absolute top-0 right-0 w-32 h-32 .bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-2xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
            <div className="flex items-center justify-between relative z-10">
              <p className="text-sm font-medium .text-[var(--text-muted)]">{stat.name}</p>
              <div className={`p-3 rounded-2xl shadow-sm border border-white/50 backdrop-blur-md ${
                stat.icon === "room" ? ".bg-[var(--accent-light)]/40 .text-[var(--accent-dark)]" :
                stat.icon === "money" ? "bg-red-50 text-red-600" :
                stat.icon === "revenue" ? "bg-emerald-50 text-emerald-600" :
                "bg-amber-50 text-amber-600"
              }`}>
                {stat.icon === "room" && <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
                {stat.icon === "money" && <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>}
                {stat.icon === "revenue" && <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
                {stat.icon === "wrench" && <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>}
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2 relative z-10">
              <span className="text-3xl font-bold .text-[var(--text-main)] tracking-tight">{loading ? "-" : stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ตารางการแจ้งซ่อมล่าสุด */}
        <div className="lg:col-span-2 glass-panel rounded-3xl overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b .border-[var(--glass-border)] flex justify-between items-center bg-white/30 backdrop-blur-md">
            <h3 className="text-lg font-bold .text-[var(--text-main)]">รายการแจ้งซ่อมล่าสุด</h3>
            <Link href="/admin/repair_request" className="text-sm font-semibold .text-[var(--accent-dark)] .hover:text-[var(--accent-brown)] transition-colors">ดูทั้งหมด</Link>
          </div>
          <div className="flex-1 overflow-x-auto min-h-[200px]">
             {loading ? (
                <div className="flex justify-center items-center h-full py-16">
                    <div className="w-10 h-10 border-4 .border-[var(--accent-light)] .border-t-[var(--accent-brown)] rounded-full animate-spin"></div>
                </div>
             ) : recentRepairs.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full py-16 .text-[var(--text-muted)]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-4"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <p className="font-medium text-lg">ไม่มีรายการแจ้งซ่อมล่าสุด</p>
                 </div>
             ) : (
                <table className="w-full text-sm text-left border-collapse block md:table">
                <thead className="text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] hidden md:table-header-group">
                    <tr>
                    <th className="px-6 py-4 font-semibold">รหัสงาน</th>
                    <th className="px-6 py-4 font-semibold">ห้อง</th>
                    <th className="px-6 py-4 font-semibold">ปัญหาที่พบ</th>
                    <th className="px-6 py-4 font-semibold">สถานะ</th>
                    <th className="px-6 py-4 font-semibold text-right">วันที่แจ้ง</th>
                    </tr>
                </thead>
                <tbody className="block md:table-row-group p-4 md:p-0">
                    {recentRepairs.map((repair, idx) => (
                    <tr key={repair.id} className="block md:table-row bg-white/40 md:bg-transparent border border-[var(--glass-border)] md:border-0 md:border-b mb-4 md:mb-0 rounded-2xl md:rounded-none p-4 md:p-0 hover:bg-white/60 transition-colors shadow-sm md:shadow-none">
                        <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 font-medium text-[var(--text-main)] mb-3 md:mb-0">
                            <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">รหัสงาน:</span>
                            <span className="text-right md:text-left">{idx + 1}</span>
                        </td>
                        <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 text-[var(--text-main)] font-medium mb-3 md:mb-0">
                            <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">ห้อง:</span>
                            <span className="text-right md:text-left">{repair.room}</span>
                        </td>
                        <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 text-[var(--text-muted)] mb-3 md:mb-0">
                            <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">ปัญหาที่พบ:</span>
                            <span className="text-right md:text-left">{repair.issue}</span>
                        </td>
                        <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 mb-3 md:mb-0">
                            <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">สถานะ:</span>
                            <span className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-semibold border shadow-sm ${
                                repair.status === 'กำลังดำเนินการ' ? 'bg-blue-50/80 text-blue-700 border-blue-200 backdrop-blur-sm' :
                                repair.status === 'รอคิว' ? 'bg-amber-50/80 text-amber-700 border-amber-200 backdrop-blur-sm' :
                                'bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm'
                            }`}>
                                {repair.status}
                            </span>
                        </td>
                        <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 border-t border-[var(--glass-border)] md:border-t-0 pt-3 md:pt-0">
                            <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">วันที่แจ้ง:</span>
                            <span className="text-right text-[var(--text-muted)] text-xs">{repair.date}</span>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
             )}
          </div>
        </div>

        {/* การดำเนินการด่วน */}
        <div className="glass-panel rounded-3xl overflow-hidden flex flex-col h-full">
          <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-white/30 backdrop-blur-md">
            <h3 className="text-lg font-bold text-[var(--text-main)]">การดำเนินการด่วน</h3>
          </div>
          <div className="p-5 space-y-3 flex-1">
            {[
              { name: "ออกบิลค่าเช่าประจำเดือน", icon: "bill", color: "text-amber-600", bg: "bg-amber-50 border-amber-100", href: "/admin/bills_payments" },
              { name: "จัดการผู้เช่า", icon: "users", color: "text-[var(--accent-dark)]", bg: "bg-[var(--accent-light)] border-[var(--accent-light)]", href: "/admin/manage_tenants" },
              { name: "จัดการตึกและห้องพัก", icon: "door", color: "text-blue-600", bg: "bg-blue-50 border-blue-100", href: "/admin/rooms" },
              { name: "คำขอจองห้อง", icon: "requests", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", href: "/admin/room_requests" }
            ].map((action) => (
              <Link key={action.name} href={action.href} className="w-full flex items-center justify-between p-4 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--accent-brown)] bg-white/40 hover:bg-white/70 transition-all group shadow-sm hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl border shadow-sm ${action.bg} ${action.color}`}>
                    {action.icon === "bill" && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
                    {action.icon === "users" && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                    {action.icon === "door" && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15v4a2 2 0 0 1-2 2H5"/><path d="M11 18h2"/><path d="M21 8v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8"/><path d="M15 8V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4z"/></svg>}
                    {action.icon === "requests" && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>}
                  </div>
                  <span className="text-[15px] font-bold text-[var(--text-main)] group-hover:text-[var(--accent-dark)] transition-colors">{action.name}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/50 border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent-brown)] group-hover:border-[var(--accent-brown)] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-white transition-colors"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
