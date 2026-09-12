"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import {
  Megaphone,
  PlusCircle,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  Calendar,
  Save,
  RotateCcw,
} from "lucide-react";

// =====================================================
// CKEditor Dynamic Import (SSR Safe)
// =====================================================
const EditorWrapper = dynamic(
  async () => {
    // นำเข้า CSS ของ CKEditor 5
    await import("ckeditor5/ckeditor5.css");

    const { CKEditor } = await import("@ckeditor/ckeditor5-react");
    const {
      ClassicEditor,
      Essentials,
      Paragraph,
      Bold,
      Italic,
      Underline,
      Link,
      List,
      Heading,
      BlockQuote,
    } = await import("ckeditor5");

    function EditorComponent({
      value,
      onChange,
      placeholder = "พิมพ์รายละเอียดเนื้อหาประกาศที่นี่...",
    }) {
      return (
        <div className="ck-content-custom">
          <CKEditor
            editor={ClassicEditor}
            data={value || ""}
            config={{
              licenseKey: "GPL",
              placeholder: placeholder,
              plugins: [
                Essentials,
                Paragraph,
                Bold,
                Italic,
                Underline,
                Link,
                List,
                Heading,
                BlockQuote,
              ],
              toolbar: [
                "undo",
                "redo",
                "|",
                "heading",
                "|",
                "bold",
                "italic",
                "underline",
                "|",
                "link",
                "blockQuote",
                "|",
                "bulletedList",
                "numberedList",
              ],
            }}
            onChange={(_, editor) => {
              const data = editor.getData();
              onChange(data);
            }}
          />
        </div>
      );
    }

    return EditorComponent;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-56 w-full animate-pulse items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-500" />
        กำลังโหลดเครื่องมือเขียนประกาศ...
      </div>
    ),
  }
);

