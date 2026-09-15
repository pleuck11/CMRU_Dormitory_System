import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import { verifyAuthToken } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuthToken(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: กรุณาเข้าสู่ระบบก่อนทำรายการ" },
        { status: 401 }
      );
    }

    const { title, body, url } = await request.json();
    if (!title || !body) {
      return NextResponse.json(
        { error: "Missing required fields: title and body" },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const messaging = getMessaging();

    // ดึงผู้ดูแลระบบทุกคนจาก Firestore ผ่าน Firebase Admin SDK
    const adminSnapshot = await adminDb
      .collection("users")
      .where("role", "==", "admin")
      .get();

    if (adminSnapshot.empty) {
      return NextResponse.json({ success: true, sentCount: 0, message: "No admin found" });
    }

    let sentCount = 0;
    const sendPromises = adminSnapshot.docs.map(async (adminDoc) => {
      const adminId = adminDoc.id;
      try {
        const tokenDoc = await adminDb.collection("fcm_tokens").doc(adminId).get();
        if (!tokenDoc.exists) return;

        const { token } = tokenDoc.data()!;
        if (!token) return;

        await messaging.send({
          token,
          notification: {
            title,
            body,
          },
          webpush: {
            notification: {
              title,
              body,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              requireInteraction: false,
            },
            fcmOptions: {
              link: url || "/admin/room_requests",
            },
          },
          data: {
            url: url || "/admin/room_requests",
            timestamp: Date.now().toString(),
          },
        });
        sentCount++;
      } catch (err: any) {
        // จัดการ token หมดอายุ
        if (err?.code === "messaging/registration-token-not-registered") {
          try {
            await adminDb.collection("fcm_tokens").doc(adminId).delete();
          } catch {}
        }
        console.warn(`Failed to send push notification to admin ${adminId}:`, err?.message);
      }
    });

    await Promise.allSettled(sendPromises);

    return NextResponse.json({ success: true, sentCount, totalAdmins: adminSnapshot.size });
  } catch (error: any) {
    console.error("Error in /api/notify-admin:", error);
    return NextResponse.json(
      { error: "Failed to notify admin", details: error?.message },
      { status: 500 }
    );
  }
}
