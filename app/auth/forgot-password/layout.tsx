import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ลืมรหัสผ่าน",
  description: "กู้คืนรหัสผ่านของคุณสำหรับเข้าระบบ Yayee Dormitory",
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
