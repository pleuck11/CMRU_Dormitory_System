"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser, sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

interface Profile {
  email: string;
  phone: string;
}

interface Room {
  roomNumber: string;
  building: string;
}

export default function TenantProfile() {

  const [profile, setProfile] = useState<Profile | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [phone, setPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const auth = getAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {

      const user = auth.currentUser;
      if (!user) return;

      // ดึงข้อมูลโปรไฟล์จาก users
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Profile;
        setProfile(data);
        setPhone(data.phone ?? "");
      }

      // ดึงข้อมูลห้องจาก rooms (เหมือนแดชบอร์ด)
      const roomQuery = query(
        collection(db, "rooms"),
        where("tenantId", "==", user.uid)
      );
      const roomSnapshot = await getDocs(roomQuery);
      roomSnapshot.forEach((d) => {
        setRoom(d.data() as Room);
      });
    };

    fetchProfile();
  }, []);

  const handleForgotPassword = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) return;

    try {
      await sendPasswordResetEmail(auth, user.email);
      toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบอีเมลหรือกล่องจดหมายสแปม");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast.error("เกิดข้อผิดพลาดในการส่งลิงก์รีเซ็ตรหัสผ่าน");
    }
  };

  // อัปเดตเบอร์โทร
  const updatePhone = async () => {

    const user = auth.currentUser;
    if (!user) return;

    const docRef = doc(db, "users", user.uid);

    await updateDoc(docRef, {
      phone: phone
    });

    setEditingPhone(false);

    toast.success("อัปเดตเบอร์โทรสำเร็จ");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast.error("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    if (newPassword.length < 6) {
      toast.warning("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }

    const user = auth.currentUser;
    if (!user || !user.email) return;

    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setIsChangingPassword(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error("รหัสผ่านเดิมไม่ถูกต้อง");
      } else {
        toast.error("เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน");
      }
    }
  };

  // ลบโปรไฟล์
  const handleDeleteProfile = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบโปรไฟล์? การกระทำนี้ไม่สามารถย้อนกลับได้ ห้องพักและข้อมูลส่วนตัวของคุณจะถูกลบออกจากระบบ (แต่ผู้ดูแลระบบจะยังคงเห็นประวัติของคุณ)")) {
      return;
    }

    try {
      // ลบแบบอ้อมใน Firestore (Soft delete)
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: new Date(),
        tenantStatus: "moved_out" // ตรวจสอบให้แน่ใจว่าได้ระบุสถานะว่าย้ายออกแล้วด้วย
      });

      // แต่เราต้องเคลียร์ห้องด้วยถ้าเค้ายังอยู่
      if (room) {
         const roomQuery = query(collection(db, "rooms"), where("tenantId", "==", user.uid));
         const roomSnapshot = await getDocs(roomQuery);
         roomSnapshot.forEach(async (d) => {
            await updateDoc(doc(db, "rooms", d.id), {
               status: "ว่าง",
               tenantId: null
            });
         });
      }

      // ลบ account จาก authentication จริงๆ
      await deleteUser(user);
      
      toast.success("ลบโปรไฟล์และบัญชีสำเร็จ");
      router.push("/auth/login");
    } catch (error: any) {
      console.error("Error deleting profile:", error);
      if (error.code === 'auth/requires-recent-login') {
         toast.warning("กรุณาออกจากระบบและเข้าสู่ระบบใหม่อีกครั้งก่อนทำการลบบัญชี");
      } else {
         toast.error("เกิดข้อผิดพลาดในการลบโปรไฟล์");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 p-4 md:p-8">

      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-white/60 transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)]"
          aria-label="ย้อนกลับ"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">
          โปรไฟล์ผู้เช่า
        </h1>
      </div>

      {profile && (
        <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6 relative overflow-hidden">
          {/* วงกลมตกแต่ง */}
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-[var(--accent-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-40 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-4 text-[var(--text-main)]">
            <p className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 bg-white/40 rounded-xl border border-[var(--glass-border)]">
              <b className="w-24 text-[var(--accent-dark)]">Email:</b> 
              <span className="font-medium">{profile.email}</span>
            </p>

            <p className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 p-3 bg-white/40 rounded-xl border border-[var(--glass-border)]">
              <b className="w-24 text-[var(--accent-dark)]">ห้องพัก:</b>
              <span className="font-medium bg-emerald-100/80 text-emerald-800 px-3 py-1 rounded-lg text-sm">
                {room ? `ตึก ${room.building} ห้อง ${room.roomNumber}` : "ยังไม่มีห้องพัก"}
              </span>
            </p>

            {/* เบอร์โทร */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white/40 rounded-xl border border-[var(--glass-border)]">
              <b className="w-24 text-[var(--accent-dark)] mt-1 sm:mt-0">เบอร์โทร:</b>

              {!editingPhone ? (
                <div className="flex flex-1 items-center justify-between">
                  <span className="font-medium">{phone}</span>

                  <button
                    onClick={() => setEditingPhone(true)}
                    className="glass-button-outline px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-white"
                  >
                    แก้ไข
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="glass-input px-3 py-1.5 rounded-lg text-sm border-slate-300 w-full sm:w-auto flex-1"
                    placeholder="ใส่เบอร์โทรศัพท์"
                  />

                  <button
                    onClick={updatePhone}
                    className="glass-button px-4 py-1.5 rounded-lg text-sm font-medium"
                  >
                    บันทึก
                  </button>

                  <button
                    onClick={() => {
                      setEditingPhone(false);
                      if (profile) setPhone(profile.phone);
                    }}
                    className="px-4 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                </div>
              )}
            </div>
            
            <div className="pt-6 mt-6 border-t border-[var(--glass-border)]">
              {!isChangingPassword ? (
                 <button
                   onClick={() => setIsChangingPassword(true)}
                   className="w-full sm:w-auto flex justify-center py-2.5 px-6 rounded-lg text-sm font-semibold glass-button-outline border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                 >
                   เปลี่ยนรหัสผ่านใหม่
                 </button>
              ) : (
                 <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                   <h3 className="text-lg font-bold text-[var(--accent-brown)]">เปลี่ยนรหัสผ่าน</h3>
                   
                   <div>
                     <label className="block text-sm font-medium mb-1">รหัสผ่านเดิม</label>
                     <input
                       type="password"
                       required
                       value={oldPassword}
                       onChange={(e) => setOldPassword(e.target.value)}
                       className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium mb-1">รหัสผ่านใหม่</label>
                     <input
                       type="password"
                       required
                       minLength={6}
                       value={newPassword}
                       onChange={(e) => setNewPassword(e.target.value)}
                       className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                     />
                   </div>

                   <div>
                     <label className="block text-sm font-medium mb-1">ยืนยันรหัสผ่านใหม่</label>
                     <input
                       type="password"
                       required
                       minLength={6}
                       value={confirmNewPassword}
                       onChange={(e) => setConfirmNewPassword(e.target.value)}
                       className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                     />
                   </div>

                   <div className="text-right">
                     <button
                       type="button"
                       onClick={handleForgotPassword}
                       className="text-xs text-[var(--accent-brown)] hover:text-[var(--accent-dark)] underline transition-colors inline-block"
                     >
                       ลืมรหัสผ่านเดิมและต้องการรีเซ็ต?
                     </button>
                   </div>

                   <div className="flex gap-2 pt-2">
                     <button
                       type="submit"
                       className="flex-1 glass-button px-4 py-2 bg-[var(--accent-brown)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--accent-dark)] transition-colors shadow-sm"
                     >
                       ยืนยันการเปลี่ยน
                     </button>
                     <button
                       type="button"
                       onClick={() => {
                          setIsChangingPassword(false);
                          setOldPassword("");
                          setNewPassword("");
                          setConfirmNewPassword("");
                       }}
                       className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors"
                     >
                       ยกเลิก
                     </button>
                   </div>
                 </form>
              )}
            </div>
            
            <div className="pt-4 pb-2 space-y-3">

              <button
                onClick={handleDeleteProfile}
                className="w-full sm:w-auto flex justify-center py-2.5 px-6 rounded-lg text-sm font-semibold bg-red-600 outline-none hover:bg-red-700 text-white shadow-md transition-colors"
              >
                ลบโปรไฟล์บัญชีผู้ใช้
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}