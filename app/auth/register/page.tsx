"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile, signOut, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function Register() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!loading && user && !verificationSent) {
      if (user.emailVerified) {
        router.push("/tenant/dashboard");
      }
    }
  }, [user, loading, router, verificationSent]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const onlyNums = value.replace(/[^0-9]/g, "");
      if (onlyNums.length <= 10) setFormData({ ...formData, [name]: onlyNums });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน");
      setIsRegistering(false);
      return;
    }

    if (formData.name.toLowerCase().includes("admin") || formData.email.toLowerCase().includes("admin")) {
      setError("ไม่อนุญาตให้ใช้คำว่า 'admin' ในชื่อหรืออีเมลเพื่อความปลอดภัย และโปรดใช้อีเมลจริง");
      setIsRegistering(false);
      return;
    }

    try {
      // 1. สร้างผู้ใช้ใน Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const newUser = userCredential.user;

      // 2. อัปเดตชื่อผู้ใช้
      await updateProfile(newUser, { displayName: formData.name });

      // 3. บันทึกข้อมูลลง Firestore
      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: "tenant",
        createdAt: new Date().toISOString()
      });

      // 4. ส่งอีเมลยืนยันตัวตนผ่านระบบพื้นฐานของ Firebase
      const actionCodeSettings = {
        url: window.location.origin + '/auth/login?verified=1',
        handleCodeInApp: false,
      };
      try {
        await sendEmailVerification(newUser, actionCodeSettings);
      } catch (emailErr) {
        console.error("Failed to send Firebase verification email:", emailErr);
        // ระบบสมัครสำเร็จแล้ว แต่แค่ส่งอีเมลไม่ผ่าน ไม่ควรให้หน้าพัง
      }

      await signOut(auth); // ออกจากระบบหลังสมัครเสร็จ
      setVerificationSent(true);
    } catch (err: any) {
      if (err.code !== "auth/email-already-in-use" && err.code !== "auth/weak-password" && err.code !== "permission-denied") {
        console.error("Registration Error:", err);
      }
      if (err.code === "auth/email-already-in-use") {
        setError("อีเมลนี้ถูกใช้งานแล้ว");
      } else if (err.code === "auth/weak-password") {
        setError("รหัสควรมีความยาวอย่างน้อย 6 ตัวอักษร");
      } else if (err.code === "permission-denied") {
        setError("ไม่มีสิทธิ์ในการสร้างข้อมูลผู้ใช้งาน");
      } else if (err.code === "auth/too-many-requests") {
        setError("คุณพยายามทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วค่อยลองใหม่อีกครั้ง");
      } else {
        setError(`เกิดข้อผิดพลาดในการสมัครสมาชิก: ${err.message || "กรุณาลองใหม่อีกครั้ง"}`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // หน้ายืนยันอีเมล
  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 font-sans relative overflow-hidden page-enter">
        <div className="absolute top-[-15%] right-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-60 pointer-events-none orb-float-1" />
        <div className="absolute bottom-[-15%] left-[25%] w-80 h-80 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none orb-float-2" />

        <div className="w-full max-w-md relative z-10">
          <div className="glass-panel rounded-3xl px-8 py-12 text-center shadow-xl">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-main)] mb-3">รอดำเนินการยืนยัน</h2>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-2">
              ระบบได้ส่งลิงก์ยืนยันตัวตนไปที่อีเมล
            </p>
            <p className="font-semibold text-[var(--text-main)] text-sm mb-4">{formData.email}</p>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-8">
              กรุณาตรวจสอบอีเมล (รวมถึงในกล่องจดหมายขยะ) และคลิกลิงก์ที่ได้รับเพื่อเข้าสู่ระบบ
            </p>
            <Link
              href="/auth/login"
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold glass-button"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const EyeIcon = ({ show }: { show: boolean }) => show ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 font-sans relative overflow-hidden page-enter">
      {/* วงกลมตกแต่งพื้นหลัง */}
      <div className="absolute top-[-15%] right-[-10%] w-96 h-96 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-60 pointer-events-none orb-float-1" />
      <div className="absolute top-[30%] left-[-10%] w-72 h-72 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none orb-float-2" />
      <div className="absolute bottom-[-15%] right-[25%] w-80 h-80 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none orb-float-3" />

      {/* ปุ่มกลับหน้าแรกแบบลอยตัว (Floating Back Button) */}
      <Link 
        href="/" 
        className="absolute left-6 md:left-8 z-50 flex items-center justify-center gap-2 px-3 py-3 md:px-4 md:py-2.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/50 text-[var(--text-main)] shadow-sm hover:bg-white/90 hover:shadow-md hover:scale-105 active:scale-95 transition-all group"
        style={{ top: 'max(env(safe-area-inset-top), 44px)' }}
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
            <Link href="/auth/login" className="flex-1 py-2.5 text-sm font-medium text-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors rounded-l-xl">
              เข้าสู่ระบบ
            </Link>
            <div className="flex-1 py-2.5 text-sm font-semibold text-center bg-gradient-to-r from-[var(--accent-brown)] to-[var(--accent-dark)] text-white rounded-r-xl">
              สมัครสมาชิก
            </div>
          </div>

          {/* ข้อผิดพลาด */}
          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          {/* ฟอร์ม */}
          <form onSubmit={handleRegister} className="space-y-4">

            {/* ชื่อ-นามสกุล */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">ชื่อ - นามสกุล</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  name="name" type="text" required
                  value={formData.name} onChange={handleChange}
                  placeholder="ชื่อผู้ใช้งาน"
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm"
                />
              </div>
            </div>

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
                  name="email" type="email" autoComplete="email" required
                  value={formData.email} onChange={handleChange}
                  placeholder="example@domain.com"
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm"
                />
              </div>
            </div>

            {/* เบอร์โทร */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">เบอร์โทรศัพท์</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 5.55 5.55l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </span>
                <input
                  name="phone" type="tel" maxLength={10} required
                  value={formData.phone} onChange={handleChange}
                  placeholder="0xxxxxxxxx"
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm"
                />
              </div>
            </div>

            {/* รหัสผ่าน */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                  value={formData.password} onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 glass-input rounded-xl text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent-brown)] transition-colors">
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </div>

            {/* ยืนยันรหัสผ่าน */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-main)] mb-1.5">ยืนยันรหัสผ่าน</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password" required
                  value={formData.confirmPassword} onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-10 py-2.5 glass-input rounded-xl text-sm ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? "border-red-400"
                      : formData.confirmPassword && formData.password === formData.confirmPassword
                      ? "border-green-400"
                      : ""
                  }`}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent-brown)] transition-colors">
                  <EyeIcon show={showConfirmPassword} />
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>
              )}
              {formData.confirmPassword && formData.password === formData.confirmPassword && (
                <p className="mt-1 text-xs text-green-600">รหัสผ่านตรงกัน</p>
              )}
            </div>

            {/* ยืนยันข้อมูล */}
            <button
              type="submit"
              disabled={isRegistering}
              className="w-full py-3 rounded-xl font-semibold text-sm glass-button disabled:opacity-60 disabled:cursor-not-allowed mt-2 transition-all"
            >
              {isRegistering ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังประมวลผล...
                </span>
              ) : "สมัครสมาชิก"}
            </button>
          </form>

          {/* ส่วนท้าย */}
          <p className="text-center text-sm text-[var(--text-muted)] mt-6">
            มีบัญชีอยู่แล้ว?{" "}
            <Link href="/auth/login" className="font-semibold text-[var(--accent-brown)] hover:text-[var(--accent-dark)] transition-colors">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
