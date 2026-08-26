"use client";

import { useEffect, useState } from "react";
import { Megaphone, X, CheckCircle2, Sparkles, BellRing } from "lucide-react";

interface AnnouncementModalProps {
  enabled?: boolean;
  title?: string;
  body?: string;
}

export default function AnnouncementModal({
  enabled = true,
  title,
  body,
}: AnnouncementModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkAndShow = () => {
      // หากปิดการใช้งานไว้ ไม่ต้องแสดง
      if (enabled === false) return;

      // ตรวจสอบว่าเคยปิดประกาศเว็บใน session นี้หรือยัง
      const announcementDismissed = sessionStorage.getItem("cmru_announcement_dismissed");
      if (announcementDismissed) return;

      // ตรวจสอบว่าประกาศชี้แจงงานวิจัยถูกปิดหรือยัง (ลำดับคือ: ชี้แจง -> ประกาศเว็บ)
      const researchDismissed = sessionStorage.getItem("cmru_research_notice_dismissed");
      if (researchDismissed) {
        // ให้หน่วงเวลาเล็กน้อยเพื่อความนุ่มนวลในการสลับ modal
        setTimeout(() => {
          setIsOpen(true);
        }, 150);
      }
    };

    checkAndShow();

    const handleResearchNoticeDismissed = () => {
      checkAndShow();
    };

    window.addEventListener("cmru_research_notice_dismissed", handleResearchNoticeDismissed);
    return () => {
      window.removeEventListener("cmru_research_notice_dismissed", handleResearchNoticeDismissed);
    };
  }, [enabled]);

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
    sessionStorage.setItem("cmru_announcement_dismissed", "true");
    setIsOpen(false);
  };

  const displayTitle = title?.trim() || "";
  const displayBody = body?.trim() || "";

  // หากไม่มีการระบุข้อความประกาศไว้เลย หรือปิดใช้งานอยู่ ไม่ต้องแสดง Popup
  if (!isOpen || enabled === false || (!displayTitle && !displayBody)) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop Background */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#F3E7DD] p-6 sm:p-8 z-10 overflow-hidden transform transition-all duration-300 scale-100 animate-in zoom-in-95">
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#C67C4E] via-[#8B5E3C] to-[#C67C4E]" />

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
          <div className="w-16 h-16 rounded-2xl bg-amber-100/70 text-[#8B5E3C] flex items-center justify-center mb-4 shadow-sm relative">
            <Megaphone className="w-8 h-8 text-[#8B5E3C]" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#F3E7DD]/80 text-[#8B5E3C] text-xs font-bold tracking-wide mb-3">
            <BellRing className="w-3.5 h-3.5" />
            <span>ข่าวสารและประกาศ / Announcement</span>
          </div>

          {displayTitle && (
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#3A2D23] mb-2 leading-snug">
              {displayTitle}
            </h2>
          )}
        </div>

        {/* Content Box */}
        {displayBody && (
          <div className="my-4 p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE1D5] text-[#3A2D23]">
            <p className="text-sm sm:text-base leading-relaxed text-[#5C4738] whitespace-pre-line text-center">
              {displayBody}
            </p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center mt-6">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto min-w-[200px] bg-[#8B5E3C] hover:bg-[#734A2E] active:scale-[0.99] text-white px-8 py-3.5 rounded-full font-bold text-sm sm:text-base transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>รับทราบ</span>
          </button>
        </div>
      </div>
    </div>
  );
}
