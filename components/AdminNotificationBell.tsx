"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

// ─────────────────────────────────────────────
// ประเภทข้อมูล
// ─────────────────────────────────────────────
type NotifCategory = "repair" | "room_request" | "chat" | "bill" | "move_out";

interface NotifItem {
  id: string;
  category: NotifCategory;
  title: string;
  body: string;
  href: string;
  createdAt: Date;
  isNew: boolean; // ยังไม่เคยเห็น (unread)
}

// ─────────────────────────────────────────────
// ฟังก์ชันแปลงเวลาสัมพัทธ์ (ภาษาไทย)
// ─────────────────────────────────────────────
function relativeTime(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "เมื่อกี้";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

// ─────────────────────────────────────────────
// ไอคอนและสีตามประเภทการแจ้งเตือน
// ─────────────────────────────────────────────
const CATEGORY_META: Record<
  NotifCategory,
  { color: string; bg: string; icon: React.ReactNode }
> = {
  repair: {
    color: "text-orange-600",
    bg: "bg-orange-100",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  room_request: {
    color: "text-blue-600",
    bg: "bg-blue-100",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
      </svg>
    ),
  },
  chat: {
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  bill: {
    color: "text-red-600",
    bg: "bg-red-100",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
      </svg>
    ),
  },
  move_out: {
    color: "text-purple-600",
    bg: "bg-purple-100",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
      </svg>
    ),
  },
};

