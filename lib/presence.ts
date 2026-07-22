/**
 * presence.ts — ระบบ Online/Offline Status โดยใช้ Firebase Realtime Database
 *
 * ทำไมถึงใช้ RTDB แทน Firestore:
 * - RTDB มี .onDisconnect() ที่ Firebase Server จัดการเองเมื่อ TCP connection หลุด
 * - ไม่ต้องใช้ heartbeat polling = 0 unnecessary writes
 * - ข้อมูลไม่สะสมถาวร — เป็นแค่สถานะ live ณ ขณะนั้น
 */

import {
  ref,
  set,
  onValue,
  onDisconnect,
  serverTimestamp,
  query,
  orderByChild,
  equalTo,
} from "firebase/database";
import { rtdb } from "@/lib/firebase";

/**
 * เริ่ม broadcast presence (เรียกเมื่อ user เปิดหน้าแชท)
 * คืนค่า cleanup function สำหรับ useEffect
 */
export function startPresence(uid: string, role: string): () => void {
  const presenceRef = ref(rtdb, `presence/${uid}`);

  // 1. ตั้งค่าให้ Firebase Server set offline อัตโนมัติเมื่อ disconnect
  onDisconnect(presenceRef).set({
    online: false,
    role,
    lastSeen: serverTimestamp(),
  });

  // 2. Set online ทันที
  set(presenceRef, {
    online: true,
    role,
    lastSeen: serverTimestamp(),
  });

  // 3. Handle visibilitychange (tab hidden/shown)
  const handleVisibilityChange = () => {
    if (document.hidden) {
      set(presenceRef, { online: false, role, lastSeen: serverTimestamp() });
    } else {
      // ตั้ง onDisconnect ใหม่เสมอหลัง reconnect
      onDisconnect(presenceRef).set({ online: false, role, lastSeen: serverTimestamp() });
      set(presenceRef, { online: true, role, lastSeen: serverTimestamp() });
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Cleanup: set offline + ลบ listener
  return () => {
    set(presenceRef, { online: false, role, lastSeen: serverTimestamp() });
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

/**
 * Subscribe สถานะ online ของ admin ทุกคน (ใช้ฝั่ง tenant)
 * คืน true ถ้ามี admin online อยู่สักคน
 */
export function subscribeAnyAdminPresence(
  onChange: (isOnline: boolean, lastSeen?: Date) => void
): () => void {
  const presenceRef = ref(rtdb, "presence");

  const unsubscribe = onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) {
      onChange(false);
      return;
    }

    let anyOnline = false;
    let latestSeen: Date | undefined;

    snapshot.forEach((child) => {
      const data = child.val();
      if (data?.role === "admin" && data?.online === true) {
        anyOnline = true;
        // lastSeen จาก RTDB เป็น timestamp (ms)
        if (data.lastSeen) {
          const d = new Date(data.lastSeen);
          if (!latestSeen || d > latestSeen) latestSeen = d;
        }
      }
    });

    onChange(anyOnline, latestSeen);
  }, () => onChange(false));

  return unsubscribe;
}

/**
 * Subscribe สถานะ online ของ tenant คนใดคนหนึ่ง (ใช้ฝั่ง admin)
 */
export function subscribeTenantPresence(
  tenantUid: string,
  onChange: (isOnline: boolean, lastSeen?: Date) => void
): () => void {
  const presenceRef = ref(rtdb, `presence/${tenantUid}`);

  const unsubscribe = onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) { onChange(false); return; }
    const data = snapshot.val();
    const lastSeen = data.lastSeen ? new Date(data.lastSeen) : undefined;
    onChange(data.online === true, lastSeen);
  }, () => onChange(false));

  return unsubscribe;
}
