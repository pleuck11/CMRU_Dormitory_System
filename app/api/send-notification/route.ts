import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK (singleton)
let adminApp: App;
function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      adminApp = getApps()[0];
    }
  }
  return adminApp;
}

export async function POST(request: NextRequest) {
  try {
    const { targetUserId, title, body, url } = await request.json();

    if (!targetUserId || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = getAdminApp();
    const adminDb = getFirestore(admin);
    const messaging = getMessaging(admin);

    // ดึง FCM Token ของผู้รับจาก Firestore
    const tokenDoc = await adminDb.collection("fcm_tokens").doc(targetUserId).get();

    if (!tokenDoc.exists) {
      // ผู้รับยังไม่เคย register token — ถือว่า OK แค่ไม่ส่ง push
      return NextResponse.json({ success: true, sent: false, reason: "no_token" });
    }

    const { token } = tokenDoc.data()!;

    // ส่ง FCM Push Notification
    const message = {
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
          link: url || "/",
        },
      },
      data: {
        url: url || "/",
        timestamp: Date.now().toString(),
      },
    };

    await messaging.send(message);

    return NextResponse.json({ success: true, sent: true });
  } catch (error: any) {
    console.error("FCM send error:", error);

    // ถ้า token หมดอายุหรือไม่ถูกต้อง ให้ลบออกจาก Firestore
    if (error?.code === "messaging/registration-token-not-registered") {
      try {
        const { targetUserId } = await request.json().catch(() => ({}));
        if (targetUserId) {
          const admin = getAdminApp();
          await getFirestore(admin).collection("fcm_tokens").doc(targetUserId).delete();
        }
      } catch {}
      return NextResponse.json({ success: true, sent: false, reason: "token_expired" });
    }

    return NextResponse.json(
      { error: "Failed to send notification", details: error?.message },
      { status: 500 }
    );
  }
}
