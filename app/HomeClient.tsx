"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function HomeClient({ initialSettings }: { initialSettings: any }) {
  const PLACEHOLDER_IMG = "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22800%22%20height%3D%22600%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23e2e8f0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20fill%3D%22%2394a3b8%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E";
  const [heroImage, setHeroImage] = useState(initialSettings?.heroImage || PLACEHOLDER_IMG);
  const [airconImage, setAirconImage] = useState(initialSettings?.airconMainImage || PLACEHOLDER_IMG);
  const [fanImage, setFanImage] = useState(initialSettings?.fanMainImage || PLACEHOLDER_IMG);
  const [contactPhone, setContactPhone] = useState(initialSettings?.contactPhone || "062-2499094, 080-1330194");
  const [contactAddress, setContactAddress] = useState(initialSettings?.contactAddress || "บ้านปากทางสะลวง ต.ขี้เหล็ก\nอ.แม่ริม จ.เชียงใหม่");
  
  const [socialFB, setSocialFB] = useState<string>(initialSettings?.socialFB || "#");
  const [socialIG, setSocialIG] = useState<string>(initialSettings?.socialIG || "#");
  const [socialLINE, setSocialLINE] = useState<string>(initialSettings?.socialLINE || "#");
  const [linkFAQ, setLinkFAQ] = useState<string>(initialSettings?.linkFAQ || "#");
  const [linkHelp, setLinkHelp] = useState<string>(initialSettings?.linkHelp || "#");
  const [linkTerms, setLinkTerms] = useState<string>(initialSettings?.linkTerms || "#");
  const [linkPrivacy, setLinkPrivacy] = useState<string>(initialSettings?.linkPrivacy || "#");
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.4 } // เปลี่ยนเป็น 0.4 เพื่อให้จับได้เร็วขึ้นเวลา Scroll.
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // นำการดึงข้อมูล Firebase ออก และเปลี่ยนไปใช้ Server Component props แทน

  return (
    <div className="min-h-screen bg-[#FFFDF9] font-sans text-[#3A2D23] overflow-x-hidden selection:bg-[#B3744A] selection:text-white">
      {/* แถบนำทาง */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between bg-white/80 backdrop-blur-md px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-[#8B5E3C] font-extrabold text-2xl tracking-tighter">
            Yayee Dormitory
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#665243]">
          <a href="#home" className={`pb-1 border-b-2 transition-all ${activeSection === 'home' ? 'text-[#8B5E3C] border-[#8B5E3C]' : 'border-transparent hover:text-[#8B5E3C] hover:border-[#8B5E3C]'}`}>Home</a>
          <a href="#rooms" className={`pb-1 border-b-2 transition-all ${activeSection === 'rooms' ? 'text-[#8B5E3C] border-[#8B5E3C]' : 'border-transparent hover:text-[#8B5E3C] hover:border-[#8B5E3C]'}`}>Rooms</a>
          <a href="#contact" className={`pb-1 border-b-2 transition-all ${activeSection === 'contact' ? 'text-[#8B5E3C] border-[#8B5E3C]' : 'border-transparent hover:text-[#8B5E3C] hover:border-[#8B5E3C]'}`}>Contact</a>
        </div>
        <div className="flex items-center">
          <Link
            href="/auth/login"
            className="bg-[#8B5E3C] hover:bg-[#734A2E] text-white px-8 py-2.5 rounded-full text-sm font-bold transition-all shadow-md hover:shadow-lg"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* ส่วนเนื้อหาหลัก */}
      <section id="home" className="relative pt-36 pb-28 md:pt-40 md:pb-40 flex flex-col justify-center min-h-[85vh]">
        {/* ตั้งค่ารูปภาพพื้นหลัง */}
        <div className="absolute inset-0 z-0">
          <img src={heroImage} alt="Yayee Dormitory Building" fetchPriority="high" className="w-full h-full object-cover object-center contrast-[1.1] saturate-[1.1] brightness-[1.05]" onError={(e) => e.currentTarget.src = PLACEHOLDER_IMG} />
          {/* บนมือถือใส่ Overlay สีขาวขุ่นเยอะขึ้นเพื่อให้อ่านตัวอักษรสีเข้มได้ชัด ส่วนบน Desktop ใช้ Gradient เหมือนเดิม */}
          <div className="absolute inset-0 bg-[#FFFDF9]/85 md:bg-transparent"></div>
          <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-[#FFFDF9] via-[#FFFDF9]/90 to-[#FFFDF9]/0 w-[70%] lg:w-[60%]"></div>
        </div>

        <div className="relative z-10 w-full px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="max-w-[600px]">
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#F3E7DD] text-[#8B5E3C] text-xs font-bold tracking-wider mb-6">
              A WARM SANCTUARY
            </div>
            <h1 className="text-[36px] sm:text-5xl md:text-6xl lg:text-[72px] font-extrabold text-[#3A2D23] leading-[1.2] md:leading-[1.1] mb-6 tracking-tight">
              พักที่หยาหยี๋ ชีวิตดีๆ <br />
              เริ่มต้นที่นี่
            </h1>
            <p className="text-[#6D5A4C] text-base md:text-lg mb-10 leading-relaxed font-medium max-w-[480px]">
              ค้นหาที่พักที่ให้ความรู้สึกเหมือนบ้าน ด้วยบรรยากาศที่อบอุ่น การออกแบบที่ใส่ใจ และความปลอดภัยที่เหนือระดับ
            </p>
          </div>
        </div>
      </section>

      {/* ส่วนคุณสมบัติ */}
      <section className="py-14 md:py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#3A2D23] inline-block relative">
            ความสุขที่ออกแบบมาเพื่อคุณ
            <div className="absolute -bottom-3 left-0 w-2/3 h-1 bg-[#8B5E3C] rounded-full"></div>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[160px]">
          {/* ความปลอดภัย */}
          <div className="bg-[#FFF4E5] rounded-[30px] p-8 flex flex-col justify-between col-span-1 md:col-span-1 transition-transform hover:-translate-y-2 hover:shadow-xl duration-300">
            <div className="bg-white/60 w-12 h-12 rounded-full flex items-center justify-center text-[#8B5E3C] text-2xl shadow-sm">
              👮
            </div>
            <div>
              <h3 className="font-bold text-lg mb-1 text-[#3A2D23]">รักษาความปลอดภัย</h3>
              <p className="text-xs text-[#6D5A4C] leading-snug">ดูแลตลอด 24 ชั่วโมง ด้วยกล้องวงจรปิด (CCTV) ทั่วบริเวณ</p>
            </div>
          </div>
          
          {/* เฟอร์นิเจอร์ */}
          <div className="bg-[#FDF0EB] rounded-[30px] p-8 flex flex-col justify-between col-span-1 md:col-span-1 transition-transform hover:-translate-y-2 hover:shadow-xl duration-300">
            <div className="text-3xl mb-4 text-[#8B5E3C]">🛋️</div>
            <div>
              <h3 className="font-bold text-lg text-[#3A2D23] leading-tight mb-2">เฟอร์นิเจอร์ครบ</h3>
              <p className="text-xs text-[#6D5A4C] leading-snug">ชุดเตียงนอน ตู้เสื้อผ้า โต๊ะทำงาน เครื่องทำน้ำอุ่น ตู้เย็น</p>
            </div>
          </div>

          {/* ที่จอดรถ */}
          <div className="bg-[#E4EACD] rounded-[30px] p-8 flex flex-col justify-between col-span-1 md:col-span-1 transition-transform hover:-translate-y-2 hover:shadow-xl duration-300">
            <div className="text-3xl mb-4 text-[#4A5D23] font-bold">🚗</div>
            <div>
              <h3 className="font-bold text-lg text-[#3A2D23] leading-tight mb-1">ที่จอดรถกว้างขวาง</h3>
              <p className="text-xs text-[#4A5D23]/80 leading-snug">มีพื้นที่รองรับสำหรับรถมอเตอร์ไซค์และรถยนต์ภายในหอพัก</p>
            </div>
          </div>

          {/* เครื่องซักผ้า */}
          <div className="bg-[#EAE1D5] rounded-[30px] p-8 flex flex-col justify-center items-center text-center col-span-1 md:col-span-1 transition-transform hover:-translate-y-2 hover:shadow-xl duration-300">
            <div className="bg-[#8B5E3C] text-white w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-3 shadow-md">
              🧺
            </div>
            <h3 className="font-bold text-sm text-[#3A2D23]">เครื่องซักผ้าหยอดเหรียญ<br/>เริ่มต้น 20 บาท</h3>
          </div>

          {/* สถานที่ใกล้เคียง */}
          <div className="bg-[#8B5E3C] rounded-[30px] p-6 md:p-10 flex flex-col justify-center col-span-1 md:col-span-2 text-white relative overflow-hidden transition-transform hover:-translate-y-2 hover:shadow-xl duration-300">
            <div className="relative z-10 w-full md:w-full">
              <h3 className="font-bold text-2xl mb-5">🛣️ สถานที่สำคัญใกล้เคียง</h3>
              <ul className="text-white/90 text-[14px] md:text-[15px] space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0">🚕</span> 
                  <span className="leading-snug">7-11 เดินทางเพียง 2 นาที</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0">🚕</span> 
                  <span className="leading-snug">ตลาดสดเดินทางเพียง 2 นาที</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0">🚕</span> 
                  <span className="leading-snug">มหาวิทยาลัยราชภัฏเชียงใหม่ ศูนย์แม่ริม <span className="inline-block whitespace-nowrap">เดินทาง 5 นาที</span></span>
                </li>
              </ul>
            </div>
            {/* องค์ประกอบตกแต่งพื้นหลัง */}
            <div className="absolute right-[-5%] bottom-[-10%] opacity-10 blur-sm pointer-events-none">
              <span className="text-[180px] leading-none">🚩</span>
            </div>
          </div>
        </div>
      </section>

      {/* ส่วนห้องพัก */}
      <section id="rooms" className="py-14 md:py-20 px-6 lg:px-12 bg-[#FAF7F2]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#3A2D23] inline-block relative mb-2">
                ห้องพักและอัตราค่าเช่า
              </h2>
              <p className="text-[#6D5A4C] text-sm md:text-base mb-4">หอพักหยาหยี๋เปิดให้เช่า พร้อมสิ่งอำนวยความสะดวกครบครัน</p>
              
              <div className="bg-white/60 p-4 md:px-6 md:py-4 rounded-2xl flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#8B5E3C] shadow-sm border border-[#F3E7DD] mb-8 inline-flex">
                <div className="flex items-center gap-2"><span className="text-lg">💧</span> น้ำ 150 บาท/ห้อง</div>
                <div className="flex items-center gap-2"><span className="text-lg">🔥</span> ไฟ 9 บาท/หน่วย</div>
                <div className="flex items-center gap-2"><span className="text-lg">🗑️</span> ขยะ 30 บาท/เดือน</div>
                <div className="flex items-center gap-2"><span className="text-lg">🏦</span> มัดจำประกันห้อง 5,000 บาท</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* ห้องที่ 1 */}
            <div className="bg-white p-4 rounded-[40px] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(139,94,60,0.15)] transition-all duration-300 flex flex-col hover:-translate-y-2">
              <div className="relative h-64 md:h-80 w-full rounded-[30px] overflow-hidden mb-6">
                <img src={airconImage} alt="ห้องแอร์ หอพักหยาหยี๋" className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = PLACEHOLDER_IMG} />
                <div className="absolute top-4 left-4 bg-[#A36A00]/90 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                  AVAILABLE
                </div>
              </div>
              <div className="px-4 pb-2 flex-1 flex flex-col">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-2xl font-extrabold text-[#3A2D23] mb-2">ห้องแอร์</h3>
                    <div className="flex items-center gap-4 text-xs font-semibold text-[#8B5E3C]">
                      <span className="flex items-center gap-1">❄️ แอร์ปรับอากาศ</span>
                      <span className="flex items-center gap-1">🛏️ เฟอร์นิเจอร์</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-extrabold text-[#3A2D23] leading-none mb-1">฿3,500</p>
                    <p className="text-[10px] text-[#A89F95] uppercase tracking-wider font-bold">/ MONTH</p>
                  </div>
                </div>
                
                <Link href="/details_room?type=aircon" className="mt-auto block text-center bg-[#8B5E3C] hover:bg-[#734A2E] text-white py-4 rounded-2xl font-bold transition-colors w-full shadow-md">
                  ดูรายละเอียดและจอง
                </Link>
              </div>
            </div>

            {/* ห้องที่ 2 */}
            <div className="bg-white p-4 rounded-[40px] shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_-15px_rgba(139,94,60,0.15)] transition-all duration-300 flex flex-col hover:-translate-y-2">
              <div className="relative h-64 md:h-80 w-full rounded-[30px] overflow-hidden mb-6">
                <img src={fanImage} alt="ห้องพัดลม หอพักหยาหยี๋" className="w-full h-full object-cover" onError={(e) => e.currentTarget.src = PLACEHOLDER_IMG} />
                <div className="absolute top-4 left-4 bg-[#A36A00]/90 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                  AVAILABLE
                </div>
              </div>
              <div className="px-4 pb-2 flex-1 flex flex-col">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-2xl font-extrabold text-[#3A2D23] mb-2">ห้องพัดลม</h3>
                    <div className="flex items-center gap-4 text-xs font-semibold text-[#8B5E3C]">
                      <span className="flex items-center gap-1">🌀 พัดลม</span>
                      <span className="flex items-center gap-1">🛏️ เฟอร์นิเจอร์</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl sm:text-3xl font-extrabold text-[#3A2D23] leading-none mb-1">฿2,800</p>
                    <p className="text-[10px] text-[#A89F95] uppercase tracking-wider font-bold">/ MONTH</p>
                  </div>
                </div>
                
                <Link href="/details_room?type=fan" className="mt-auto block text-center bg-[#8B5E3C] hover:bg-[#734A2E] text-white py-4 rounded-2xl font-bold transition-colors w-full shadow-md">
                  ดูรายละเอียดและจอง
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ส่วนกระตุ้นการตัดสินใจ */}
      <section id="contact" className="py-14 md:py-20 px-6 lg:px-12">
        <div className="max-w-5xl mx-auto bg-[#8B5E3C] rounded-[40px] md:rounded-[60px] p-10 md:p-20 text-center relative overflow-hidden shadow-2xl">
          {/* รูปทรงเรขาคณิตตกแต่งพื้นหลัง */}
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-black/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
              พร้อมเริ่มต้นบทใหม่ <br />
              ที่แสนอบอุ่นหรือยัง?
            </h2>
            <p className="text-white/80 mb-10 text-sm md:text-base max-w-xl mx-auto">
              เราพร้อมดูแลและให้คำปรึกษา เพื่อให้คุณได้พบกับพื้นที่ที่ใช่ที่สุดสำหรับชีวิตคุณ
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/auth/register" className="bg-white text-[#8B5E3C] hover:bg-[#FDF0EB] px-8 py-4 rounded-full font-bold transition-all shadow-lg text-sm sm:text-base">
                ติดต่อสอบถาม
              </Link>
              <a href={`tel:${contactPhone.split(',')[0].trim()}`} className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 rounded-full font-bold transition-all backdrop-blur-sm text-sm sm:text-base">
                โทร: {contactPhone}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ส่วนท้าย */}
      <footer className="py-12 md:py-16 px-6 lg:px-12 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* แบรนด์ */}
          <div className="lg:pr-8">
            <h3 className="text-[#8B5E3C] font-extrabold text-2xl tracking-tighter mb-6">
              Yayee Dormitory
            </h3>
            <p className="text-[#6D5A4C] text-sm leading-relaxed mb-6">
              การเลือกหอพักไม่ใช่แค่ที่พักอาศัย แต่เป็นพื้นที่แห่งการพักผ่อนและความสุขที่แท้จริง
            </p>
            <div className="flex gap-4">
              <a href={socialFB} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#F3E7DD] text-[#8B5E3C] flex items-center justify-center hover:bg-[#8B5E3C] hover:text-white transition-all">
                FB
              </a>
              <a href={socialIG} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#F3E7DD] text-[#8B5E3C] flex items-center justify-center hover:bg-[#8B5E3C] hover:text-white transition-all">
                IG
              </a>
              <a href={socialLINE} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#F3E7DD] text-[#8B5E3C] flex items-center justify-center hover:bg-[#8B5E3C] hover:text-white transition-all">
                LN
              </a>
            </div>
          </div>

          {/* บริการของเรา */}
          <div>
            <h4 className="font-bold text-[#3A2D23] mb-6 tracking-wider text-xs">OUR SERVICES</h4>
            <ul className="space-y-4 text-sm text-[#6D5A4C]">
              <li><Link href="/#rooms" className="hover:text-[#8B5E3C] transition-colors">ค้นหาห้องพัก</Link></li>
              <li><Link href="/#rooms" className="hover:text-[#8B5E3C] transition-colors">ห้องพักทั้งหมด</Link></li>
              <li><Link href={linkTerms} className="hover:text-[#8B5E3C] transition-colors">เงื่อนไขการเข้าพัก</Link></li>
              <li><Link href="/auth/register" className="hover:text-[#8B5E3C] transition-colors">การจองออนไลน์</Link></li>
            </ul>
          </div>

          {/* ข้อมูลพื้นฐาน */}
          <div>
            <h4 className="font-bold text-[#3A2D23] mb-6 tracking-wider text-xs">INFORMATION</h4>
            <ul className="space-y-4 text-sm text-[#6D5A4C]">
              <li><Link href={linkFAQ} className="hover:text-[#8B5E3C] transition-colors">คำถามที่พบบ่อย</Link></li>
              <li><Link href={linkHelp} className="hover:text-[#8B5E3C] transition-colors">ศูนย์ช่วยเหลือ</Link></li>
              <li><Link href={linkTerms} className="hover:text-[#8B5E3C] transition-colors">ข้อกำหนดการใช้งาน</Link></li>
              <li><Link href={linkPrivacy} className="hover:text-[#8B5E3C] transition-colors">นโยบายความเป็นส่วนตัว</Link></li>
            </ul>
          </div>

          {/* ติดต่อเรา */}
          <div>
            <h4 className="font-bold text-[#3A2D23] mb-6 tracking-wider text-xs">GET IN TOUCH</h4>
            <ul className="space-y-4 text-sm text-[#6D5A4C]">
              <li className="flex items-start">
                <span className="mt-1">📍</span>
                <span className="ml-2 whitespace-pre-line">{contactAddress}</span>
              </li>
              <li className="flex items-start mt-2">
                <span className="mt-1">☎️</span>
                <span className="ml-2">{contactPhone}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-100 text-center text-xs text-gray-400 font-medium">
          © {new Date().getFullYear()} YAYEE DORMITORY. ALL RIGHTS RESERVED.
        </div>
      </footer>
    </div>
  );
}
