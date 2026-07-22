"use client";

import { useState } from "react";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function EmailVerificationWall() {
  const { user } = useAuth();
  const router = useRouter();
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleResend = async () => {
    if (!user || resendCooldown > 0) return;
    try {
      await sendEmailVerification(user, {
        url: window.location.origin + "/auth/login?verified=1",
        handleCodeInApp: false,
      });
      setResendSuccess(true);
      setError("");
      // cooldown 60 วินาที
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      if (err?.code === "auth/too-many-requests") {
        setError("ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่");
      } else {
        setError("ไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/auth/login");
  };

  const handleRefresh = () => {
    // Reload user token เพื่อตรวจ emailVerified ใหม่
    user?.reload().then(() => {
      if (auth.currentUser?.emailVerified) {
        router.refresh();
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 font-sans relative overflow-hidden">
      {/* พื้นหลังตกแต่ง */}
      <div className="absolute top-[-15%] left-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-72 h-72 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[25%] w-80 h-80 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel rounded-3xl px-8 py-12 text-center shadow-xl">

          {/* ไอคอน */}
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
          </div>

          {/* หัวเรื่อง */}
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">
            กรุณายืนยันอีเมลของคุณ
          </h1>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-2">
            เราได้ส่งลิงก์ยืนยันตัวตนไปที่อีเมล
          </p>
          {user?.email && (
            <p className="font-semibold text-[var(--text-main)] text-sm mb-2">
              {user.email}
            </p>
          )}
          <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-8">
            กรุณาตรวจสอบกล่องจดหมาย (รวมถึงกล่องจดหมายขยะ/Spam)<br />
            แล้วคลิกลิงก์ยืนยันเพื่อเข้าใช้งานระบบ
          </p>

          {/* ข้อความแจ้งเตือน */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}
          {resendSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
              ✅ ส่งอีเมลยืนยันใหม่เรียบร้อยแล้ว กรุณาตรวจสอบกล่องจดหมาย
            </div>
          )}

          {/* ปุ่มต่างๆ */}
          <div className="flex flex-col gap-3">
            {/* ยืนยันแล้ว กดเพื่อเข้าระบบ */}
            <button
              onClick={handleRefresh}
              className="w-full py-3 rounded-xl font-semibold text-sm glass-button transition-all flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/>
              </svg>
              ยืนยันแล้ว — เข้าสู่ระบบ
            </button>

            {/* ส่งอีเมลยืนยันอีกครั้ง */}
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="w-full py-3 rounded-xl font-medium text-sm glass-button-outline disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {resendCooldown > 0
                ? `ส่งอีกครั้งได้ใน ${resendCooldown}s`
                : "📧 ส่งอีเมลยืนยันอีกครั้ง"}
            </button>

            {/* ออกจากระบบ */}
            <button
              onClick={handleLogout}
              className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
