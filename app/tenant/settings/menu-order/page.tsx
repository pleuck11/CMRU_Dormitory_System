"use client";

import { useEffect, useState } from "react";
import { GripVertical, Save, RefreshCw, Check, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MenuOrderSettings() {
  const router = useRouter();
  const defaultOrder = ["dashboard", "room", "chat", "bills_payments", "repair", "settings"];
  const [menuOrder, setMenuOrder] = useState<string[]>(defaultOrder);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedOrder = localStorage.getItem("tenantMenuOrder");
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        if (Array.isArray(parsed) && parsed.length === 6) {
          setMenuOrder(parsed);
        }
      } catch (e) {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("tenantMenuOrder", JSON.stringify(menuOrder));
    setIsSaved(true);
    // แจ้งเตือน Layout ให้อัปเดตเมนูทันที
    window.dispatchEvent(new Event("tenantMenuOrderChanged"));
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReset = () => {
    setMenuOrder(defaultOrder);
    localStorage.setItem("tenantMenuOrder", JSON.stringify(defaultOrder));
    window.dispatchEvent(new Event("tenantMenuOrderChanged"));
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.style.opacity = "0.5";
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!draggedItem || draggedItem === id) return;

    const newOrder = [...menuOrder];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const overIndex = newOrder.indexOf(id);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(overIndex, 0, draggedItem);
    setMenuOrder(newOrder);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) e.target.style.opacity = "1";
    setDraggedItem(null);
  };

  const getMenuLabel = (id: string) => {
    switch (id) {
      case "dashboard": return "แดชบอร์ด";
      case "room": return "จองห้องพัก";
      case "chat": return "แชทกับผู้ดูแล";
      case "bills_payments": return "ยอดชำระและบิล";
      case "repair": return "แจ้งซ่อม";
      case "settings": return "ตั้งค่า";
      default: return id;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-4 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">
          จัดการลำดับเมนู
        </h1>
      </div>

      <div className="glass-panel p-6 rounded-3xl space-y-6">
        <div>
          <p className="text-sm text-[var(--text-muted)]">คลิกค้างแล้วลากเพื่อปรับเปลี่ยนลำดับเมนูด้านซ้าย</p>
        </div>

        <div className="space-y-2">
          {menuOrder.map((id) => (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--glass-border)] bg-white shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors"
            >
              <GripVertical className="text-slate-400" size={20} />
              <span className="font-medium text-[var(--text-main)]">{getMenuLabel(id)}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleReset}
            className="flex-1 py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={18} />
            คืนค่าเริ่มต้น
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 rounded-xl font-medium text-white transition-all duration-300 shadow-md ${
              isSaved ? "bg-green-500 hover:bg-green-600" : "bg-[var(--accent-brown)] hover:bg-[#8B5E3C]"
            }`}
          >
            {isSaved ? <Check size={18} /> : <Save size={18} />}
            {isSaved ? "บันทึกแล้ว" : "บันทึกลำดับ"}
          </button>
        </div>
      </div>
    </div>
  );
}
