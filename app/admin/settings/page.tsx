"use client";

import Link from "next/link";

const SETTING_GROUPS = [
  {
    title: "การตั้งค่าเว็บไซต์",
    items: [
      {
        id: "finance",
        label: "การเงินและค่าธรรมเนียม",
        desc: "ตั้งค่าเรทค่าน้ำ ค่าไฟ และค่าปรับต่างๆ",
        href: "/admin/settings/finance",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
        color: "bg-blue-500 text-white",
      },
      {
        id: "contact",
        label: "การติดต่อ & โซเชียลมีเดีย",
        desc: "จัดการเบอร์โทรศัพท์ ที่อยู่ และช่องทางโซเชียล",
        href: "/admin/settings/contact",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
        color: "bg-emerald-500 text-white",
      },
      {
        id: "display",
        label: "การแสดงผลเว็บไซต์",
        desc: "จัดการรูปภาพหน้าปกและแกลเลอรีต่างๆ",
        href: "/admin/settings/display",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>,
        color: "bg-purple-500 text-white",
      },
      {
        id: "policy",
        label: "นโยบายและการช่วยเหลือ",
        desc: "จัดการลิงก์คำถามที่พบบ่อยและศูนย์ช่วยเหลือ",
        href: "/admin/settings/policy",
        icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
        color: "bg-gray-500 text-white",
      },
    ]
  }
];

export default function SettingsMenuPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">การตั้งค่า</h1>
        <p className="text-gray-500 mt-1">จัดการข้อมูลพื้นฐานและการทำงานของระบบ</p>
      </div>

      <div className="space-y-6">
        {SETTING_GROUPS.map((group, gIdx) => (
          <section key={gIdx}>
            {/* Group Title */}
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
              {group.title}
            </h2>
            
            {/* List Menu Container */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-50">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors group relative"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${item.color}`}>
                    <div className="scale-[0.8]">{item.icon}</div>
                  </div>
                  
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[17px] font-semibold text-gray-900 truncate">
                      {item.label}
                    </h3>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  
                  {/* Right Arrow */}
                  <div className="text-gray-300 group-hover:text-gray-400 group-hover:translate-x-1 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
