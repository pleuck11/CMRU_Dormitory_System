// Simple event-based toast system — ไม่ต้องใช้ Context/Provider
// ใช้งาน: import { toast } from "@/lib/toast"
//          toast.success("บันทึกสำเร็จ")
//          toast.error("เกิดข้อผิดพลาด")
//          toast.warning("กรุณากรอกข้อมูล")
//          toast.info("ข้อมูล")

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastEvent {
  id: string;
  message: string;
  type: ToastType;
}

const EVENT_NAME = "app:toast";

function emit(message: string, type: ToastType) {
  if (typeof window === "undefined") return;
  const id = Math.random().toString(36).slice(2);
  window.dispatchEvent(new CustomEvent<ToastEvent>(EVENT_NAME, { detail: { id, message, type } }));
}

export const toast = {
  success: (message: string) => emit(message, "success"),
  error: (message: string) => emit(message, "error"),
  warning: (message: string) => emit(message, "warning"),
  info: (message: string) => emit(message, "info"),
};

export { EVENT_NAME };
