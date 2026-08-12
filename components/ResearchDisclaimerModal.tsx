"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, X, CheckCircle2, Info } from "lucide-react";

export default function ResearchDisclaimerModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAppMode, setIsAppMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // ตรวจสอบว่าใช้งานผ่านแอปพลิเคชัน (PWA Standalone Mode / Capacitor / Mobile App Wrapper) หรือไม่
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes("android-app://") ||
      typeof (window as any).Capacitor !== "undefined" ||
      navigator.userAgent.includes("Capacitor");

    setIsAppMode(standalone);

    // ตรวจสอบว่าเคยปิด popup ใน session นี้หรือยัง
    const dismissed = sessionStorage.getItem("cmru_research_notice_dismissed");
    if (!dismissed) {
      setIsOpen(true);
    } else if (standalone) {
      // หากเข้าผ่านแอปและเคยปิดประกาศแล้ว ให้เปลี่ยนหน้าไป login ทันที
      router.push("/auth/login");
    }
  }, [router]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    sessionStorage.setItem("cmru_research_notice_dismissed", "true");
    setIsOpen(false);

    // หากใช้งานผ่านแอป หลังกดรับทราบให้พาไปหน้าเข้าสู่ระบบ (/auth/login) ทันที
    if (isAppMode) {
      router.push("/auth/login");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop Background */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#F3E7DD] p-6 sm:p-8 z-10 overflow-hidden transform transition-all duration-300 scale-100">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#8B5E3C] via-[#C67C4E] to-[#8B5E3C]" />

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-[#3A2D23] hover:bg-[#F3E7DD]/50 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Tag */}
        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-16 h-16 rounded-2xl bg-[#F3E7DD] text-[#8B5E3C] flex items-center justify-center mb-4 shadow-sm">
            <GraduationCap className="w-9 h-9" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F3E7DD]/70 text-[#8B5E3C] text-xs font-bold tracking-wide mb-3">
            <Info className="w-3.5 h-3.5" />
            <span>ประกาศชี้แจง / Notice</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-[#3A2D23] mb-3 leading-snug">
            มหาวิทยาลัยราชภัฏเชียงใหม่
          </h2>
        </div>

        {/* Content Box */}
        <div className="my-4 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE1D5] text-[#3A2D23]">
          <p className="text-base sm:text-lg font-semibold leading-relaxed text-center text-[#665243]">
            เว็บไซต์นี้เป็นเว็บที่ใช้ข้อมูลหอพักในการทำวิจัยและโปรเจคของมหาวิทยาลัยราชภัฏเชียงใหม่เท่านั้น
          </p>
        </div>

        {/* Info detail */}
        <p className="text-xs text-[#887467] text-center mb-6 leading-relaxed">
          ข้อมูลและระบบทั้งหมดจัดทำขึ้นเพื่อการศึกษาและการวิจัยทางวิชาการเท่านั้น
        </p>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto min-w-[200px] bg-[#8B5E3C] hover:bg-[#734A2E] text-white px-8 py-3.5 rounded-full font-bold text-sm sm:text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>รับทราบ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
