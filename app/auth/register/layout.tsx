import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ลงทะเบียนจองห้องพัก",
  description: "สมัครสมาชิกและลงทะเบียนจองห้องพัก Yayee Dormitory กรอกข้อมูลส่วนตัวเพื่อเริ่มต้นการเช่าของคุณ",
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