// ─────────────────────────────────────────────
// คอมโพเนนต์หลัก
// ─────────────────────────────────────────────
export default function AdminNotificationBell() {
  const { user, role, loading } = useAuth();

  // notification items จาก Firestore (รวมทุก category)
  const [items, setItems] = useState<NotifItem[]>([]);
  // set ของ id ที่ "อ่านแล้ว" (เก็บใน sessionStorage)
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // ─── Load readIds จาก sessionStorage ────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("admin_notif_read");
      if (saved) setReadIds(new Set(JSON.parse(saved)));
    } catch {
      // ปล่อยผ่าน
    }
  }, []);

  // ─── ฟังก์ชัน merge items จาก category ต่าง ๆ ──
  const mergeItems = useCallback(
    (category: NotifCategory, newItems: Omit<NotifItem, "isNew">[]) => {
      setItems((prev) => {
        const filtered = prev.filter((i) => i.category !== category);
        const merged: NotifItem[] = [
          ...filtered,
          ...newItems.map((ni) => ({
            ...ni,
            isNew: !readIds.has(ni.id),
          })),
        ];
        // เรียงจากใหม่ → เก่า
        merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return merged.slice(0, 50); // จำกัด 50 รายการ
      });
    },
    [readIds]
  );

  // ─── Firestore realtime listeners ───────────
  useEffect(() => {
    if (loading || !user || role !== "admin") return;

    const unsubs: (() => void)[] = [];

    // 1. แจ้งซ่อม (repairs) - สถานะ "ใหม่" ล่าสุด 20 รายการ
    const repairQ = query(
      collection(db, "repairs"),
      where("status", "==", "ใหม่"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    unsubs.push(
      onSnapshot(repairQ, (snap) => {
        const newItems = snap.docs.map((d) => {
          const data = d.data();
          const ts: Timestamp | null = data.createdAt ?? null;
          return {
            id: `repair_${d.id}`,
            category: "repair" as NotifCategory,
            title: "แจ้งซ่อมใหม่",
            body: `ห้อง ${data.room || "-"} · ${data.type || data.issue || "ไม่ระบุอาการ"}`,
            href: "/admin/repair_request",
            createdAt: ts ? (ts.toDate ? ts.toDate() : new Date(ts as any)) : new Date(),
          };
        });
        mergeItems("repair", newItems);
      }, (err) => {
        if (err.code !== "permission-denied") console.error("repairs listener:", err);
      })
    );

    // 2. คำขอจองห้อง (room_requests) - pending ล่าสุด 20 รายการ
    const roomReqQ = query(
      collection(db, "room_requests"),
      where("status", "in", ["pending", "pending_docs", "pending_approval"])
    );
    unsubs.push(
      onSnapshot(roomReqQ, (snap) => {
        let newItems = snap.docs.map((d) => {
          const data = d.data();
          const ts: Timestamp | null = data.createdAt ?? null;
          let title = "คำขอจองห้องพัก";
          let bodyStatus = "รอดำเนินการ";
          
          if (data.status === "pending_approval") {
            title = "รอตรวจสอบเอกสารจองห้อง";
            bodyStatus = "ผู้เช่าส่งเอกสารแล้ว";
          } else if (data.status === "pending_docs") {
            title = "คำขอจองห้องพักใหม่";
            bodyStatus = "รอผู้เช่าส่งเอกสาร";
          }

          return {
            id: `roomreq_${d.id}`,
            category: "room_request" as NotifCategory,
            title: title,
            body: `ห้อง ${data.building ?? ""}${data.roomNumber ?? "-"} · ${bodyStatus}`,
            href: "/admin/room_requests",
            createdAt: ts ? (ts.toDate ? ts.toDate() : new Date(ts as any)) : new Date(),
          };
        });
        
        // เรียงจากใหม่ไปเก่าแล้วตัด 20 รายการ
        newItems.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        newItems = newItems.slice(0, 20);
        
        mergeItems("room_request", newItems);
      }, (err) => {
        if (err.code !== "permission-denied") console.error("room_requests listener:", err);
      })
    );

    // 3. แชทที่ยังไม่อ่าน (chats) - adminUnreadCount > 0
    unsubs.push(
      onSnapshot(
        query(collection(db, "chats"), where("adminUnreadCount", ">", 0)),
        (snap) => {
          const newItems = snap.docs.map((d) => {
            const data = d.data();
            const ts: Timestamp | null = data.lastMessageAt ?? data.updatedAt ?? null;
            const count = data.adminUnreadCount ?? 1;
            return {
              id: `chat_${d.id}`,
              category: "chat" as NotifCategory,
              title: "ข้อความใหม่จากผู้เช่า",
              body: `${count} ข้อความ${count > 1 ? "" : ""} · ${data.tenantName || data.roomNumber || "ผู้เช่า"}`,
              href: "/admin/chat",
              createdAt: ts ? (ts.toDate ? ts.toDate() : new Date(ts as any)) : new Date(),
            };
          });
          mergeItems("chat", newItems);
        }, (err) => {
          if (err.code !== "permission-denied") console.error("chats listener:", err);
        }
      )
    );

    // 4. บิลรอตรวจสอบและบิลค้างชำระ (bills) - status "pending" หรือ (status "unpaid" และ dueDate < now)
    const billQ = query(
      collection(db, "bills"),
      where("status", "in", ["unpaid", "pending"])
    );
    unsubs.push(
      onSnapshot(billQ, (snap) => {
        const now = new Date();
        const newItems = snap.docs
          .filter((d) => {
            const data = d.data();
            if (data.status === "pending") return true; // เอาบิลที่รอตรวจสอบเสมอ
            const due: any = data.dueDate ?? null;
            if (!due) return false;
            const dueDateObj = due.toDate ? due.toDate() : new Date(due);
            return dueDateObj < now; // เอาบิลที่เกินกำหนดแล้ว
          })
          .map((d) => {
            const data = d.data();
            const isPending = data.status === "pending";
            const ts: any = isPending ? (data.updatedAt ?? data.createdAt ?? null) : (data.dueDate ?? null);
            return {
              id: `bill_${d.id}`,
              category: "bill" as NotifCategory,
              title: isPending ? "แจ้งชำระเงินบิลค่าเช่า" : "บิลค้างชำระ (เกินกำหนด)",
              body: `ห้อง ${data.roomNumber ?? "-"} · ${isPending ? "รอตรวจสอบสลิป" : `฿${(data.totalAmount ?? 0).toLocaleString()}`}`,
              href: "/admin/bills_payments",
              createdAt: ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : new Date(),
            };
          });
        mergeItems("bill", newItems);
      }, (err) => {
        if (err.code !== "permission-denied") console.error("bills listener:", err);
      })
    );

    // 5. แจ้งย้ายออก (move_out) - จาก users ที่ moveOutRequested == true
    const moveOutQ = query(
      collection(db, "users"),
      where("moveOutRequested", "==", true)
    );
    unsubs.push(
      onSnapshot(moveOutQ, (snap) => {
        const newItems = snap.docs.map((d) => {
          const data = d.data();
          const ts: any = data.moveOutRequestedAt ?? null;
          const expDate: any = data.expectedMoveOutDate ?? null;
          const expDateObj = expDate ? (expDate.toDate ? expDate.toDate() : new Date(expDate)) : null;
          const isDue = expDateObj && expDateObj <= new Date();
          
          return {
            id: `moveout_${d.id}`,
            category: "move_out" as NotifCategory,
            title: isDue ? "ครบกำหนดย้ายออก" : "แจ้งย้ายออกใหม่",
            body: `ผู้เช่า: ${data.name || "-"}`,
            href: "/admin/manage_tenants",
            createdAt: ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : new Date(),
          };
        });
        mergeItems("move_out", newItems);
      }, (err) => {
        if (err.code !== "permission-denied") console.error("moveout listener:", err);
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [loading, user, role, mergeItems]);

  // ─── Recalculate isNew เมื่อ readIds เปลี่ยน ──
  useEffect(() => {
    setItems((prev) =>
      prev.map((i) => ({ ...i, isNew: !readIds.has(i.id) }))
    );
  }, [readIds]);

  // ─── ปิด dropdown เมื่อคลิกนอก ──────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !bellRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Mark all as read ────────────────────────
  const markAllRead = () => {
    const allIds = items.map((i) => i.id);
    const next = new Set([...readIds, ...allIds]);
    setReadIds(next);
    try {
      sessionStorage.setItem("admin_notif_read", JSON.stringify([...next]));
    } catch {
      // ปล่อยผ่าน
    }
  };

  const unreadCount = items.filter((i) => i.isNew).length;

  // ─── Render ───────────────────────────────────
  return (
    <div className="relative">
      {/* ── Bell Button ── */}
      <button
        ref={bellRef}
        id="admin-notification-bell"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-label="การแจ้งเตือน"
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/70 hover:bg-white border border-white/60 shadow-sm hover:shadow-md transition-all duration-200 backdrop-blur-sm group"
      >
        {/* Bell icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-colors duration-200 ${unreadCount > 0 ? "text-[var(--accent-brown)]" : "text-slate-500 group-hover:text-slate-700"}`}
          style={unreadCount > 0 ? { animation: "bellRing 0.6s ease-in-out" } : {}}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-[calc(100%+10px)] w-[360px] max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden z-[9999] animate-in slide-in-from-top-2 fade-in duration-200"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.16)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-800">การแจ้งเตือน</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} ใหม่
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-[var(--accent-brown)] hover:text-[var(--accent-dark)] transition-colors py-1 px-2 rounded-lg hover:bg-orange-50"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* Category Tabs Summary */}
          {items.length > 0 && (
            <div className="flex gap-2 px-5 py-3 border-b border-slate-100 overflow-x-auto">
              {(["repair", "room_request", "chat", "bill", "move_out"] as NotifCategory[]).map((cat) => {
                const catItems = items.filter((i) => i.category === cat);
                const catUnread = catItems.filter((i) => i.isNew).length;
                if (catItems.length === 0) return null;
                const meta = CATEGORY_META[cat];
                const labels: Record<NotifCategory, string> = {
                  repair: "ซ่อม",
                  room_request: "จอง",
                  chat: "แชท",
                  bill: "บิล",
                  move_out: "ย้ายออก",
                };
                return (
                  <div
                    key={cat}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${meta.bg} ${meta.color}`}
                  >
                    {meta.icon}
                    {labels[cat]}
                    {catUnread > 0 && (
                      <span className="bg-white/80 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {catUnread}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[420px] custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-40">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <p className="text-sm font-medium">ไม่มีการแจ้งเตือน</p>
                <p className="text-xs text-slate-300 mt-1">ระบบทุกอย่างปกติ ✓</p>
              </div>
            ) : (
              items.map((item) => {
                const meta = CATEGORY_META[item.category];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      // ทำเครื่องหมายว่าอ่านแล้ว
                      const next = new Set([...readIds, item.id]);
                      setReadIds(next);
                      try {
                        sessionStorage.setItem("admin_notif_read", JSON.stringify([...next]));
                      } catch { /**/ }
                      setOpen(false);
                    }}
                    className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors border-b border-slate-100/80 last:border-0 group ${item.isNew ? "bg-orange-50/50" : ""}`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${meta.bg} ${meta.color} shadow-sm mt-0.5`}>
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight ${item.isNew ? "text-slate-900" : "text-slate-600"}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {item.body}
                      </p>
                      <p className={`text-[11px] mt-1.5 font-medium ${item.isNew ? "text-[var(--accent-brown)]" : "text-slate-400"}`}>
                        {relativeTime(item.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {item.isNew && (
                      <div className="flex-shrink-0 mt-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-brown)] shadow-sm" />
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 px-5 py-3 flex flex-wrap gap-2 justify-center">
            <Link
              href="/admin/repair_request"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors whitespace-nowrap min-w-[70px]"
            >
              แจ้งซ่อม
            </Link>
            <Link
              href="/admin/room_requests"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors whitespace-nowrap min-w-[70px]"
            >
              คำขอห้อง
            </Link>
            <Link
              href="/admin/chat"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors whitespace-nowrap min-w-[70px]"
            >
              แชท
            </Link>
            <Link
              href="/admin/bills_payments"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-semibold py-2 px-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors whitespace-nowrap min-w-[70px]"
            >
              บิล
            </Link>
            <Link
              href="/admin/manage_tenants"
              onClick={() => setOpen(false)}
              className="flex-[1_0_100%] text-center text-xs font-semibold py-2 px-3 rounded-xl bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors whitespace-nowrap min-w-[70px]"
            >
              จัดการผู้เช่า (ย้ายออก)
            </Link>
          </div>
        </div>
      )}

      {/* Bell ring keyframe */}
      <style jsx>{`
        @keyframes bellRing {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(10deg); }
          30%  { transform: rotate(-10deg); }
          45%  { transform: rotate(8deg); }
          60%  { transform: rotate(-6deg); }
          75%  { transform: rotate(4deg); }
          90%  { transform: rotate(-2deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
