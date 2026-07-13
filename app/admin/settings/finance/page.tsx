"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

export default function FinanceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialDataStr, setInitialDataStr] = useState<string>("");

  const [formData, setFormData] = useState({
    requireDeposit: true,
    depositFee: 5000,
    electricUnitPrice: 8,
    waterFeeFlat: 150,
    garbageFeeFlat: 30,
    billDueDaysLimit: 5,
    lateFeePerDay: 0,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          const completeData = {
            requireDeposit: data.requireDeposit !== undefined ? data.requireDeposit : true,
            depositFee: data.depositFee ?? formData.depositFee,
            electricUnitPrice: data.electricUnitPrice ?? formData.electricUnitPrice,
            waterFeeFlat: data.waterFeeFlat ?? formData.waterFeeFlat,
            garbageFeeFlat: data.garbageFeeFlat ?? formData.garbageFeeFlat,
            billDueDaysLimit: data.billDueDaysLimit ?? formData.billDueDaysLimit,
            lateFeePerDay: data.lateFeePerDay ?? formData.lateFeePerDay,
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
      toast.success("บันทึกการตั้งค่าการเงินเรียบร้อยแล้ว");
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">การเงินและค่าธรรมเนียม</h1>
          <p className="text-gray-500 text-sm mt-1">ตั้งค่าเรทค่าน้ำ ค่าไฟ และค่าปรับต่างๆ</p>
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
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">ตั้งค่าการเงิน</h2>
          </div>
          
          <div className="divide-y divide-gray-50">
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2">
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">บังคับชำระมัดจำ</label>
                <p className="text-[11px] text-gray-400">เปิด-ปิด การชำระมัดจำเมื่อผู้เช่ายืนยันการจองห้อง</p>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={formData.requireDeposit} onChange={e => setFormData({ ...formData, requireDeposit: e.target.checked })} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-brown)]"></div>
                </label>
              </div>
            </div>

            <div className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2 ${!formData.requireDeposit ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">ค่ามัดจำห้องพัก</label>
                <p className="text-[11px] text-gray-400">ชำระครั้งแรกก่อนเข้าอยู่</p>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <input type="number" min="0" value={formData.depositFee} onChange={e => setFormData({ ...formData, depositFee: Number(e.target.value) })} className="w-24 text-right bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-bold" disabled={!formData.requireDeposit} />
                <span className="text-gray-400 font-medium text-sm">บาท</span>
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2">
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">ค่าไฟ (ต่อหน่วย)</label>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <input type="number" min="0" value={formData.electricUnitPrice} onChange={e => setFormData({ ...formData, electricUnitPrice: Number(e.target.value) })} className="w-20 text-right bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-bold" />
                <span className="text-gray-400 font-medium text-sm">บาท</span>
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2">
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">ค่าน้ำเหมาจ่าย</label>
                <p className="text-[11px] text-gray-400">ต่อเดือน/ห้อง</p>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <input type="number" min="0" value={formData.waterFeeFlat} onChange={e => setFormData({ ...formData, waterFeeFlat: Number(e.target.value) })} className="w-24 text-right bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-bold" />
                <span className="text-gray-400 font-medium text-sm">บาท</span>
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2">
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">ค่าขยะเหมาจ่าย</label>
                <p className="text-[11px] text-gray-400">ต่อเดือน/ห้อง</p>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <input type="number" min="0" value={formData.garbageFeeFlat} onChange={e => setFormData({ ...formData, garbageFeeFlat: Number(e.target.value) })} className="w-24 text-right bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-bold" />
                <span className="text-gray-400 font-medium text-sm">บาท</span>
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2">
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">กำหนดชำระ</label>
                <p className="text-[11px] text-gray-400">บวกจากวันออกบิล</p>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <span className="text-gray-400 font-medium text-sm">อีก</span>
                <input type="number" min="0" value={formData.billDueDaysLimit} onChange={e => setFormData({ ...formData, billDueDaysLimit: Number(e.target.value) })} className="w-16 text-right bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-bold" />
                <span className="text-gray-400 font-medium text-sm">วัน</span>
              </div>
            </div>

            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-gray-50/50 transition-colors gap-2">
              <div className="w-full sm:w-1/2">
                <label className="text-sm font-semibold text-gray-900">ค่าปรับล่าช้า</label>
                <p className="text-[11px] text-gray-400">คิดรายวันที่เกินกำหนด</p>
              </div>
              <div className="w-full sm:w-1/2 flex items-center sm:justify-end gap-2">
                <input type="number" min="0" value={formData.lateFeePerDay} onChange={e => setFormData({ ...formData, lateFeePerDay: Number(e.target.value) })} className="w-20 text-right bg-transparent border-none p-0 focus:ring-0 text-gray-900 font-bold" />
                <span className="text-gray-400 font-medium text-sm">บาท</span>
              </div>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
