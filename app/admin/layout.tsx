"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useEffect, useState } from "react";
import NotificationProvider from "@/components/NotificationProvider";
import ToastContainer from "@/components/ToastContainer";
import { collection, onSnapshot, query } from "firebase/firestore";
import AdminNotificationBell from "@/components/AdminNotificationBell";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "แดชบอร์ด", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg> },
  { href: "/admin/manage_tenants", label: "จัดการผู้เช่า", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { href: "/admin/rooms", label: "จัดการตึกและห้องพัก", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15v4a2 2 0 0 1-2 2H5"/><path d="M11 18h2"/><path d="M21 8v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8"/><path d="M15 8V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4z"/></svg> },
  { href: "/admin/electric_meter", label: "จัดการมิเตอร์ไฟ", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
  { href: "/admin/repair_request", label: "แจ้งซ่อม", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
  { href: "/admin/room_requests", label: "คำขอจองห้อง", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg> },
  { href: "/admin/bills_payments", label: "บิลและการชำระเงิน", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
  { href: "/admin/chat", label: "แชทผู้เช่า", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { href: "/admin/report", label: "ออกรายงาน", icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { 
    href: "/admin/settings", 
    label: "ตั้งค่าเว็บไซต์", 
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> 
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Subscribe จำนวนข้อความที่ยังไม่ได้อ่านโดย admin แบบ Realtime
  // รอให้ loading เสร็จและ role ยืนยันแล้วค่อย subscribe เพื่อป้องกัน permission-denied error
  useEffect(() => {
    if (loading || !user || role !== "admin") return;
    const unsubscribe = onSnapshot(
      query(collection(db, "chats")),
      (snap) => {
        let total = 0;
        snap.forEach((d) => {
          total += d.data().adminUnreadCount || 0;
        });
        setChatUnreadCount(total);
      },
      (error) => {
        // กลืน permission-denied error เงียบๆ (เกิดได้ตอน token กำลัง refresh)
        if (error.code !== "permission-denied") {
          console.error("Chat unread count listener error:", error);
        }
      }
    );
    return () => unsubscribe();
  }, [loading, user, role]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/auth/login");
      } else if (role !== "admin") {
        router.push("/tenant/dashboard");
      }
    }
  }, [user, role, loading, router]);

  // ปิด drawer เมื่อเปลี่ยนหน้า
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("ออกจากระบบล้มเหลว", error);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">กำลังโหลด...</div>;
  }

  if (!user || role !== "admin") {
    return null;
  }

  const SidebarNav = () => (
    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 relative overflow-hidden group ${
              isActive
                ? "text-white shadow-md shadow-[var(--shadow-color)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/50"
            }`}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-brown)] to-[var(--accent-dark)] opacity-90 z-0"></div>
            )}
            <div className="relative z-10 flex items-center gap-3 w-full">
              <div className={`${isActive ? "text-white" : "text-[var(--accent-brown)] group-hover:scale-110 transition-transform"}`}>
                {item.icon}
              </div>
              <span className="flex-1">{item.label}</span>
              {/* Badge แจ้งเตือนเมนูแชท */}
              {item.href === "/admin/chat" && chatUnreadCount > 0 && (
                <span className={`min-w-[20px] h-5 rounded-full text-[10px] font-bold flex items-center justify-center px-1.5 ${
                  isActive
                    ? "bg-white text-[var(--accent-brown)]"
                    : "bg-red-500 text-white"
                }`}>
                  {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
    <div className="min-h-screen flex flex-col md:flex-row font-sans relative">
      {/* องค์ประกอบพื้นหลังตกแต่ง */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none z-0 print:hidden"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-[var(--accent-dark)] rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none z-0 print:hidden"></div>

      {/* แถบเมนูด้านข้างสำหรับ Desktop */}
      <aside className="hidden md:flex flex-col w-72 glass-panel border-r border-[var(--glass-border)] h-screen sticky top-0 print:hidden z-10 rounded-none bg-white/40">
        <div className="p-6 border-b border-[var(--glass-border)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--glass-bg)] to-transparent opacity-50"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg border border-[var(--glass-border)] p-1 overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[15px] font-bold tracking-tight text-[var(--text-main)] block truncate whitespace-nowrap">ระบบบริหารจัดการหอพักหยาหยี๋</span>
              <span className="text-[11px] font-medium text-[var(--text-muted)] tracking-wider block truncate whitespace-nowrap">Yayee Dormitory Management</span>
            </div>
          </div>
        </div>
        <SidebarNav />
        <div className="p-4 border-t border-[var(--glass-border)] bg-white/30 backdrop-blur-md">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full px-4 py-3 glass-button-outline rounded-lg font-semibold text-[var(--accent-dark)] hover:text-white group transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* เมนูแบบ Full Screen สำหรับมือถือ (แนว Settings App) */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-[var(--bg-color)]/95 backdrop-blur-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-3 pt-[max(env(safe-area-inset-top),20px)] bg-transparent sticky top-0 z-10">
            <div className="flex-1"></div>
            <h2 className="text-xl font-bold text-center text-[var(--text-main)] flex-1">เมนู</h2>
            <div className="flex-1 flex justify-end">
              <button onClick={() => setDrawerOpen(false)} className="text-[var(--accent-brown)] font-semibold text-base bg-transparent active:opacity-70 transition-opacity p-2 -mr-2">
                ปิด
              </button>
            </div>
          </div>

          {/* เนื้อหาเมนู (Scrollable) */}
          <div className="flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),24px)] pt-2 px-4 bg-transparent custom-scrollbar">
            
            {/* กล่องเมนูกลุ่มต่างๆ */}
            {[
              { title: "การจัดการหอพัก", hrefs: ["/admin/manage_tenants", "/admin/rooms"] },
              { title: "บริการและการเงิน", hrefs: ["/admin/electric_meter", "/admin/bills_payments"] },
              { title: "ระบบและอื่นๆ", hrefs: ["/admin/report", "/admin/settings"] }
            ].map((group, groupIdx) => (
              <div key={groupIdx} className="mb-6">
                <h3 className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 ml-4">{group.title}</h3>
                <div className="glass-panel rounded-3xl overflow-hidden shadow-sm border border-[var(--glass-border)]">
                  {group.hrefs.map((href, index) => {
                    const item = NAV_ITEMS.find(i => i.href === href);
                    if (!item) return null;
                    
                    const isActive = pathname === href || pathname.startsWith(`${href}/`);
                    
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center justify-between p-4 transition-colors relative ${isActive ? "bg-white/40" : "hover:bg-white/20 active:bg-white/30"}`}
                      >
                        {/* เส้นคั่นบางๆ สำหรับไอเท็มที่ 2 ขึ้นไป */}
                        {index > 0 && <div className="absolute top-0 left-[68px] right-0 h-[1px] bg-[var(--glass-border)]/50"></div>}
                        
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive ? "bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white shadow-md scale-105" : "text-[var(--accent-brown)] opacity-90 bg-white/50"}`}>
                            <div className="scale-[1.1]">
                               {item.icon}
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-[15px] font-bold transition-colors ${isActive ? "text-[var(--text-main)]" : "text-[var(--text-main)]/80"}`}>
                              {item.label}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {item.href === "/admin/chat" && chatUnreadCount > 0 && (
                            <span className="bg-red-500 text-white min-w-[22px] h-5 px-1.5 flex items-center justify-center rounded-full text-xs font-bold shadow-sm">
                              {chatUnreadCount > 99 ? "99+" : chatUnreadCount}
                            </span>
                          )}
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-[var(--text-muted)] opacity-50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {/* ออกจากระบบ */}
            <div className="mb-8 mt-4">
              <button
                onClick={() => { setDrawerOpen(false); setShowLogoutModal(true); }}
                className="w-full flex items-center justify-between p-4 glass-panel rounded-3xl shadow-sm border border-red-200/50 hover:bg-red-50/50 active:bg-red-100/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 transition-transform hover:scale-110">
                    <div className="scale-[1.1]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    </div>
                  </div>
                  <span className="text-[15px] font-bold text-red-500">ออกจากระบบ</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
            
            <div className="text-center mt-8 mb-4">
               <span className="text-xs text-gray-400 font-medium tracking-widest uppercase">YAYEE DORMITORY</span>
            </div>

          </div>
        </div>
      )}

      {/* เนื้อหาหลัก */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 w-full overflow-hidden print:overflow-visible">
        {/* Mobile top header */}
        <header className="md:hidden flex items-center justify-between p-4 glass-panel bg-white/90 backdrop-blur-md border-b border-[var(--glass-border)] print:hidden rounded-none sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-[var(--glass-border)] p-[2px] overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-[var(--text-main)]">หอพักหยาหยี๋</span>
              <span className="text-xs text-[var(--accent-brown)] font-semibold">ผู้ดูแลระบบ</span>
            </div>
          </div>
          {/* กระดิ่งแจ้งเตือน Mobile */}
          <AdminNotificationBell />
        </header>

        {/* พื้นที่แสดงเนื้อหา */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 pb-28 md:pb-8 print:p-0 print:bg-white print:overflow-visible custom-scrollbar">
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </main>
        
        {/* แถบนำทางด้านล่างสำหรับมือถือ (Floating Capsule Design) */}
        <nav className="md:hidden fixed bottom-6 left-4 right-4 z-40 glass-panel !rounded-[2rem] px-2 py-2.5 shadow-[0_8px_32px_rgba(198,124,78,0.15)] print:hidden transition-all border border-white/60">
          <div className="flex items-center justify-between px-2 max-w-md mx-auto">
            {[
              { href: "/admin/dashboard", label: "หน้าหลัก", icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg> },
              { href: "/admin/room_requests", label: "คำขอ", icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg> },
              { href: "/admin/repair_request", label: "แจ้งซ่อม", icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
              { href: "/admin/chat", label: "แชท", icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, badge: chatUnreadCount },
            ].map(item => {
              const isActive = pathname === item.href && !drawerOpen;
              return (
                <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)} className="flex flex-col items-center gap-1 min-w-[3.5rem] relative group" prefetch={true}>
                  <div className={`relative p-2.5 rounded-2xl transition-all duration-300 ease-out ${isActive ? "text-white bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] shadow-md scale-110" : "text-[var(--text-muted)] group-hover:text-[var(--accent-brown)] group-hover:bg-white/40"}`}>
                    {item.icon}
                    {item.badge && item.badge > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
            
            {/* ปุ่มเปิดเมนู */}
            <button onClick={() => setDrawerOpen((prev) => !prev)} className="flex flex-col items-center gap-1 min-w-[3.5rem] relative group">
              <div className={`relative p-2.5 rounded-2xl transition-all duration-300 ease-out ${drawerOpen ? "text-white bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] shadow-md scale-110" : "text-[var(--text-muted)] group-hover:text-[var(--accent-brown)] group-hover:bg-white/40"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </div>
            </button>
          </div>
        </nav>
      </div>
    </div>
    <ToastContainer />
    
    {/* Modal ยืนยันออกจากระบบ (มือถือ) */}
    {showLogoutModal && (
      <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
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
            <p className="text-sm text-center text-[var(--text-muted)] mb-6">คุณต้องการออกจากระบบผู้ดูแลใช่หรือไม่</p>
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
