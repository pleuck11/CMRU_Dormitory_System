"use client";

import { useEffect, useState, useCallback } from "react";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

const VAPID_KEY = "BPJ5WwxZOrR8f0yeUow05zu-EuBjCEmytezakAiWrB0ET17uVfUhUsLZWMeBZ7gr4nhAFo8Ij4IDE2DTCpdE-0k";

// State เก็บ toast ที่โผล่มาขณะ App เปิดอยู่
let toastCallback: ((title: string, body: string) => void) | null = null;

export function setToastCallback(cb: (title: string, body: string) => void) {
  toastCallback = cb;
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    if (typeof Notification !== "undefined") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;
    } else {
      return false; // ไม่รองรับ Native Notification
    }

    if (!("serviceWorker" in navigator)) return true; // ถ้าไม่มี SW อย่างน้อยก็แจ้งเตือนแบบธรรมดาได้
    const supported = await isSupported();
    if (!supported) return true;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // บันทึก FCM token ลง Firestore
      await setDoc(
        doc(db, "fcm_tokens", userId),
        {
          token,
          userId,
          updatedAt: serverTimestamp(),
          userAgent: navigator.userAgent,
        },
        { merge: true }
      );
      return true;
    }
    return false;
  } catch (error) {
    console.warn("Notification registration warning:", error);
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }
}

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"idle" | "asking" | "granted" | "denied">("idle");
  const [showIOSInstruction, setShowIOSInstruction] = useState(false);

  const showToast = useCallback((title: string, body: string) => {
    setToast({ title, body });
    setTimeout(() => setToast(null), 6000);

    // แจ้งเตือนผ่านเบราวเซอร์สำหรับทุกอุปกรณ์ขณะที่แอปเปิดอยู่
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: '/logo.png' });
      } catch (e) {
        // Fallback สำหรับ Safari/มือถือที่ต้องใช้ Service Worker สำหรับการแจ้งเตือน
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, { body, icon: '/logo.png' });
          }).catch(() => {});
        }
      }
    }
  }, []);

  useEffect(() => {
    setToastCallback(showToast);
  }, [showToast]);

  // เมื่อ user login → ตั้ง FCM listener สำหรับข้อความที่มาขณะ App เปิดอยู่ (Foreground)
  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const supported = await isSupported();
        if (!supported || !("serviceWorker" in navigator)) return;

        const messaging = getMessaging(app);
        unsubscribe = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || "CMRU Dormitory";
          const body = payload.notification?.body || "";
          showToast(title, body);
        });
      } catch (e) {
        // browser ไม่รองรับ messaging — ปล่อยผ่าน
      }
    };

    init();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user, showToast]);

  // ขอ permission เมื่อ user login ทำทันทีแบบ native prompt เพื่อรองรับการแจ้งเตือนจากเครื่องโดยตรง
  useEffect(() => {
    if (!user) return;

    // ตรวจสอบ iOS Safari เพื่อแสดงคำแนะนำการ Add to Home Screen (PWA)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (isIOS && !isStandalone) {
      if (!sessionStorage.getItem("ios_notif_dismissed")) {
        setShowIOSInstruction(true);
      }
      return; // ห้ามรัน Notification.requestPermission เพราะ Safari ไม่รองรับถ้าไม่ได้ Add to Home Screen
    }

    if (typeof Notification === "undefined") return;
    if (permissionStatus !== "idle") return;

    const browserPerm = Notification.permission;

    if (browserPerm === "granted") {
      setPermissionStatus("granted");
      requestNotificationPermission(user.uid);
    } else if (browserPerm === "denied") {
      setPermissionStatus("denied");
    } else {
      // เรียก Native Prompt การขอสิทธิ์ของเครื่อง (Device Notification Request)
      setPermissionStatus("asking");
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          setPermissionStatus("granted");
          requestNotificationPermission(user.uid);
        } else {
          setPermissionStatus("denied");
        }
      });
    }
  }, [user, permissionStatus]);

  return (
    <>
      {children}

      {/* คำแนะนำสำหรับ iOS (เนื่องจาก Apple บังคับให้ติดตั้งเป็น PWA ก่อนถึงจะรับแจ้งเตือนได้) */}
      {showIOSInstruction && user && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-lg">
          <div className="glass-panel border-2 border-blue-400/50 shadow-2xl px-5 py-5 rounded-2xl flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-blue-900">เปิดรับการแจ้งเตือนบน iPhone / iPad</p>
                <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                  เนื่องจากความปลอดภัยของระบบ iOS เพื่อเปิดรับการแจ้งเตือนจากหอพัก คุณจะต้องบันทึกแอปนี้ลงหน้าจอโฮมก่อน:
                  <br/><br/>
                  1. แตะไอคอน <span className="inline-flex items-center justify-center w-5 h-5 bg-white border border-gray-300 rounded mx-1 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> Share ที่อยู่ด้านล่าง<br/>
                  2. เลือกเมนู <span className="font-semibold text-gray-800">Add to Home Screen</span> (เพิ่มไปยังหน้าจอโฮม)
                </p>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem("ios_notif_dismissed", "1");
                  setShowIOSInstruction(false);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors flex-shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* การแจ้งเตือนภายในแอป (Toast) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full pointer-events-none">
          <div className="glass-panel border border-white/40 shadow-2xl px-5 py-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-right-4 duration-300 pointer-events-auto">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] flex items-center justify-center flex-shrink-0 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-main)] truncate">{toast.title}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">{toast.body}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
