import { Metadata } from "next";

export const metadata: Metadata = {
  title: "รายละเอียดห้องพัก",
  description: "ดูรายละเอียดห้องพัก สิ่งอำนวยความสะดวก และอัตราค่าเช่าของ Yayee Dormitory",
};

export default function RoomDetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
