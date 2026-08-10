# 🎨 Yayee Dormitory — Design System & Style Guide

คู่มือสำหรับสร้างหน้าใหม่ให้มีสไตล์เป็นธีมเดียวกันทั้งระบบ

---

## 1. Color Palette (CSS Variables)

ตัวแปรสีทั้งหมดถูกนิยามใน `app/globals.css` และใช้งานผ่าน `var(--name)`

| Variable | Value | ใช้สำหรับ |
|---|---|---|
| `--bg-color` | `#F9F2ED` | พื้นหลังทั้งหน้า |
| `--text-main` | `#000000` | ข้อความหลัก |
| `--text-muted` | `#888888` | ข้อความรอง / placeholder |
| `--glass-bg` | `rgba(255,255,255,0.4)` | พื้น glass panel |
| `--glass-border` | `#E3E3E3` | เส้นขอบ glass |
| `--glass-highlight` | `rgba(255,255,255,0.8)` | แสงสะท้อนด้านบน |
| `--accent-brown` | `#C67C4E` | สีหลัก (ปุ่ม, active, accent) |
| `--accent-light` | `#EDD6C8` | สีอ่อนของ brown (badge, bg อ่อน) |
| `--accent-dark` | `#A6653E` | สีเข้มของ brown (hover, gradient end) |
| `--shadow-color` | `rgba(49,49,49,0.08)` | เงา |

> ห้ามใช้สีแบบ hardcode (เช่น text-gray-600, bg-orange-400) ถ้ามีตัวแปรรองรับแล้ว ให้ใช้ var() แทน

---

## 2. Typography

- Font: Kanit (Google Fonts) — ถูก inject ผ่าน next/font ใน app/layout.tsx
- Class: font-sans (map ไปยัง Kanit อัตโนมัติ)
- ภาษา: ข้อความในระบบเป็นภาษาไทยเป็นหลัก

### ขนาดข้อความมาตรฐาน

`
h1 (ชื่อหน้า)        : text-3xl font-bold tracking-tight
h2 (หัวข้อ section)  : text-lg font-bold
h3 (หัวข้อ group)    : text-[11px] font-bold uppercase tracking-wider
ข้อความปกติ          : text-sm หรือ text-[15px] font-medium
ข้อความรอง           : text-sm text-[var(--text-muted)]
Badge / Label เล็ก   : text-xs font-semibold
`

---

## 3. Glass Morphism Utility Classes

ทั้งหมดนิยามใน app/globals.css ใช้ได้เลยโดยไม่ต้องเขียน CSS เพิ่ม

### .glass-panel
การ์ด / panel หลัก — มี backdrop blur, เส้นขอบ, เงา และ hover lift
`jsx
<div className="glass-panel rounded-3xl p-6">...</div>
`

### .glass-panel-solid
สำหรับ sidebar / drawer บนมือถือที่ต้องการพื้นหลังทึบ
`jsx
<aside className="glass-panel-solid">...</aside>
`

### .glass-input
Input field — blur เบาๆ, focus แสดงขอบ accent-brown พร้อม glow
`jsx
<input className="glass-input w-full px-4 py-3" />
`

### .glass-button
ปุ่มหลัก — gradient น้ำตาล, hover ลอยขึ้น + glow pulse
`jsx
<button className="glass-button px-6 py-2.5 rounded-lg font-bold">บันทึก</button>
`

### .glass-button-outline
ปุ่มรอง — พื้นขาวโปร่งแสง, ขอบ accent-light
`jsx
<button className="glass-button-outline px-6 py-2.5 rounded-lg font-semibold">ยกเลิก</button>
`

### .liquid-hover
Effect แสงวาบเวลา hover (shimmer sweep)
`jsx
<div className="liquid-hover glass-panel rounded-2xl p-4">...</div>
`

---

## 4. Border Radius Convention

| ขนาด | Class | ใช้กับ |
|---|---|---|
| ใหญ่ | rounded-3xl | การ์ด, panel, modal, กล่องเมนู |
| กลาง | rounded-2xl | ปุ่มใน modal, รายการในเมนู, icon wrapper |
| เล็ก | rounded-xl | icon badge, nav item active, input |
| ปุ่ม | rounded-lg | ปุ่มทั่วไป (glass-button) |
| กลม | rounded-full | badge, avatar, dot indicator |

---

