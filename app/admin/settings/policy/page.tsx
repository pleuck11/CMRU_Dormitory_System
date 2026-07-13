"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

export default function PolicySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialDataStr, setInitialDataStr] = useState<string>("");

  const [formData, setFormData] = useState({
    linkFAQ: "#",
    linkHelp: "#",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          const completeData = {
            linkFAQ: data.linkFAQ ?? formData.linkFAQ,
            linkHelp: data.linkHelp ?? formData.linkHelp,
          };
          setFormData(completeData);
          setInitialDataStr(JSON.stringify(completeData));
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("ไม่สามารถโหลดการตั้งค่าได้");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const checkIsDirty = useCallback(() => {
    return JSON.stringify(formData) !== initialDataStr;
  }, [formData, initialDataStr]);

  useEffect(() => {
    if (initialDataStr) {
      setIsDirty(checkIsDirty());
    }
  }, [checkIsDirty, initialDataStr]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      await setDoc(doc(db, "settings", "general"), formData, { merge: true });
      setInitialDataStr(JSON.stringify(formData));
      setIsDirty(false);
      toast.success("บันทึกนโยบายและการช่วยเหลือเรียบร้อยแล้ว");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 animate-in fade-in duration-500 relative">
      <div className="mb-6 flex flex-col items-start justify-between sm:flex-row sm:items-center gap-4">
        <div>
          <Link href="/admin/settings" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--accent-brown)] hover:text-amber-800 mb-3 transition-colors bg-orange-50 px-3 py-1.5 rounded-lg w-fit">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            การตั้งค่า
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">นโยบายและการช่วยเหลือ</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการลิงก์คำถามที่พบบ่อยและศูนย์ช่วยเหลือ</p>
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all shadow-md text-sm disabled:opacity-75"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">นโยบายและการช่วยเหลือ</h2>
          </div>
          
          <div className="divide-y divide-gray-50">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3"><label className="text-sm font-semibold text-gray-900">FAQ (ถามตอบ)</label></div>
              <div className="w-full sm:w-2/3"><input type="text" className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm placeholder-gray-300 truncate" value={formData.linkFAQ} onChange={e => setFormData({ ...formData, linkFAQ: e.target.value })} /></div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3"><label className="text-sm font-semibold text-gray-900">ศูนย์ช่วยเหลือ</label></div>
              <div className="w-full sm:w-2/3"><input type="text" className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm placeholder-gray-300 truncate" value={formData.linkHelp} onChange={e => setFormData({ ...formData, linkHelp: e.target.value })} /></div>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
