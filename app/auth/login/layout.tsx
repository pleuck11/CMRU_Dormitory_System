import { Metadata } from "next";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "เข้าสู่ระบบ Yayee Dormitory Management System เพื่อจัดการข้อมูลการเช่า บิลชำระเงิน และแจ้งซ่อม",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
