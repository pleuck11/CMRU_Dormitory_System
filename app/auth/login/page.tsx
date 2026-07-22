"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, sendEmailVerification, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function Login() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else {
        router.push("/tenant/dashboard");
      }
    }
  }, [user, role, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError("");

    try {
      // ตั้งค่าให้อยู่ในระบบตลอดไป (จนกว่าจะกดล็อกเอาท์)
      await setPersistence(auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // ดึงข้อมูล role เพื่อตรวจสอบสิทธิ์การใช้งาน
      const docRef = doc(db, "users", userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      const userRole = docSnap.exists() ? docSnap.data().role : "tenant";

      // ยกเว้นการยืนยันอีเมลสำหรับผู้ดูแลระบบ (admin)
      if (!userCredential.user.emailVerified && userRole !== "admin") {
        await signOut(auth);
        setUnverifiedEmail(email);
        setIsLoggingIn(false);
        return;
      }

      // ผู้ใช้จะถูกเปลี่ยนหน้าอัตโนมัติผ่าน useEffect
    } catch (err: any) {
      if (err.code === "auth/too-many-requests") {
        setError("คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วค่อยลองใหม่อีกครั้ง");
      } else if (err.code !== "auth/invalid-credential") {
        console.error("Login Error:", err);
        setError(`เกิดข้อผิดพลาด: ${err.message}`);
      } else {
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      }
      setIsLoggingIn(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    try {
      // Sign in briefly to get the user object for re-sending verification
      const userCredential = await signInWithEmailAndPassword(auth, unverifiedEmail, password);
      await sendEmailVerification(userCredential.user, {
        url: window.location.origin + '/auth/login?verified=1',
        handleCodeInApp: false,
      });
      await signOut(auth);
      setResendSuccess(true);
      // cooldown 60 วินาที
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setError("ไม่สามารถส่งอีเมลยืนยันได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  // หน้าแจ้งเตือนยังไม่ได้ยืนยันอีเมล
  if (unverifiedEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 font-sans relative overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-60 pointer-events-none" />
        <div className="absolute bottom-[-15%] left-[25%] w-80 h-80 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="glass-panel rounded-3xl px-8 py-12 text-center shadow-xl">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">ยืนยันอีเมลก่อนเข้าสู่ระบบ</h2>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-2">
              บัญชีนี้ยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบกล่องจดหมายของ
            </p>
            <p className="font-semibold text-[var(--text-main)] text-sm mb-2">{unverifiedEmail}</p>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed mb-6">
              (รวมถึงกล่องจดหมายขยะ/Spam) แล้วคลิกลิงก์ยืนยันตัวตนที่ได้รับ
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            {resendSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">
                ✅ ส่งอีเมลยืนยันใหม่แล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ
              </div>
            )}

            <button
              onClick={handleResendVerification}
              disabled={resendCooldown > 0}
              className="w-full py-3 rounded-xl font-semibold text-sm glass-button disabled:opacity-50 disabled:cursor-not-allowed mb-3 transition-all"
            >
              {resendCooldown > 0 ? `ส่งอีกครั้งได้ใน ${resendCooldown}s` : "📧 ส่งอีเมลยืนยันอีกครั้ง"}
            </button>

            <button
              onClick={() => { setUnverifiedEmail(""); setResendSuccess(false); setError(""); }}
              className="w-full py-3 rounded-xl font-medium text-sm glass-button-outline transition-all"
            >
              กลับไปเข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 font-sans relative overflow-hidden">
      {/* วงกลมตกแต่งพื้นหลัง */}
      <div className="absolute top-[-15%] left-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-72 h-72 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[25%] w-80 h-80 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none" />

      {/* ปุ่มกลับหน้าแรกแบบลอยตัว (Floating Back Button) */}
      <Link 
        href="/" 
        className="absolute top-6 left-6 md:top-8 md:left-8 z-50 flex items-center justify-center gap-2 px-3 py-3 md:px-4 md:py-2.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/50 text-[var(--text-main)] shadow-sm hover:bg-white/90 hover:shadow-md hover:scale-105 active:scale-95 transition-all group"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span className="text-sm font-bold hidden sm:block">กลับหน้าแรก</span>
      </Link>

      {/* การ์ดหลัก */}
      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel rounded-3xl px-8 py-10 shadow-xl">

          {/* โลโก้ + หัวข้อ */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-[var(--glass-border)] flex items-center justify-center p-2">
                <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">เข้าสู่ระบบและสมัครสมาชิก</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">กรุณากรอกข้อมูลผู้เช่าเพื่อเข้าสู่ระบบ</p>
          </div>

          {/* Tab สลับ */}
          <div className="flex rounded-xl overflow-hidden border border-[var(--glass-border)] mb-7 bg-white/40">
            <div className="flex-1 py-2.5 text-sm font-semibold text-center bg-gradient-to-r from-[var(--accent-brown)] to-[var(--accent-dark)] text-white rounded-l-xl">
              เข้าสู่ระบบ
            </div>
            <Link href="/auth/register" className="flex-1 py-2.5 text-sm font-medium text-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors rounded-r-xl">
              สมัครสมาชิก
            </Link>
          </div>

          {/* ข้อผิดพลาด */}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          {/* ฟอร์ม */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* อีเมล */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">อีเมล</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm"
                />
              </div>
            </div>

            {/* รหัสผ่าน */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-[var(--text-main)]">รหัสผ่าน</label>
                <Link href="/auth/forgot-password" className="text-xs text-[var(--accent-brown)] hover:text-[var(--accent-dark)] transition-colors font-medium">
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 glass-input rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent-brown)] transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ยืนยันข้อมูล */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl font-semibold text-sm glass-button disabled:opacity-60 disabled:cursor-not-allowed mt-2 transition-all"
            >
              {isLoggingIn ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* ส่วนท้าย */}
          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            ยังไม่มีบัญชี?{" "}
            <Link href="/auth/register" className="font-semibold text-[var(--accent-brown)] hover:text-[var(--accent-dark)] transition-colors">
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}