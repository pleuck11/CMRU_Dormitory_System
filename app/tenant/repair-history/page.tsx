"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface Repair {
  id: string;
  type: string;
  detail: string;
  status: string;
  time: string;
  imageUrl?: string;
  createdAt: { seconds: number };
}

// แปลง timestamp เป็นวันที่อ่านง่าย
function formatDate(seconds: number) {
  const date = new Date(seconds * 1000);
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// แปลงเวลานัด datetime-local เป็นภาษาไทย
function formatAppointment(iso: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// แสดง badge สถานะ
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    ใหม่: {
      label: "ใหม่",
      cls: "bg-blue-100 text-blue-700 border border-blue-200",
    },
    กำลังทำ: {
      label: "กำลังดำเนินการ",
      cls: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    },
    สำเร็จ: {
      label: "ซ่อมแล้ว",
      cls: "bg-green-100 text-green-700 border border-green-200",
    },
    ยกเลิก: {
      label: "ยกเลิก",
      cls: "bg-red-100 text-red-700 border border-red-200",
    },
  };
  const s = config[status] ?? {
    label: status,
    cls: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function RepairHistoryPage() {
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Repair | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    // รอให้ auth พร้อมก่อนดึงข้อมูล
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "repairs"),
          where("tenantId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Repair, "id">),
        }));
        setRepairs(data);
      } catch (error) {
        console.error("ดึงข้อมูลประวัติแจ้งซ่อมไม่สำเร็จ", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center mt-24 gap-4">
        <div className="w-10 h-10 border-4 border-[var(--accent-brown)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-muted)]">กำลังโหลดประวัติแจ้งซ่อม...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 md:p-8">
      {/* หัวข้อ */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">
          ประวัติแจ้งซ่อม
        </h1>
        <p className="text-[var(--text-muted)] mt-1">
          รายการคำขอซ่อมทั้งหมดของคุณ
        </p>
      </div>

      {/* ไม่มีข้อมูล */}
      {repairs.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--glass-border)] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <p className="text-[var(--text-muted)] font-medium">
            ยังไม่มีประวัติการแจ้งซ่อม
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {repairs.map((repair) => (
            <div
              key={repair.id}
              className="glass-panel rounded-2xl p-5 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => setSelected(repair)}
            >
              <div className="flex items-start justify-between gap-3">
                {/* ข้อมูลหลัก */}
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={repair.status} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {repair.createdAt
                        ? formatDate(repair.createdAt.seconds)
                        : ""}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[var(--text-main)] text-lg leading-snug">
                    {repair.type}
                  </h3>
                  <p className="text-[var(--text-muted)] text-sm line-clamp-2">
                    {repair.detail}
                  </p>
                </div>

                {/* รูปภาพ thumbnail */}
                {repair.imageUrl && (
                  <img
                    src={repair.imageUrl}
                    alt="รูปแจ้งซ่อม"
                    className="w-20 h-20 object-cover rounded-xl border flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightbox(repair.imageUrl!);
                    }}
                  />
                )}
              </div>

              {/* ปุ่มดูรายละเอียด */}
              <div className="mt-4 flex justify-end">
                <span className="text-sm text-[var(--accent-brown)] font-medium flex items-center gap-1">
                  ดูรายละเอียด
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* โมดอลรายละเอียด */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* รูปภาพ */}
            {selected.imageUrl && (
              <div
                className="relative cursor-zoom-in"
                onClick={() => setLightbox(selected.imageUrl!)}
              >
                <img
                  src={selected.imageUrl}
                  alt="รูปแจ้งซ่อม"
                  className="w-full h-56 object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                  คลิกเพื่อขยาย
                </div>
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* หัวข้อและสถานะ */}
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold text-gray-800 leading-snug">
                  {selected.type}
                </h2>
                <StatusBadge status={selected.status} />
              </div>

              {/* รายละเอียด */}
              <div className="space-y-3 text-sm">
                <div className="flex gap-3 items-start">
                  <span className="text-gray-400 w-24 shrink-0">รายละเอียด</span>
                  <p className="text-gray-700 leading-relaxed">{selected.detail}</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 w-24 shrink-0">นัดเวลา</span>
                  <p className="text-gray-700">{formatAppointment(selected.time)}</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-400 w-24 shrink-0">แจ้งซ่อมเมื่อ</span>
                  <p className="text-gray-700">
                    {selected.createdAt
                      ? formatDate(selected.createdAt.seconds)
                      : "-"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="w-full mt-2 py-3 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* กล่องไฟแสดงรูปเต็ม */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="รูปแจ้งซ่อมขนาดเต็ม"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center transition"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}