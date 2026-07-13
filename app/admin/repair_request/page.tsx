"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, getDocs, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

interface RepairRequest {
  id: string;
  room: string;
  issue: string;
  description: string;
  date: string;
  status: string;
  reportedBy: string;
  imageUrl?: string;
}

export default function RepairRequestPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ทุกสถานะ");
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        // 1. ดึงข้อมูลการแจ้งซ่อม
        const repairsQ = query(collection(db, "repairs"), orderBy("createdAt", "desc"));
        const repairsSnap = await getDocs(repairsQ);
        
        // 2. ดึงข้อมูลผู้ใช้ทั้งหมด
        const usersSnap = await getDocs(collection(db, "users"));
        const usersMap = new Map();
        usersSnap.docs.forEach(d => usersMap.set(d.id, d.data()));

        // 3. ดึงข้อมูลห้องทั้งหมด
        const roomsSnap = await getDocs(collection(db, "rooms"));
        const roomsMap = new Map(); // รหัสผู้เช่า -> หมายเลขห้อง
        roomsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.tenantId) {
                roomsMap.set(data.tenantId, `${data.building}${data.roomNumber}`);
            }
        });

        const requestsList = repairsSnap.docs.map(d => {
            const data = d.data();
            const tenantId = data.tenantId;
            const uData = usersMap.get(tenantId);
            const rData = roomsMap.get(tenantId);

            return {
                id: d.id,
                room: rData || "-",
                issue: data.type || data.issue || "ไม่ระบุ",
                description: data.detail || data.description || "-",
                date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('th-TH') : "-",
                status: data.status || "ใหม่",
                reportedBy: uData?.name || "ไม่ทราบชื่อ",
                imageUrl: data.imageUrl
            };
        });

        setRequests(requestsList);
      } catch (error) {
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const filteredRequests = requests.filter(r => {
    const matchSearch = r.room.includes(searchQuery) || r.issue.includes(searchQuery) || r.id.includes(searchQuery) || r.reportedBy.includes(searchQuery);
    const matchStatus = filterStatus === "ทุกสถานะ" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id: string, newStatus: string) => {
    try {
        await updateDoc(doc(db, "repairs", id), { status: newStatus });
        setRequests(requests.map(req => req.id === id ? { ...req, status: newStatus } : req));
    } catch (err) {
        console.error("Error updating status:", err);
        toast.error("อัปเดตสถานะไม่สำเร็จ");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">
      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">แจ้งซ่อม</h1>
          <p className="text-[var(--text-muted)] mt-1">รายการแจ้งซ่อมและประวัติการซ่อมบำรุงทั้งหมด</p>
        </div>
      </div>

       {/* ภาพรวมสถิติ */}
       <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-3xl hover:-translate-y-1 transition-transform duration-300">
              <p className="text-sm font-bold text-[var(--text-muted)] mb-1">ทั้งหมด</p>
              <p className="text-3xl font-bold text-[var(--text-main)]">{requests.length}</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border-red-200/50 bg-red-50/20 hover:-translate-y-1 transition-transform duration-300">
              <p className="text-sm font-bold text-red-600/80 mb-1">ใหม่</p>
              <p className="text-3xl font-bold text-red-600">{requests.filter(r => r.status === 'ใหม่').length}</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border-amber-200/50 bg-amber-50/20 hover:-translate-y-1 transition-transform duration-300">
              <p className="text-sm font-bold text-amber-600/80 mb-1">กำลังทำ</p>
              <p className="text-3xl font-bold text-amber-600">{requests.filter(r => r.status === 'กำลังทำ').length}</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border-emerald-200/50 bg-emerald-50/20 hover:-translate-y-1 transition-transform duration-300">
              <p className="text-sm font-bold text-emerald-600/80 mb-1">สำเร็จ</p>
              <p className="text-3xl font-bold text-emerald-600">{requests.filter(r => r.status === 'สำเร็จ').length}</p>
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
              placeholder="ค้นหารหัส, อาการ, ผู้แจ้ง, หรือห้อง..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-11 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="glass-input px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent w-full sm:w-auto bg-white/50 backdrop-blur-md cursor-pointer"
             >
                 <option value="ทุกสถานะ" className="bg-white">ทุกสถานะ</option>
                 <option value="ใหม่" className="bg-white">ใหม่</option>
                 <option value="กำลังทำ" className="bg-white">กำลังทำ</option>
                 <option value="สำเร็จ" className="bg-white">สำเร็จ</option>
                 <option value="ยกเลิก" className="bg-white">ยกเลิก</option>
             </select>
          </div>
        </div>

        {/* ข้อมูลตาราง */}
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-[var(--text-muted)] font-medium text-lg">
              <div className="w-10 h-10 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin"></div>
              <span>กำลังโหลดข้อมูล...</span>
            </div>
          ) : (
          <table className="w-full text-sm text-left relative z-10 border-collapse block md:table">
            <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ห้อง</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ปัญหาที่พบ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">วันที่แจ้ง</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">สถานะ</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">รูปภาพ</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <span>ไม่พบข้อมูลการแจ้งซ่อม</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request, idx) => (
                  <tr key={request.id} className="block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b hover:bg-white/60 md:hover:bg-white/40 transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group">
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                        <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ห้อง</span>
                        <div className="flex items-center gap-2">
                           <div className="w-10 h-10 border border-[var(--accent-brown)]/30 rounded-xl bg-[var(--accent-light)]/40 text-[var(--accent-dark)] flex items-center justify-center font-bold text-sm shadow-sm backdrop-blur-sm">
                              {request.room}
                           </div>
                           <span className="text-xs text-[var(--text-muted)] font-medium block">({request.reportedBy})</span>
                        </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-start md:items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                        <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase mt-1">ปัญหาที่พบ</span>
                        <div className="max-w-[250px] text-right md:text-left">
                            <p className="font-bold text-[var(--text-main)] truncate text-base mb-1">{request.issue}</p>
                            <p className="text-xs text-[var(--text-muted)] truncate font-medium mt-1" title={request.description}>{request.description}</p>
                        </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">วันที่แจ้ง</span>
                      <span><span className="text-[var(--accent-brown)] mr-1">📅</span>{request.date}</span>
                    </td>
                    <td className="flex items-center justify-between md:table-cell px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">สถานะ</span>
                      <div className="relative inline-block w-[130px] md:w-full md:min-w-[130px]">
                         <select 
                           value={request.status} 
                           onChange={(e) => updateStatus(request.id, e.target.value)}
                           className={`appearance-none w-full px-4 py-2 pr-8 rounded-xl text-xs font-bold border focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all cursor-pointer shadow-sm ${
                               request.status === 'สำเร็จ' ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm' :
                               request.status === 'กำลังทำ' ? 'bg-amber-50/80 text-amber-700 border-amber-200 backdrop-blur-sm' :
                               request.status === 'ยกเลิก' ? 'bg-slate-100/80 text-slate-700 border-slate-200 backdrop-blur-sm' :
                               'bg-blue-50/80 text-blue-700 border-blue-200 backdrop-blur-sm'
                           }`}
                         >
                            <option value="ใหม่" className="bg-white">ใหม่</option>
                            <option value="กำลังทำ" className="bg-white">กำลังทำ</option>
                            <option value="สำเร็จ" className="bg-white">สำเร็จ</option>
                            <option value="ยกเลิก" className="bg-white">ยกเลิก</option>
                         </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                             <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                         </div>
                      </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-right border-b border-[var(--glass-border)] md:border-0">
                       <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">รูปภาพ</span>
                       {request.imageUrl ? (
                         <a href={request.imageUrl} target="_blank" rel="noreferrer" className="inline-block">
                           <img src={request.imageUrl} alt="รูปซ่อม" className="w-10 h-10 rounded-lg object-cover border border-[var(--glass-border)] hover:scale-110 transition-transform shadow-sm" />
                         </a>
                       ) : (
                         <span className="text-xs text-[var(--text-muted)]">-</span>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
