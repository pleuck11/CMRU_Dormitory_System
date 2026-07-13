"use client";

import Link from "next/link";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError("");
    setMessage("");

    if (!email) {
      setError("กรุณากรอกอีเมล");
      setIsSending(false);
      return;
    }

    try {
      // ตอนที่คลิกลิงก์ในอีเมล จะวิ่งมาหา URL นี้แทนหน้า Firebase ปกติ
      const actionCodeSettings = {
        url: window.location.origin + '/auth/action',
        handleCodeInApp: false, // false เพราะต้องการให้ลิงก์เปิดหน้าเว็บ ไม่ใช่บนแอปพลิเคชันมือถือ
      };

      try {
        // ลองใช้ Resend (Custom HTML) ก่อน
        const res = await fetch("/api/send-reset-password-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        if (!res.ok) {
          throw new Error("Resend API Failed");
        }
      } catch (apiError) {
        // ถ้า Resend ล้มเหลว (เช่น ติด Sandbox) ให้ Fallback ไปใช้ Firebase Default
        console.warn("Resend failed, falling back to Firebase email:", apiError);
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
      }

      setMessage("ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว (หากไม่พบ กรุณาตรวจสอบในกล่องจดหมายขยะ/Spam)");
      setEmail("");
    } catch (err: any) {
      console.error("Forgot Password Error:", err);
      // แจ้งเตือน 'auth/user-not-found' กรณีที่อีเมลไม่ถูกต้อง หรือเกิดข้อผิดพลาดอื่นๆ
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        setError("ไม่พบบัญชีที่เชื่อมโยงกับอีเมลนี้");
      } else {
        setError("เกิดข้อผิดพลาดในการส่งอีเมลรีเซ็ตรหัสผ่าน");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* วงกลมตกแต่ง */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-72 h-72 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-80 h-80 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center liquid-hover">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-xl border border-[var(--glass-border)] p-2 overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[var(--text-main)]">
          ลืมรหัสผ่าน
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--text-muted)]">
          กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งค่านหัสผ่านใหม่
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="glass-panel py-8 px-4 sm:rounded-3xl sm:px-10">
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm text-center">
              {message}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleResetPassword}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-main)]">
                อีเมล
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 rounded-xl glass-input sm:text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending}
                className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-semibold glass-button disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? "กำลังส่งลิงก์..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
              </button>
            </div>
          </form>

          <div className="mt-8 flex gap-4">
            <Link
              href="/auth/login"
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-medium glass-button-outline"
            >
              กลับไปเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
