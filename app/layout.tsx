import type { Metadata, Viewport } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const kanit = Kanit({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["latin", "thai"],
  variable: "--font-kanit",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#C67C4E",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://yayee-dorm.vercel.app"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Yayee Dorm",
  },
  title: {
    template: "%s | Yayee Dormitory",
    default: "Yayee Dormitory Management System",
  },
  description: "ระบบบริหารจัดการหอพักหยาหยี๋ออนไลน์ ค้นหาที่พักที่ให้ความรู้สึกเหมือนบ้าน ด้วยบรรยากาศที่อบอุ่น ร่มรื่น และปลอดภัย",
  keywords: ["หอพัก", "หอยาหยี๋", "ที่พักเปิดใหม่", "ที่พักแม่ริม", "หอพักแม่ริม", "หอพักใกล้มหาวิทยาลัยราชภัฏเชียงใหม่ แม่ริม", "yayee dormitory"],
  authors: [{ name: "Yayee Dormitory" }],
  openGraph: {
    title: "Yayee Dormitory Management System",
    description: "ระบบบริหารจัดการหอพักหยาหยี๋ออนไลน์ ค้นหาที่พักที่ให้ความรู้สึกเหมือนบ้าน ด้วยบรรยากาศที่อบอุ่น",
    url: "/",
    siteName: "Yayee Dormitory",
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yayee Dormitory Management System",
    description: "ระบบบริหารจัดการหอพักหยาหยี๋ออนไลน์ ค้นหาที่พักที่ให้ความรู้สึกเหมือนบ้าน",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${kanit.variable} font-sans antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