## 5. Spacing & Layout

### Page Content Wrapper
`jsx
<div className="space-y-8">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">ชื่อหน้า</h1>
      <p className="text-[var(--text-muted)] mt-1">คำอธิบายสั้นๆ</p>
    </div>
  </div>
</div>
`

### Grid System
`jsx
{/* 4 คอลัมน์สำหรับสถิติ */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

{/* 2 คอลัมน์ (content + sidebar) */}
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">...</div>
  <div>...</div>
</div>
`

### Padding มาตรฐาน
- ภายใน card: p-5 หรือ p-6
- Card header: px-6 py-5
- ปุ่มหลัก: px-4 py-2.5 หรือ px-6 py-3

---

## 6. Component Patterns

### Stat Card
`jsx
<div className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
  <div className="flex items-center justify-between relative z-10">
    <p className="text-sm font-medium text-[var(--text-muted)]">ชื่อสถิติ</p>
    <div className="p-3 rounded-2xl shadow-sm border border-white/50 bg-amber-50 text-amber-600">
      {/* icon */}
    </div>
  </div>
  <div className="mt-4 flex items-baseline gap-2 relative z-10">
    <span className="text-3xl font-bold text-[var(--text-main)] tracking-tight">ค่า</span>
  </div>
</div>
`

### Action List Item (clickable row)
`jsx
<Link href="/path" className="w-full flex items-center justify-between p-4 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--accent-brown)] bg-white/40 hover:bg-white/70 transition-all group shadow-sm hover:shadow-md">
  <div className="flex items-center gap-4">
    <div className="p-2.5 rounded-xl border shadow-sm bg-amber-50 border-amber-100 text-amber-600">
      {/* icon */}
    </div>
    <span className="text-[15px] font-bold text-[var(--text-main)] group-hover:text-[var(--accent-dark)] transition-colors">ชื่อ</span>
  </div>
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
</Link>
`

### Status Badge
`jsx
{/* สำเร็จ */}
<span className="px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-emerald-50/80 text-emerald-700 border-emerald-200">สำเร็จ</span>

{/* รอดำเนินการ */}
<span className="px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-amber-50/80 text-amber-700 border-amber-200">รอดำเนินการ</span>

{/* กำลังดำเนินการ */}
<span className="px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-blue-50/80 text-blue-700 border-blue-200">กำลังดำเนินการ</span>

{/* ปฏิเสธ */}
<span className="px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm bg-red-50/80 text-red-700 border-red-200">ปฏิเสธ</span>
`

### Panel Header
`jsx
<div className="px-6 py-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-white/30 backdrop-blur-md">
  <h3 className="text-lg font-bold text-[var(--text-main)]">ชื่อหัวข้อ</h3>
  <Link href="/path" className="text-sm font-semibold text-[var(--accent-dark)] hover:text-[var(--accent-brown)] transition-colors">ดูทั้งหมด</Link>
</div>
`

### Loading Spinner
`jsx
<div className="flex justify-center items-center py-16">
  <div className="w-10 h-10 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin"></div>
</div>
`

### Empty State
`jsx
<div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-4">
    {/* icon */}
  </svg>
  <p className="font-medium text-lg">ไม่มีข้อมูล</p>
</div>
`

### Modal (Confirmation)
`jsx
<div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
  <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
    <div className="p-6">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        {/* icon */}
      </div>
      <h3 className="text-lg font-bold text-center text-[var(--text-main)] mb-1">ยืนยัน?</h3>
      <p className="text-sm text-center text-[var(--text-muted)] mb-6">คำอธิบาย</p>
      <div className="flex gap-3">
        <button className="flex-1 py-3 rounded-2xl font-semibold text-sm border border-[var(--glass-border)] bg-white text-[var(--text-muted)]">ยกเลิก</button>
        <button className="flex-1 py-3 rounded-2xl font-semibold text-sm bg-red-500 text-white shadow-md">ยืนยัน</button>
      </div>
    </div>
  </div>
</div>
`

