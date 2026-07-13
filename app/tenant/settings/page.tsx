import Link from "next/link";
import { ListOrdered } from "lucide-react";

export default function TenantSettings() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-center gap-3 mb-2">
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight text-center">
          ตั้งค่า
        </h1>
      </div>

      <div className="glass-panel p-2 rounded-3xl space-y-2">
        <Link
          href="/tenant/profile"
          className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--accent-brown)]/10 text-[var(--accent-brown)] flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--text-main)]">ข้อมูลส่วนตัว</h3>
            <p className="text-sm text-[var(--text-muted)]">จัดการข้อมูลส่วนตัวและรหัสผ่าน</p>
          </div>
          <div className="text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </Link>

        {/* เมนูจัดการลำดับเมนู */}
        <Link
          href="/tenant/settings/menu-order"
          className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-[var(--accent-brown)]/10 text-[var(--accent-brown)] flex items-center justify-center flex-shrink-0">
            <ListOrdered size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-[var(--text-main)]">จัดการลำดับเมนู</h3>
            <p className="text-sm text-[var(--text-muted)]">ปรับเปลี่ยนลำดับเมนูด้านซ้ายตามที่คุณต้องการ</p>
          </div>
          <div className="text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}
