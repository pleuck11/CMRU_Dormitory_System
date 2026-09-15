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
  email?: string;
}

export default function ManageTenantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmMoveOut, setConfirmMoveOut] = useState<Tenant | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tenant Details & Bill History modal
  const [selectedTenantForBills, setSelectedTenantForBills] = useState<Tenant | null>(null);
  const [tenantBills, setTenantBills] = useState<any[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);

  const handleOpenBills = async (tenant: Tenant) => {
    setSelectedTenantForBills(tenant);
    setLoadingBills(true);
    try {
      const q = query(
        collection(db, "bills"),
        where("tenantId", "==", tenant.tenantId)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const dateA = a.dueDate || a.month || "";
        const dateB = b.dueDate || b.month || "";
        return dateB.localeCompare(dateA);
      });
      setTenantBills(list);
    } catch (err) {
      console.error("Error loading bills:", err);
      toast.error("ไม่สามารถดึงประวัติบิลได้");
    } finally {
      setLoadingBills(false);
    }
  };

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
                expectedMoveOutDate: uData.expectedMoveOutDate,
                email: uData.email || "-"
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

        // 2. Archive bills (เก็บประวัติการเงินไว้สำหรับรายงาน ไม่ลบถาวร)
        const billsSnap = await getDocs(query(collection(db, "bills"), where("tenantId", "==", uid)));
        if (!billsSnap.empty) {
          const batch = writeBatch(db);
          billsSnap.docs.forEach((d) => {
            batch.update(d.ref, {
              isArchived: true,
              archivedAt: new Date().toISOString(),
              pastRoom: tenant.room
            });
          });
          await batch.commit();
        }

        // 3. ปรับสถานะผู้เช่าเป็น moved_out พร้อมบันทึกประวัติห้องเดิม
        await updateDoc(doc(db, "users", uid), {
          tenantStatus: "moved_out",
          pastRoom: tenant.room,
          movedOutAt: new Date().toISOString(),
          moveOutRequested: false,
        });
      }

      toast.success("บันทึกการย้ายออกและเก็บประวัติเรียบร้อยแล้ว");
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
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">ยืนยันการย้ายออก</h3>
                <p className="text-slate-500 text-sm mt-1">
                  {confirmMoveOut.name} · ห้อง {confirmMoveOut.room}
                </p>
              </div>
              <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
                <p className="text-amber-800 font-bold text-sm flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
                  การดำเนินการย้ายออก
                </p>
                <ul className="text-amber-700 text-xs space-y-1 ml-6 list-disc">
                  <li>ห้องพักจะเปลี่ยนสถานะเป็น "ว่าง" พร้อมเปิดให้จองใหม่</li>
                  <li>ประวัติผู้เช่าจะถูกบันทึกย้ายไปยังหน้า "ประวัติผู้เช่า"</li>
                  <li>ประวัติบิลค่าเช่าทั้งหมดจะถูกจัดเก็บเข้าคลังข้อมูล (ไม่สูญหาย)</li>
                  <li>สถานะบัญชีผู้เช่าจะถูกปรับเป็น "ย้ายออกแล้ว"</li>
                </ul>
              </div>
              <p className="text-slate-400 text-xs">คุณสามารถตรวจสอบประวัติย้อนหลังได้ตลอดเวลา</p>
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

      {/* ===== Modal รายละเอียดผู้เช่า & ประวัติบิล ===== */}
      {selectedTenantForBills && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="glass-panel bg-white/95 rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between bg-white/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent-light)]/60 text-[var(--accent-dark)] font-extrabold text-lg flex items-center justify-center border border-[var(--accent-brown)]/20 shadow-sm">
                  {selectedTenantForBills.room}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-main)]">{selectedTenantForBills.name}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                    <span>📞 {selectedTenantForBills.contact}</span>
                    <span>✉️ {selectedTenantForBills.email}</span>
                    <span>📅 เข้าพัก: {selectedTenantForBills.moveInDate}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedTenantForBills(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Financial Quick Summary */}
              {(() => {
                const totalPaid = tenantBills
                  .filter(b => b.status === "paid")
                  .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
                const totalUnpaid = tenantBills
                  .filter(b => b.status === "pending" || b.status === "overdue")
                  .reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-500">จำนวนบิลทั้งหมด</p>
                      <p className="text-lg font-bold text-slate-800 mt-0.5">{tenantBills.length} บิล</p>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <p className="text-xs font-semibold text-emerald-600">ยอดชำระแล้ว</p>
                      <p className="text-lg font-bold text-emerald-700 mt-0.5">฿{totalPaid.toLocaleString()}</p>
                    </div>
                    <div className={`p-3.5 rounded-2xl border ${totalUnpaid > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                      <p className={`text-xs font-semibold ${totalUnpaid > 0 ? 'text-amber-600' : 'text-slate-500'}`}>ยอดค้างชำระ</p>
                      <p className={`text-lg font-bold mt-0.5 ${totalUnpaid > 0 ? 'text-amber-700' : 'text-slate-800'}`}>฿{totalUnpaid.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Bills Table */}
              <div>
                <h3 className="text-sm font-bold text-[var(--text-main)] mb-3">ประวัติบิลค่าเช่า</h3>
                {loadingBills ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    <span>กำลังโหลดบิล...</span>
                  </div>
                ) : tenantBills.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 border border-dashed rounded-2xl">
                    <p className="font-semibold text-sm">ยังไม่มีประวัติบิลสำหรับผู้เช่านี้</p>
                  </div>
                ) : (
                  <div className="border border-[var(--glass-border)] rounded-2xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-[var(--glass-border)]">
                        <tr>
                          <th className="px-4 py-3">รอบเดือน</th>
                          <th className="px-4 py-3">กำหนดชำระ</th>
                          <th className="px-4 py-3 text-right">ยอดรวม (บาท)</th>
                          <th className="px-4 py-3 text-center">สถานะ</th>
                          <th className="px-4 py-3">วิธีชำระ</th>
                          <th className="px-4 py-3 text-center">สลิป</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--glass-border)]">
                        {tenantBills.map((bill) => (
                          <tr key={bill.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-800">{bill.month || "-"}</td>
                            <td className="px-4 py-3 text-slate-500">{bill.dueDate || "-"}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              {(Number(bill.totalAmount) || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                bill.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                                bill.status === "overdue" ? "bg-rose-100 text-rose-700" :
                                "bg-amber-100 text-amber-700"
                              }`}>
                                {bill.status === "paid" ? "ชำระแล้ว" : bill.status === "overdue" ? "ค้างชำระ" : "รอชำระ"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {bill.paymentMethod === "cash" ? "เงินสด" : bill.paymentMethod === "transfer" ? (
                                <span className="flex flex-col">
                                  <span>โอนเงิน</span>
                                  {bill.transRef && <span className="text-[10px] text-slate-400 font-mono">Ref: {bill.transRef}</span>}
                                </span>
                              ) : "-"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {bill.slipUrl ? (
                                <button
                                  onClick={() => setPreviewSlipUrl(bill.slipUrl)}
                                  className="text-[11px] font-bold text-[var(--accent-brown)] underline hover:text-[var(--accent-dark)]"
                                >
                                  ดูสลิป
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--glass-border)] bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setSelectedTenantForBills(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-900 transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Slip Lightbox Modal ===== */}
      {previewSlipUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewSlipUrl(null)}
        >
          <div 
            className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full border-b pb-3">
              <h3 className="font-bold text-slate-800 text-sm">หลักฐานการโอนเงิน</h3>
              <button 
                onClick={() => setPreviewSlipUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>
            <div className="w-full max-h-[70vh] overflow-auto rounded-xl flex items-center justify-center bg-slate-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={previewSlipUrl} 
                alt="สลิปการโอนเงิน" 
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <a 
              href={previewSlipUrl} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 underline flex items-center gap-1"
            >
              เปิดรูปขนาดเต็มในแท็บใหม่ ↗
            </a>
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
                            onClick={() => handleOpenBills(tenant)}
                            className="px-3 py-1.5 text-xs font-bold border border-[var(--glass-border)] rounded-lg text-slate-700 bg-white/70 hover:bg-white transition-all shadow-sm flex items-center gap-1.5"
                            title="ดูรายละเอียดและประวัติบิล"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)]"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            ประวัติบิล
                          </button>
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
