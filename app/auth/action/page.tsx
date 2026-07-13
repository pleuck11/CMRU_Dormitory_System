"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

function ActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [oobCode, setOobCode] = useState<string | null>(null);
  const [emailToReset, setEmailToReset] = useState<string | null>(null);
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Firebase จะส่งโหมด (mode) และรหัสยืนยัน (oobCode) มาทาง URL
    const code = searchParams.get("oobCode");
    const mode = searchParams.get("mode");

    if (code && mode === "resetPassword") {
      setOobCode(code);
      // ตรวจสอบว่า Code ถูกต้องและยังไม่หมดอายุ
      verifyPasswordResetCode(auth, code)
        .then((email) => {
          setEmailToReset(email);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Invalid or expired code", error);
          setError("ลิงก์รีเซ็ตรหัสผ่านนี้ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่");
          setLoading(false);
        });
    } else {
      setError("ไม่พบข้อมูลสำหรับการดำเนินการนี้");
      setLoading(false);
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (newPassword.length < 6) {
      setError("รหัสผ่านควรมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (!oobCode) return;

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
    } catch (error: any) {
      console.error("Error setting new password:", error);
      setError("เกิดข้อผิดพลาดในการตั้งรหัสผ่าน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !error && !success) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[50vh] space-y-4">
         <div className="w-12 h-12 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin"></div>
         <p className="text-[var(--text-muted)] font-medium">กำลังตรวจสอบข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {success ? (
        <div className="text-center space-y-6">
           <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
           </div>
           <h3 className="text-xl font-bold text-[var(--text-main)]">ตั้งรหัสผ่านใหม่สำเร็จแล้ว</h3>
           <p className="text-[var(--text-muted)] text-sm mb-6">
             คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
           </p>
           <Link
             href="/auth/login"
             className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold glass-button mt-4"
           >
             ไปที่หน้าเข้าสู่ระบบ
           </Link>
        </div>
      ) : error ? (
        <div className="text-center space-y-6">
           <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </div>
           <h3 className="text-xl font-bold text-red-600">ข้อผิดพลาด</h3>
           <p className="text-[var(--text-muted)] text-sm mb-6">
             {error}
           </p>
           <Link
             href="/auth/forgot-password"
             className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold glass-button-outline mt-4"
           >
             กลับไปขอลิงก์ใหม่
           </Link>
        </div>
      ) : (
        <div className="space-y-6">
           <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-[var(--text-main)]">ตั้งรหัสผ่านใหม่</h3>
              <p className="text-[var(--text-muted)] text-sm mt-1">{emailToReset}</p>
           </div>

           <form className="space-y-5" onSubmit={handleResetPassword}>
             <div>
               <label className="block text-sm font-medium text-[var(--text-main)] mb-1">รหัสผ่านใหม่</label>
               <input
                 type="password"
                 required
                 minLength={6}
                 value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 className="appearance-none block w-full px-4 py-3 rounded-xl glass-input sm:text-sm"
                 placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium text-[var(--text-main)] mb-1">ยืนยันรหัสผ่านใหม่</label>
               <input
                 type="password"
                 required
                 minLength={6}
                 value={confirmPassword}
                 onChange={(e) => setConfirmPassword(e.target.value)}
                 className="appearance-none block w-full px-4 py-3 rounded-xl glass-input sm:text-sm"
                 placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
               />
             </div>

             <button
               type="submit"
               disabled={loading}
               className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-semibold glass-button disabled:opacity-50 mt-4"
             >
               {loading ? "กำลังดำเนินการ..." : "บันทึกรหัสผ่าน"}
             </button>
           </form>
        </div>
      )}
    </div>
  );
}

export default function ActionPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* วงกลมตกแต่ง */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-72 h-72 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center liquid-hover mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-xl border border-[var(--glass-border)] p-2 overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Yayee Dormitory Logo" className="w-full h-full object-contain" />
          </div>
        </div>
        
        <div className="glass-panel py-8 px-5 sm:rounded-3xl sm:px-10 shadow-lg">
           <Suspense fallback={<div className="text-center p-8 text-[var(--text-muted)] animate-pulse">กำลังโหลดผลลัพธ์...</div>}>
              <ActionContent />
           </Suspense>
        </div>
      </div>
    </div>
  );
}
