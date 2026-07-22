"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, getDocs, deleteDoc, doc, Timestamp,
  where, limit, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { startPresence } from "@/lib/presence";

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: "tenant" | "admin";
  createdAt: Timestamp | null;
  type?: string;
  moveInDate?: string;
  roomLabel?: string;
  newDate?: string;  // YYYY-MM-DD (สำหรับ reschedule_request)
  newTime?: string;  // HH:MM
}

interface TenantInfo {
  uid: string;
  displayName: string;
  email: string;
  roomNumber?: string;
  lastMessage?: string;
  lastMessageTime?: Timestamp | null;
  unread?: number;
}

// ลบข้อความที่อายุเกิน 3 เดือนออกจาก Firestore
async function deleteOldMessages(tenantId: string) {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oldMsgsQ = query(
      collection(db, "chats", tenantId, "messages"),
      where("createdAt", "<", Timestamp.fromDate(threeMonthsAgo))
    );
    const snapshot = await getDocs(oldMsgsQ);
    const deletions = snapshot.docs.map((d) =>
      deleteDoc(doc(db, "chats", tenantId, "messages", d.id))
    );
    await Promise.all(deletions);
  } catch (err) {
    console.warn("ไม่สามารถลบข้อความเก่าได้:", err);
  }
}

export default function AdminChatPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);
  const [respondedIds, setRespondedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Broadcast สถานะ admin online เมื่อเปิดหน้าแชท
  useEffect(() => {
    if (!user) return;
    const cleanup = startPresence(user.uid, "admin");
    return cleanup;
  }, [user]);

  // โหลดรายชื่อผู้เช่าแบบเรียลไทม์
  useEffect(() => {
    // 1. ติดตามคอลเลกชัน users (เฉพาะ role == "tenant")
    const usersQ = query(collection(db, "users"), where("role", "==", "tenant"));
    const unsubUsers = onSnapshot(usersQ, (userSnap) => {
      const tenantBase: Record<string, TenantInfo> = {};
      userSnap.forEach((docSnap) => {
        const data = docSnap.data();
        tenantBase[docSnap.id] = {
          uid: docSnap.id,
          displayName: data.displayName || data.name || "ผู้เช่าไม่ระบุชื่อ",
          email: data.email || "",
          roomNumber: data.roomNumber || "",
          lastMessage: "",
          lastMessageTime: null,
          unread: 0,
        };
      });

      // 2. ติดตามคอลเลกชัน chats เพื่อดึงข้อมูลล่าสุดและจำนวนที่ยังไม่อ่าน
      const unsubChats = onSnapshot(
        collection(db, "chats"), 
        (chatSnap) => {
          const updatedTenants = { ...tenantBase };
          chatSnap.forEach((cDoc) => {
            const cData = cDoc.data();
            if (updatedTenants[cDoc.id]) {
              updatedTenants[cDoc.id].lastMessage = cData.lastMessage || "";
              updatedTenants[cDoc.id].lastMessageTime = cData.lastMessageTime || null;
              updatedTenants[cDoc.id].unread = cData.adminUnreadCount || 0;
            }
          });

          // 3. แปลงกลับเป็น array และเรียงลำดับ
          const tenantList = Object.values(updatedTenants);
          tenantList.sort((a, b) => {
            if (!a.lastMessageTime && !b.lastMessageTime) return 0;
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime.toMillis() - a.lastMessageTime.toMillis();
          });

          setTenants(tenantList);
          setLoadingTenants(false);
        },
        (error) => {
          if (error.code !== "permission-denied") console.error("Admin chat snapshot error:", error);
        }
      );

      return () => unsubChats();
    }, (err) => {
      if (err.code !== "permission-denied") console.error("โหลดข้อมูลผู้เช่าไม่สำเร็จ:", err);
      setLoadingTenants(false);
    });

    return () => unsubUsers();
  }, []);

  // Subscribe ข้อความของผู้เช่าที่เลือก + reset adminUnreadCount
  useEffect(() => {
    if (!selectedTenant) return;

    setLoadingMessages(true);
    // ลบข้อความเก่าเกิน 3 เดือน
    deleteOldMessages(selectedTenant.uid);

    // Reset จำนวนข้อความที่ยังไม่ได้อ่านเป็น 0 เมื่อ admin เปิดห้องแชทนี้
    setDoc(
      doc(db, "chats", selectedTenant.uid),
      { adminUnreadCount: 0 },
      { merge: true }
    ).catch(() => {});

    // อัปเดต state ของ tenants ให้ unread = 0 ด้วย
    setTenants((prev) =>
      prev.map((t) =>
        t.uid === selectedTenant.uid ? { ...t, unread: 0 } : t
      )
    );

    const q = query(
      collection(db, "chats", selectedTenant.uid, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message));
        setMessages(msgs);
        setLoadingMessages(false);
      },
      (error) => {
        if (error.code !== "permission-denied") console.error("Admin messages snapshot error:", error);
      }
    );

    return () => unsubscribe();
  }, [selectedTenant]);

  // เลื่อนลงด้านล่างเมื่อมีข้อความใหม่
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || !selectedTenant || sending) return;

    setSending(true);
    setInput("");
    try {
      await addDoc(
        collection(db, "chats", selectedTenant.uid, "messages"),
        {
          text,
          senderId: user.uid,
          senderName: "ผู้ดูแลหอพัก",
          senderRole: "admin",
          createdAt: serverTimestamp(),
        }
      );
      // อัปเดตข้อความล่าสุด
      await setDoc(
        doc(db, "chats", selectedTenant.uid),
        { lastMessage: text, lastMessageTime: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("ส่งข้อความไม่สำเร็จ:", err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: Timestamp | null): string => {
    if (!ts) return "";
    const d = ts.toDate();
    return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (ts: Timestamp | null): string => {
    if (!ts) return "";
    return ts.toDate().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  };

  const formatRelativeTime = (ts: Timestamp | null): string => {
    if (!ts) return "";
    const now = new Date();
    const date = ts.toDate();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "เมื่อกี้";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  };

  // จัดกลุ่มวันที่ข้อความ
  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = msg.createdAt ? formatDate(msg.createdAt) : "กำลังส่ง...";
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      acc.push({ date, msgs: [msg] });
    }
    return acc;
  }, []);

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.roomNumber || "").includes(searchQuery);

    // ถ้ามีการค้นหา ให้แสดงผลลัพธ์ทั้งหมดที่ตรงกัน (เพื่อให้เริ่มแชทใหม่ได้)
    if (searchQuery.trim() !== "") {
      return matchesSearch;
    }

    // ถ้าไม่มีการค้นหา ให้แสดงเฉพาะผู้เช่าที่มีประวัติการแชท
    return t.lastMessageTime !== null || t.lastMessage !== "";
  });

  // หาข้อความปักหมุดล่าสุด
  const pinnedMsg = useMemo(() => {
    const msg = [...messages].reverse().find((m) => m.type === "move_in_date");
    if (!msg || !msg.moveInDate) return undefined;

    const moveInDate = new Date(msg.moveInDate);
    let hours = 23;
    let minutes = 59;

    // พยายามดึงเวลาจาก text เช่น "เวลา 18:00 น."
    if (msg.text) {
      const timeMatch = msg.text.match(/เวลา\s+(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
      }
    }

    moveInDate.setHours(hours, minutes, 59, 999);

    // ถ้าเวลาปัจจุบันเลยเวลานัดหมายแล้ว ให้ซ่อนปักหมุด
    if (new Date() > moveInDate) return undefined;

    return msg;
  }, [messages]);

  const scrollToPinned = () => {
    if (!pinnedMsg) return;
    const el = messageRefs.current.get(pinnedMsg.id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-4", "ring-emerald-400", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-4", "ring-emerald-400", "ring-offset-2"), 1500);
    }
  };

  // ยืนยันการเปลี่ยนวันเข้าพัก
  const handleConfirmReschedule = async (msg: Message) => {
    if (!selectedTenant || !user || !msg.newDate) return;
    setRespondedIds((prev) => new Set(prev).add(msg.id));
    try {
      const formattedDate = new Date(msg.newDate).toLocaleDateString("th-TH", {
        day: "numeric", month: "long", year: "numeric",
      });
      const confirmText = `✅ ยืนยันการเปลี่ยนวันเข้าพักเป็นวันที่ ${formattedDate} เวลา ${msg.newTime || ""} น. เรียบร้อยแล้ว`;
      // ส่งข้อความยืนยัน
      await addDoc(collection(db, "chats", selectedTenant.uid, "messages"), {
        text: confirmText,
        senderId: user.uid,
        senderName: "ผู้ดูแลหอพัก",
        senderRole: "admin",
        createdAt: serverTimestamp(),
      });
      // สร้าง move_in_date ใหม่เพื่ออัปเดตแถบปักหมุด
      await addDoc(collection(db, "chats", selectedTenant.uid, "messages"), {
        text: confirmText,
        senderId: "admin",
        senderName: "ผู้ดูแลหอพัก",
        senderRole: "admin",
        type: "move_in_date",
        moveInDate: msg.newDate,
        roomLabel: pinnedMsg?.roomLabel || "",
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "chats", selectedTenant.uid),
        { lastMessage: confirmText, lastMessageTime: serverTimestamp() },
        { merge: true }
      );

      // อัปเดตวันที่เข้าพักในข้อมูลห้องด้วย (rooms collection)
      const roomQ = query(collection(db, "rooms"), where("tenantId", "==", selectedTenant.uid));
      const roomSnap = await getDocs(roomQ);
      if (!roomSnap.empty) {
        const roomId = roomSnap.docs[0].id;
        const newDateObj = new Date(msg.newDate);
        await updateDoc(doc(db, "rooms", roomId), {
          approvedAt: newDateObj
        });
      }

      // อัปเดต moveInDate ใน room_requests
      const reqQ = query(collection(db, "room_requests"), where("tenantId", "==", selectedTenant.uid), where("status", "==", "approved"));
      const reqSnap = await getDocs(reqQ);
      if (!reqSnap.empty) {
        for (const reqDoc of reqSnap.docs) {
          await updateDoc(doc(db, "room_requests", reqDoc.id), {
            moveInDate: msg.newDate
          });
        }
      }
    } catch (err) {
      console.error("ยืนยันไม่สำเร็จ:", err);
      setRespondedIds((prev) => { const s = new Set(prev); s.delete(msg.id); return s; });
    }
  };

  // ปฏิเสธการเปลี่ยนวันเข้าพัก
  const handleRejectReschedule = async (msg: Message) => {
    if (!selectedTenant || !user) return;
    setRespondedIds((prev) => new Set(prev).add(msg.id));
    try {
      const rejectText = `❌ ไม่สามารถเปลี่ยนวันเข้าพักได้ในขณะนี้ หากต้องการเปลี่ยนวันกรุณาติดต่อแอดมินโดยตรง`;
      await addDoc(collection(db, "chats", selectedTenant.uid, "messages"), {
        text: rejectText,
        senderId: user.uid,
        senderName: "ผู้ดูแลหอพัก",
        senderRole: "admin",
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "chats", selectedTenant.uid),
        { lastMessage: rejectText, lastMessageTime: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("ปฏิเสธไม่สำเร็จ:", err);
      setRespondedIds((prev) => { const s = new Set(prev); s.delete(msg.id); return s; });
    }
  };

  return (
    <div className="w-full flex-1 min-h-0 flex gap-4">
      {/* รายชื่อผู้เช่า */}
      <div className={`glass-panel rounded-2xl flex flex-col ${selectedTenant ? "hidden md:flex" : "flex"} w-full md:w-80 flex-shrink-0`}>
        {/* หัวข้อ */}
        <div className="p-4 border-b border-[var(--glass-border)] flex-shrink-0">
          <h2 className="text-base font-bold text-[var(--text-main)] mb-3">ห้องแชทผู้เช่า</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาผู้เช่า..."
              className="w-full pl-9 pr-4 py-2 glass-input rounded-xl text-sm text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
          </div>
        </div>

        {/* รายการผู้เช่า */}
        <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loadingTenants ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin" />
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center p-4">
              <p className="text-[var(--text-muted)] text-sm">ไม่พบผู้เช่า</p>
            </div>
          ) : (
            filteredTenants.map((tenant) => (
              <button
                key={tenant.uid}
                onClick={() => setSelectedTenant(tenant)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-white/40 text-left border-b border-[var(--glass-border)]/50 ${
                  selectedTenant?.uid === tenant.uid ? "bg-[var(--accent-brown)]/10 border-l-2 border-l-[var(--accent-brown)]" : ""
                }`}
              >
                {/* รูปโปรไฟล์ */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                  {tenant.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-main)] truncate">{tenant.displayName}</p>
                    {tenant.lastMessageTime && (
                      <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">
                        {formatRelativeTime(tenant.lastMessageTime)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                    {tenant.lastMessage || (
                      <span className="italic opacity-60">ยังไม่มีการสนทนา</span>
                    )}
                  </p>
                  {tenant.roomNumber && (
                    <span className="text-[10px] text-[var(--accent-brown)] font-medium">ห้อง {tenant.roomNumber}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* พื้นที่แชท */}
      <div className={`bg-white/80 backdrop-blur-md rounded-2xl flex-1 min-h-0 relative flex flex-col shadow-sm border border-white/60 ${selectedTenant ? "flex" : "hidden md:flex"}`}>
        {/* ลายพื้นหลังแบบแอปแชท (Dot Pattern) */}
        <div 
          className="absolute inset-0 z-0 pointer-events-none rounded-2xl"
          style={{
            backgroundImage: `radial-gradient(#C67C4E 1.5px, transparent 1.5px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
            opacity: 0.15
          }}
        />
        {!selectedTenant ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            <div className="w-20 h-20 rounded-2xl bg-[var(--accent-light)]/30 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)] opacity-60">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-[var(--text-main)] font-bold text-lg">เลือกผู้เช่าเพื่อเริ่มแชท</p>
              <p className="text-[var(--text-muted)] text-sm mt-1">กดที่รายชื่อผู้เช่าทางซ้ายเพื่อเปิดการสนทนา</p>
            </div>
          </div>
        ) : (
          <>
            {/* ส่วนหัว */}
            <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-3 flex-shrink-0">
              {/* ปุ่ม Back สำหรับมือถือ */}
              <button
                onClick={() => setSelectedTenant(null)}
                className="md:hidden p-1.5 rounded-lg hover:bg-white/50 text-[var(--text-muted)] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] flex items-center justify-center text-white font-bold flex-shrink-0 shadow-md">
                {selectedTenant.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[var(--text-main)]">{selectedTenant.displayName}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedTenant.email}
                  {selectedTenant.roomNumber && ` • ห้อง ${selectedTenant.roomNumber}`}
                </p>
              </div>
            </div>

            {/* ====== Pinned Banner (Messenger-style) ====== */}
            {pinnedMsg && pinnedMsg.moveInDate && (
              <div className={`flex-shrink-0 mx-4 mt-3 rounded-2xl overflow-hidden border border-emerald-200 shadow-sm transition-all duration-300 ${pinnedCollapsed ? "bg-emerald-50" : "bg-gradient-to-r from-emerald-50 to-teal-50"}`}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={scrollToPinned}
                  onKeyDown={(e) => e.key === "Enter" && scrollToPinned()}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-100/60 transition-colors text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
                      <path d="M16 3a1 1 0 0 1 .707.293l4 4A1 1 0 0 1 20 9h-1v1a3 3 0 0 1-.878 2.121L15 15.243V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 9 21v-5.757l-3.121-3.122A3 3 0 0 1 5 10V9H4a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 8 3h8z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                      📌 วันเข้าพักที่ปักหมุด{pinnedMsg.roomLabel ? ` • ห้อง ${pinnedMsg.roomLabel}` : ""}
                    </p>
                    <p className="text-sm font-bold text-emerald-800 truncate">
                      {new Date(pinnedMsg.moveInDate).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPinnedCollapsed(!pinnedCollapsed); }}
                    className="w-7 h-7 rounded-full hover:bg-emerald-200 flex items-center justify-center flex-shrink-0 transition-colors"
                    title="ย่อ/ขยาย"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-emerald-600 transition-transform duration-300 ${pinnedCollapsed ? "rotate-180" : ""}`}>
                      <polyline points="18 15 12 9 6 15"/>
                    </svg>
                  </button>
                </div>
                <div className={`overflow-hidden transition-all duration-300 ${pinnedCollapsed ? "max-h-0" : "max-h-16"}`}>
                  <div className="px-4 pb-3">
                    <p className="text-xs text-emerald-600">ส่งให้ผู้เช่าเรียบร้อยแล้ว • กดเพื่อเลื่อนไปยังข้อความต้นทาง</p>
                  </div>
                </div>
              </div>
            )}

            {/* ข้อความ */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-3 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent-light)]/30 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)] opacity-60">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-[var(--text-main)] font-bold">ยังไม่มีการสนทนา</p>
                  <p className="text-[var(--text-muted)] text-sm">ส่งข้อความแรกเพื่อเริ่มต้นคุยกับผู้เช่า</p>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* ตัวแบ่งวันที่ */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-[var(--glass-border)]" />
                      <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-white/60 px-2 py-0.5 rounded-full border border-[var(--glass-border)]">
                        {group.date}
                      </span>
                      <div className="flex-1 h-px bg-[var(--glass-border)]" />
                    </div>

                    {group.msgs.map((msg) => {
                      const isAdmin = msg.senderRole === "admin";

                      // ===== การ์ดวันเข้าพัก (compact) =====
                      if (msg.type === "move_in_date" && msg.moveInDate) {
                        const formattedMoveIn = new Date(msg.moveInDate).toLocaleDateString("th-TH", {
                          weekday: "long", day: "numeric", month: "long", year: "numeric",
                        });
                        return (
                          <div
                            key={msg.id}
                            ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                            className="flex justify-center my-4 transition-all duration-300 rounded-2xl"
                          >
                            <div className="w-full max-w-xs bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
                              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
                                  <path d="M16 3a1 1 0 0 1 .707.293l4 4A1 1 0 0 1 20 9h-1v1a3 3 0 0 1-.878 2.121L15 15.243V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 9 21v-5.757l-3.121-3.122A3 3 0 0 1 5 10V9H4a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 8 3h8z"/>
                                </svg>
                                <span className="text-white font-bold text-xs">ปักหมุดวันเข้าพัก (ส่งแล้ว)</span>
                                {msg.roomLabel && (
                                  <span className="ml-auto text-[10px] bg-white/30 text-white px-1.5 py-0.5 rounded-full font-semibold">ห้อง {msg.roomLabel}</span>
                                )}
                              </div>
                              <div className="px-4 py-3 text-center">
                                <p className="text-emerald-800 font-bold text-sm">{formattedMoveIn}</p>
                                <p className="text-[10px] text-emerald-500 mt-0.5">ดูที่แถบด้านบนสำหรับรายละเอียด</p>
                              </div>
                              <div className="px-3 pb-2 flex justify-end">
                                <span className="text-[10px] text-emerald-400">{formatTime(msg.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ===== คำขอเปลี่ยนวันเข้าพัก (ผู้เช่าส่ง) =====
                      if (msg.type === "reschedule_request" && msg.senderRole === "tenant") {
                        const alreadyResponded = respondedIds.has(msg.id);
                        const fmtNewDate = msg.newDate
                          ? new Date(msg.newDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })
                          : "";
                        return (
                          <div
                            key={msg.id}
                            ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                            className="flex flex-col items-start gap-1.5 mb-3"
                          >
                            {/* Avatar + bubble */}
                            <div className="flex items-end gap-2">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5">
                                {selectedTenant.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="max-w-[72%] flex flex-col gap-0.5 items-start">
                                <span className="text-[10px] font-semibold text-[var(--text-muted)] ml-1">{selectedTenant.displayName}</span>
                                <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed shadow-sm bg-amber-50 border-2 border-amber-200 text-amber-900">
                                  {msg.text}
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)] mx-1">{formatTime(msg.createdAt)}</span>
                              </div>
                            </div>

                            {/* ปุ่ม ยืนยัน / ปฏิเสธ */}
                            {!alreadyResponded ? (
                              <div className="ml-9 flex items-center gap-2">
                                <p className="text-[10px] text-[var(--text-muted)] mr-1">ยืนยันวันใหม่{fmtNewDate ? ` (${fmtNewDate})` : ""}?</p>
                                <button
                                  onClick={() => handleConfirmReschedule(msg)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all hover:scale-105 active:scale-95"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  ยืนยัน
                                </button>
                                <button
                                  onClick={() => handleRejectReschedule(msg)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 shadow-sm transition-all hover:scale-105 active:scale-95"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  ปฏิเสธ
                                </button>
                              </div>
                            ) : (
                              <div className="ml-9">
                                <span className="text-[10px] text-[var(--text-muted)] italic">ตอบกลับแล้ว</span>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // ===== ข้อความธรรมดา =====
                      return (
                        <div
                          key={msg.id}
                          ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                          className={`flex items-end gap-2 mb-3 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}
                        >
                          {/* รูปโปรไฟล์ */}
                          {!isAdmin && (
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5">
                              {selectedTenant.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {isAdmin && (
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5">
                              A
                            </div>
                          )}

                          <div className={`max-w-[72%] flex flex-col gap-0.5 ${isAdmin ? "items-end" : "items-start"}`}>
                            {!isAdmin && (
                              <span className="text-[10px] font-semibold text-[var(--text-muted)] ml-1">
                                {selectedTenant.displayName}
                              </span>
                            )}
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                isAdmin
                                  ? "bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white rounded-br-sm"
                                  : "bg-white/80 backdrop-blur-sm text-[var(--text-main)] border border-[var(--glass-border)] rounded-bl-sm"
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] mx-1">
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* ช่องกรอกข้อความ */}
            <div className="px-4 py-3 border-t border-[var(--glass-border)] flex items-center gap-3 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`พิมพ์ข้อความถึง ${selectedTenant.displayName}...`}
                className="flex-1 glass-input px-4 py-2.5 rounded-xl text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all"
                disabled={sending}
                maxLength={1000}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
