"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  serverTimestamp, where, getDocs, deleteDoc, doc, Timestamp,
  setDoc, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

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
}

async function deleteOldMessages(tenantId: string) {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oldMsgsQ = query(
      collection(db, "chats", tenantId, "messages"),
      where("createdAt", "<", Timestamp.fromDate(threeMonthsAgo))
    );
    const snapshot = await getDocs(oldMsgsQ);
    await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, "chats", tenantId, "messages", d.id))));
  } catch (err) {
    console.warn("ไม่สามารถลบข้อความเก่าได้:", err);
  }
}

export default function TenantChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // สถานะสำหรับ reschedule
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  useEffect(() => {
    if (!user) return;
    deleteOldMessages(user.uid);

    const q = query(
      collection(db, "chats", user.uid, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const msgs: Message[] = [];
        snapshot.forEach((d) => msgs.push({ id: d.id, ...d.data() } as Message));
        setMessages(msgs);
        setLoading(false);
      },
      (error) => {
        if (error.code !== "permission-denied") console.error("Chat snapshot error:", error);
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // หาข้อความปักหมุดล่าสุด (move_in_date)
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
      // กระพริบสีไฮไลต์ชั่วคราว
      el.classList.add("ring-4", "ring-emerald-400", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-4", "ring-emerald-400", "ring-offset-2"), 1500);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setInput("");
    try {
      await addDoc(collection(db, "chats", user.uid, "messages"), {
        text,
        senderId: user.uid,
        senderName: user.displayName || user.email || "ผู้เช่า",
        senderRole: "tenant",
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "chats", user.uid),
        { adminUnreadCount: increment(1), lastMessage: text, lastMessageTime: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("ส่งข้อความไม่สำเร็จ:", err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!newDate || !user) return;
    setSubmittingReschedule(true);
    try {
      const formattedDate = new Date(newDate).toLocaleDateString("th-TH", {
        day: "numeric", month: "long", year: "numeric",
      });
      const rescheduleText = `📅 ขอเปลี่ยนวันเข้าพักเป็นวันที่ ${formattedDate} เวลา ${newTime} น.`;
      await addDoc(collection(db, "chats", user.uid, "messages"), {
        text: rescheduleText,
        senderId: user.uid,
        senderName: user.displayName || user.email || "\u0e1c\u0e39\u0e49\u0e40\u0e0a\u0e48\u0e32",
        senderRole: "tenant",
        type: "reschedule_request",
        newDate: newDate,   // YYYY-MM-DD
        newTime: newTime,   // HH:MM
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "chats", user.uid),
        { adminUnreadCount: increment(1), lastMessage: rescheduleText, lastMessageTime: serverTimestamp() },
        { merge: true }
      );
      setRescheduleId(null);
      setNewDate("");
      setNewTime("09:00");
    } catch (err) {
      console.error("ส่งคำขอเปลี่ยนวันไม่สำเร็จ:", err);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const formatTime = (ts: Timestamp | null) => {
    if (!ts) return "";
    return ts.toDate().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  };
  const formatDate = (ts: Timestamp | null) => {
    if (!ts) return "";
    return ts.toDate().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  };
  const formatMoveInDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const groupedMessages = messages.reduce<{ date: string; msgs: Message[] }[]>((acc, msg) => {
    const date = msg.createdAt ? formatDate(msg.createdAt) : "กำลังส่ง...";
    const last = acc[acc.length - 1];
    if (last && last.date === date) last.msgs.push(msg);
    else acc.push({ date, msgs: [msg] });
    return acc;
  }, []);

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] flex flex-col">

      {/* ====== Header ====== */}
      <div className="glass-panel rounded-2xl px-5 py-4 mb-2 flex items-center gap-4 shadow-sm flex-shrink-0">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] flex items-center justify-center text-white font-bold text-lg shadow-md">
          A
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-[var(--text-main)]">แชทกับผู้ดูแลหอพัก</p>
          <p className="text-xs text-[var(--text-muted)]">ส่งข้อความถึงแอดมินได้โดยตรง • ประวัติเก็บไว้ 3 เดือน</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          ออนไลน์
        </span>
      </div>

      {/* ====== Pinned Banner (Messenger-style) ====== */}
      {pinnedMsg && pinnedMsg.moveInDate && (
        <div
          className={`flex-shrink-0 mb-2 rounded-2xl overflow-hidden border border-emerald-200 shadow-sm transition-all duration-300 ${pinnedCollapsed ? "bg-emerald-50" : "bg-gradient-to-r from-emerald-50 to-teal-50"}`}
        >
          {/* แถบหลัก — กดเพื่อ scroll ไปข้อความ */}
          <div
            role="button"
            tabIndex={0}
            onClick={scrollToPinned}
            onKeyDown={(e) => e.key === "Enter" && scrollToPinned()}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-100/60 transition-colors text-left cursor-pointer"
          >
            {/* ไอคอนหมุด */}
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
                <path d="M16 3a1 1 0 0 1 .707.293l4 4A1 1 0 0 1 20 9h-1v1a3 3 0 0 1-.878 2.121L15 15.243V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 9 21v-5.757l-3.121-3.122A3 3 0 0 1 5 10V9H4a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 8 3h8z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">📌 วันเข้าพักที่ปักหมุด{pinnedMsg.roomLabel ? ` • ห้อง ${pinnedMsg.roomLabel}` : ""}</p>
              <p className="text-sm font-bold text-emerald-800 truncate">
                {formatMoveInDate(pinnedMsg.moveInDate)}
              </p>
            </div>
            {/* ปุ่ม collapse */}
            <button
              onClick={(e) => { e.stopPropagation(); setPinnedCollapsed(!pinnedCollapsed); }}
              className="w-7 h-7 rounded-full hover:bg-emerald-200 flex items-center justify-center flex-shrink-0 transition-colors"
              title={pinnedCollapsed ? "ขยาย" : "ย่อ"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-emerald-600 transition-transform duration-300 ${pinnedCollapsed ? "rotate-180" : ""}`}>
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          </div>

          {/* ส่วนขยาย: รายละเอียด + ปุ่มเลือกวันใหม่ */}
          <div className={`overflow-hidden transition-all duration-300 ${pinnedCollapsed ? "max-h-0" : "max-h-80"}`}>
            <div className="px-4 pb-3 border-t border-emerald-100">
              <p className="text-xs text-emerald-600 mt-2 mb-2">หากไม่สะดวกในวันดังกล่าว สามารถเลือกวันใหม่ได้เลย</p>

              {rescheduleId === "pinned" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-emerald-700 block mb-1">วันที่</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-3 py-1.5 text-sm border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-emerald-700 block mb-1">เวลา</label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setRescheduleId(null); setNewDate(""); }}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleRescheduleSubmit}
                      disabled={!newDate || submittingReschedule}
                      className="flex-1 py-1.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                    >
                      {submittingReschedule ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : "ส่งคำขอ"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRescheduleId("pinned")}
                  className="w-full py-1.5 text-xs font-bold rounded-xl border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                    <line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
                  </svg>
                  เลือกวันใหม่
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== พื้นที่ข้อความ ====== */}
      <div className="glass-panel rounded-2xl flex-1 overflow-y-auto p-4 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-3 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent-light)]/30 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)] opacity-60">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-[var(--text-main)] font-bold">ยังไม่มีการสนทนา</p>
            <p className="text-[var(--text-muted)] text-sm">ส่งข้อความแรกเพื่อเริ่มต้นคุยกับผู้ดูแล</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[var(--glass-border)]" />
                <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-white/60 px-2 py-0.5 rounded-full border border-[var(--glass-border)]">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-[var(--glass-border)]" />
              </div>

              {group.msgs.map((msg) => {
                const isMine = msg.senderId === user?.uid;

                // ===== การ์ดวันเข้าพักในกระแสแชท (compact) =====
                if (msg.type === "move_in_date" && msg.moveInDate) {
                  return (
                    <div
                      key={msg.id}
                      ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                      className="flex justify-center my-4 transition-all duration-300 rounded-2xl"
                    >
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl shadow-sm overflow-hidden w-full max-w-xs">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0">
                            <path d="M16 3a1 1 0 0 1 .707.293l4 4A1 1 0 0 1 20 9h-1v1a3 3 0 0 1-.878 2.121L15 15.243V19a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 9 21v-5.757l-3.121-3.122A3 3 0 0 1 5 10V9H4a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 8 3h8z"/>
                          </svg>
                          <span className="text-white font-bold text-xs">ปักหมุดวันเข้าพัก</span>
                          {msg.roomLabel && (
                            <span className="ml-auto text-[10px] bg-white/30 text-white px-1.5 py-0.5 rounded-full font-semibold">ห้อง {msg.roomLabel}</span>
                          )}
                        </div>
                        <div className="px-4 py-3 text-center">
                          <p className="text-emerald-800 font-bold text-sm">{formatMoveInDate(msg.moveInDate)}</p>
                          <p className="text-[10px] text-emerald-500 mt-0.5">ดูที่แถบด้านบนเพื่อเลือกวันใหม่</p>
                        </div>
                        <div className="px-3 pb-2 flex justify-end">
                          <span className="text-[10px] text-emerald-400">{formatTime(msg.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ===== ข้อความธรรมดา =====
                return (
                  <div
                    key={msg.id}
                    ref={(el) => { if (el) messageRefs.current.set(msg.id, el); }}
                    className={`flex items-end gap-2 mb-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {!isMine && (
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-0.5">
                        A
                      </div>
                    )}
                    <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                      {!isMine && (
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] ml-1">{msg.senderName}</span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                        isMine
                          ? "bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white rounded-br-sm"
                          : "bg-white/80 backdrop-blur-sm text-[var(--text-main)] border border-[var(--glass-border)] rounded-bl-sm"
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] mx-1">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ====== ช่องพิมพ์ข้อความ ====== */}
      <div className="glass-panel rounded-2xl px-4 py-3 mt-2 flex items-center gap-3 shadow-sm flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ข้อความ..."
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
    </div>
  );
}
