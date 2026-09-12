"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
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
    if (!searchTerm.trim()) return announcements;
    const term = searchTerm.toLowerCase();
    return announcements.filter(
      (item) =>
        item.title?.toLowerCase().includes(term) ||
        item.content?.toLowerCase().includes(term)
    );
  }, [announcements, searchTerm]);

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
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white shadow-md shadow-amber-900/15">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-3.5 py-1.5 text-xs font-semibold text-amber-800 shadow-sm">
            <BellRing className="h-3.5 w-3.5 text-amber-600 animate-bounce" />
            ประกาศทั้งหมด {announcements.length} รายการ
          </span>
        </div>
      </div>

      {/* ช่องค้นหา */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหาตามหัวข้อหรือเนื้อหาประกาศ..."
          className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/80 py-2.5 pl-10 pr-10 text-sm text-[var(--text-main)] placeholder:text-gray-400 focus:border-[var(--accent-brown)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
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

      {/* รายการประกาศ */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl glass-panel p-16 text-center shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-brown)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">กำลังโหลดประกาศข่าวสาร...</p>
        </div>
      ) : filteredAnnouncements.length > 0 ? (
        <div className="space-y-5">
          {filteredAnnouncements.map((item, index) => (
            <article
              key={item.id}
              className={`glass-panel rounded-3xl p-6 md:p-7 shadow-sm border transition-all hover:shadow-md ${
                index === 0 && !searchTerm
                  ? "border-2 border-amber-300/80 bg-gradient-to-br from-white/95 via-amber-50/40 to-orange-50/20"
                  : "border-[var(--glass-border)] bg-white/80 hover:bg-white"
              }`}
            >
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between border-b border-gray-100 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg md:text-xl font-bold text-[var(--text-main)]">
                      {item.title}
                    </h2>
                    {index === 0 && !searchTerm && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
                        ล่าสุด
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Calendar className="h-3.5 w-3.5 text-amber-600" />
                    <span>เผยแพร่เมื่อ: {formatThaiDate(item.createdAt)}</span>
                    {item.updatedAt && (
                      <span>(แก้ไขเมื่อ: {formatThaiDate(item.updatedAt)})</span>
                    )}
                  </div>
                </div>
              </div>

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
      `}</style>
    </div>
  );
}
