import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebase-admin";

// For Vercel Cron
export const dynamic = "force-dynamic"; 

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    
    // Allow triggering from Vercel CRON or using a specific secret token for manual trigger
    if (
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      req.headers.get("user-agent") !== "vercel-cron/1.0"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = getAdminDb();
    
    // Get all pending requests
    const snapshot = await adminDb
      .collection("room_requests")
      .where("status", "in", ["pending", "pending_docs"])
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ message: "No pending requests found." });
    }

    let cancelledCount = 0;
    const now = new Date();

    const batch = adminDb.batch();

    snapshot.forEach((doc) => {
      const data = doc.data();
      
      // Calculate age of the request
      let createdAt = data.createdAt?.toDate();
      
      // Fallback if createdAt is not a valid timestamp (just in case)
      if (!createdAt) {
         createdAt = new Date();
      }

      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // If more than 7 days, cancel the request
      if (diffDays > 7) {
        // 1. Update request status
        batch.update(doc.ref, { 
          status: "cancelled", 
          cancelReason: "หมดเวลา 7 วัน (ยกเลิกอัตโนมัติ)",
          updatedAt: FieldValue.serverTimestamp()
        });

        // 2. Free up the room (change status back to 'ว่าง')
        if (data.roomId) {
          const roomRef = adminDb.collection("rooms").doc(data.roomId);
          batch.update(roomRef, { status: "ว่าง" });
        }

        cancelledCount++;
      }
    });

    if (cancelledCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Checked ${snapshot.size} pending requests. Cancelled ${cancelledCount} expired requests.` 
    });

  } catch (error: any) {
    console.error("Cron Error cleanup-bookings:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