### Table (Responsive — card on mobile, table on desktop)
`jsx
<table className="w-full text-sm text-left border-collapse block md:table">
  <thead className="text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] hidden md:table-header-group">
    <tr>
      <th className="px-6 py-4 font-semibold">คอลัมน์</th>
    </tr>
  </thead>
  <tbody className="block md:table-row-group p-4 md:p-0">
    <tr className="block md:table-row bg-white/40 md:bg-transparent border border-[var(--glass-border)] md:border-0 md:border-b mb-4 md:mb-0 rounded-2xl md:rounded-none p-4 md:p-0 hover:bg-white/60 transition-colors shadow-sm md:shadow-none">
      <td className="flex md:table-cell items-center justify-between md:px-6 md:py-4 mb-3 md:mb-0">
        <span className="md:hidden text-xs font-semibold text-[var(--text-muted)]">คอลัมน์:</span>
        <span>ค่า</span>
      </td>
    </tr>
  </tbody>
</table>
`

---

## 7. Animation Classes

| Class | Effect |
|---|---|
| .page-enter | หน้า slide up + fade in |
| .animate-fade-in | fade in เบาๆ |
| .animate-scale-in | scale + fade (modal) |
| .delay-100 / .delay-200 / .delay-300 | หน่วงอนิเมชัน |
| .orb-float-1/2/3 | ก้อนแสงลอย |

---

## 8. Icon Convention

- ใช้ inline SVG เป็นหลัก (ยกเว้น lucide-react สำหรับบางกรณี)
- ขนาด nav: width="20" height="20"
- ขนาด bottom nav: width="22" height="22"
- ขนาดปุ่ม: width="18" height="18"
- สไตล์มาตรฐาน: fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"

---

## 9. Mobile-First Responsive Pattern

ระบบใช้ Tailwind breakpoint md: เป็นหลัก (≥ 768px = desktop)

- mobile → ค่าปกติ (ไม่มี prefix)
- desktop → md: prefix

Bottom Navigation (mobile): md:hidden fixed bottom-6 left-4 right-4 glass-panel !rounded-[2rem]
Sidebar (desktop): hidden md:flex flex-col w-72 glass-panel sticky top-0 h-screen

Safe area สำหรับ notch/home indicator:
`
style={{ bottom: calc(24px + env(safe-area-inset-bottom)) }}
style={{ paddingTop: calc(env(safe-area-inset-top, 0px) + 16px) }}
`

---

## 10. File Structure Convention

`
app/
  admin/
    layout.tsx              — Layout + Sidebar + Bottom Nav (admin)
    [feature]/
      page.tsx              — "use client" + Firebase logic + UI
      history_[feature]/
        page.tsx            — หน้าประวัติของ feature นั้น
  tenant/
    layout.tsx              — Layout + Bottom Nav (tenant)
    [feature]/
      page.tsx
  auth/
    login/page.tsx
    register/page.tsx
  globals.css               — Design system ทั้งหมด
  layout.tsx                — Root layout + Font + Meta

components/
  AuthProvider.tsx          — useAuth() hook
  NotificationProvider.tsx  — Context สำหรับ toast notifications
  ToastContainer.tsx        — แสดง toast
  PageTransition.tsx        — Wrap children ด้วย animation
  SplashScreen.tsx          — Loading screen ตอนเปิดแอป

lib/
  firebase.ts               — Firebase config + exports (db, auth, storage)
`

---

## 11. Naming & Code Convention

- File names: kebab-case เช่น history-tenants, snake_case สำหรับโฟลเดอร์ เช่น manage_tenants
- Component names: PascalCase เช่น AdminDashboard, TenantLayout
- "use client" — ใส่ทุกไฟล์ที่ใช้ useState, useEffect, Firebase client SDK
- Firebase import: import { db, auth, storage } from "@/lib/firebase"
- Auth guard: ทำใน useEffect ร่วมกับ useAuth() จาก AuthProvider

---

## 12. Checklist ก่อน Push หน้าใหม่

- [ ] ใช้ glass-panel, glass-button, glass-input ตาม pattern
- [ ] ทุกการ์ดใช้ rounded-3xl, ปุ่มใช้ rounded-lg หรือ rounded-2xl
- [ ] สีใช้ CSS variable (var(--accent-brown) ฯลฯ) ไม่ hardcode
- [ ] มี loading state (spinner) และ empty state (icon + ข้อความ)
- [ ] Responsive ทำงานถูกต้องบนมือถือด้วย md: breakpoint
- [ ] ข้อความ/คอมเมนต์ในโค้ดเป็นภาษาไทย
- [ ] ใส่ "use client" ถ้าใช้ hook หรือ Firebase
