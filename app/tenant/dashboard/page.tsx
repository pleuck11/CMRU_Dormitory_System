"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

function formatThaiDate(timestamp: any): string {
  if (!timestamp) return "เมื่อสักครู่";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
}

interface RoomRequest {
  id: string;
  status: string;
  building: string;
  roomNumber: string;
  rentPrice: number;
  depositFee?: number;
  requireDeposit?: boolean;
  slipUrl?: string;
  idCardUrl?: string;
}

interface BankAccount {
  promptPayNumber?: string;
  qrImageUrl?: string;
}

interface Room {
  roomNumber: string;
  building: string;
}

interface Bill {
  amount: number;
  status: string;
}

interface Repair {
  issue?: string;
  type?: string;
  status: string;
}

export default function TenantDashboard() {
  const [mounted, setMounted] = useState(false);
  const [roomRequest, setRoomRequest] = useState<RoomRequest | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isMoveOutModalOpen, setIsMoveOutModalOpen] = useState(false);
  const [moveOutRequested, setMoveOutRequested] = useState(false);
  const [expectedMoveOutDate, setExpectedMoveOutDate] = useState<Date | null>(null);
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [latestAnnouncement, setLatestAnnouncement] = useState<Announcement | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchData = async () => {
      try {
        const tenantId = user.uid;

        const roomQuery = query(collection(db, "rooms"), where("tenantId", "==", tenantId));
        const billQuery = query(collection(db, "bills"), where("tenantId", "==", tenantId));
        const repairQuery = query(collection(db, "repairs"), where("tenantId", "==", tenantId));
        const roomReqQuery = query(collection(db, "room_requests"), where("tenantId", "==", tenantId), where("status", "in", ["pending", "pending_docs", "pending_approval", "queued"]));
        const bankAccountQuery = doc(db, "bankAccount", "owner");
        const settingsQuery = doc(db, "settings", "general");
        const userQuery = doc(db, "users", tenantId);
        const annQuery = query(collection(db, "announcements"), orderBy("createdAt", "desc"));

        const [roomSnapshot, billSnapshot, repairSnapshot, roomReqSnapshot, bankAccountSnap, settingsSnap, userSnap, annSnapshot] = await Promise.all([
          getDocs(roomQuery).catch(e => { console.error("Room fetch error:", e); return null; }),
          getDocs(billQuery).catch(e => { console.error("Bill fetch error:", e); return null; }),
          getDocs(repairQuery).catch(e => { console.error("Repair fetch error:", e); return null; }),
          getDocs(roomReqQuery).catch(e => { console.error("RoomReq fetch error:", e); return null; }),
          getDoc(bankAccountQuery).catch(e => { console.error("BankAccount fetch error:", e); return null; }),
          getDoc(settingsQuery).catch(e => { console.error("Settings fetch error:", e); return null; }),
          getDoc(userQuery).catch(e => { console.error("User fetch error:", e); return null; }),
          getDocs(annQuery).catch(e => { console.error("Announcement fetch error:", e); return null; })
        ]);

        if (roomSnapshot) roomSnapshot.forEach((doc) => setRoom(doc.data() as Room));
        if (billSnapshot) billSnapshot.forEach((doc) => setBill(doc.data() as Bill));
        
        if (repairSnapshot) {
          const repairList: Repair[] = [];
          repairSnapshot.forEach((doc) => repairList.push(doc.data() as Repair));
          setRepairs(repairList);
        }

        if (annSnapshot) {
          const annList: Announcement[] = [];
          annSnapshot.forEach((doc) => {
            annList.push({
              id: doc.id,
              ...doc.data(),
            } as Announcement);
          });
          setAnnouncements(annList);

          // ตรวจสอบว่ามีประกาศใหม่ล่าสุดหรือไม่ และเคยกดรับทราบหรือยัง
          if (annList.length > 0) {
            const latest = annList[0];
            setLatestAnnouncement(latest);
            const dismissedId = localStorage.getItem(`dismissed_announcement_id_${user.uid}`);

            // ถ้ายังไม่เคยกดปิดของประกาศตัวล่าสุดนี้ ให้เด้ง Popup ขึ้นมา
            if (dismissedId !== latest.id) {
              setSelectedAnnouncement(latest);
              setShowAnnouncementPopup(true);
            }
          }
        }

        if (roomReqSnapshot && !roomReqSnapshot.empty) {
           const docReq = roomReqSnapshot.docs[0];
           const reqData = docReq.data();
           let depositFee = reqData.depositFee;
           let requireDeposit = true;
           if (settingsSnap && settingsSnap.exists()) {
             if (!depositFee) depositFee = settingsSnap.data().depositFee;
             if (settingsSnap.data().requireDeposit !== undefined) requireDeposit = settingsSnap.data().requireDeposit;
           }
           setRoomRequest({ id: docReq.id, ...reqData, depositFee, requireDeposit } as RoomRequest);
        }

        if (bankAccountSnap && bankAccountSnap.exists()) {
          setBankAccount(bankAccountSnap.data() as BankAccount);
        }

        if (userSnap && userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.moveOutRequested) {
            setMoveOutRequested(true);
            if (userData.expectedMoveOutDate) {
              setExpectedMoveOutDate(userData.expectedMoveOutDate.toDate ? userData.expectedMoveOutDate.toDate() : new Date(userData.expectedMoveOutDate));
            }
          }
        }
      } catch (error) {
        console.error("Dashboard general error", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading]);

  // 1. ฟังก์ชันเมื่อกดปุ่ม "รับทราบ" (บันทึก ID ลง localStorage เพื่อไม่ให้เด้งอีก)
  const handleAcknowledgeAnnouncement = () => {
    if (latestAnnouncement && user) {
      localStorage.setItem(`dismissed_announcement_id_${user.uid}`, latestAnnouncement.id);
    }
    setShowAnnouncementPopup(false);
  };

  // 2. ฟังก์ชันเมื่อกดกากบาท (ปิด Popup ชั่วคราว แต่พอกลับมาเข้าเว็บใหม่จะยังเด้งเหมือนเดิม)
  const handleCloseAnnouncement = () => {
    setShowAnnouncementPopup(false);
  };

  const handleUploadIdCard = async () => {
    if (!roomRequest || !idCardFile || !user) {
      toast.warning("กรุณาเลือกไฟล์สำเนาบัตรประชาชน");
      return;
    }
    
    setUploading(true);
    try {
      const res = await fetch(`/api/upload-blob?filename=booking_docs/${roomRequest.id}/idcard_${Date.now()}_${idCardFile.name}`, {
        method: "POST",
        body: idCardFile,
      });

      const blob = await res.json();
      if (!res.ok) throw new Error(blob.error || "Failed to upload");

      const idCardUrl = blob.url;
      const isDepositRequired = roomRequest.requireDeposit !== false;
      const newStatus = (!isDepositRequired || roomRequest.slipUrl) ? "pending_approval" : roomRequest.status;
      
      await updateDoc(doc(db, "room_requests", roomRequest.id), {
        idCardUrl,
        status: newStatus
      });

      setRoomRequest({ ...roomRequest, idCardUrl, status: newStatus });
      toast.success("อัปโหลดเอกสารสำเร็จ");
    } catch (error) {
      console.error("Upload error", error);
      toast.error("เกิดข้อผิดพลาดในการอัปโหลดไฟล์");
    } finally {
      setUploading(false);
    }
  };

  const handleRequestMoveOut = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      await updateDoc(doc(db, "users", user.uid), {
        moveOutRequested: true,
        moveOutRequestedAt: new Date(),
        expectedMoveOutDate: futureDate
      });
      
      setMoveOutRequested(true);
      setExpectedMoveOutDate(futureDate);
      setIsMoveOutModalOpen(false);
      toast.success("แจ้งย้ายออกสำเร็จ ระบบได้บันทึกคำขอของคุณแล้ว");
    } catch (error) {
      console.error("Error requesting move out:", error);
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-10">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">แดชบอร์ดผู้เช่า</h1>
        {announcements.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (announcements.length > 0) {
                  setSelectedAnnouncement(announcements[0]);
                  setShowAnnouncementPopup(true);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-brown)] hover:text-[var(--accent-dark)] bg-white/80 hover:bg-white border border-[var(--glass-border)] px-3.5 py-2 rounded-xl transition-all shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 11 18-5v12L3 14v-3z"/>
                <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
              </svg>
              ประกาศล่าสุด
            </button>
            <Link
              href="/tenant/announcements"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-brown)] hover:text-[var(--accent-dark)] bg-white/70 hover:bg-white border border-[var(--glass-border)] px-3.5 py-2 rounded-xl transition-all shadow-sm"
            >
              ประกาศทั้งหมด ({announcements.length})
            </Link>
          </div>
        )}
      </div>

      {/* สถานะการจองห้องพัก (ถ้ามี) */}
      {roomRequest && (
        <div className="glass-panel p-6 md:p-8 rounded-3xl mb-8 border-2 border-amber-200/50 bg-amber-50/50 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
           <div className="relative z-10">
             <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                   <h2 className="text-xl font-bold text-amber-900 mb-1">สถานะการจองห้องพัก</h2>
                   <p className="text-amber-700/80 text-sm font-medium">ห้อง {roomRequest.building}{roomRequest.roomNumber}</p>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* สรุปข้อมูล */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-between">
          <div>
            <p className="text-[var(--text-muted)] font-medium mb-1">ห้องพักของคุณ</p>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">
              {room ? `ตึก ${room.building} ห้อง ${room.roomNumber}` : "ยังไม่มีห้องพัก"}
            </h2>
          </div>
          {room && (
            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] relative z-10">
              {moveOutRequested ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  <span className="font-semibold">แจ้งย้ายออกแล้ว (กำหนด: {expectedMoveOutDate ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(expectedMoveOutDate) : '-'})</span>
                </div>
              ) : (
                <button 
                  onClick={() => setIsMoveOutModalOpen(true)}
                  className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 w-fit"
                >
                  แจ้งย้ายออก
                </button>
              )}
            </div>
          )}
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <p className="text-[var(--text-muted)] font-medium mb-1">บิลค่าเช่าเดือนนี้</p>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">
            {bill ? `฿${bill.amount?.toLocaleString() ?? "0"}` : "฿0"}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1">
            สถานะ: <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${bill?.status === 'ค้างชำระ' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{bill?.status || 'ปกติ'}</span>
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <p className="text-[var(--text-muted)] font-medium mb-1">งานซ่อมของคุณ</p>
          <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-baseline gap-2">
            {repairs.length} <span className="text-sm font-normal text-[var(--text-muted)]">รายการ</span>
          </h2>
        </div>
      </div>

      {/* ตารางงานซ่อม */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center gap-3 bg-white/30">
          <h2 className="text-lg font-bold text-[var(--text-main)]">รายการแจ้งซ่อมล่าสุด</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse block md:table">
            <thead className="text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] hidden md:table-header-group">
              <tr>
                <th className="px-6 py-4 font-semibold">ปัญหา</th>
                <th className="px-6 py-4 font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group p-4 md:p-0">
              {repairs.length === 0 ? (
                <tr className="block md:table-row">
                  <td className="px-6 py-12 text-center text-[var(--text-muted)] block md:table-cell" colSpan={2}>
                    <p className="font-medium text-base">ไม่มีรายการแจ้งซ่อม</p>
                  </td>
                </tr>
              ) : (
                repairs.map((repair, index) => (
                  <tr key={index} className="block md:table-row bg-white/40 md:bg-transparent border border-[var(--glass-border)] md:border-0 md:border-b mb-4 md:mb-0 rounded-2xl md:rounded-none p-4 md:p-0 hover:bg-white/60 transition-colors shadow-sm md:shadow-none">
                    <td className="px-6 py-4 font-medium text-[var(--text-main)] block md:table-cell">
                      {repair.issue || repair.type || "แจ้งซ่อมทั่วไป"}
                    </td>
                    <td className="px-6 py-4 block md:table-cell">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {repair.status || "รอดำเนินการ"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================
          POPUP แสดงประกาศ (Modal)
      ====================================================== */}
      {mounted && showAnnouncementPopup && selectedAnnouncement && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-amber-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Popup (ปุ่มกากบาทเรียกใช้ handleCloseAnnouncement เพื่อปิดชั่วคราว) */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 11 18-5v12L3 14v-3z"/>
                  <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                </svg>
                <h3 className="font-bold text-lg">ประกาศจากหอพัก</h3>
              </div>
              <button
                onClick={handleCloseAnnouncement}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Content Popup */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-xs text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-full font-semibold">
                  เผยแพร่เมื่อ: {formatThaiDate(selectedAnnouncement.createdAt)}
                </span>
                <h2 className="text-xl font-bold text-gray-900 mt-2">
                  {selectedAnnouncement.title}
                </h2>
              </div>

              {selectedAnnouncement.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex justify-center">
                  <img
                    src={selectedAnnouncement.imageUrl}
                    alt={selectedAnnouncement.title}
                    className="max-h-80 w-auto object-contain"
                  />
                </div>
              )}

              <div
                className="text-sm text-gray-700 leading-relaxed bg-gray-50/70 p-4 rounded-2xl border border-gray-100"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content || "" }}
              />
            </div>

            {/* Footer Popup (ปุ่มรับทราบเรียกใช้ handleAcknowledgeAnnouncement เพื่อบันทึกไม่ให้เด้งอีก) */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <Link
                href="/tenant/announcements"
                onClick={() => setShowAnnouncementPopup(false)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 mr-auto"
              >
                ดูประกาศทั้งหมด
              </Link>
              <button
                onClick={handleAcknowledgeAnnouncement}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition-colors"
              >
                รับทราบ
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}