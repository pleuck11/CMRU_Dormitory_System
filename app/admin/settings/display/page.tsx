"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";
import Cropper from "react-easy-crop";
import getCroppedImg from "@/lib/cropImage";

interface DisplaySettings {
  heroImage: string;
  airconMainImage: string;
  airconGallery: string[];
  airconPrice: string;
  airconSize: string;
  airconDesc: string;
  airconDescSub: string;
  fanMainImage: string;
  fanGallery: string[];
  fanPrice: string;
  fanSize: string;
  fanDesc: string;
  fanDescSub: string;
}

const PLACEHOLDER_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22800%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E";

export default function DisplaySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [initialDataStr, setInitialDataStr] = useState<string>("");

  // รูปภาพส่วนหัว (Hero)
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);

  // การตั้งค่า Cropper สำหรับ Hero Banner
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropInputUrl, setCropInputUrl] = useState<string>('');
  const [tempHeroImageFile, setTempHeroImageFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // ไฟล์และตัวอย่างรูปภาพห้องแอร์ (ปกหลัก)
  const [airconMainFile, setAirconMainFile] = useState<File | null>(null);
  const [airconMainPreview, setAirconMainPreview] = useState<string | null>(null);
  
  // ไฟล์และตัวอย่างรูปภาพห้องพัดลม (ปกหลัก)
  const [fanMainFile, setFanMainFile] = useState<File | null>(null);
  const [fanMainPreview, setFanMainPreview] = useState<string | null>(null);

  // เตรียมสำหรับอัปโหลดรูปลง Gallery
  const [newAirconGalleryFiles, setNewAirconGalleryFiles] = useState<{file: File, preview: string}[]>([]);
  const [newFanGalleryFiles, setNewFanGalleryFiles] = useState<{file: File, preview: string}[]>([]);

  // ติวรายการ Blob URL ที่โดนลบ
  const [urlsToDelete, setUrlsToDelete] = useState<string[]>([]);

  const [formData, setFormData] = useState<DisplaySettings>({
    heroImage: PLACEHOLDER_IMG,
    airconMainImage: PLACEHOLDER_IMG,
    airconGallery: [],
    airconPrice: "3,500",
    airconSize: "32",
    airconDesc: "เตียงนอน, ห้องน้ำในตัว, ตู้เย็น, ตู้เสื้อผ้า, โต๊ะเรียน, โต๊ะเครื่องแป้ง",
    airconDescSub: "(มีอย่างละ 1 ชิ้น เฟอร์นิเจอร์ครบครันพร้อมเข้าอยู่ พร้อมเครื่องทำน้ำอุ่น)",
    fanMainImage: PLACEHOLDER_IMG,
    fanGallery: [],
    fanPrice: "2,800",
    fanSize: "32",
    fanDesc: "เตียงนอน, ห้องน้ำในตัว, ตู้เสื้อผ้า, โต๊ะเรียน, โต๊ะเครื่องแป้ง",
    fanDescSub: "(มีอย่างละ 1 ชิ้น บรรยากาศโปร่งสบาย อากาศถ่ายเทสะดวก)",
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          
          // ย้ายข้อมูลฟิลด์รูปภาพขนาดย่อ (Thumb) เก่าไปยังอาร์เรย์ Gallery หากยังไม่มีอยู่
          const newAirconGallery = data.airconGallery ? [...data.airconGallery] : [];
          if (!data.airconGallery) {
             if (data.airconThumb1 && !data.airconThumb1.includes("data:image")) newAirconGallery.push(data.airconThumb1);
             if (data.airconThumb2 && !data.airconThumb2.includes("data:image")) newAirconGallery.push(data.airconThumb2);
             if (data.airconThumb3 && !data.airconThumb3.includes("data:image")) newAirconGallery.push(data.airconThumb3);
          }

          const newFanGallery = data.fanGallery ? [...data.fanGallery] : [];
          if (!data.fanGallery) {
             if (data.fanThumb1 && !data.fanThumb1.includes("data:image")) newFanGallery.push(data.fanThumb1);
             if (data.fanThumb2 && !data.fanThumb2.includes("data:image")) newFanGallery.push(data.fanThumb2);
             if (data.fanThumb3 && !data.fanThumb3.includes("data:image")) newFanGallery.push(data.fanThumb3);
          }

          const completeData = {
            ...formData,
            heroImage: data.heroImage || formData.heroImage,
            airconMainImage: data.airconMainImage || formData.airconMainImage,
            airconPrice: data.airconPrice || formData.airconPrice,
            airconSize: data.airconSize || formData.airconSize,
            airconDesc: data.airconDesc || formData.airconDesc,
            airconDescSub: data.airconDescSub || formData.airconDescSub,
            fanMainImage: data.fanMainImage || formData.fanMainImage,
            fanPrice: data.fanPrice || formData.fanPrice,
            fanSize: data.fanSize || formData.fanSize,
            fanDesc: data.fanDesc || formData.fanDesc,
            fanDescSub: data.fanDescSub || formData.fanDescSub,
            airconGallery: newAirconGallery,
            fanGallery: newFanGallery
          };

          setFormData(completeData);
          setInitialDataStr(JSON.stringify(completeData));
          if (completeData.heroImage && completeData.heroImage !== PLACEHOLDER_IMG) setHeroImagePreview(completeData.heroImage);
          if (completeData.airconMainImage && completeData.airconMainImage !== PLACEHOLDER_IMG) setAirconMainPreview(completeData.airconMainImage);
          if (completeData.fanMainImage && completeData.fanMainImage !== PLACEHOLDER_IMG) setFanMainPreview(completeData.fanMainImage);
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
    const isFormDataChanged = JSON.stringify(formData) !== initialDataStr;
    const hasPendingUploads = heroImageFile !== null || 
                              airconMainFile !== null || 
                              fanMainFile !== null || 
                              newAirconGalleryFiles.length > 0 || 
                              newFanGalleryFiles.length > 0;
    const hasDeletions = urlsToDelete.length > 0;
    return isFormDataChanged || hasPendingUploads || hasDeletions;
  }, [formData, initialDataStr, heroImageFile, airconMainFile, fanMainFile, newAirconGalleryFiles, newFanGalleryFiles, urlsToDelete]);

  useEffect(() => {
    if (initialDataStr) {
      setIsDirty(checkIsDirty());
    }
  }, [checkIsDirty, initialDataStr]);

  const handleHeroImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setTempHeroImageFile(file);
      setCropInputUrl(URL.createObjectURL(file));
      setCropModalOpen(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setFlipH(false);
      setFlipV(false);
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    try {
      if (!croppedAreaPixels) return;
      const croppedFile = await getCroppedImg(
        cropInputUrl,
        croppedAreaPixels,
        { horizontal: flipH, vertical: flipV }
      );
      
      if (croppedFile) {
        setHeroImageFile(croppedFile);
        setHeroImagePreview(URL.createObjectURL(croppedFile));
        setIsDirty(true);
      }
      setCropModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("เกิดข้อผิดพลาดในการตัดรูปภาพ");
    }
  };

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFile(file);
      setPreview(URL.createObjectURL(file));
      e.target.value = '';
    }
  };

  const handleAddGalleryImages = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFiles: React.Dispatch<React.SetStateAction<{file: File, preview: string}[]>>
  ) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setFiles(prev => [...prev, ...newFiles]);
      e.target.value = '';
    }
  };

  const removeExistingGalleryImage = (type: 'aircon' | 'fan', url: string) => {
    setFormData(prev => ({
      ...prev,
      [type === 'aircon' ? 'airconGallery' : 'fanGallery']: prev[type === 'aircon' ? 'airconGallery' : 'fanGallery'].filter((u: string) => u !== url)
    }));
    setUrlsToDelete(prev => [...prev, url]);
  };

  const removeNewGalleryImage = (
    type: 'aircon' | 'fan', 
    index: number,
    stateFiles: {file: File, preview: string}[],
    setFiles: React.Dispatch<React.SetStateAction<{file: File, preview: string}[]>>
  ) => {
    const newArr = [...stateFiles];
    newArr.splice(index, 1);
    setFiles(newArr);
  };

  const uploadFile = async (file: File): Promise<string> => {
    const uploadData = new FormData();
    uploadData.append("file", file);
    const uploadRes = await fetch("/api/upload-room-image", {
      method: "POST",
      body: uploadData,
    });
    if (!uploadRes.ok) throw new Error("อัปโหลดรูปภาพล้มเหลว");
    const resData = await uploadRes.json();
    return resData.url;
  };

  const deleteOldBlob = async (url: string) => {
    if (!url || !url.includes("public.blob.vercel-storage.com")) return;
    try {
      await fetch("/api/delete-blob-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
    } catch (e) {
      console.error("Failed to delete old blob via API", e);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    let newSettings = { ...formData };

    try {
      const deleteTasks = urlsToDelete.map(url => deleteOldBlob(url));

      if (heroImageFile) {
        if (formData.heroImage && formData.heroImage !== PLACEHOLDER_IMG) deleteTasks.push(deleteOldBlob(formData.heroImage));
        newSettings.heroImage = await uploadFile(heroImageFile);
      }
      
      if (airconMainFile) {
        if (formData.airconMainImage && formData.airconMainImage !== PLACEHOLDER_IMG) deleteTasks.push(deleteOldBlob(formData.airconMainImage));
        newSettings.airconMainImage = await uploadFile(airconMainFile);
      }
      if (fanMainFile) {
        if (formData.fanMainImage && formData.fanMainImage !== PLACEHOLDER_IMG) deleteTasks.push(deleteOldBlob(formData.fanMainImage));
        newSettings.fanMainImage = await uploadFile(fanMainFile);
      }

      if (newAirconGalleryFiles.length > 0) {
         const uploadedUrls = await Promise.all(newAirconGalleryFiles.map(f => uploadFile(f.file)));
         newSettings.airconGallery = [...newSettings.airconGallery, ...uploadedUrls];
      }
      if (newFanGalleryFiles.length > 0) {
         const uploadedUrls = await Promise.all(newFanGalleryFiles.map(f => uploadFile(f.file)));
         newSettings.fanGallery = [...newSettings.fanGallery, ...uploadedUrls];
      }

      await setDoc(doc(db, "settings", "general"), {
         ...newSettings,
         airconThumb1: null, airconThumb2: null, airconThumb3: null,
         fanThumb1: null, fanThumb2: null, fanThumb3: null
      }, { merge: true });
      
      setFormData(newSettings);
      setInitialDataStr(JSON.stringify(newSettings));
      
      setHeroImageFile(null);
      setAirconMainFile(null);
      setFanMainFile(null);
      setNewAirconGalleryFiles([]);
      setNewFanGalleryFiles([]);
      setUrlsToDelete([]);
      
      toast.success("บันทึกการแสดงผลเว็บไซต์เรียบร้อยแล้ว");
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการอัปโหลดรูป");
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">การแสดงผลเว็บไซต์</h1>
          <p className="text-gray-500 text-sm mt-1">จัดการรูปภาพหน้าปกและแกลเลอรีต่างๆ</p>
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

      {cropModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col shadow-2xl overflow-hidden relative">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10 relative">
              <h3 className="text-lg font-bold text-gray-900">
                ปรับรูปภาพปก
              </h3>
              <button onClick={() => setCropModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-colors">✕</button>
            </div>
            
            <div className="relative flex-1 min-h-[40vh] md:min-h-[50vh] bg-gray-900">
              <Cropper
                image={cropInputUrl}
                crop={crop}
                zoom={zoom}
                aspect={21 / 7}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                transform={`scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`}
              />
            </div>

            <div className="p-4 bg-gray-50 flex flex-col sm:flex-row gap-4 justify-between items-center z-10 relative">
              <div className="flex-1 w-full flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-500">ซูม (Zoom)</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900"
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setFlipH(!flipH)} className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 text-sm flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-8"/><path d="M12 4v4"/><path d="m9 16-4-4 4-4"/><path d="m15 8 4 4-4 4"/></svg>
                  แนวนอน
                </button>
              </div>

              <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                <button
                  type="button"
                  onClick={handleApplyCrop}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all shadow-md text-sm"
                >
                  นำไปใช้
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            </div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">จัดการรูปภาพต่างๆ</h2>
          </div>
          
          <div className="p-4 sm:p-5 space-y-6">
            
            {/* Hero Banner */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">แบนเนอร์หน้าแรก (Hero)</h3>
                  <p className="text-[11px] text-gray-500">อัตราส่วนแนะนำ 21:7 แนวนอน</p>
                </div>
              </div>
              <label htmlFor="hero-image-upload" className="block relative rounded-2xl overflow-hidden aspect-[21/9] cursor-pointer group border border-gray-200">
                <img src={heroImagePreview || formData.heroImage} alt="Hero" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={e => e.currentTarget.src = PLACEHOLDER_IMG} />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/90 text-gray-900 font-bold px-4 py-2 rounded-full text-xs shadow-md">เปลี่ยนภาพปกใหม่</div>
                </div>
              </label>
              <input id="hero-image-upload" type="file" accept="image/*" className="hidden" onChange={handleHeroImageSelect} />
            </div>

            <hr className="border-gray-100" />

            {/* ห้องแอร์ */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-lg">❄️</span>
                <h3 className="text-sm font-bold text-gray-900">รายละเอียด ห้องแอร์</h3>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">ราคา (บาท/เดือน)</label>
                  <input type="text" value={formData.airconPrice} onChange={e => setFormData({ ...formData, airconPrice: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none" placeholder="เช่น 3,500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">ขนาดห้อง (sq.m.)</label>
                  <input type="text" value={formData.airconSize} onChange={e => setFormData({ ...formData, airconSize: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none" placeholder="เช่น 32" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">สิ่งอำนวยความสะดวก</label>
                  <input type="text" value={formData.airconDesc} onChange={e => setFormData({ ...formData, airconDesc: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none" placeholder="เช่น เตียงนอน, ห้องน้ำในตัว, ตู้เสื้อผ้า" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">คำอธิบายเพิ่มเติม</label>
                  <input type="text" value={formData.airconDescSub} onChange={e => setFormData({ ...formData, airconDescSub: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none text-gray-600" placeholder="เช่น (มีอย่างละ 1 ชิ้น เฟอร์นิเจอร์ครบครัน)" />
                </div>
              </div>

              {/* Image Gallery */}
              <div className="space-y-2 mt-4">
                <p className="text-xs font-bold text-gray-700">รูปภาพประกอบ</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide custom-scrollbar">
                  {/* ปกหลัก */}
                  <div className="flex-shrink-0 w-28 space-y-1">
                    <p className="text-[10px] font-semibold text-blue-600 text-center">ภาพปกหลัก</p>
                    <label htmlFor="aircon-main-upload" className="block relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer group border-2 border-blue-200 bg-gray-50">
                      <img src={airconMainPreview || formData.airconMainImage} alt="Aircon Main" className="w-full h-full object-cover" onError={e => e.currentTarget.src = PLACEHOLDER_IMG} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-bold text-[10px]">เปลี่ยน</span>
                      </div>
                    </label>
                    <input id="aircon-main-upload" type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, setAirconMainFile, setAirconMainPreview)} />
                  </div>
                  
                  {/* เส้นกั้น */}
                  <div className="w-px bg-gray-200 my-4 shrink-0"></div>

                  {/* แกลเลอรีที่มีอยู่ */}
                  {formData.airconGallery.map((url, idx) => (
                    <div key={`exist-air-${idx}`} className="flex-shrink-0 w-28 space-y-1">
                       <p className="text-[10px] font-semibold text-gray-400 text-center">แกลเลอรี {idx+1}</p>
                       <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-gray-200 group bg-gray-50">
                          <img src={url} alt={`Gallery ${idx+1}`} className="w-full h-full object-cover" onError={e => e.currentTarget.src = PLACEHOLDER_IMG} />
                          <button type="button" onClick={() => removeExistingGalleryImage('aircon', url)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-colors">✕</button>
                       </div>
                    </div>
                  ))}

                  {/* แกลเลอรีใหม่ */}
                  {newAirconGalleryFiles.map((fileObj, idx) => (
                    <div key={`new-air-${idx}`} className="flex-shrink-0 w-28 space-y-1">
                       <p className="text-[10px] font-semibold text-emerald-500 text-center">ใหม่</p>
                       <div className="relative rounded-xl overflow-hidden aspect-[4/3] border-2 border-dashed border-emerald-300 group bg-gray-50">
                          <img src={fileObj.preview} alt={`New Gallery ${idx+1}`} className="w-full h-full object-cover opacity-70" />
                          <button type="button" onClick={() => removeNewGalleryImage('aircon', idx, newAirconGalleryFiles, setNewAirconGalleryFiles)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-colors">✕</button>
                       </div>
                    </div>
                  ))}

                  {/* ปุ่มเพิ่มรูปแกลเลอรี */}
                  <div className="flex-shrink-0 w-28 flex items-end">
                     <label htmlFor="aircon-gallery-upload" className="w-full flex flex-col items-center justify-center aspect-[4/3] bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl cursor-pointer transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mb-1"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                       <span className="text-[10px] font-bold text-gray-500">เพิ่มรูป</span>
                     </label>
                     <input id="aircon-gallery-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => handleAddGalleryImages(e, setNewAirconGalleryFiles)} />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* ห้องพัดลม */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <span className="text-lg">🌀</span>
                <h3 className="text-sm font-bold text-gray-900">รายละเอียด ห้องพัดลม</h3>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">ราคา (บาท/เดือน)</label>
                  <input type="text" value={formData.fanPrice} onChange={e => setFormData({ ...formData, fanPrice: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none" placeholder="เช่น 2,800" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700">ขนาดห้อง (sq.m.)</label>
                  <input type="text" value={formData.fanSize} onChange={e => setFormData({ ...formData, fanSize: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none" placeholder="เช่น 32" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">สิ่งอำนวยความสะดวก</label>
                  <input type="text" value={formData.fanDesc} onChange={e => setFormData({ ...formData, fanDesc: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none" placeholder="เช่น เตียงนอน, ห้องน้ำในตัว, ตู้เสื้อผ้า" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700">คำอธิบายเพิ่มเติม</label>
                  <input type="text" value={formData.fanDescSub} onChange={e => setFormData({ ...formData, fanDescSub: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all outline-none text-gray-600" placeholder="เช่น (มีอย่างละ 1 ชิ้น บรรยากาศโปร่งสบาย)" />
                </div>
              </div>

              {/* Image Gallery */}
              <div className="space-y-2 mt-4">
                <p className="text-xs font-bold text-gray-700">รูปภาพประกอบ</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide custom-scrollbar">
                  {/* ปกหลัก */}
                  <div className="flex-shrink-0 w-28 space-y-1">
                    <p className="text-[10px] font-semibold text-blue-600 text-center">ภาพปกหลัก</p>
                    <label htmlFor="fan-main-upload" className="block relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer group border-2 border-blue-200 bg-gray-50">
                      <img src={fanMainPreview || formData.fanMainImage} alt="Fan Main" className="w-full h-full object-cover" onError={e => e.currentTarget.src = PLACEHOLDER_IMG} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-bold text-[10px]">เปลี่ยน</span>
                      </div>
                    </label>
                    <input id="fan-main-upload" type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, setFanMainFile, setFanMainPreview)} />
                  </div>
                  
                  {/* เส้นกั้น */}
                  <div className="w-px bg-gray-200 my-4 shrink-0"></div>

                  {/* แกลเลอรีที่มีอยู่ */}
                  {formData.fanGallery.map((url, idx) => (
                    <div key={`exist-fan-${idx}`} className="flex-shrink-0 w-28 space-y-1">
                       <p className="text-[10px] font-semibold text-gray-400 text-center">แกลเลอรี {idx+1}</p>
                       <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-gray-200 group bg-gray-50">
                          <img src={url} alt={`Gallery ${idx+1}`} className="w-full h-full object-cover" onError={e => e.currentTarget.src = PLACEHOLDER_IMG} />
                          <button type="button" onClick={() => removeExistingGalleryImage('fan', url)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-colors">✕</button>
                       </div>
                    </div>
                  ))}

                  {/* แกลเลอรีใหม่ */}
                  {newFanGalleryFiles.map((fileObj, idx) => (
                    <div key={`new-fan-${idx}`} className="flex-shrink-0 w-28 space-y-1">
                       <p className="text-[10px] font-semibold text-emerald-500 text-center">ใหม่</p>
                       <div className="relative rounded-xl overflow-hidden aspect-[4/3] border-2 border-dashed border-emerald-300 group bg-gray-50">
                          <img src={fileObj.preview} alt={`New Gallery ${idx+1}`} className="w-full h-full object-cover opacity-70" />
                          <button type="button" onClick={() => removeNewGalleryImage('fan', idx, newFanGalleryFiles, setNewFanGalleryFiles)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-colors">✕</button>
                       </div>
                    </div>
                  ))}

                  {/* ปุ่มเพิ่มรูปแกลเลอรี */}
                  <div className="flex-shrink-0 w-28 flex items-end">
                     <label htmlFor="fan-gallery-upload" className="w-full flex flex-col items-center justify-center aspect-[4/3] bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 rounded-xl cursor-pointer transition-colors">
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mb-1"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                       <span className="text-[10px] font-bold text-gray-500">เพิ่มรูป</span>
                     </label>
                     <input id="fan-gallery-upload" type="file" accept="image/*" multiple className="hidden" onChange={e => handleAddGalleryImages(e, setNewFanGalleryFiles)} />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </form>
    </div>
  );
}
