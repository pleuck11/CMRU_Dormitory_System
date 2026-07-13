"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

interface Tenant {
  id: string;
  room: string;
  name: string;
  contact: string;
  status: "active" | "inactive" | "moved_out";
  moveInDate: string;
  tenantId: string;
  roomId: string;
  moveOutRequested?: boolean;
  expectedMoveOutDate?: any;
}

export default function ManageTenantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmMoveOut, setConfirmMoveOut] = useState<Tenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "rooms"), where("status", "==", "มีผู้เช่า"));
        const snapshot = await getDocs(q);
        
        const tenantIds = new Set<string>();
        const roomDocs = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          if (data.tenantId) tenantIds.add(data.tenantId);
          return { id: doc.id, ...data };
        });

        const usersMap = new Map<string, any>();
        const tenantIdsArray = Array.from(tenantIds);
        
        for (let i = 0; i < tenantIdsArray.length; i += 10) {
          const chunk = tenantIdsArray.slice(i, i + 10);
          if (chunk.length === 0) continue;
          
          const userQ = query(collection(db, "users"), where("__name__", "in", chunk));
          const userSnapshot = await getDocs(userQ);
          
          userSnapshot.docs.forEach(uDoc => {
            usersMap.set(uDoc.id, uDoc.data());
          });
        }

        const tenantList: Tenant[] = [];
        for (const roomData of roomDocs) {
          if (roomData.tenantId) {
            const uData = usersMap.get(roomData.tenantId);
            if (uData) {
              let moveInDateFormatted = "-";
              if (roomData.approvedAt) {
                const dateObj = roomData.approvedAt.toDate ? roomData.approvedAt.toDate() : new Date(roomData.approvedAt);
                moveInDateFormatted = new Intl.DateTimeFormat('th-TH', {
                  day: '2-digit', month: 'short', year: 'numeric'
                }).format(dateObj);
              }

              tenantList.push({
                id: roomData.tenantId + "-" + roomData.id,
                room: `${roomData.building}${roomData.roomNumber}`,
                name: uData.name || "ไม่ทราบชื่อ",
                contact: uData.phone || "-",
                status: "active",
                moveInDate: moveInDateFormatted, // วันที่เข้าพักดึงจากตอนอนุมัติ
                tenantId: roomData.tenantId,
                roomId: roomData.id,
                moveOutRequested: uData.moveOutRequested,
                expectedMoveOutDate: uData.expectedMoveOutDate
              });
            }
          }
        }
        setTenants(tenantList);
      } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูลผู้เช่า:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, []);

  const filteredTenants = tenants.filter(t => 
    t.name.includes(searchQuery) || t.room.includes(searchQuery) || t.contact.includes(searchQuery)
  );

  const handleMoveOut = async (tenant: Tenant) => {
    // แสดง Modal เตือนก่อน
    setConfirmMoveOut(tenant);
  };

  const handleConfirmMoveOut = async () => {
    const tenant = confirmMoveOut;
    if (!tenant) return;
    setConfirmMoveOut(null);
    setIsDeleting(true);
    try {
      // 1. อัปเดตสถานะห้องให้เป็น "ว่าง" และลบ tenantId
      if (tenant.roomId) {
        await updateDoc(doc(db, "rooms", tenant.roomId), {
          status: "ว่าง",
          tenantId: null,
          approvedAt: null,
        });
      }

      if (tenant.tenantId) {
        const uid = tenant.tenantId;

        // 2. ดึงข้อมูลผู้ใช้สำหรับเก็บไว้ reset
        const userSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", uid)));
        const userData = userSnap.docs[0]?.data();

        // 3. ลบ bills
        const billsSnap = await getDocs(query(collection(db, "bills"), where("tenantId", "==", uid)));
        for (const d of billsSnap.docs) await deleteDoc(d.ref);

        // 4. ลบ repairs
        const repairsSnap = await getDocs(query(collection(db, "repairs"), where("tenantId", "==", uid)));
        for (const d of repairsSnap.docs) await deleteDoc(d.ref);

        // 5. ลบ room_requests
        const reqSnap = await getDocs(query(collection(db, "room_requests"), where("tenantId", "==", uid)));
        for (const d of reqSnap.docs) await deleteDoc(d.ref);

        // 6. ลบ chats + messages
        const msgsSnap = await getDocs(collection(db, "chats", uid, "messages"));
        for (const d of msgsSnap.docs) await deleteDoc(d.ref);
        try { await deleteDoc(doc(db, "chats", uid)); } catch {}

        // 7. รีเซ็ต users document ให้เหมือนสมัครใหม่
        await setDoc(doc(db, "users", uid), {
          uid,
          name: userData?.name || "",
          email: userData?.email || "",
          phone: userData?.phone || "",
          role: "tenant",
          createdAt: userData?.createdAt || new Date().toISOString(),
        });
      }

      toast.success("ย้ายออกสำเร็จ ลบข้อมูลทั้งหมดเรียบร้อยแล้ว");
      setTenants(prev => prev.filter(t => t.id !== tenant.id));
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการย้ายออก:", error);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">

      {/* ===== Modal ยืนยันย้ายออก ===== */}
      {confirmMoveOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">ยืนยันการย้ายออก</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {confirmMoveOut.name} · ห้อง {confirmMoveOut.room}
                </p>
              </div>
              <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 text-left space-y-2">
                <p className="text-red-700 font-bold text-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                  ระบบจะลบข้อมูลทั้งหมดทันที
                </p>
                <ul className="text-red-600 text-xs space-y-1 ml-6 list-disc">
                  <li>บิลค่าเช่าและประวัติการชำระเงินทั้งหมด</li>
                  <li>ประวัติแจ้งซ่อมทั้งหมด</li>
                  <li>ประวัติการจองห้องทั้งหมด</li>
                  <li>ข้อความแชททั้งหมด</li>
                  <li>บัญชีจะถูก reset เหมือนสมัครใหม่</li>
                </ul>
              </div>
              <p className="text-slate-400 text-xs">การกระทำนี้ไม่สามารถยกเลิกได้</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setConfirmMoveOut(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmMoveOut}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors"
                >
                  ยืนยันย้ายออก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Overlay กำลังลบข้อมูล ===== */}
      {isDeleting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm gap-4">
          <div className="w-14 h-14 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white font-semibold text-lg">กำลังลบข้อมูล...</p>
          <p className="text-white/60 text-sm">กรุณารอสักครู่</p>
        </div>
      )}

      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">จัดการผู้เช่า</h1>
          <p className="text-[var(--text-muted)] mt-1">รายชื่อและข้อมูลผู้เช่าทั้งหมดในระบบ</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/manage_tenants/history_tenants" className="glass-button-outline px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 group hover:bg-slate-50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-[var(--accent-brown)] transition-colors"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span className="font-semibold text-slate-700">ประวัติผู้เช่า</span>
          </Link>
          <Link href="/admin/room_requests" className="glass-button px-5 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 group">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            คำขอจองห้องพัก
          </Link>
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
              placeholder="ค้นหาชื่อ, ห้อง, หรือเบอร์โทร..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-11 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
             <button className="glass-button-outline flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold w-full sm:w-auto justify-center hover:bg-white/50 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                ตัวกรอง
             </button>
          </div>
        </div>

        {/* ข้อมูลตาราง */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left relative z-10 border-collapse block md:table">
            <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ห้อง</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">เบอร์ติดต่อ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">วันที่เข้าพัก</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">สถานะ</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin mb-2"></div>
                      <span>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span>ไม่พบข้อมูลผู้เช่า</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant, idx) => (
                  <tr key={tenant.id} className="block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b hover:bg-white/60 md:hover:bg-white/40 transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group">
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                        <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ห้อง</span>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 border border-[var(--accent-brown)]/30 rounded-xl bg-[var(--accent-light)]/40 text-[var(--accent-dark)] flex items-center justify-center font-bold text-sm shadow-sm backdrop-blur-sm">
                                {tenant.room}
                            </div>
                        </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--text-main)] text-base border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ชื่อ-นามสกุล</span>
                      {tenant.name}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">เบอร์ติดต่อ</span>
                      <span><span className="text-[var(--accent-brown)] mr-1">📞</span> {tenant.contact}</span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">วันที่เข้าพัก</span>
                      <span><span className="text-[var(--accent-brown)] mr-1">📅</span> {tenant.moveInDate}</span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">สถานะ</span>
                      <div className="flex flex-col gap-1">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm w-fit ${
                          tenant.status === 'active' ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm' :
                          'bg-slate-50/80 text-slate-700 border-slate-200 backdrop-blur-sm'
                        }`}>
                          {tenant.status === 'active' ? 'เข้าพักอยู่' : 'ย้ายออกแล้ว'}
                        </span>
                        {tenant.moveOutRequested && tenant.expectedMoveOutDate && (
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold border shadow-sm w-fit ${
                            new Date() >= (tenant.expectedMoveOutDate.toDate ? tenant.expectedMoveOutDate.toDate() : new Date(tenant.expectedMoveOutDate)) 
                            ? 'bg-red-50 text-red-600 border-red-200' 
                            : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}>
                            {new Date() >= (tenant.expectedMoveOutDate.toDate ? tenant.expectedMoveOutDate.toDate() : new Date(tenant.expectedMoveOutDate)) 
                              ? 'ครบกำหนดย้ายออก' 
                              : `แจ้งย้ายออก (ออก: ${new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(tenant.expectedMoveOutDate.toDate ? tenant.expectedMoveOutDate.toDate() : new Date(tenant.expectedMoveOutDate))})`
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="flex justify-end gap-2 md:table-cell px-2 py-3 md:px-6 md:py-4 text-right mt-2 md:mt-0">
                       <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-70 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleMoveOut(tenant)}
                            className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition-all shadow-sm flex items-center gap-1.5 ${
                              tenant.moveOutRequested && tenant.expectedMoveOutDate && new Date() >= (tenant.expectedMoveOutDate.toDate ? tenant.expectedMoveOutDate.toDate() : new Date(tenant.expectedMoveOutDate))
                              ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 animate-pulse shadow-red-500/30'
                              : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
                            }`}
                            title="ย้ายออก"
                          >
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                             ย้ายออก
                          </button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* การแบ่งหน้า (จำลอง) */}
        <div className="p-5 border-t border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex items-center justify-between text-sm text-[var(--text-muted)] font-medium">
            <div>แสดงผล 1 ถึง {filteredTenants.length} จาก {filteredTenants.length} รายการ</div>
            <div className="flex gap-2">
                <button className="glass-button-outline px-4 py-2 rounded-lg border border-slate-200 hover:bg-white/50 hover:border-slate-300 disabled:opacity-50 transition-all font-semibold" disabled>ก่อนหน้า</button>
                <button className="glass-button px-4 py-2 border border-transparent rounded-lg text-white font-bold shadow-sm">1</button>
                <button className="glass-button-outline px-4 py-2 rounded-lg border border-slate-200 hover:bg-white/50 hover:border-slate-300 disabled:opacity-50 transition-all font-semibold" disabled>ถัดไป</button>
            </div>
        </div>
      </div>
    </div>
  );
}