// ฟังก์ชันแปลง Timestamp ของ Firestore เป็นภาษาไทย
function formatThaiDate(timestamp) {
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

// =====================================================
// Main Component
// =====================================================
export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editId, setEditId] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");

  // Feedback Notification
  const [notification, setNotification] = useState(null);

  // Delete Confirmation Modal State
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  // แสดงการแจ้งเตือนและปิดอัตโนมัติ
  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // =====================================================
  // ดึงข้อมูลประกาศ
  // =====================================================
  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsLoading(true);
      const announcementsRef = collection(db, "announcements");
      const q = query(announcementsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const list = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setAnnouncements(list);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      showToast("error", "ไม่สามารถดึงข้อมูลประกาศได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // กรองประกาศตามคำค้นหา
  const filteredAnnouncements = useMemo(() => {
    if (!searchTerm.trim()) return announcements;
    const term = searchTerm.toLowerCase();
    return announcements.filter(
      (item) =>
        item.title?.toLowerCase().includes(term) ||
        item.content?.toLowerCase().includes(term)
    );
  }, [announcements, searchTerm]);

  // =====================================================
  // เพิ่ม / บันทึกการแก้ไข
  // =====================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("error", "กรุณากรอกหัวข้อประกาศ");
      return;
    }
    if (!content.trim() || content === "<p></p>") {
      showToast("error", "กรุณากรอกเนื้อหาของประกาศ");
      return;
    }

    try {
      setIsSubmitting(true);

      if (editId) {
        // แก้ไขประกาศเดิม
        const docRef = doc(db, "announcements", editId);
        await updateDoc(docRef, {
          title: title.trim(),
          content: content,
          updatedAt: serverTimestamp(),
        });
        showToast("success", "บันทึกการแก้ไขประกาศสำเร็จแล้ว");
      } else {
        // เพิ่มประกาศใหม่
        await addDoc(collection(db, "announcements"), {
          title: title.trim(),
          content: content,
          createdAt: serverTimestamp(),
        });
        showToast("success", "เผยแพร่ประกาศใหม่สำเร็จแล้ว");
      }

      // Reset Form
      setTitle("");
      setContent("");
      setEditId(null);
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error saving announcement:", error);
      showToast("error", "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================================
  // ลบประกาศ
  // =====================================================
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    try {
      await deleteDoc(doc(db, "announcements", deleteTargetId));
      showToast("success", "ลบประกาศเรียบร้อยแล้ว");
      if (editId === deleteTargetId) {
        handleCancelEdit();
      }
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      showToast("error", "เกิดข้อผิดพลาด ไม่สามารถลบประกาศได้");
    } finally {
      setDeleteTargetId(null);
    }
  };

  // เข้าสู่โหมดแก้ไข
  const handleEdit = (item) => {
    setEditId(item.id);
    setTitle(item.title || "");
    setContent(item.content || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ยกเลิกการแก้ไข
  const handleCancelEdit = () => {
    setEditId(null);
    setTitle("");
    setContent("");
  };

  return (
    <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* =====================================================
            Page Header & Breadcrumb
        ====================================================== */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                <Megaphone className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                ระบบจัดการประกาศข่าวสาร
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              สร้าง เผยแพร่ และจัดการประกาศข่าวสารสำหรับผู้ใช้งานในระบบ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100">
              <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
              ประกาศทั้งหมด {announcements.length} รายการ
            </span>
          </div>
        </div>

        {/* =====================================================
            Notification Banner
        ====================================================== */}
        {notification && (
          <div
            className={`flex items-center justify-between rounded-xl p-4 transition-all duration-300 shadow-sm ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
              <span className="text-sm font-medium">
                {notification.message}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =====================================================
            Form Card (สร้าง / แก้ไข)
        ====================================================== */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm transition-all">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              {editId ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Pencil className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <PlusCircle className="h-4 w-4" />
                </span>
              )}
              <h2 className="text-lg font-semibold text-slate-800">
                {editId ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"}
              </h2>
            </div>

            {editId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                กำลังอยู่ในโหมดแก้ไข
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* หัวข้อ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                หัวข้อประกาศ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ระบุหัวข้อประกาศ เช่น แจ้งปิดปรับปรุงระบบชั่วคราว..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>

            {/* เครื่องมือเขียนข้อความ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                เนื้อหาประกาศ <span className="text-rose-500">*</span>
              </label>
              <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                <EditorWrapper value={content} onChange={setContent} />
              </div>
            </div>

            {/* ปุ่ม Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              {editId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  ยกเลิก
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : editId ? (
                  <>
                    <Save className="h-4 w-4" />
                    บันทึกการแก้ไข
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    เผยแพร่ประกาศ
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* =====================================================
            ประวัติและรายการประกาศทั้งหมด
        ====================================================== */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-slate-800">
              รายการประกาศทั้งหมด
            </h2>

            {/* ช่องค้นหา */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาหัวข้อหรือเนื้อหา..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* สภาพการโหลด */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm text-slate-500">กำลังโหลดรายการประกาศ...</p>
            </div>
          ) : filteredAnnouncements.length > 0 ? (
            <div className="grid gap-4">
              {filteredAnnouncements.map((item) => (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                    editId === item.id
                      ? "border-amber-300 ring-2 ring-amber-100"
                      : "border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                          {item.title}
                        </h3>
                        {editId === item.id && (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            กำลังแก้ไข
                          </span>
                        )}
                      </div>

                      {/* วันที่และเวลา */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          เผยแพร่เมื่อ: {formatThaiDate(item.createdAt)}
                        </span>
                        {item.updatedAt && (
                          <span className="text-slate-400">
                            (แก้ไขล่าสุด: {formatThaiDate(item.updatedAt)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ปุ่ม Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไข
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบ
                      </button>
                    </div>
                  </div>

                  {/* แสดงเนื้อหาประกาศพร้อมคลาสจัดแต่ง Rich Text */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div
                      className="announcement-html-content text-sm text-slate-600 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: item.content || "",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* กรณีไม่มีประกาศ หรือค้นหาไม่พบ */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <Megaphone className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-base font-medium text-slate-700">
                {searchTerm ? "ไม่พบประกาศที่ตรงกับคำค้นหา" : "ยังไม่มีประกาศในระบบ"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {searchTerm
                  ? "ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง"
                  : "เริ่มต้นโดยการกรอกแบบฟอร์มด้านบนเพื่อเผยแพร่ประกาศแรกของคุณ"}
              </p>
            </div>
          )}
        </div>

        {/* =====================================================
            Delete Confirmation Dialog
        ====================================================== */}
        {deleteTargetId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-rose-600">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  ยืนยันการลบประกาศ
                </h3>
              </div>
              <p className="text-sm text-slate-500">
                คุณแน่ใจหรือไม่ว่าต้องการลบประกาศนี้? การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200"
                >
                  ลบประกาศ
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* =====================================================
          CSS จัดการความสูง CKEditor & สไตล์ Rich Text
      ====================================================== */}
      <style jsx global>{`
        /* กำหนดความสูงและขอบมนของ CKEditor */
        .ck-editor__editable_inline {
          min-height: 220px !important;
          border-bottom-left-radius: 0.75rem !important;
          border-bottom-right-radius: 0.75rem !important;
          padding: 1rem 1.25rem !important;
        }
        .ck-toolbar {
          border-top-left-radius: 0.75rem !important;
          border-top-right-radius: 0.75rem !important;
          background-color: #f8fafc !important;
          border-color: #e2e8f0 !important;
        }

        /* คืนค่าสไตล์หัวข้อและลิสต์สำหรับ HTML ที่เรนเดอร์จาก CKEditor */
        .announcement-html-content h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #0f172a;
        }
        .announcement-html-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #1e293b;
        }
        .announcement-html-content h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
          color: #334155;
        }
        .announcement-html-content p {
          margin-bottom: 0.75rem;
        }
        .announcement-html-content ul {
          list-style-type: disc !important;
          margin-left: 1.5rem !important;
          margin-bottom: 0.75rem !important;
        }
        .announcement-html-content ol {
          list-style-type: decimal !important;
          margin-left: 1.5rem !important;
          margin-bottom: 0.75rem !important;
        }
        .announcement-html-content li {
          margin-bottom: 0.25rem;
        }
        .announcement-html-content a {
          color: #4f46e5;
          text-decoration: underline;
        }
        .announcement-html-content blockquote {
          border-left: 4px solid #cbd5e1;
          padding-left: 1rem;
          font-style: italic;
          color: #64748b;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}