"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

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

  const [roomRequest, setRoomRequest] = useState<RoomRequest | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
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
  const [loading, setLoading] = useState(true);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // รอให้ผู้ใช้ยืนยันตัวตนเสร็จสิ้น
    if (authLoading || !user) return;

    const fetchData = async () => {
      try {
        const tenantId = user.uid;

        // ดึงข้อมูลห้อง, บิล, แจ้งซ่อม, คำขอจองห้อง พร้อมกันด้วย Promise.all
        const roomQuery = query(collection(db, "rooms"), where("tenantId", "==", tenantId));
        const billQuery = query(collection(db, "bills"), where("tenantId", "==", tenantId));
        const repairQuery = query(collection(db, "repairs"), where("tenantId", "==", tenantId));
        const roomReqQuery = query(collection(db, "room_requests"), where("tenantId", "==", tenantId), where("status", "in", ["pending", "pending_docs", "pending_approval", "queued"]));
        const bankAccountQuery = doc(db, "bankAccount", "owner");
        const settingsQuery = doc(db, "settings", "general");
        const userQuery = doc(db, "users", tenantId);

        const [roomSnapshot, billSnapshot, repairSnapshot, roomReqSnapshot, bankAccountSnap, settingsSnap, userSnap] = await Promise.all([
          getDocs(roomQuery).catch(e => { console.error("Room fetch error:", e); return null; }),
          getDocs(billQuery).catch(e => { console.error("Bill fetch error:", e); return null; }),
          getDocs(repairQuery).catch(e => { console.error("Repair fetch error:", e); return null; }),
          getDocs(roomReqQuery).catch(e => { console.error("RoomReq fetch error:", e); return null; }),
          getDoc(bankAccountQuery).catch(e => { console.error("BankAccount fetch error:", e); return null; }),
          getDoc(settingsQuery).catch(e => { console.error("Settings fetch error:", e); return null; }),
          getDoc(userQuery).catch(e => { console.error("User fetch error:", e); return null; })
        ]);

        if (roomSnapshot) roomSnapshot.forEach((doc) => setRoom(doc.data() as Room));
        if (billSnapshot) billSnapshot.forEach((doc) => setBill(doc.data() as Bill));
        
        if (repairSnapshot) {
          const repairList: Repair[] = [];
          repairSnapshot.forEach((doc) => repairList.push(doc.data() as Repair));
          setRepairs(repairList);
        }

        if (roomReqSnapshot && !roomReqSnapshot.empty) {
           const docReq = roomReqSnapshot.docs[0];
           const reqData = docReq.data();
           
           // ใช้ค่า depositFee จากการตั้งค่าหากไม่มีในเอกสาร
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

  const handleUploadIdCard = async () => {
    if (!roomRequest || !idCardFile || !user) {
      toast.warning("กรุณาเลือกไฟล์สำเนาบัตรประชาชน");
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", idCardFile);

      // อัปโหลดบัตรประชาชนไปยัง Vercel Blob ผ่าน API ใหม่ของเรา
      const res = await fetch(`/api/upload-blob?filename=booking_docs/${roomRequest.id}/idcard_${Date.now()}_${idCardFile.name}`, {
        method: "POST",
        body: idCardFile,
      });

      const blob = await res.json();
      if (!res.ok) throw new Error(blob.error || "Failed to upload");

      const idCardUrl = blob.url;

      // อัปเดตคำขอ
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

  const handleVerifySlip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomRequest) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("slip", file);
      formData.append("billId", roomRequest.id);
      formData.append("type", "deposit");

      const res = await fetch("/api/verify-slip", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "เกิดข้อผิดพลาดในการตรวจสอบสลิป");
        return;
      }

      const isSlipValid = data.success === true;
      if (isSlipValid && data.slipUrl) {
        toast.success("ชำระเงินมัดจำสำเร็จ!");
        const newStatus = roomRequest.idCardUrl ? "pending_approval" : roomRequest.status;
        
        if (newStatus !== roomRequest.status) {
          await updateDoc(doc(db, "room_requests", roomRequest.id), { status: newStatus });
        }
        
        setRoomRequest(prev => prev ? { ...prev, slipUrl: data.slipUrl, status: newStatus } : null);
        setIsPayModalOpen(false);
      } else {
        toast.error("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      }
    } catch (error) {
      console.error("Error verifying slip:", error);
      toast.error("เกิดข้อผิดพลาดในการอัปโหลดสลิป");
    } finally {
      setUploading(false);
      e.target.value = ""; // รีเซ็ต input
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
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">แดชบอร์ดผู้เช่า</h1>
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

             {roomRequest.status === "queued" ? (
               <div className="bg-sky-50/80 backdrop-blur-sm rounded-2xl p-6 border border-sky-100 shadow-sm text-center">
                  <div className="w-16 h-16 mx-auto bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <h3 className="text-lg font-bold text-sky-900 mb-2">คุณกำลังอยู่ในคิวรอห้องพัก</h3>
                  <p className="text-sky-700/80 text-sm leading-relaxed">
                    เนื่องจากห้องนี้มีผู้จองท่านอื่นอยู่ก่อนแล้ว ระบบจึงจัดให้คุณอยู่ในคิวถัดไป<br/>
                    กรุณารอแอดมินแจ้งสิทธิ์การชำระเงินมัดจำ (คุณจะยังไม่สามารถทำรายการได้ในขณะนี้)
                  </p>
               </div>
             ) : ((roomRequest.requireDeposit !== false && !roomRequest.slipUrl) || !roomRequest.idCardUrl) ? (
               <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white shadow-sm">
                  <p className="text-amber-800 font-semibold mb-4 text-sm">
                    {roomRequest.requireDeposit !== false 
                      ? "กรุณาดำเนินการให้ครบทั้ง 2 ขั้นตอน เพื่อยืนยันการจอง:" 
                      : "กรุณาดำเนินการอัปโหลดเอกสาร เพื่อยืนยันการจอง:"}
                  </p>
                  
                  <div className={`grid grid-cols-1 ${roomRequest.requireDeposit !== false ? 'md:grid-cols-2' : ''} gap-6 mb-6`}>
                    {/* สลิปโอนเงิน */}
                    {roomRequest.requireDeposit !== false && (
                    <div className="p-4 bg-white rounded-xl border border-amber-100 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                           <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">1</span>
                           <h3 className="font-bold text-[var(--text-main)]">ชำระค่ามัดจำ</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">ยอดชำระ: <span className="font-bold text-amber-600">฿{(roomRequest.depositFee || roomRequest.rentPrice).toLocaleString()}</span></p>
                      </div>
                      
                      {roomRequest.slipUrl ? (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm font-semibold">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ชำระค่ามัดจำเรียบร้อยแล้ว
                        </div>
                      ) : (
                        <button 
                          onClick={() => setIsPayModalOpen(true)}
                          className="w-full py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-xl transition-colors text-sm"
                        >
                          สแกนจ่ายค่ามัดจำ
                        </button>
                      )}
                    </div>
                    )}

                    {/* บัตรประชาชน */}
                    <div className="p-4 bg-white rounded-xl border border-amber-100 flex flex-col h-full justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                           <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">{roomRequest.requireDeposit !== false ? "2" : "1"}</span>
                           <h3 className="font-bold text-[var(--text-main)]">อัปโหลดสำเนาบัตรประชาชน</h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">โปรดแนบไฟล์รูปภาพสำเนาบัตรประชาชน</p>
                      </div>

                      {roomRequest.idCardUrl ? (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg text-sm font-semibold">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          อัปโหลดเอกสารเรียบร้อยแล้ว
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <input 
                            type="file" 
                            accept="image/*,.pdf"
                            onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                            className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition-colors border border-gray-200 rounded-lg bg-white"
                          />
                          <button 
                            onClick={handleUploadIdCard}
                            disabled={uploading || !idCardFile}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                          >
                            {uploading ? "กำลังอัปโหลด..." : "อัปโหลดเอกสาร"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* หมายเหตุ 3 วัน */}
                  <div className="mt-4 bg-red-50/80 border border-red-100 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-xs text-red-700 font-medium leading-relaxed">
                      <strong>หมายเหตุ:</strong> กรุณา{roomRequest.requireDeposit !== false ? "ชำระค่ามัดจำและ" : ""}อัปโหลดเอกสารให้ครบถ้วนภายใน 3 วัน นับจากวันที่ทำการจอง 
                      หากพ้นกำหนด ระบบจะทำการ <span className="font-bold underline">ยกเลิกการจองอัตโนมัติ</span> เพื่อให้สิทธิ์ผู้อื่นต่อไป
                    </p>
                  </div>
               </div>
             ) : (
               <div className="bg-emerald-50/80 rounded-2xl p-5 flex items-center gap-3 border border-emerald-100">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-800">ส่งเอกสารเรียบร้อยแล้ว</h3>
                    <p className="text-emerald-700/80 text-sm">กำลังรอผู้ดูแลระบบตรวจสอบและอนุมัติ (หากมีข้อสงสัยสามารถสอบถามผ่านแชทได้)</p>
                  </div>
               </div>
             )}
           </div>
        </div>
      )}

      {/* สรุปข้อมูล */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-between">
          <div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
            <p className="text-[var(--text-muted)] font-medium mb-1">ห้องพักของคุณ</p>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">
              {room ? `ตึก ${room.building} ห้อง ${room.roomNumber}` : "ยังไม่มีห้องพัก"}
            </h2>
          </div>
          {room && (
            <div className="mt-4 pt-4 border-t border-[var(--glass-border)] relative z-10">
              {moveOutRequested ? (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="font-semibold">แจ้งย้ายออกแล้ว (กำหนด: {expectedMoveOutDate ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(expectedMoveOutDate) : '-'})</span>
                </div>
              ) : (
                <button 
                  onClick={() => setIsMoveOutModalOpen(true)}
                  className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 w-fit"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                  แจ้งย้ายออก
                </button>
              )}
            </div>
          )}
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <p className="text-[var(--text-muted)] font-medium mb-1">บิลค่าเช่าเดือนนี้</p>
          <h2 className="text-2xl font-bold text-[var(--text-main)]">
            {bill ? `฿${bill.amount?.toLocaleString() ?? "0"}` : "฿0"}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-1">
            สถานะ: <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${bill?.status === 'ค้างชำระ' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{bill?.status || 'ปกติ'}</span>
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
          <p className="text-[var(--text-muted)] font-medium mb-1">งานซ่อมของคุณ</p>
          <h2 className="text-2xl font-bold text-[var(--text-main)] flex items-baseline gap-2">
            {repairs.length} <span className="text-sm font-normal text-[var(--text-muted)]">รายการ</span>
          </h2>
        </div>

      </div>

      {/* ตารางงานซ่อม */}
      <div className="glass-panel rounded-2xl overflow-hidden">

        <div className="p-6 border-b border-[var(--glass-border)] flex items-center gap-3 bg-white/30">
          <div className="p-2 bg-[var(--accent-light)]/30 rounded-lg text-[var(--accent-dark)]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
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
                    <div className="flex flex-col items-center justify-center space-y-3">
                       <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                       <p className="font-medium text-base">ไม่มีรายการแจ้งซ่อม</p>
                    </div>
                  </td>
                </tr>
              ) : (
                repairs.map((repair, index) => (
                  <tr key={index} className="block md:table-row bg-white/40 md:bg-transparent border border-[var(--glass-border)] md:border-0 md:border-b mb-4 md:mb-0 rounded-2xl md:rounded-none p-4 md:p-0 hover:bg-white/60 transition-colors shadow-sm md:shadow-none">
                    <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 font-medium text-[var(--text-main)] mb-3 md:mb-0">
                      <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">ปัญหา:</span>
                      <span className="text-right md:text-left">{repair.type || repair.issue}</span>
                    </td>
                    <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 border-t border-[var(--glass-border)] md:border-t-0 pt-3 md:pt-0">
                      <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">สถานะ:</span>
                      <span className={`px-3 py-1.5 rounded-full text-[10px] md:text-xs font-semibold border shadow-sm ${
                        repair.status === 'รอคิว' || repair.status === 'รอดำเนินการ' ? 'bg-amber-50/80 text-amber-700 border-amber-200' :
                        repair.status === 'กำลังซ่อม' ? 'bg-blue-50/80 text-blue-700 border-blue-200' :
                        'bg-emerald-50/80 text-emerald-700 border-emerald-200'
                      }`}>
                        {repair.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ Modal ชำระเงินมัดจำ ============ */}
      {isPayModalOpen && roomRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !uploading && setIsPayModalOpen(false)} />
          <div className="relative glass-panel w-full sm:w-[95%] sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 max-h-[92vh] overflow-y-auto">

            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-light)]/50 border border-[var(--accent-brown)]/20 text-[var(--accent-dark)] flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-main)]">ชำระค่ามัดจำ</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                ตึก {roomRequest.building} ห้อง {roomRequest.roomNumber}
              </p>
            </div>

            <div className="bg-[var(--accent-light)]/40 border border-[var(--accent-brown)]/20 rounded-2xl px-5 py-4 text-center">
              <p className="text-xs font-bold text-[var(--text-muted)] mb-1">ยอดชำระมัดจำ</p>
              <p className="text-3xl font-bold text-[var(--accent-dark)]">฿{(roomRequest.depositFee || roomRequest.rentPrice || 0).toLocaleString()}</p>
            </div>

            {bankAccount ? (
              <>
                {(bankAccount.promptPayNumber || bankAccount.qrImageUrl) && (
                  <div className="flex flex-col items-center gap-3">
                    <img 
                      src={bankAccount.promptPayNumber ? `https://promptpay.io/${bankAccount.promptPayNumber}/${roomRequest.depositFee || roomRequest.rentPrice}.png` : bankAccount.qrImageUrl} 
                      alt="QR PromptPay" 
                      className="w-48 h-48 object-contain rounded-2xl border border-[var(--glass-border)] bg-white p-2 shadow-sm" 
                    />
                  </div>
                )}

                <div className="pt-2">
                  <label className={`w-full glass-button flex flex-col items-center justify-center py-3 rounded-xl font-bold cursor-pointer transition-all ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
                    {uploading ? (
                      <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mb-1" />กำลังตรวจสอบ...</>
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
                    <input type="file" accept="image/*" className="hidden" onChange={handleVerifySlip} disabled={uploading} />
                  </label>
                  <p className="text-[10px] text-center text-[var(--text-muted)] mt-2">ระบบจะตรวจสอบสลิปอัตโนมัติ</p>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-[var(--text-muted)]">
                <p className="text-sm font-medium">ยังไม่มีข้อมูลบัญชีธนาคาร</p>
                <p className="text-xs mt-1">กรุณาติดต่อแอดมิน</p>
              </div>
            )}

            <button onClick={() => setIsPayModalOpen(false)} disabled={uploading} className="w-full glass-button-outline py-2.5 rounded-xl font-bold disabled:opacity-50">
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* ============ Modal แจ้งย้ายออก ============ */}
      {isMoveOutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !uploading && setIsMoveOutModalOpen(false)} />
          <div className="relative glass-panel w-full sm:w-[95%] sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom sm:fade-in sm:zoom-in-95 max-h-[92vh] overflow-y-auto">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-main)]">ยืนยันการแจ้งย้ายออก</h2>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm leading-relaxed">
              <p className="font-bold mb-2">ข้อกำหนดการย้ายออก:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>คุณต้องแจ้งย้ายออกล่วงหน้าอย่างน้อย <strong className="text-red-600">30 วัน</strong></li>
                <li>ระบบจะกำหนดวันที่ย้ายออกเป็น <strong>{new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}</strong> อัตโนมัติ</li>
              </ul>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsMoveOutModalOpen(false)} 
                disabled={uploading} 
                className="flex-1 glass-button-outline py-3 rounded-xl font-bold disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleRequestMoveOut} 
                disabled={uploading} 
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex justify-center items-center gap-2 transition-colors shadow-md shadow-red-500/20"
              >
                {uploading ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> กำลังดำเนินการ</>
                ) : (
                  "ยืนยันแจ้งย้ายออก"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

}
