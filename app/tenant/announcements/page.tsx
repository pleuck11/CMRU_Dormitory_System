"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import {
  Megaphone,
  Search,
  Calendar,
  ArrowLeft,
  Loader2,
  X,
  BellRing,
  Eye,
  Image as ImageIcon,
  Users,
  Globe,
} from "lucide-react";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  target?: string;
  imageUrl?: string | null;
  createdAt?: any;
  updatedAt?: any;
}

function formatThaiDate(timestamp: any): string {
  if (!timestamp) return "เมื่อสักครู่";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
}

export default function TenantAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterTarget, setFilterTarget] = useState<"all" | "public" | "tenant">("all");
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (viewingImage) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      const mainEl = document.querySelector("main");
      if (mainEl) {
        mainEl.style.overflow = "hidden";
      }

      const preventScroll = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      };

      window.addEventListener("wheel", preventScroll, { passive: false });
      window.addEventListener("touchmove", preventScroll, { passive: false });
      if (mainEl) {
        mainEl.addEventListener("wheel", preventScroll, { passive: false });
        mainEl.addEventListener("touchmove", preventScroll, { passive: false });
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setViewingImage(null);
      };
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
        if (mainEl) {
          mainEl.style.overflow = "";
          mainEl.removeEventListener("wheel", preventScroll);
          mainEl.removeEventListener("touchmove", preventScroll);
        }
        window.removeEventListener("wheel", preventScroll);
        window.removeEventListener("touchmove", preventScroll);
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.style.overflow = "";
    }
  }, [viewingImage]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true);
      const q = query(
        collection(db, "announcements"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: AnnouncementItem[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AnnouncementItem, "id">),
      }));
      setAnnouncements(list);
    } catch (err) {
      console.error("Error fetching announcements for tenant:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const filteredAnnouncements = useMemo(() => {
    let list = announcements;
    if (filterTarget === "public") {
      list = list.filter((item) => item.target !== "tenant");
    } else if (filterTarget === "tenant") {
      list = list.filter((item) => item.target === "tenant");
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (item) =>
        item.title?.toLowerCase().includes(term) ||
        item.content?.toLowerCase().includes(term)
    );
  }, [announcements, searchTerm, filterTarget]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header & Back Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/tenant/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent-brown)] hover:text-[var(--accent-dark)] transition-colors mb-1"
          >
            <ArrowLeft className="h-4 w-4" />
            กลับไปหน้าแดชบอร์ด
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5E3C] to-[#734A2E] text-white shadow-md shadow-[#8B5E3C]/20">
              <Megaphone className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] tracking-tight">
                ประกาศและข่าวสารหอพัก
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                ติดตามข่าวสาร การแจ้งเตือน และข้อมูลสำคัญจากผู้ดูแลหอพักหยาหยี๋
              </p>
            </div>
          </div>
        </div>

        {/* Badge จำนวนประกาศ */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3E7DD]/90 border border-[#E8D7CA] px-3.5 py-1.5 text-xs font-semibold text-[#8B5E3C] shadow-sm">
            <BellRing className="h-3.5 w-3.5 text-[#8B5E3C] animate-bounce" />
            ประกาศทั้งหมด {announcements.length} รายการ
          </span>
        </div>
      </div>

      {/* แถบตัวกรองและช่องค้นหา */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* กลุ่มปุ่มตัวกรองเป้าหมาย */}
        <div className="flex rounded-2xl bg-white/80 p-1 border border-[var(--glass-border)] text-xs font-medium shadow-xs">
          <button
            type="button"
            onClick={() => setFilterTarget("all")}
            className={`px-3.5 py-2 rounded-xl transition-all ${
              filterTarget === "all"
                ? "bg-[#8B5E3C] text-white shadow-sm font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => setFilterTarget("public")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              filterTarget === "public"
                ? "bg-emerald-600 text-white shadow-sm font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            ประกาศทั่วไป
          </button>
          <button
            type="button"
            onClick={() => setFilterTarget("tenant")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
              filterTarget === "tenant"
                ? "bg-[#8B5E3C] text-white shadow-sm font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            เฉพาะผู้เช่า
          </button>
        </div>

        {/* ช่องค้นหา */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาประกาศ..."
            className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/80 py-2 pl-10 pr-10 text-sm text-[var(--text-main)] placeholder:text-gray-400 focus:border-[#8B5E3C] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#8B5E3C]/10 transition-all shadow-xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* รายการประกาศ */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl glass-panel p-16 text-center shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B5E3C] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">กำลังโหลดประกาศข่าวสาร...</p>
        </div>
      ) : filteredAnnouncements.length > 0 ? (
        <div className="space-y-5">
          {filteredAnnouncements.map((item, index) => (
            <article
              key={item.id}
              className={`glass-panel rounded-3xl p-6 md:p-7 shadow-sm border transition-all hover:shadow-md ${
                index === 0 && !searchTerm && filterTarget === "all"
                  ? "border-2 border-[#8B5E3C]/30 bg-gradient-to-br from-white/95 via-[#FAF6F2] to-[#F5EEE6]"
                  : "border-[var(--glass-border)] bg-white/80 hover:bg-white"
              }`}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between border-b border-gray-100 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg md:text-xl font-bold text-[var(--text-main)]">
                      {item.title}
                    </h2>
                    {index === 0 && !searchTerm && filterTarget === "all" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E7DD] px-2.5 py-0.5 text-xs font-semibold text-[#8B5E3C] border border-[#E8D7CA]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8B5E3C] animate-pulse" />
                        ล่าสุด
                      </span>
                    )}
                    {item.target === "tenant" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F5EBE1] px-2.5 py-0.5 text-xs font-semibold text-[#734A2E] border border-[#E5D5C5]">
                        <Users className="h-3 w-3" />
                        เฉพาะผู้เช่า
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <Globe className="h-3 w-3" />
                        ประกาศทั่วไป
                      </span>
                    )}
                    {item.imageUrl && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E7DD]/70 px-2.5 py-0.5 text-xs font-medium text-[#8B5E3C] border border-[#E8D7CA]">
                        <ImageIcon className="h-3 w-3" />
                        มีรูปภาพแนบ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Calendar className="h-3.5 w-3.5 text-[#8B5E3C]" />
                    <span>เผยแพร่เมื่อ: {formatThaiDate(item.createdAt)}</span>
                    {item.updatedAt && (
                      <span>(แก้ไขเมื่อ: {formatThaiDate(item.updatedAt)})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* รูปภาพประกอบประกาศ (ถ้ามี) */}
              {item.imageUrl && (
                <div className="mt-4">
                  <div
                    onClick={() => setViewingImage(item.imageUrl || null)}
                    className="relative group/img max-w-xl cursor-pointer overflow-hidden rounded-2xl border border-[#EAE1D5] bg-[#FAF7F2] shadow-xs"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full max-h-96 object-cover group-hover/img:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-[2px]">
                      <Eye className="h-4 w-4" />
                      คลิกเพื่อดูรูปภาพขนาดเต็ม
                    </div>
                  </div>
                </div>
              )}

              {/* Rich Text เนื้อหาประกาศ */}
              <div className="mt-4">
                <div
                  className="tenant-announcement-content text-sm text-[var(--text-main)]/90 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: item.content || "",
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* เมื่อไม่พบประกาศ */
        <div className="flex flex-col items-center justify-center rounded-3xl glass-panel p-16 text-center border-dashed border-2 border-amber-200/60 bg-amber-50/20">
          <Megaphone className="h-12 w-12 text-amber-300 mb-3" />
          <h3 className="text-base font-bold text-[var(--text-main)]">
            {searchTerm ? "ไม่พบประกาศที่ตรงกับคำค้นหา" : "ยังไม่มีประกาศในระบบ"}
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {searchTerm
              ? "ลองค้นหาด้วยคำหรือคีย์เวิร์ดอื่น"
              : "เมื่อผู้ดูแลหอพักลงประกาศ ข้อมูลจะปรากฏที่หน้านี้"}
          </p>
        </div>
      )}

      {/* =====================================================
          LightBox Preview Modal (รูปภาพขนาดเต็ม — ลอยอยู่ตรงกลางจอฝั่งขวาเสมอ ไม่เลื่อนตามการ Scroll)
      ====================================================== */}
      {mounted && viewingImage && createPortal(
        <div
          className="fixed top-0 bottom-0 right-0 left-0 md:left-64 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200 select-none overflow-hidden"
          onClick={() => setViewingImage(null)}
          onWheel={(e) => {
            e.stopPropagation();
          }}
          onTouchMove={(e) => {
            e.stopPropagation();
          }}
        >
          {/* ปุ่มปิดมุมขวาบนของพื้นที่จอฝั่งขวา */}
          <button
            type="button"
            onClick={() => setViewingImage(null)}
            className="absolute top-5 right-5 z-[100000] flex items-center justify-center w-11 h-11 rounded-full bg-white/20 hover:bg-white/35 text-white backdrop-blur-md transition-all cursor-pointer shadow-lg active:scale-95"
            title="ปิดรูปภาพ (ESC หรือคลิกพื้นที่ว่าง)"
          >
            <X className="h-6 w-6" />
          </button>

          {/* กรอบแสดงรูปภาพ จัดกลางจอฝั่งขวาพอดีเสมอ */}
          <div
            className="relative max-w-full max-h-[88vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={viewingImage}
              alt="รูปภาพขนาดเต็ม"
              className="max-h-[85vh] max-w-[calc(100vw-2rem)] md:max-w-[calc(100vw-18rem)] w-auto h-auto rounded-2xl object-contain shadow-2xl transition-transform"
            />
          </div>
        </div>,
        document.body
      )}

      {/* สไตล์ Rich Text สำหรับเนื้อหาประกาศ */}
      <style jsx global>{`
        .tenant-announcement-content h1 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #451a03;
          margin-bottom: 0.5rem;
        }
        .tenant-announcement-content h2 {
          font-size: 1.2rem;
          font-weight: 700;
          color: #78350f;
          margin-bottom: 0.5rem;
        }
        .tenant-announcement-content h3 {
          font-size: 1.05rem;
          font-weight: 600;
          color: #92400e;
          margin-bottom: 0.35rem;
        }
        .tenant-announcement-content p {
          margin-bottom: 0.65rem;
        }
        .tenant-announcement-content ul {
          list-style-type: disc !important;
          margin-left: 1.5rem !important;
          margin-bottom: 0.65rem !important;
        }
        .tenant-announcement-content ol {
          list-style-type: decimal !important;
          margin-left: 1.5rem !important;
          margin-bottom: 0.65rem !important;
        }
        .tenant-announcement-content li {
          margin-bottom: 0.25rem;
        }
        .tenant-announcement-content a {
          color: var(--accent-brown);
          text-decoration: underline;
        }
        .tenant-announcement-content blockquote {
          border-left: 4px solid #d97706;
          padding-left: 1rem;
          font-style: italic;
          color: #78350f;
          margin: 1rem 0;
        }
        .tenant-announcement-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </div>
  );
}