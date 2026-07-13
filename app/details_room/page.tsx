"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

const PLACEHOLDER_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22800%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E";

// ข้อมูลจำลองสำหรับห้องพักแต่ละประเภท (Mock Data)
const ROOM_DATA = {
  aircon: {
    title: "ห้องแอร์ (Air Conditioned)",
    price: "3,500",
    amenities: [
      { icon: "❄️", label: "แอร์ปรับอากาศ" },
      { icon: "📐", label: "32 sq.m." }
    ],
    desc: "เตียงนอน, ห้องน้ำในตัว, ตู้เย็น, ตู้เสื้อผ้า, โต๊ะเรียน, โต๊ะเครื่องแป้ง",
    descSub: "(มีอย่างละ 1 ชิ้น เฟอร์นิเจอร์ครบครันพร้อมเข้าอยู่ พร้อมเครื่องทำน้ำอุ่น)",
    mainImg: PLACEHOLDER_IMG,
    thumbnails: [
      PLACEHOLDER_IMG, 
      PLACEHOLDER_IMG, 
      PLACEHOLDER_IMG, 
      PLACEHOLDER_IMG
    ]
  },
  fan: {
    title: "ห้องพัดลม (Fan)",
    price: "2,800",
    amenities: [
      { icon: "🌀", label: "พัดลมเพดาน" },
      { icon: "📐", label: "32 sq.m." }
    ],
    desc: "เตียงนอน, ห้องน้ำในตัว, ตู้เสื้อผ้า, โต๊ะเรียน, โต๊ะเครื่องแป้ง",
    descSub: "(มีอย่างละ 1 ชิ้น บรรยากาศโปร่งสบาย อากาศถ่ายเทสะดวก)",
    mainImg: PLACEHOLDER_IMG,
    thumbnails: [
      PLACEHOLDER_IMG,
      PLACEHOLDER_IMG,
      PLACEHOLDER_IMG,
      PLACEHOLDER_IMG
    ]
  }
};

function RoomDetailsContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");
  
  // ตรวจสอบพารามิเตอร์ หากไม่ตรงให้ใช้ค่าเริ่มต้นเป็น aircon
  const roomType = (typeParam === 'fan' || typeParam === 'aircon') ? typeParam : 'aircon';
  const [roomData, setRoomData] = useState(ROOM_DATA);
  const data = roomData[roomType as keyof typeof ROOM_DATA] || roomData.aircon;

  const [activeImage, setActiveImage] = useState(data.mainImg);

  useEffect(() => {
    // โหลดข้อมูลรูปภาพตั้งค่าจากระบบแอดมิน
    const fetchSettings = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        
        const docRef = doc(db, "settings", "general");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const settings = docSnap.data();
          setRoomData(prev => {
            const newData = { ...prev };
            
            // แอร์
            if (settings.airconPrice) newData.aircon.price = settings.airconPrice;
            if (settings.airconSize) {
              newData.aircon.amenities = [
                 { icon: "❄️", label: "แอร์ปรับอากาศ" },
                 { icon: "📐", label: `${settings.airconSize} sq.m.` }
              ];
            }
            if (settings.airconDesc) newData.aircon.desc = settings.airconDesc;
            if (settings.airconDescSub) newData.aircon.descSub = settings.airconDescSub;
            if (settings.airconMainImage) {
              newData.aircon.mainImg = settings.airconMainImage;
            }
            let airconThumbs = [newData.aircon.mainImg];
            if (settings.airconGallery) {
              airconThumbs = [...airconThumbs, ...settings.airconGallery];
            } else {
              if (settings.airconThumb1) airconThumbs.push(settings.airconThumb1);
              if (settings.airconThumb2) airconThumbs.push(settings.airconThumb2);
              if (settings.airconThumb3) airconThumbs.push(settings.airconThumb3);
            }
            newData.aircon.thumbnails = airconThumbs;

            // พัดลม
            if (settings.fanPrice) newData.fan.price = settings.fanPrice;
            if (settings.fanSize) {
              newData.fan.amenities = [
                 { icon: "🌀", label: "พัดลมเพดาน" },
                 { icon: "📐", label: `${settings.fanSize} sq.m.` }
              ];
            }
            if (settings.fanDesc) newData.fan.desc = settings.fanDesc;
            if (settings.fanDescSub) newData.fan.descSub = settings.fanDescSub;
            if (settings.fanMainImage) {
              newData.fan.mainImg = settings.fanMainImage;
            }
            let fanThumbs = [newData.fan.mainImg];
            if (settings.fanGallery) {
              fanThumbs = [...fanThumbs, ...settings.fanGallery];
            } else {
              if (settings.fanThumb1) fanThumbs.push(settings.fanThumb1);
              if (settings.fanThumb2) fanThumbs.push(settings.fanThumb2);
              if (settings.fanThumb3) fanThumbs.push(settings.fanThumb3);
            }
            newData.fan.thumbnails = fanThumbs;

            return newData;
          });
        }
      } catch (error) {
        console.error("Failed to load custom room images", error);
      }
    };
    
    fetchSettings();
  }, []);

  // อัปเดตภาพหลักเมื่อ URL พารามิเตอร์เปลี่ยน (สลับไปมา) หรือเมื่อข้อมูลดึงเสร็จ
  useEffect(() => {
    setActiveImage(data.mainImg);
  }, [data.mainImg]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 pt-10">
      {/* แถบนำทาง / หัวข้อด้านบน */}
      <div className="text-[var(--text-muted)] font-medium mb-8 flex items-center gap-3 text-sm">
        <Link href="/" className="hover:text-[var(--accent-brown)] transition-colors flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          หน้าหลัก
        </Link>
        <span className="opacity-50">/</span>
        <span className="text-[var(--accent-brown)] font-bold">รายละเอียดห้องพัก</span>
      </div>

      {/* การ์ดข้อมูลหลัก */}
      <div className="bg-white rounded-[40px] p-6 lg:p-10 shadow-[0_20px_60px_-15px_rgba(139,94,60,0.1)] text-[#3A2D23] border border-[#F3E7DD]">
        
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-14 items-stretch">
          {/* ด้านซ้าย: รูปภาพแกลลอรี่ */}
          <div className="w-full lg:w-[55%] flex flex-col gap-4">
            {/* ภาพหลัก */}
            <div className="relative rounded-[30px] overflow-hidden aspect-[4/3] bg-gray-100 shadow-inner group">
              {/* ใช้ tag img มาตรฐานเพื่อหลีกเลี่ยงปัญหาเรื่อง Domain ที่ไม่ได้กำหนดใน config ของ next/image */}
              <img
                src={activeImage}
                alt={data.title}
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER_IMG; // รูปภาพสำรอง
                }}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-6 left-6 bg-[#A36A00]/90 backdrop-blur-sm text-white text-[10px] md:text-[12px] font-bold px-4 py-2 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                AVAILABLE
              </div>
            </div>
            
            {/* รูปภาพขนาดเล็กด้านล่าง (Thumbnails) */}
            <div className="grid grid-cols-4 gap-3 md:gap-4 mt-2 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {data.thumbnails.map((img, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setActiveImage(img)}
                  className={`relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-50 transition-all duration-300 cursor-pointer ${
                    activeImage === img 
                      ? 'ring-2 ring-[var(--accent-brown)] ring-offset-2 scale-95 opacity-100 shadow-md' 
                      : 'hover:opacity-90 opacity-60 hover:scale-100 hover:shadow-sm'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Room thumbnail ${idx + 1}`}
                    onError={(e) => {
                       e.currentTarget.src = PLACEHOLDER_IMG;
                    }}
                    className="w-full h-full object-cover"
                  />
                  {activeImage !== img && (
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ด้านขวา: ข้อมูลรายละเอียด */}
          <div className="w-full lg:w-[45%] flex flex-col pt-2 lg:pt-6">
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#F3E7DD] text-[#8B5E3C] text-xs font-bold tracking-wider mb-5 self-start">
              YAYEE DORMITORY
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-[36px] font-extrabold text-[#3A2D23] tracking-tight leading-tight mb-8">
              {data.title}
            </h1>

            <div className="mb-8 p-6 bg-gradient-to-br from-[#FFFDF9] to-[#FDF0EB] rounded-3xl border border-[#F3E7DD] shadow-sm relative overflow-hidden">
               {/* ของตกแต่ง */}
               <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/40 rounded-full blur-2xl"></div>
              <div className="relative z-10 flex flex-col">
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#8B5E3C] leading-none tracking-tight">{data.price}</span>
                  <span className="text-xl text-[var(--accent-dark)] font-bold mb-1.5 opacity-80">บาท</span>
                </div>
                <div className="text-xs text-[#8B5E3C] uppercase tracking-[0.2em] font-bold mt-2 opacity-70">
                  PER MONTH (เฉลี่ยต่อเดือน)
                </div>
              </div>
            </div>

            {/* ป้ายกำกับ / จุดเด่นห้อง */}
            <div className="flex flex-wrap items-center gap-3 mb-10 text-[#8B5E3C] font-semibold text-sm">
              {data.amenities.map((item, idx) => (
                 <div key={idx} className="flex items-center gap-2.5 bg-white border border-[#F3E7DD] shadow-sm px-4 py-2.5 rounded-xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <span className="text-xl">{item.icon}</span> 
                  <span>{item.label}</span>
                 </div>
              ))}
            </div>

            {/* รายละเอียดคำอธิบายแบบละเอียด */}
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-[var(--text-main)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)]"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              สิ่งอำนวยความสะดวกในห้อง
            </h3>
            <div className="mb-10 text-[#6D5A4C] text-sm md:text-base leading-[1.8] font-medium p-6 bg-[#FAFAFA] rounded-2xl border border-gray-100 shadow-inner">
              <div className="flex items-start gap-4">
                <span className="text-[var(--accent-brown)] mt-0.5 text-lg">✨</span>
                <div>
                  <p className="text-[var(--text-main)]">{data.desc}</p>
                  <p className="text-[var(--text-muted)] mt-2 text-sm font-semibold">{data.descSub}</p>
                </div>
              </div>
            </div>

            {/* ปุ่มทำรายการ (Call to action) */}
            <div className="mt-auto flex flex-col gap-4">
              <Link
                href="/auth/register"
                className="group relative block text-center bg-[#8B5E3C] hover:bg-[#734A2E] text-white py-4 md:py-5 rounded-2xl font-bold transition-all w-full shadow-[0_10px_30px_-10px_rgba(139,94,60,0.5)] hover:shadow-[0_15px_35px_-10px_rgba(139,94,60,0.6)] text-base md:text-lg hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out"></div>
                สมัครสมาชิกเพื่อจองห้องนี้
              </Link>
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-500">
                หากมีบัญชีอยู่แล้ว? 
                <Link href="/auth/login" className="text-[#8B5E3C] font-bold underline hover:text-[#734A2E] transition-colors">
                  เข้าสู่ระบบ
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoomDetails() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] font-sans pb-20 selection:bg-[#B3744A] selection:text-white">
      {/* ใช้ Suspense ครอบเพื่อให้ useSearchParams สามารถทำงานได้ถูกต้องเวลา build */}
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center flex-col gap-4">
            <div className="w-14 h-14 border-4 border-[#F3E7DD] border-t-[#8B5E3C] rounded-full animate-spin"></div>
            <p className="text-[#8B5E3C] font-bold tracking-widest animate-pulse">LOADING...</p>
        </div>
      }>
        <RoomDetailsContent />
      </Suspense>
    </div>
  );
}
