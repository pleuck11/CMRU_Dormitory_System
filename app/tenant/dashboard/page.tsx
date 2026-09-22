"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, orderBy } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  target?: string;
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
  moveInDate?: string;
  cancelReason?: string;
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
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

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
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/upload-blob?filename=booking_docs/${roomRequest.id}/idcard_${Date.now()}_${idCardFile.name}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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

      setRoomRequest((prev) => prev ? { ...prev, idCardUrl, status: newStatus } : null);
      setIdCardFile(null);
      toast.success("อัปโหลดเอกสารสำเร็จ");
    } catch (error) {
      console.error("Upload error", error);
      toast.error("เกิดข้อผิดพลาดในการอัปโหลดไฟล์");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDepositSlip = async () => {
    if (!roomRequest || !slipFile || !user) {
      toast.warning("กรุณาเลือกไฟล์สลิปการโอนเงินมัดจำ");
      return;
    }

    setIsVerifyingSlip(true);
    try {
      const formData = new FormData();
      formData.append("slip", slipFile);
      formData.append("billId", roomRequest.id);
      formData.append("type", "deposit");

      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/verify-slip", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "เกิดข้อผิดพลาดในการตรวจสอบสลิป");
        return;
      }

      if (data.success) {
        toast.success("ตรวจสอบสลิปมัดจำสำเร็จแล้ว! ✨");
        const newSlipUrl = data.slipUrl;
        const newStatus = roomRequest.idCardUrl ? "pending_approval" : roomRequest.status;
        setRoomRequest((prev) => prev ? {
          ...prev,
          slipUrl: newSlipUrl,
          status: newStatus
        } : null);
        setSlipFile(null);
      } else {
        toast.error(data.message || "สลิปไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Error verifying deposit slip:", error);
      toast.error("เกิดข้อผิดพลาดในการตรวจสอบสลิป");
    } finally {
      setIsVerifyingSlip(false);
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
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700 shadow-sm shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amber-950">สถานะการจองห้องพัก</h2>
                  <p className="text-amber-800/90 text-sm font-medium">ห้องพัก: ตึก {roomRequest.building} ห้อง {roomRequest.roomNumber}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {roomRequest.status === "approved" && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    อนุมัติแล้ว 🎉
                  </span>
                )}
                {roomRequest.status === "pending_approval" && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    รอแอดมินอนุมัติห้องพัก
                  </span>
                )}
                {(roomRequest.status === "pending" || roomRequest.status === "pending_docs") && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    รอดำเนินการเอกสาร / ชำระมัดจำ
                  </span>
                )}
                {(roomRequest.status === "cancelled" || roomRequest.status === "rejected") && (
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                    คำขอถูกยกเลิก
                  </span>
                )}
              </div>
            </div>

            {/* Approved State */}
            {roomRequest.status === "approved" && (
              <div className="bg-white/80 backdrop-blur-sm border border-emerald-200 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900 text-base">คำขอจองห้องได้รับการอนุมัติแล้ว</p>
                  <p className="text-xs text-emerald-700">
                    {roomRequest.moveInDate ? `วันเข้าอยู่ที่กำหนด: ${roomRequest.moveInDate}` : "ยินดีต้อนรับสู่ Yayee Dormitory! คุณสามารถติดต่อผู้ดูแลหอพักผ่านทางกล่องข้อความได้"}
                  </p>
                </div>
                <Link
                  href="/tenant/chat"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0"
                >
                  เปิดแชทผู้ดูแลหอพัก
                </Link>
              </div>
            )}

            {/* Pending Approval State */}
            {roomRequest.status === "pending_approval" && (
              <div className="bg-white/80 backdrop-blur-sm border border-blue-200 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">✓</div>
                  <div>
                    <p className="font-bold text-blue-950 text-sm">อัปโหลดเอกสารครบถ้วนเรียบร้อยแล้ว</p>
                    <p className="text-xs text-blue-700">ขณะนี้แอดมินกำลังตรวจสอบความถูกต้องของสลิปและสำเนาบัตรประชาชน เมื่อได้รับการอนุมัติระบบจะแจ้งเตือนให้ทราบทันที</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-2 border-t border-blue-100 text-xs">
                  {roomRequest.slipUrl && (
                    <a href={roomRequest.slipUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900 underline font-semibold flex items-center gap-1">
                      📄 ดูสลิปมัดจำที่แนบ
                    </a>
                  )}
                  {roomRequest.idCardUrl && (
                    <a href={roomRequest.idCardUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-900 underline font-semibold flex items-center gap-1">
                      🪪 ดูสำเนาบัตรประชาชนที่แนบ
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Pending Docs State (Deposit & ID Card Upload) */}
            {(roomRequest.status === "pending" || roomRequest.status === "pending_docs") && (
              <div className="space-y-4">
                <p className="text-xs font-medium text-amber-900/90">
                  กรุณาดำเนินการแนบหลักฐานการชำระเงินมัดจำและสำเนาบัตรประชาชนเพื่อยืนยันสิทธิ์การจองห้องพัก
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* กล่องที่ 1: เงินมัดจำ */}
                  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-amber-200/80 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-[var(--text-main)]">1. ชำระเงินมัดจำ</h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          ยอดที่ต้องชำระ: <span className="font-bold text-amber-700 text-sm">฿{(roomRequest.depositFee || roomRequest.rentPrice || 0).toLocaleString()}</span>
                        </p>
                      </div>
                      {roomRequest.slipUrl ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ชำระแล้ว ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          รอชำระ
                        </span>
                      )}
                    </div>

                    {roomRequest.slipUrl ? (
                      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
                        <span>บันทึกสลิปมัดจำแล้ว</span>
                        <a href={roomRequest.slipUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-emerald-700 hover:text-emerald-900">
                          ดูสลิป
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        {bankAccount && (
                          <div className="bg-amber-50/60 p-2.5 rounded-xl text-xs text-amber-900 border border-amber-200/60 flex items-center justify-between">
                            <div>
                              <span className="text-[var(--text-muted)]">พร้อมเพย์: </span>
                              <span className="font-bold">{bankAccount.promptPayNumber || "-"}</span>
                            </div>
                            {bankAccount.qrImageUrl && (
                              <button
                                type="button"
                                onClick={() => setShowQRModal(true)}
                                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
                              >
                                ดู QR Code
                              </button>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                            แนบสลิปโอนเงิน (ระบบตรวจจับ QR อัตโนมัติ):
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isVerifyingSlip}
                            onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                            className="block w-full text-xs text-[var(--text-main)] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={!slipFile || isVerifyingSlip}
                          onClick={handleUploadDepositSlip}
                          className="w-full bg-[var(--accent-brown)] hover:bg-[var(--accent-dark)] disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          {isVerifyingSlip ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              กำลังตรวจสอบสลิป...
                            </>
                          ) : (
                            "อัปโหลดและตรวจสอบสลิปมัดจำ"
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* กล่องที่ 2: สำเนาบัตรประชาชน */}
                  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-amber-200/80 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-[var(--text-main)]">2. สำเนาบัตรประชาชน</h3>
                        <p className="text-xs text-[var(--text-muted)]">สำหรับจัดทำสัญญาห้องพัก</p>
                      </div>
                      {roomRequest.idCardUrl ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          แนบแล้ว ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          รอแนบเอกสาร
                        </span>
                      )}
                    </div>

                    {roomRequest.idCardUrl ? (
                      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-800 flex items-center justify-between">
                        <span>บันทึกสำเนาบัตรประชาชนแล้ว</span>
                        <a href={roomRequest.idCardUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-emerald-700 hover:text-emerald-900">
                          ดูเอกสาร
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">
                            เลือกรูปถ่ายหรือสำเนาบัตรประชาชน:
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploading}
                            onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                            className="block w-full text-xs text-[var(--text-main)] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={!idCardFile || uploading}
                          onClick={handleUploadIdCard}
                          className="w-full bg-[var(--accent-brown)] hover:bg-[var(--accent-dark)] disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                          {uploading ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              กำลังอัปโหลด...
                            </>
                          ) : (
                            "อัปโหลดสำเนาบัตรประชาชน"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cancelled / Rejected State */}
            {(roomRequest.status === "cancelled" || roomRequest.status === "rejected") && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-red-900">คำขอจองห้องนี้สิ้นสุดลงแล้ว</p>
                  <p className="text-red-700">{roomRequest.cancelReason || "ห้องพักอาจถูกยกเลิกเนื่องจากเกินกำหนดเวลาหรือผู้ดูแลปฏิเสธ"}</p>
                </div>
                <Link
                  href="/tenant/room"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl transition-all shadow-sm shrink-0"
                >
                  เลือกห้องใหม่
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal QR Code พร้อมเพย์ */}
      {showQRModal && bankAccount?.qrImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative text-center">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-all"
            >
              ✕
            </button>
            <h3 className="font-bold text-lg text-[var(--text-main)]">QR Code ชำระเงินมัดจำ</h3>
            <p className="text-xs text-[var(--text-muted)]">สแกนเพื่อโอนเงินผ่าน Mobile Banking</p>
            <div className="flex justify-center p-2 bg-slate-50 rounded-2xl border border-slate-100">
              <img src={bankAccount.qrImageUrl} alt="PromptPay QR" className="w-56 h-56 object-contain rounded-xl" />
            </div>
            <div className="text-xs text-slate-600">
              พร้อมเพย์: <span className="font-bold text-slate-900">{bankAccount.promptPayNumber || "-"}</span>
            </div>
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full bg-[var(--accent-brown)] text-white font-bold text-xs py-2.5 rounded-xl hover:bg-[var(--accent-dark)] transition-all"
            >
              ปิดหน้าต่าง
            </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#F3E7DD] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            
            {/* Header Popup (Warm Coffee Brown Theme) */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#8B5E3C] via-[#9B6A45] to-[#734A2E] text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 11 18-5v12L3 14v-3z"/>
                    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight text-white">ประกาศจากหอพัก</h3>
                  <p className="text-[11px] text-white/80 font-medium">หอพักหยาหยี๋ (Yayee Dormitory)</p>
                </div>
              </div>
              <button
                onClick={handleCloseAnnouncement}
                className="p-1.5 rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer"
                title="ปิดชั่วคราว"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Content Popup */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-[#8B5E3C] bg-[#F3E7DD]/90 px-3 py-1 rounded-full font-semibold border border-[#E8D7CA]">
                  📅 เผยแพร่เมื่อ: {formatThaiDate(selectedAnnouncement.createdAt)}
                </span>
                {selectedAnnouncement.target === "tenant" ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#F5EBE1] text-[#734A2E] border border-[#E5D5C5]">
                    🔒 สำหรับผู้เช่า
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#EBF3EA] text-[#2D6A4F] border border-[#CFE4CD]">
                    🌐 ประกาศทั่วไป
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-[#3A2D23] tracking-tight leading-snug">
                {selectedAnnouncement.title}
              </h2>

              {selectedAnnouncement.imageUrl && (
                <div className="rounded-2xl overflow-hidden border border-[#EAE1D5] bg-[#FAF7F2] flex justify-center p-2">
                  <img
                    src={selectedAnnouncement.imageUrl}
                    alt={selectedAnnouncement.title}
                    className="max-h-80 w-auto object-contain rounded-xl"
                  />
                </div>
              )}

              <div
                className="text-sm text-[#3A2D23] leading-relaxed bg-[#FAF7F2] p-5 rounded-2xl border border-[#EAE1D5] announcement-html-content"
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content || "" }}
              />
            </div>

            {/* Footer Popup */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-white/90 border-t border-[#F3E7DD]">
              <Link
                href="/tenant/announcements"
                onClick={() => setShowAnnouncementPopup(false)}
                className="text-xs font-bold text-[#8B5E3C] hover:text-[#734A2E] transition-colors flex items-center gap-1"
              >
                <span>ดูประกาศทั้งหมด</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </Link>
              <button
                onClick={handleAcknowledgeAnnouncement}
                className="bg-[#8B5E3C] hover:bg-[#734A2E] text-white px-7 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-[#8B5E3C]/20 transition-all active:scale-[0.98] cursor-pointer"
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