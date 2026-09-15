import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  const admin = await verifyAdminToken(request);
  if (!admin) {
    return NextResponse.json(
      { error: "Unauthorized: คุณไม่มีสิทธิ์ในการลบรูปภาพนี้" },
      { status: 403 }
    );
  }

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "ไม่พบ URL ของรูปภาพที่ต้องการลบ" }, { status: 400 });
    }

    // ตรวจสอบว่าเป็น URL ของ Vercel Blob จริงๆ (ป้องกันการลบลิงก์ภายนอก)
    if (!url.includes("public.blob.vercel-storage.com")) {
      return NextResponse.json({ error: "URL ไม่ถูกต้อง" }, { status: 400 });
    }

    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting blob image:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการลบรูป: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
