"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import React, { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import NotificationProvider from "@/components/NotificationProvider";
import ToastContainer from "@/components/ToastContainer";
import EmailVerificationWall from "@/components/EmailVerificationWall";


export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading, emailVerified } = useAuth();

  // เปิด dropdown แจ้งซ่อมอัตโนมัติเมื่ออยู่ในหน้าแจ้งซ่อม
  const isRepairPath = pathname === "/tenant/repair" || pathname === "/tenant/repair-history";
  const [repairOpen, setRepairOpen] = useState(isRepairPath);
  const [tenantStatus, setTenantStatus] = useState<string | null>(null);
  const [hasRoom, setHasRoom] = useState<boolean>(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [menuOrder, setMenuOrder] = useState<string[]>([
    "dashboard",
    "room",
    "chat",
    "bills_payments",
    "repair",
    "settings"
  ]);

  useEffect(() => {
    const loadMenuOrder = () => {
      const savedOrder = localStorage.getItem("tenantMenuOrder");
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          if (Array.isArray(parsed) && parsed.length === 6) {
            setMenuOrder(parsed);
          }
        } catch (e) {
          console.error("Error parsing menu order", e);
        }
      }
    };
    
    loadMenuOrder();
    window.addEventListener("tenantMenuOrderChanged", loadMenuOrder);
    return () => window.removeEventListener("tenantMenuOrderChanged", loadMenuOrder);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          let currentStatus = "active";
          if (userDoc.exists()) {
             currentStatus = userDoc.data().tenantStatus || "active";
          }

          // เช็คว่ามีห้องอยู่ไหม
          const roomQuery = query(collection(db, "rooms"), where("tenantId", "==", user.uid));
          const roomSnap = await getDocs(roomQuery);
          const currentlyHasRoom = !roomSnap.empty;
          
          // แก้ไขอัตโนมัติสำหรับผู้เช่าเก่าที่แอดมินลืมอัปเดตสถานะให้ตอนอนุมัติห้อง
          if (currentlyHasRoom && currentStatus === "moved_out") {
            try {
              await updateDoc(doc(db, "users", user.uid), { tenantStatus: "active" });
              currentStatus = "active";
            } catch (err) {
              console.error("Auto-heal failed:", err);
            }
          }

          setHasRoom(currentlyHasRoom);
          setTenantStatus(currentStatus);

        } catch (error) {
          console.error("Error fetching tenant status:", error);
        }
      }
    };

    if (!loading) {
      if (!user) {
        router.push("/auth/login");
      } else if (role === "admin") {
        router.push("/admin/dashboard");
      } else {
        fetchStatus();
      }
    }
  }, [user, role, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("ออกจากระบบล้มเหลว", error);
    }
  };


  // ผู้ใช้ login แล้วแต่ยังไม่ยืนยันอีเมล → แสดงหน้าแจ้งเตือน
  if (!loading && user && !emailVerified) {
    return <EmailVerificationWall />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || role === "admin") {
    return null;
  }

  return (
    <>
    <div className="min-h-screen bg-transparent flex flex-col md:flex-row font-sans">

      {/* แถบเมนูด้านข้าง (Sidebar) */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-slate-200/50 h-screen sticky top-0">

        {/* โลโก้ */}
        <div className="p-6 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-3 liquid-hover">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-md border border-slate-200 p-1 overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[15px] font-bold text-[var(--text-main)] block truncate whitespace-nowrap">หอพักหยาหยี๋ <span className="text-[var(--accent-brown)]">ออนไลน์</span></span>
              <span className="text-[11px] text-[var(--text-muted)] block truncate whitespace-nowrap">Yayee Dormitory Management</span>
            </div>
          </div>
        </div>

        {/* เมนูหลัก */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {menuOrder.map((itemId) => {
            if (itemId === "dashboard") {
              return (
                <div key={itemId}>
                  <Link
                    href="/tenant/dashboard"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      pathname === "/tenant/dashboard"
                        ? "bg-[var(--accent-brown)] text-white shadow-md shadow-[var(--shadow-color)] translate-x-1"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <rect width="7" height="9" x="3" y="3" />
                      <rect width="7" height="5" x="14" y="3" />
                      <rect width="7" height="9" x="14" y="12" />
                      <rect width="7" height="5" x="3" y="16" />
                    </svg>
                    <span className="flex-1">แดชบอร์ด</span>
                  </Link>
                </div>
              );
            }

            if (itemId === "room") {
              return (
                <div key={itemId}>
                  <Link
                    href="/tenant/room"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      pathname === "/tenant/room"
                        ? "bg-[var(--accent-brown)] text-white shadow-md shadow-[var(--shadow-color)] translate-x-1"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                      <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span className="flex-1">จองห้องพัก</span>
                  </Link>
                </div>
              );
            }

            if (itemId === "chat") {
              return (
                <div key={itemId}>
                  <Link
                    href="/tenant/chat"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      pathname === "/tenant/chat"
                        ? "bg-[var(--accent-brown)] text-white shadow-md shadow-[var(--shadow-color)] translate-x-1"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span className="flex-1">แชทกับผู้ดูแล</span>
                  </Link>
                </div>
              );
            }

            if (itemId === "bills_payments" && tenantStatus !== "moved_out" && hasRoom) {
              return (
                <div key={itemId}>
                  <Link
                    href="/tenant/bills_payments"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      pathname === "/tenant/bills_payments"
                        ? "bg-[var(--accent-brown)] text-white shadow-md shadow-[var(--shadow-color)] translate-x-1"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" x2="22" y1="10" y2="10" />
                    </svg>
                    <span className="flex-1">ยอดชำระและบิล</span>
                  </Link>
                </div>
              );
            }

            if (itemId === "repair" && tenantStatus !== "moved_out" && hasRoom) {
              return (
                <div key={itemId} className="space-y-1">
                  <button
                    onClick={() => setRepairOpen(!repairOpen)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      isRepairPath
                        ? "bg-[var(--accent-brown)] text-white shadow-md shadow-[var(--shadow-color)] translate-x-1"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                    <span className="flex-1 text-left">แจ้งซ่อม</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`shrink-0 transition-transform duration-300 ${repairOpen ? "rotate-180" : "rotate-0"}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      repairOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <div className="ml-6 mt-1 space-y-1">
                      <Link
                        href="/tenant/repair"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          pathname === "/tenant/repair"
                            ? "bg-[var(--accent-brown)]/20 text-[var(--accent-brown)] font-semibold border-l-2 border-[var(--accent-brown)] pl-4"
                            : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        กรอกแบบฟอร์มแจ้งซ่อม
                      </Link>

                      <Link
                        href="/tenant/repair-history"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                          pathname === "/tenant/repair-history"
                            ? "bg-[var(--accent-brown)]/20 text-[var(--accent-brown)] font-semibold border-l-2 border-[var(--accent-brown)] pl-4"
                            : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        ประวัติแจ้งซ่อม
                      </Link>
                    </div>
                  </div>
                </div>
              );
            }

            if (itemId === "settings") {
              return (
                <div key={itemId}>
                  <Link
                    href="/tenant/settings"
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                      (pathname === "/tenant/settings" || pathname === "/tenant/profile" || pathname === "/tenant/settings/menu-order")
                        ? "bg-[var(--accent-brown)] text-white shadow-md shadow-[var(--shadow-color)] translate-x-1"
                        : "text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-main)] hover:translate-x-1"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    <span className="flex-1">ตั้งค่า</span>
                  </Link>
                </div>
              );
            }
            return null;
          })}
        </nav>

        {/* ออกจากระบบ */}
        <div className="p-4 border-t border-[var(--glass-border)]">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 glass-button-outline rounded-lg font-medium flex justify-center items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            ออกจากระบบ
          </button>
        </div>

      </aside>

      {/* เนื้อหา */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* ส่วนหัวสำหรับมือถือ */}
        <header className="md:hidden flex items-center justify-between p-4 glass-panel-solid border-b border-[var(--glass-border)] z-40 sticky top-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 p-1 overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-[var(--text-main)]">หอพักหยาหยี๋ออนไลน์</span>
              <span className="text-xs text-[var(--text-muted)]">Yayee Dormitory</span>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors shadow-sm border border-red-100"
            aria-label="ออกจากระบบ"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
          </button>
        </header>

        {/* เนื้อหาหน้าต่างๆ */}
        <main className="flex-1 p-4 md:p-8 bg-transparent pb-28 md:pb-8">
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </main>

        {/* แถบนำทางด้านล่างสำหรับมือถือ */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] transition-all">
          <div className="flex items-center justify-around px-1 max-w-md mx-auto">
            {[
              { href: "/tenant/dashboard", label: "หน้าหลัก", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg> },
              { href: "/tenant/room", label: "ห้องพัก", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
              ...(tenantStatus !== "moved_out" && hasRoom ? [
                { href: "/tenant/bills_payments", label: "บิล", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg> },
                { href: "/tenant/repair", label: "แจ้งซ่อม", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
              ] : []),
              { href: "/tenant/chat", label: "แชท", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
              { href: "/tenant/settings", label: "ตั้งค่า", icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
            ].map(item => {
              const isActive = pathname === item.href || (item.href === "/tenant/repair" && pathname?.includes("repair")) || (item.href === "/tenant/settings" && (pathname?.includes("profile") || pathname?.includes("settings")));
              return (
                <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 min-w-[3.5rem] sm:min-w-[4rem] group" prefetch={true}>
                  <div className={`relative p-1.5 rounded-xl transition-all duration-300 ease-out ${isActive ? "text-[var(--accent-brown)] bg-orange-50 scale-110" : "text-slate-400 group-hover:text-slate-600 group-hover:scale-105"}`}>
                    {item.icon}
                  </div>
                  <span className={`text-[10px] sm:text-xs transition-all duration-300 ${isActive ? "font-bold text-[var(--accent-dark)]" : "font-medium text-slate-500"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

      </div>

    </div>
    <ToastContainer />

    {/* Modal ยืนยันออกจากระบบ (มือถือ) */}
    {showLogoutModal && (
      <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
          <div className="p-6">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
            </div>
            <h3 className="text-lg font-bold text-center text-[var(--text-main)] mb-1">ออกจากระบบ?</h3>
            <p className="text-sm text-center text-[var(--text-muted)] mb-6">คุณต้องการออกจากระบบหอพักหยาหยี๋ใช่หรือไม่</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm border border-[var(--glass-border)] bg-white text-[var(--text-muted)] active:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm bg-red-500 text-white active:bg-red-600 transition-colors shadow-md"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}