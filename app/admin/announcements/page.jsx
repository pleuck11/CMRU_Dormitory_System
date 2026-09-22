"use client";

import "ckeditor5/ckeditor5.css";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
  Image as ImageIcon,
  Upload,
  Eye,
  Globe,
  Users,
} from "lucide-react";

// =====================================================
// CKEditor Dynamic Import (SSR Safe & รองรับภาษาไทย)
// =====================================================
const EditorWrapper = dynamic(
  async () => {
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

    // ดึงไฟล์ภาษาไทยของ CKEditor 5
    let translations;
    try {
      translations = (await import("ckeditor5/translations/th.js")).default;
    } catch (err) {
      console.warn("Could not load Thai translations for CKEditor", err);
    }

    function EditorComponent({
      value,
      onChange,
      placeholder = "เขียนรายละเอียดเนื้อหาประกาศที่นี่...",
    }) {
      return (
        <div className="ck-content-custom">
          <CKEditor
            editor={ClassicEditor}
            data={value || ""}
            config={{
              licenseKey: "GPL",
              language: "th",
              translations: translations ? [translations] : undefined,
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
              heading: {
                options: [
                  {
                    model: "paragraph",
                    title: "ข้อความปกติ",
                    class: "ck-heading_paragraph",
                  },
                  {
                    model: "heading1",
                    view: "h1",
                    title: "หัวข้อหลัก (H1)",
                    class: "ck-heading_heading1",
                  },
                  {
                    model: "heading2",
                    view: "h2",
                    title: "หัวข้อย่อย (H2)",
                    class: "ck-heading_heading2",
                  },
                  {
                    model: "heading3",
                    view: "h3",
                    title: "หัวข้อย่อย (H3)",
                    class: "ck-heading_heading3",
                  },
                ],
              },
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
  const [target, setTarget] = useState("public"); // "public" (คนทั่วไป) | "tenant" (ผู้เช่าเท่านั้น)
  const [editId, setEditId] = useState(null);

  // Image Upload States
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Modal Image Preview (LightBox)
  const [viewingImage, setViewingImage] = useState(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTarget, setFilterTarget] = useState("all"); // "all" | "public" | "tenant"

  // Feedback Notification
  const [notification, setNotification] = useState(null);

  // Delete Confirmation Modal State
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleteTargetImageUrl, setDeleteTargetImageUrl] = useState(null);
  const [mounted, setMounted] = useState(false);

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

      const preventScroll = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };

      window.addEventListener("wheel", preventScroll, { passive: false });
      window.addEventListener("touchmove", preventScroll, { passive: false });
      if (mainEl) {
        mainEl.addEventListener("wheel", preventScroll, { passive: false });
        mainEl.addEventListener("touchmove", preventScroll, { passive: false });
      }

      const handleKeyDown = (e) => {
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

  // แสดงการแจ้งเตือนและปิดอัตโนมัติ
  const showToast = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // จัดการการเลือกรูปภาพ
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("error", "กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WEBP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("error", "ขนาดไฟล์รูปภาพต้องไม่เกิน 10MB");
      return;
    }

    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  // ลบรูปภาพที่เลือก
  const handleRemoveImage = () => {
    setImageFile(null);
    setImageUrl("");
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      if (error?.code === "permission-denied") {
        console.warn("Firestore permission-denied: ยังไม่ได้ตั้งค่าสิทธิ์ announcements ใน Firestore Rules", error);
        showToast("error", "ยังไม่ได้ตั้งค่าสิทธิ์ (Security Rules) สำหรับ announcements ใน Firebase Console");
      } else {
        console.error("Error fetching announcements:", error);
        showToast("error", "ไม่สามารถดึงข้อมูลประกาศได้ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // กรองประกาศตามคำค้นหาและกลุ่มเป้าหมาย
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

      // จัดการอัปโหลดรูปภาพ (ถ้ามีไฟล์ใหม่เลือกไว้)
      let finalImageUrl = imageUrl;
      if (imageFile) {
        setIsUploadingImage(true);
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload-announcement-image", {
          method: "POST",
          body: uploadData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || "อัปโหลดรูปภาพไม่สำเร็จ");
        }

        const data = await uploadRes.json();
        finalImageUrl = data.url;
        setIsUploadingImage(false);
      }

      if (editId) {
        // แก้ไขประกาศเดิม
        const docRef = doc(db, "announcements", editId);
        await updateDoc(docRef, {
          title: title.trim(),
          content: content,
          target: target || "public",
          imageUrl: finalImageUrl || null,
          updatedAt: serverTimestamp(),
        });
        showToast("success", "บันทึกการแก้ไขประกาศสำเร็จแล้ว");
      } else {
        // เพิ่มประกาศใหม่
        await addDoc(collection(db, "announcements"), {
          title: title.trim(),
          content: content,
          target: target || "public",
          imageUrl: finalImageUrl || null,
          createdAt: serverTimestamp(),
        });
        showToast("success", "เผยแพร่ประกาศใหม่สำเร็จแล้ว");
      }

      // Reset Form
      handleCancelEdit();
      await fetchAnnouncements();
    } catch (error) {
      if (error?.code === "permission-denied") {
        console.warn("Firestore permission-denied:", error);
        showToast("error", "ไม่มีสิทธิ์บันทึกข้อมูล (Permission Denied) กรุณาตรวจสอบสิทธิ์ Admin ใน Firestore Rules");
      } else {
        console.error("Error saving announcement:", error);
        showToast("error", error?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  // =====================================================
  // ลบประกาศ
  // =====================================================
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;

    try {
      // พยายามลบรูปจาก Vercel Blob ถ้ามีรูปภาพ
      if (deleteTargetImageUrl && deleteTargetImageUrl.includes("public.blob.vercel-storage.com")) {
        try {
          await fetch("/api/delete-blob-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: deleteTargetImageUrl }),
          });
        } catch (delErr) {
          console.warn("Could not delete announcement image blob:", delErr);
        }
      }

      await deleteDoc(doc(db, "announcements", deleteTargetId));
      showToast("success", "ลบประกาศเรียบร้อยแล้ว");
      if (editId === deleteTargetId) {
        handleCancelEdit();
      }
      await fetchAnnouncements();
    } catch (error) {
      if (error?.code === "permission-denied") {
        console.warn("Firestore permission-denied:", error);
        showToast("error", "ไม่มีสิทธิ์ลบข้อมูล (Permission Denied) กรุณาตรวจสอบสิทธิ์ Admin ใน Firestore Rules");
      } else {
        console.error("Error deleting announcement:", error);
        showToast("error", "เกิดข้อผิดพลาด ไม่สามารถลบประกาศได้");
      }
    } finally {
      setDeleteTargetId(null);
      setDeleteTargetImageUrl(null);
    }
  };

  // เข้าสู่โหมดแก้ไข
  const handleEdit = (item) => {
    setEditId(item.id);
    setTitle(item.title || "");
    setContent(item.content || "");
    setTarget(item.target || "public");
    setImageFile(null);
    setImageUrl(item.imageUrl || "");
    setImagePreview(item.imageUrl || "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ยกเลิกการแก้ไข
  const handleCancelEdit = () => {
    setEditId(null);
    setTitle("");
    setContent("");
    setTarget("public");
    setImageFile(null);
    setImageUrl("");
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-brown)] to-[var(--accent-dark)] text-white shadow-md shadow-amber-900/20">
                <Megaphone className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
                ระบบจัดการประกาศข่าวสาร
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              สร้าง เผยแพร่ และจัดการประกาศข่าวสารสำหรับคนทั่วไปหรือเฉพาะผู้เช่า พร้อมรูปภาพประกอบ
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1 text-xs font-semibold text-[var(--accent-dark)] border border-amber-200/70 shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[var(--accent-brown)] animate-pulse" />
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
        <div className="rounded-3xl border border-[var(--glass-border)] bg-white p-6 sm:p-8 shadow-sm transition-all">
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              {editId ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-[var(--accent-dark)]">
                  <Pencil className="h-4 w-4" />
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-[var(--accent-dark)]">
                  <PlusCircle className="h-4 w-4" />
                </span>
              )}
              <h2 className="text-lg font-semibold text-slate-800">
                {editId ? "แก้ไขประกาศ" : "สร้างประกาศใหม่"}
              </h2>
            </div>

            {editId && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-[var(--accent-dark)] border border-amber-200">
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-[var(--accent-brown)] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--accent-brown)]/10"
              />
            </div>

            {/* กลุ่มเป้าหมายผู้รับประกาศ (คนทั่วไป vs ผู้เช่าเท่านั้น) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                กลุ่มเป้าหมายผู้รับประกาศ <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTarget("public")}
                  className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    target === "public"
                      ? "border-[var(--accent-brown)] bg-amber-50/50 ring-2 ring-[var(--accent-brown)]/20 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${target === "public" ? "bg-[var(--accent-brown)] text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Globe className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${target === "public" ? "text-[var(--accent-dark)]" : "text-slate-800"}`}>
                        คนทั่วไป (สาธารณะ)
                      </span>
                      {target === "public" && (
                        <span className="h-2 w-2 rounded-full bg-[var(--accent-brown)]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      ทุกคนสามารถเห็นประกาศนี้ได้ ทั้งผู้เข้าชมเว็บไซต์และผู้เช่า
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTarget("tenant")}
                  className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    target === "tenant"
                      ? "border-[var(--accent-brown)] bg-amber-50/50 ring-2 ring-[var(--accent-brown)]/20 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${target === "tenant" ? "bg-[var(--accent-brown)] text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${target === "tenant" ? "text-[var(--accent-dark)]" : "text-slate-800"}`}>
                        ผู้ที่เช่าอยู่เท่านั้น
                      </span>
                      {target === "tenant" && (
                        <span className="h-2 w-2 rounded-full bg-[var(--accent-brown)]" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      แสดงเฉพาะผู้เช่าปัจจุบันที่เข้าสู่ระบบแล้วเท่านั้น (คนทั่วไปจะไม่เห็น)
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* ส่วนอัปโหลดรูปภาพประกาศ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  รูปภาพประกอบประกาศ <span className="text-xs text-slate-400 font-normal">(ถ้ามี)</span>
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-xs font-medium text-rose-500 hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    ลบรูปภาพ
                  </button>
                )}
              </div>

              {imagePreview ? (
                <div className="relative group rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-72 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="ตัวอย่างรูปภาพประกาศ"
                    className="w-full h-auto max-h-72 object-contain rounded-2xl"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setViewingImage(imagePreview)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/90 hover:bg-white text-xs font-medium text-slate-700 shadow-md backdrop-blur-sm transition-all cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      ดูรูปขนาดเต็ม
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--accent-brown)] hover:bg-[var(--accent-dark)] text-xs font-medium text-white shadow-md transition-all cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      เปลี่ยนรูปภาพ
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 hover:bg-amber-50/20 hover:border-[var(--accent-brown)]/40 transition-all cursor-pointer group"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-[var(--accent-brown)] mb-2 group-hover:scale-110 transition-transform">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">
                    คลิกเพื่ออัปโหลดรูปภาพประกาศ
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    รองรับไฟล์ JPG, PNG, WEBP (ขนาดไม่เกิน 10MB)
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* เครื่องมือเขียนข้อความ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                เนื้อหาประกาศ <span className="text-rose-500">*</span>
              </label>
              <div className="overflow-hidden rounded-xl border border-slate-200 focus-within:border-[var(--accent-brown)] focus-within:ring-4 focus-within:ring-[var(--accent-brown)]/10">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  ยกเลิก
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-brown)] to-[var(--accent-dark)] hover:from-[var(--accent-dark)] hover:to-[#8a4e28] px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-amber-900/15 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isUploadingImage ? "กำลังอัปโหลดรูปภาพ..." : "กำลังบันทึก..."}
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
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">
                รายการประกาศทั้งหมด
              </h2>
              <span className="rounded-full bg-[#F3E7DD] text-[#8B5E3C] border border-[#E8D7CA] px-2.5 py-0.5 text-xs font-semibold">
                {filteredAnnouncements.length} รายการ
              </span>
            </div>

            {/* กลุ่มปุ่มตัวกรองเป้าหมาย และ ช่องค้นหา */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterTarget("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterTarget === "all"
                      ? "bg-white text-slate-900 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTarget("public")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                    filterTarget === "public"
                      ? "bg-white text-emerald-700 shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  คนทั่วไป
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTarget("tenant")}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                    filterTarget === "tenant"
                      ? "bg-white text-[#8B5E3C] shadow-sm font-semibold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  เฉพาะผู้เช่า
                </button>
              </div>

              {/* ช่องค้นหา */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหาหัวข้อหรือเนื้อหา..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-[#8B5E3C] focus:outline-none focus:ring-4 focus:ring-[#8B5E3C]/10"
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
          </div>

          {/* สภาพการโหลด */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <Loader2 className="h-8 w-8 animate-spin text-[#8B5E3C] mb-3" />
              <p className="text-sm text-slate-500">กำลังโหลดรายการประกาศ...</p>
            </div>
          ) : filteredAnnouncements.length > 0 ? (
            <div className="grid gap-4">
              {filteredAnnouncements.map((item) => (
                <div
                  key={item.id}
                  className={`group relative rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${
                    editId === item.id
                      ? "border-[#8B5E3C] ring-2 ring-[#8B5E3C]/15"
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
                          <span className="rounded-md bg-[#F3E7DD] px-2 py-0.5 text-xs font-semibold text-[#8B5E3C]">
                            กำลังแก้ไข
                          </span>
                        )}
                        {item.target === "tenant" ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#F5EBE1] px-2 py-0.5 text-xs font-semibold text-[#734A2E] border border-[#E5D5C5]">
                            <Users className="h-3 w-3" />
                            เฉพาะผู้เช่า
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                            <Globe className="h-3 w-3" />
                            คนทั่วไป
                          </span>
                        )}
                        {item.imageUrl && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#F3E7DD]/70 px-2 py-0.5 text-xs font-medium text-[#8B5E3C] border border-[#E8D7CA]">
                            <ImageIcon className="h-3 w-3" />
                            มีรูปภาพ
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-[#F3E7DD]/50 hover:text-[#8B5E3C] hover:border-[#E8D7CA] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไข
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTargetId(item.id);
                          setDeleteTargetImageUrl(item.imageUrl || null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        ลบ
                      </button>
                    </div>
                  </div>

                  {/* แสดงรูปภาพประกาศ (ถ้ามี) */}
                  {item.imageUrl && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div
                        onClick={() => setViewingImage(item.imageUrl)}
                        className="relative group/img max-w-lg cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full max-h-80 object-cover group-hover/img:scale-102 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                          <Eye className="h-4 w-4" />
                          คลิกเพื่อดูรูปขนาดเต็ม
                        </div>
                      </div>
                    </div>
                  )}

                  {/* แสดงเนื้อหาประกาศพร้อมคลาสจัดแต่ง Rich Text */}
                  <div className={`mt-4 ${!item.imageUrl ? "pt-4 border-t border-slate-100" : ""}`}>
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
        {mounted && deleteTargetId && createPortal(
          <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 transition-all">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                  onClick={() => {
                    setDeleteTargetId(null);
                    setDeleteTargetImageUrl(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-sm shadow-rose-200 cursor-pointer"
                >
                  ลบประกาศ
                </button>
              </div>
            </div>
          </div>,
          document.body
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

      </div>

      {/* =====================================================
          CSS จัดการความสูง CKEditor & สไตล์ Rich Text
      ====================================================== */}
      <style jsx global>{`
        /* ปรับแต่งกล่องและแถบเครื่องมือ CKEditor */
        .ck.ck-toolbar {
          border-top-left-radius: 0.75rem !important;
          border-top-right-radius: 0.75rem !important;
          background-color: #f8fafc !important;
          border-color: #e2e8f0 !important;
          padding: 0.35rem 0.5rem !important;
        }
        .ck.ck-toolbar .ck-toolbar__items {
          display: flex !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          gap: 2px !important;
        }
        .ck-editor__editable_inline {
          min-height: 240px !important;
          border-bottom-left-radius: 0.75rem !important;
          border-bottom-right-radius: 0.75rem !important;
          border-color: #e2e8f0 !important;
          padding: 1rem 1.25rem !important;
          background-color: #ffffff !important;
        }
        .ck-editor__editable_inline.ck-focused {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
        }

        /* ป้องกันไอคอนและปุ่มขยายขนาดเกินจริง */
        .ck .ck-icon {
          width: 18px !important;
          height: 18px !important;
          font-size: 18px !important;
        }
        .ck .ck-button:not(.ck-button_with-text) .ck-button__label {
          display: none !important;
        }
        .ck .ck-button {
          border-radius: 0.5rem !important;
          cursor: pointer !important;
          transition: background-color 0.15s ease !important;
        }
        .ck .ck-button:hover {
          background-color: #f1f5f9 !important;
        }
        .ck .ck-button.ck-on {
          background-color: #e0e7ff !important;
          color: #4338ca !important;
        }
        .ck .ck-dropdown .ck-button__label {
          font-size: 0.875rem !important;
          font-weight: 500 !important;
          color: #334155 !important;
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
        .announcement-html-content img {
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