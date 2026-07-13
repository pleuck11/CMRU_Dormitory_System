"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "@/lib/toast";

interface Room {
  id: string;
  roomNumber: string;
  building: string;
  floor: string;
  status: string;
  roomType: "aircon" | "fan";
  rentPrice: number;
  image?: string;
}

export default function TenantRoomRequestPage() {
  const { user } = useAuth();
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  
  // ตัวแปรสำหรับตัวกรอง
  const [filterBuilding, setFilterBuilding] = useState<string>("all");
  const [filterRoomType, setFilterRoomType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [userData, setUserData] = useState<any>(null);
  const [hasActiveRoom, setHasActiveRoom] = useState(false);
  const [roomDataLoading, setRoomDataLoading] = useState(true);

  // ฟังการเปลี่ยนแปลงของ User document เพื่อเช็คสิทธิ์จองหลายห้อง
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
      doc(db, "users", user.uid), 
      (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      },
      (error) => {
        if (error.code !== "permission-denied") console.error("User snapshot error:", error);
      }
    );

    const checkActiveRoom = async () => {
      try {
         const activeRoomQ = query(collection(db, "rooms"), where("tenantId", "==", user.uid));
         const snap = await getDocs(activeRoomQ);
         
         const pendingReqQ = query(collection(db, "room_requests"), where("tenantId", "==", user.uid), where("status", "==", "pending"));
         const pendingSnap = await getDocs(pendingReqQ);

         setHasActiveRoom(!snap.empty || !pendingSnap.empty);
      } catch (err) {
         console.error(err);
      } finally {
         setRoomDataLoading(false);
      }
    };
    checkActiveRoom();

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "rooms"));
        const querySnapshot = await getDocs(q);

        const roomsData: Room[] = [];
        querySnapshot.forEach((doc) => {
          roomsData.push({ id: doc.id, ...doc.data() } as Room);
        });

        roomsData.sort((a, b) => {
          if (a.building === b.building) {
            return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
          }
          return a.building.localeCompare(b.building);
        });

        setAvailableRooms(roomsData);
      } catch (error) {
        console.error("Error fetching available rooms:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  const handleRequestRoom = async () => {
    if (!user || !selectedRoom) return;
    
    setSubmitting(true);
    try {
      // ตรวจสอบก่อนว่าเคยจองห้องนี้และรอดำเนินการอยู่หรือไม่เพื่อป้องกันการกดซ้ำ
      // 1. ตรวจสอบว่ามีห้องอยู่แล้วหรือไม่ (1 คน 1 ห้อง)
      const activeRoomQ = query(
        collection(db, "rooms"),
        where("tenantId", "==", user.uid)
      );
      const activeRoomSnap = await getDocs(activeRoomQ);
      if (!activeRoomSnap.empty) {
        toast.warning("คุณมีห้องพักที่กำลังเช่าอยู่แล้ว (จำกัด 1 คน ต่อ 1 ห้อง)");
        setSubmitting(false);
        setSelectedRoom(null);
        return;
      }

      // 2. ตรวจสอบว่าผู้ใช้มีคำขอที่ยัง pending อยู่หรือไม่ (ป้องกันขอซ้ำ)
      const q = query(
        collection(db, "room_requests"),
        where("tenantId", "==", user.uid),
        where("status", "in", ["pending", "pending_docs", "pending_approval"])
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        toast.warning("คุณมีคำขอจองห้องพักที่กำลังรอดำเนินการอยู่แล้ว กรุณารอแอดมินอนุมัติ");
        setSubmitting(false);
        setSelectedRoom(null);
        return;
      }

      // ตรวจสอบว่าห้องนี้มีคนจองคิวแรกไปแล้วหรือยัง เพื่อกำหนดสถานะ (คิวแรก=pending_docs, คิวถัดไป=queued)
      const checkRoomQ = query(
        collection(db, "room_requests"),
        where("roomId", "==", selectedRoom.id),
        where("status", "in", ["pending", "pending_docs", "pending_approval"])
      );
      const roomSnapshot = await getDocs(checkRoomQ);
      
      const newStatus = roomSnapshot.empty ? "pending_docs" : "queued";

      // ดึงค่า depositFee จาก settings
      let depositFee = 5000;
      const settingsSnap = await getDoc(doc(db, "settings", "general"));
      if (settingsSnap.exists() && settingsSnap.data()?.depositFee !== undefined) {
        depositFee = settingsSnap.data()?.depositFee;
      }

      // บันทึกคำขอจองห้อง
      await addDoc(collection(db, "room_requests"), {
        tenantId: user.uid,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        building: selectedRoom.building,
        rentPrice: selectedRoom.rentPrice,
        depositFee: depositFee,
        status: newStatus,
        createdAt: serverTimestamp(),
      });

      // อัปเดตสถานะห้องเป็น ติดจอง
      await updateDoc(doc(db, "rooms", selectedRoom.id), {
        status: "ติดจอง"
      });

      // ส่งแจ้งเตือนไปยังแอดมินทุกคน (ใส่ try-catch แยกไว้เผื่อติด Security Rules ของผู้เช่า)
      try {
        const adminQ = query(collection(db, "users"), where("role", "==", "admin"));
        const adminSnap = await getDocs(adminQ);
        adminSnap.forEach((adminDoc) => {
          fetch("/api/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetUserId: adminDoc.id,
              title: "🔔 มีคำขอจองห้องพักใหม่",
              body: `ผู้เช่าส่งคำขอจองห้อง ${selectedRoom.building}${selectedRoom.roomNumber} กรุณาตรวจสอบ`,
              url: "/admin/room_requests",
            }),
          }).catch(() => {});
        });
      } catch (notifyErr) {
        console.warn("ไม่สามารถส่งแจ้งเตือนหาแอดมินได้ (Permission):", notifyErr);
      }

      setSuccessMessage(newStatus === "queued" 
        ? `ลงทะเบียนรอคิวจองห้อง ${selectedRoom.building}${selectedRoom.roomNumber} เรียบร้อยแล้ว กรุณารอแอดมินแจ้งสิทธิ์การชำระเงิน` 
        : `ส่งคำขอจองห้อง ${selectedRoom.building}${selectedRoom.roomNumber} เรียบร้อยแล้ว ระบบกำลังรอการอนุมัติจากผู้ดูแล`
      );
      // ไม่เอาห้องออกจากรายการถ้าเป็นการจองต่อคิว เพราะคนอื่นก็ยังมาต่อคิวได้อีก
      if (newStatus !== "queued") {
        setAvailableRooms(prev => prev.map(r => r.id === selectedRoom.id ? { ...r, status: "ติดจอง" } : r));
      }
      setSelectedRoom(null);
    } catch (error: any) {
      console.error("Error requesting room:", error);
      toast.error(`เกิดข้อผิดพลาดในการส่งคำขอจองห้อง: ${error?.message || 'ไม่ทราบสาเหตุ'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestAdditionalRoom = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        requestingMultipleRooms: true
      });
      toast.success("ส่งคำขอสิทธิ์จองห้องเพิ่มเติมเรียบร้อยแล้ว");
      
      try {
        const adminQ = query(collection(db, "users"), where("role", "==", "admin"));
        const adminSnap = await getDocs(adminQ);
        adminSnap.forEach((adminDoc) => {
          fetch("/api/send-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetUserId: adminDoc.id,
              title: "🔐 มีคำขอสิทธิ์จองห้องเพิ่มเติม",
              body: `ผู้เช่าส่งคำขอสิทธิ์จองห้องพักหลายห้อง กรุณาตรวจสอบและอนุมัติที่หน้ารายการคำขอจองห้องพัก`,
              url: "/admin/room_requests",
            }),
          }).catch(() => {});
        });
      } catch (notifyErr) {
        console.warn("ไม่สามารถส่งแจ้งเตือนหาแอดมินได้ (Permission):", notifyErr);
      }
    } catch (e: any) {
      toast.error("เกิดข้อผิดพลาดในการส่งคำขอ: " + e.message);
    }
  };

  if (loading || roomDataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const canSeeRooms = !hasActiveRoom || userData?.canBookMultipleRooms === true;

  if (!canSeeRooms) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="glass-panel p-8 md:p-12 rounded-3xl text-center max-w-lg shadow-sm border border-[var(--glass-border)] relative overflow-hidden">
          <div className="w-20 h-20 mx-auto bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-inner border border-amber-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">จองห้องพักเพิ่มเติม</h2>
          <p className="text-[var(--text-muted)] mb-8">คุณมีรายการห้องพักอยู่ในระบบแล้ว หากต้องการจองห้องพักเพิ่มเติมในบัญชีเดิม กรุณาส่งคำขอสิทธิ์จองห้องเพิ่มเติมให้ผู้ดูแลระบบอนุมัติเสียก่อน</p>
          
          {userData?.requestingMultipleRooms ? (
            <div className="px-5 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 font-semibold inline-flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin-slow"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              คำขอของคุณกำลังรอการอนุมัติ
            </div>
          ) : (
            <button 
              onClick={handleRequestAdditionalRoom}
              className="bg-[var(--accent-brown)] hover:bg-[var(--accent-dark)] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              ส่งคำขอสิทธิ์จองห้องเพิ่ม
            </button>
          )}
        </div>
      </div>
    );
  }

  const uniqueBuildings = Array.from(new Set(availableRooms.map(r => r.building))).sort();
  
  const filteredRooms = availableRooms.filter(room => {
    if (filterBuilding !== "all" && room.building !== filterBuilding) return false;
    if (filterRoomType !== "all" && room.roomType !== filterRoomType) return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      const matchRoom = room.roomNumber.toLowerCase().includes(q);
      const matchBuilding = room.building.toLowerCase().includes(q);
      const matchFloor = room.floor.toString().toLowerCase().includes(q);
      if (!matchRoom && !matchBuilding && !matchFloor) return false;
    }
    return true;
  });

  const hasActiveFilter = filterBuilding !== "all" || filterRoomType !== "all" || searchQuery.trim() !== "";

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-8">
      {/* ส่วนหัวหน้า */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">จองห้องพัก</h1>
        <p className="text-[var(--text-muted)] mt-1">เลือกห้องพักที่ว่างและส่งคำขอให้ผู้ดูแลระบบพิจารณาอนุมัติ</p>
      </div>

      {/* ============ แถบค้นหาและกรอง ============ */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-sm border border-[var(--glass-border)]">
        {/* แถบค้นหา */}
        <div className="px-5 pt-5 pb-4 border-b border-[var(--glass-border)]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาห้อง, ตึก, หรือชั้น..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-11 pr-10 py-3 rounded-xl text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ปุ่มตัวกรอง */}
        <div className="px-5 py-4 space-y-4">
          {/* ตัวกรองตึก */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0 w-10">ตึก</span>
            <div className="flex flex-wrap gap-2">
              {["all", ...uniqueBuildings].map(b => (
                <button
                  key={b}
                  onClick={() => setFilterBuilding(b)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                    filterBuilding === b
                      ? "bg-[var(--accent-brown)] text-white border-[var(--accent-brown)] shadow-md"
                      : "bg-white/60 text-[var(--text-main)] border-[var(--glass-border)] hover:bg-white/90 hover:border-[var(--accent-brown)]/60"
                  }`}
                >
                  {b === "all" ? "🏢 ทั้งหมด" : `ตึก ${b}`}
                </button>
              ))}
            </div>
          </div>

          {/* ตัวกรองประเภทห้อง */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider shrink-0 w-10">ประเภท</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all",    label: "🛏️ ทุกประเภท",   activeClass: "bg-[var(--accent-brown)] text-white border-[var(--accent-brown)]" },
                { value: "aircon", label: "❄️ ห้องแอร์",    activeClass: "bg-sky-500 text-white border-sky-500" },
                { value: "fan",    label: "🌀 ห้องพัดลม",  activeClass: "bg-orange-400 text-white border-orange-400" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterRoomType(opt.value)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ${
                    filterRoomType === opt.value
                      ? `${opt.activeClass} shadow-md`
                      : "bg-white/60 text-[var(--text-main)] border-[var(--glass-border)] hover:bg-white/90 hover:border-[var(--accent-brown)]/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* สรุปผลและล้างตัวกรอง */}
        <div className="px-5 py-3 border-t border-[var(--glass-border)] bg-white/20 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)]">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span className="text-xs text-[var(--text-muted)]">พบ</span>
            <span className="text-sm font-bold text-[var(--accent-dark)]">{loading ? "..." : filteredRooms.length}</span>
            <span className="text-xs text-[var(--text-muted)]">ห้องที่ตรงเงื่อนไข {loading ? "" : `(จากทั้งหมด ${availableRooms.length} ห้อง)`}</span>
          </div>
          {hasActiveFilter && (
            <button
              onClick={() => { setFilterBuilding("all"); setFilterRoomType("all"); setSearchQuery(""); }}
              className="text-xs text-[var(--accent-brown)] hover:text-[var(--accent-dark)] font-semibold flex items-center gap-1 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ล้างทั้งหมด
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50/80 backdrop-blur-sm text-emerald-800 p-5 rounded-2xl border border-emerald-200/50 shadow-sm flex items-start gap-3">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 mt-0.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {availableRooms.length === 0 ? (
        <div className="glass-panel p-16 text-center rounded-3xl">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--accent-light)]/30 text-[var(--accent-dark)] mb-6 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <p className="text-[var(--text-main)] text-xl font-bold mb-2">ไม่มีห้องว่างในขณะนี้</p>
          <p className="text-[var(--text-muted)]">กรุณากลับมาตรวจสอบใหม่ในภายหลัง หรือติดต่อผู้ดูแลระบบ</p>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="glass-panel p-16 text-center rounded-3xl border-dashed border-2 border-[var(--glass-border)]">
          <p className="text-[var(--text-main)] text-xl font-bold mb-2">ไม่พบห้องที่ตรงกับตัวกรอง</p>
          <p className="text-[var(--text-muted)] mb-4">ลองเปลี่ยนรูปแบบการค้นหาดูอีกครั้ง</p>
          <button onClick={() => { setFilterBuilding("all"); setFilterRoomType("all"); setSearchQuery(""); }} className="glass-button-outline px-4 py-2 rounded-xl text-sm font-semibold">ล้างตัวกรองทั้งหมด</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredRooms.map((room) => (
            <div key={room.id} className="glass-panel rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
              <div className="h-56 bg-slate-100 relative overflow-hidden">
                {room.image ? (
                  <img src={room.image} alt={`ห้อง ${room.roomNumber}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[var(--accent-brown)] bg-[var(--accent-light)]/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span className="text-sm font-medium opacity-70">ไม่มีรูปภาพประกอบ</span>
                  </div>
                )}
                <div className="absolute top-4 right-4">
                  {room.status === "ติดจอง" ? (
                    <span className="bg-amber-100/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-amber-800 shadow-sm border border-amber-200/50">
                      ติดจอง
                    </span>
                  ) : room.status === "มีคนเช่า" ? (
                    <span className="bg-rose-100/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-rose-800 shadow-sm border border-rose-200/50">
                      มีคนเช่าแล้ว
                    </span>
                  ) : room.status === "ว่าง" ? (
                    <span className="bg-emerald-100/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-emerald-800 shadow-sm border border-emerald-200/50">
                      ว่างพร้อมอยู่
                    </span>
                  ) : (
                    <span className="bg-slate-100/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-slate-800 shadow-sm border border-slate-200/50">
                      {room.status || "ไม่พร้อมใช้งาน"}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-[var(--text-main)] mb-1">ห้อง {room.roomNumber}</h3>
                    <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      ตึก {room.building} <span className="mx-1">•</span> ชั้น {room.floor}
                    </p>
                  </div>
                  <div className="text-right bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-[var(--glass-border)]">
                    <p className="text-xl font-bold text-[var(--accent-dark)]">฿{room.rentPrice.toLocaleString()}</p>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">ต่อเดือน</p>
                  </div>
                </div>
                
                <div className="mt-5 mb-6 flex gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${room.roomType === 'aircon' ? 'bg-sky-50 text-sky-800 border border-sky-100' : 'bg-orange-50 text-orange-800 border border-orange-100'}`}>
                    {room.roomType === 'aircon' ? '❄️ ห้องแอร์' : '🌀 ห้องพัดลม'}
                  </span>
                </div>
                
                <button
                  onClick={() => setSelectedRoom(room)}
                  disabled={room.status === "มีคนเช่า" || (room.status !== "ว่าง" && room.status !== "ติดจอง")}
                  className={`w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all ${
                    room.status === "มีคนเช่า" || (room.status !== "ว่าง" && room.status !== "ติดจอง")
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none" 
                      : room.status === "ติดจอง" 
                        ? "bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200" 
                        : "glass-button"
                  }`}
                >
                  {room.status === "ติดจอง" ? "จองต่อคิว" : room.status === "มีคนเช่า" ? "มีคนเช่าแล้ว" : room.status === "ว่าง" ? "ยื่นคำขอจองห้องนี้" : "ไม่พร้อมจอง"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* โมดอลยืนยันการจอง */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--text-main)]/40 backdrop-blur-sm">
          <div className="glass-panel bg-white/80 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-white/50">
            <div className="p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white flex items-center justify-center mb-6 shadow-lg shadow-[var(--shadow-color)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--text-main)] mb-2">ยืนยันการทำรายการ</h3>
              <p className="text-[var(--text-muted)] mb-6 text-sm leading-relaxed">
                คุณกำลังจะส่งคำขอจอง <strong>ห้อง {selectedRoom.roomNumber} ตึก {selectedRoom.building}</strong> ให้กับผู้ดูแลระบบพิจารณา
              </p>
              
              <div className="bg-white/50 backdrop-blur-md p-5 rounded-2xl mb-8 border border-[var(--glass-border)] shadow-inner">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-[var(--text-muted)]">ค่าเช่ารายเดือน</span>
                  <span className="text-lg font-bold text-[var(--accent-dark)]">฿{selectedRoom.rentPrice.toLocaleString()}</span>
                </div>
                <div className="w-full h-px bg-[var(--glass-border)] my-3"></div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-[var(--text-muted)]">ประเภทห้อง</span>
                  <span className="text-sm font-semibold text-[var(--text-main)] bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">{selectedRoom.roomType === 'aircon' ? 'ห้องแอร์ ❄️' : 'พัดลม 🌀'}</span>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedRoom(null)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 glass-button-outline rounded-xl font-semibold disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleRequestRoom}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 glass-button rounded-lg font-semibold disabled:opacity-70 flex items-center justify-center shadow-md shadow-[var(--shadow-color)]"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    "ยืนยันส่งคำขอ"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
