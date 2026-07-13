"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // ใช้ข้อมูลแคช (Cache) ก่อนเพื่อเพิ่มความเร็วตอนโหลดหน้าใหม่
        const cachedRole = sessionStorage.getItem(`userRole_${currentUser.uid}`);
        if (cachedRole) {
          setRole(cachedRole);
          setLoading(false); // ได้ข้อมูล Role แล้ว หยุดสถานะโหลดทันที
        }

        try {
          // ดึงข้อมูล Role จาก Firestore เบื้องหลัง (หรือถ้าไม่มีข้อมูลในแคช)
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const fetchedRole = docSnap.data().role || "tenant";
            setRole(fetchedRole);
            sessionStorage.setItem(`userRole_${currentUser.uid}`, fetchedRole);
          } else {
            setRole("tenant"); // ค่าเริ่มต้น
            sessionStorage.setItem(`userRole_${currentUser.uid}`, "tenant");
          }
        } catch (error: any) {
          // กลืน permission-denied เงียบๆ — เกิดได้ขณะ Firebase token กำลัง propagate
          if (error?.code !== "permission-denied") {
            console.warn("เกิดข้อผิดพลาดในการดึงข้อมูล role ของผู้ใช้:", error);
          }
          if (!cachedRole) setRole("tenant");
        }
      } else {
        setRole(null);
        sessionStorage.clear(); // ล้างแคช Role ตอนผู้ใช้ล็อกเอาท์
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
