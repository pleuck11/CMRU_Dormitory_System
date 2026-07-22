"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import SplashScreen from "@/components/SplashScreen";

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  emailVerified: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  emailVerified: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // ยกเลิก listener Firestore เดิมก่อนเมื่อ user เปลี่ยน
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }

      setUser(currentUser);
      setEmailVerified(currentUser?.emailVerified ?? false);

      if (currentUser) {
        // ใช้ onSnapshot เพื่อ real-time sync role จาก Firestore
        // ทำให้เมื่อ dev เปลี่ยน role ใน Firebase Console โดยตรง ระบบจะรับรู้ทันที
        const docRef = doc(db, "users", currentUser.uid);
        unsubscribeFirestore = onSnapshot(
          docRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const fetchedRole = docSnap.data().role || "tenant";
              setRole(fetchedRole);
            } else {
              setRole("tenant");
            }
            setLoading(false);
          },
          (error) => {
            // กลืน permission-denied เงียบๆ — เกิดได้ขณะ Firebase token กำลัง propagate
            if (error?.code !== "permission-denied") {
              console.warn("เกิดข้อผิดพลาดในการดึงข้อมูล role ของผู้ใช้:", error);
            }
            setRole("tenant");
            setLoading(false);
          }
        );
      } else {
        setRole(null);
        setEmailVerified(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, emailVerified }}>
      <SplashScreen isVisible={loading} />
      {children}
    </AuthContext.Provider>
  );
}
