"use client";

import { useRef, useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { toast } from "@/lib/toast";

export default function RepairPage() {
  const [type, setType] = useState("");
  const [detail, setDetail] = useState("");
  const [time, setTime] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const chooseImage = () => fileInputRef.current?.click();

  const removeImage = () => {
    setImage(null);
    setPreview(null);
  };

  const handleCancel = () => {
    setType("");
    setDetail("");
    setTime("");
    setImage(null);
    setPreview(null);
  };

  // ฟังก์ชัน upload รูปภาพไป Firebase Storage และส่งข้อมูลไป Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      toast.warning("กรุณาเข้าสู่ระบบก่อนแจ้งซ่อม");
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl = "";

      // ถ้ามีรูปภาพ ให้ upload ผ่าน Vercel Blob API แทน Firebase Storage
      if (image) {
        const formData = new FormData();
        formData.append("file", image);

        const uploadRes = await fetch("/api/upload-repair", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "Upload failed");
        }

        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      // บันทึกข้อมูลลง Firestore พร้อม imageUrl
      await addDoc(collection(db, "repairs"), {
        type,
        detail,
        time,
        imageUrl,
        status: "ใหม่",
        tenantId: user.uid,
        createdAt: new Date(),
      });

      toast.success("ส่งคำขอแจ้งซ่อมแล้ว");
      handleCancel();
    } catch (error) {
      console.error("บันทึกข้อมูลไม่สำเร็จ", error);
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งข้อมูล");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">
          แจ้งซ่อม
        </h1>
      </div>

      <p className="text-[var(--text-muted)] text-lg mb-8">
        กรอกรายละเอียดปัญหาที่ต้องการให้เราแก้ไข
      </p>

      <form
        onSubmit={handleSubmit}
        className="glass-panel p-6 md:p-8 rounded-3xl space-y-6 relative overflow-hidden"
      >
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-[var(--accent-light)] rounded-full blur-3xl opacity-40 pointer-events-none" />

        {/* ประเภทปัญหา */}
        <div className="relative z-10">
          <label className="block mb-2 font-semibold text-[var(--text-main)]">
            ประเภทปัญหา <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="เช่น แอร์เสีย, หลอดไฟเสีย, ก๊อกน้ำรั่ว..."
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-xl p-3 glass-input"
            required
          />
        </div>

        {/* รายละเอียด */}
        <div className="relative z-10">
          <label className="block mb-2 font-semibold text-[var(--text-main)]">
            รายละเอียดเพิ่มเติม <span className="text-red-500">*</span>
          </label>
          <textarea
            placeholder="อธิบายลักษณะอาการ..."
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            className="w-full rounded-xl p-3 glass-input min-h-[120px]"
            required
          />
        </div>

        {/* รูปภาพ */}
        <div className="relative z-10">
          <label className="block mb-2 font-semibold text-[var(--text-main)]">
            รูปภาพประกอบ (ถ้ามี)
          </label>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />

          {!preview && (
            <button
              type="button"
              onClick={chooseImage}
              className="glass-button-outline px-6 py-3 rounded-lg border-dashed border-2 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              เลือกรูปภาพ
            </button>
          )}

          {preview && (
            <div className="space-y-4">
              <img
                src={preview}
                alt="preview"
                className="w-48 h-48 object-cover rounded-lg border"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={chooseImage}
                  className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
                >
                  เปลี่ยนรูป
                </button>
                <button
                  type="button"
                  onClick={removeImage}
                  className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm"
                >
                  ลบรูป
                </button>
              </div>
            </div>
          )}
        </div>

        {/* เวลานัด */}
        <div className="relative z-10">
          <label className="block mb-2 font-semibold text-[var(--text-main)]">
            เวลาที่สะดวกให้ช่างเข้าตรวจสอบ
          </label>
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-xl p-3 glass-input"
            required
          />
        </div>

        {/* ปุ่ม */}
        <div className="flex gap-4 pt-6 border-t">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3 glass-button rounded-lg font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            {submitting && (
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {submitting ? "กำลังส่ง..." : "ส่งแบบฟอร์ม"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="px-6 py-3 bg-white/50 border rounded-lg"
          >
            ล้างข้อมูล
          </button>
        </div>
      </form>
    </div>
  );
}