"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

export default function ContactSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialDataStr, setInitialDataStr] = useState<string>("");

  const [formData, setFormData] = useState({
    contactPhone: "062-2499094, 080-1330194",
    contactAddress: "บ้านปากทางสะลวง ต.ขี้เหล็ก\nอ.แม่ริม จ.เชียงใหม่",
    socialFB: "#",
    socialIG: "#",
    socialLINE: "#",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          const completeData = {
            contactPhone: data.contactPhone ?? formData.contactPhone,
            contactAddress: data.contactAddress ?? formData.contactAddress,
            socialFB: data.socialFB ?? formData.socialFB,
            socialIG: data.socialIG ?? formData.socialIG,
            socialLINE: data.socialLINE ?? formData.socialLINE,
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
      toast.success("บันทึกข้อมูลการติดต่อเรียบร้อยแล้ว");
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">การติดต่อและโซเชียล</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการเบอร์โทรศัพท์ ที่อยู่ และช่องทางโซเชียลมีเดียต่างๆ</p>
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
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">การติดต่อ & โซเชียลมีเดีย</h2>
          </div>
          
          <div className="divide-y divide-gray-50">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3">
                <label className="text-sm font-semibold text-gray-900">เบอร์โทรศัพท์</label>
              </div>
              <div className="w-full sm:w-2/3">
                <input 
                  type="text" 
                  value={formData.contactPhone}
                  onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm placeholder-gray-300"
                  placeholder="เช่น 062-2499094"
                />
              </div>
            </div>
            
            <div className="p-4 flex flex-col sm:flex-row gap-2 hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3 pt-0.5">
                <label className="text-sm font-semibold text-gray-900">ที่อยู่ส่วนกลาง</label>
              </div>
              <div className="w-full sm:w-2/3">
                <textarea 
                  value={formData.contactAddress}
                  onChange={e => setFormData({ ...formData, contactAddress: e.target.value })}
                  rows={2}
                  className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm resize-none placeholder-gray-300 custom-scrollbar"
                  placeholder="รายละเอียดที่อยู่..."
                />
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3"><label className="text-sm font-semibold text-gray-900">Facebook</label></div>
              <div className="w-full sm:w-2/3"><input type="text" className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm placeholder-gray-300 truncate" value={formData.socialFB} onChange={e => setFormData({ ...formData, socialFB: e.target.value })} /></div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3"><label className="text-sm font-semibold text-gray-900">Instagram</label></div>
              <div className="w-full sm:w-2/3"><input type="text" className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm placeholder-gray-300 truncate" value={formData.socialIG} onChange={e => setFormData({ ...formData, socialIG: e.target.value })} /></div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 group hover:bg-gray-50/50 transition-colors">
              <div className="w-full sm:w-1/3"><label className="text-sm font-semibold text-gray-900">LINE</label></div>
              <div className="w-full sm:w-2/3"><input type="text" className="w-full text-left sm:text-right bg-transparent border-none p-0 focus:ring-0 text-gray-500 text-sm placeholder-gray-300 truncate" value={formData.socialLINE} onChange={e => setFormData({ ...formData, socialLINE: e.target.value })} /></div>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
