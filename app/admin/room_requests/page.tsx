"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, updateDoc, orderBy, documentId, where, addDoc, serverTimestamp, setDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

interface RoomRequest {
  id: string;
  tenantId: string;
  roomId: string;
  roomNumber: string;
  building: string;
  rentPrice: number;
  status: "pending" | "pending_docs" | "pending_approval" | "approved" | "rejected" | "queued" | "skipped";
  createdAt: number | Date | { toDate: () => Date } | any; // ใช้ 'any' เฉพาะเมื่อจำเป็นเท่านั้น, แต่โดยปกติแล้ว Firebase Timestamp สามารถทำงานได้ดี
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  slipUrl?: string;
  idCardUrl?: string;
  moveInDate?: string;
}

interface AdditionalRoomRequest {
  id: string; // ไอดีผู้ใช้
  name: string;
  email: string;
  phone: string;
}

export default function AdminRoomRequestsPage() {
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [additionalRequests, setAdditionalRequests] = useState<AdditionalRoomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<{slipUrl?: string, idCardUrl?: string} | null>(null);
  const [approvingReq, setApprovingReq] = useState<RoomRequest | null>(null);
  const [moveInDate, setMoveInDate] = useState<string>("");

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "room_requests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      
      const reqList: RoomRequest[] = [];
      const tenantIds = new Set<string>();

      // รวบรวมข้อมูลคำขอและเก็บ tenantId ไว้ดึงพร้อมกันทีเดียว
      for (const reqDoc of snapshot.docs) {
        const reqData = reqDoc.data() as Omit<RoomRequest, "id">;
        reqList.push({ id: reqDoc.id, ...reqData } as RoomRequest);
        if (reqData.tenantId) {
          tenantIds.add(reqData.tenantId);
        }
      }

      // ดึงข้อมูลผู้ใช้ (Tenants) ที่เกี่ยวข้องทั้งหมด (ใช้ In-query แบบแบ่ง 10 ตามข้อจำกัด Firestore)
      const usersMap = new Map<string, any>();
      const tenantIdsArray = Array.from(tenantIds);
      
      for (let i = 0; i < tenantIdsArray.length; i += 10) {
        const chunk = tenantIdsArray.slice(i, i + 10);
        if (chunk.length === 0) continue;
        
        const userQ = query(collection(db, "users"), where(documentId(), "in", chunk));
        const userSnapshot = await getDocs(userQ);
        
        userSnapshot.docs.forEach(uDoc => {
          usersMap.set(uDoc.id, uDoc.data());
        });
      }

      // นำข้อมูลผู้ใช้มาประกอบร่างกับคำขอ
      const finalRequests = reqList.map(req => {
        const uData = usersMap.get(req.tenantId);
        return {
          ...req,
          tenantName: uData?.name || "ไม่ทราบชื่อ",
          tenantEmail: uData?.email || "-",
          tenantPhone: uData?.phone || "-",
        };
      });
      
      setRequests(finalRequests);

      // ดึงคำขอสิทธิ์จองห้องเพิ่มเติม
      const addQ = query(collection(db, "users"), where("requestingMultipleRooms", "==", true));
      const addSnap = await getDocs(addQ);
      const addList: AdditionalRoomRequest[] = [];
      addSnap.forEach(docSnap => {
         const data = docSnap.data();
         addList.push({
           id: docSnap.id,
           name: data.name || "ไม่ทราบชื่อ",
           email: data.email || "-",
           phone: data.phone || "-"
         });
      });
      setAdditionalRequests(addList);

    } catch (error) {
      console.error("Error fetching room requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openApproveModal = (request: RoomRequest) => {
    setApprovingReq(request);
    setMoveInDate(new Date().toISOString().split("T")[0]); // Default to today
  };

  const handleApproveConfirm = async () => {
    if (!approvingReq) return;
    
    setProcessingId(approvingReq.id);
    try {
      // 1. อัปเดตสถานะคำขอเป็น approved พร้อมใส่วันที่เข้าอยู่
      await updateDoc(doc(db, "room_requests", approvingReq.id), { 
        status: "approved",
        moveInDate: moveInDate || null
      });
      
      // 2. อัปเดตห้องพักเป็น มีผู้เช่า และผูก tenantId
      await updateDoc(doc(db, "rooms", approvingReq.roomId), {
        status: "มีผู้เช่า",
        tenantId: approvingReq.tenantId,
        approvedAt: new Date()
      });

      // 3. อัปเดตสถานะผู้เช่าให้กลับมา Active
      await updateDoc(doc(db, "users", approvingReq.tenantId), {
        tenantStatus: "active",
        role: "tenant"
      });

      // 4. ส่งข้อความแจ้งวันเข้าอยู่ในแชทของผู้เช่า
      if (moveInDate) {
        const formattedDate = new Date(moveInDate).toLocaleDateString("th-TH", {
          day: "numeric", month: "long", year: "numeric"
        });
        const chatText = `🎉 ยินดีต้อนรับ! คำขอจองห้อง ${approvingReq.building}${approvingReq.roomNumber} ได้รับอนุมัติแล้ว\n\nวันเข้าอยู่ที่กำหนดคือ ${formattedDate} หากไม่สะดวกในวันดังกล่าว สามารถกดปุ่ม "เลือกวันใหม่" เพื่อเสนอวันที่สะดวกกลับมาได้เลย`;
        await addDoc(collection(db, "chats", approvingReq.tenantId, "messages"), {
          text: chatText,
          senderId: "admin",
          senderName: "ผู้ดูแลหอพัก",
          senderRole: "admin",
          type: "move_in_date",
          moveInDate: moveInDate,
          roomLabel: `${approvingReq.building}${approvingReq.roomNumber}`,
          createdAt: serverTimestamp(),
        });
        await setDoc(
          doc(db, "chats", approvingReq.tenantId),
          {
            lastMessage: `📅 วันเข้าอยู่: ${formattedDate}`,
            lastMessageTime: serverTimestamp(),
            adminUnreadCount: increment(0),
          },
          { merge: true }
        );
      }

      // 5. ส่งแจ้งเตือน Push Notification ไปยังผู้เช่า
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: approvingReq.tenantId,
          title: "✅ คำขอจองห้องพักได้รับอนุมัติ",
          body: `ห้อง${approvingReq.building}${approvingReq.roomNumber} ได้รับอนุมัติแล้ว ตรวจสอบวันเข้าอยู่ในแชทได้เลย`,
          url: "/tenant/chat",
        }),
      }).catch(() => {});
      
      toast.success("อนุมัติคำขอสำเร็จ");
      setApprovingReq(null);
      fetchRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string, roomId: string) => {
    if (!confirm("ยืนยันการปฏิเสธคำขอนี้?")) return;
    
    setProcessingId(requestId);
    try {
      await updateDoc(doc(db, "room_requests", requestId), { status: "rejected" });


      // ส่งแจ้งเตือนไปยังผู้เช่า
      const rejReq = requests.find(r => r.id === requestId);
      if (rejReq) {
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: rejReq.tenantId,
            title: "❌ คำขอจองห้องพักถูกปฏิเสธ",
            body: `คำขอจองห้อง${rejReq.building}${rejReq.roomNumber} ไม่ได้รับอนุมัติ สามารถเลือกห้องใหม่ได้`,
            url: "/tenant/room",
          }),
        }).catch(() => {});
      }

      // ตรวจสอบว่ามีคิวต่อไปหรือไม่
      const queueQ = query(
        collection(db, "room_requests"),
        where("roomId", "==", roomId),
        where("status", "==", "queued"),
        orderBy("createdAt", "asc")
      );
      const queueSnap = await getDocs(queueQ);
      
      if (!queueSnap.empty) {
        // มีคิวถัดไป ให้สิทธิ์คิวถัดไป
        const nextReqDoc = queueSnap.docs[0];
        await updateDoc(doc(db, "room_requests", nextReqDoc.id), { status: "pending_docs" });
        
        // ส่งแจ้งเตือนคิวถัดไป (Push)
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: nextReqDoc.data().tenantId,
            title: "🎉 ถึงคิวของคุณแล้ว!",
            body: `ถึงคิวห้อง ${rejReq?.building}${rejReq?.roomNumber} แล้ว กรุณาเข้าสู่ระบบเพื่อชำระเงินมัดจำภายใน 3 วัน`,
            url: "/tenant/dashboard",
          }),
        }).catch(() => {});

        // แจ้งเตือนไปยังคิวถัดไปผ่านแชท
        await addDoc(collection(db, "chats", nextReqDoc.data().tenantId, "messages"), {
          text: `🎉 ถึงคิวจองห้องพักของคุณแล้ว!\n\nห้อง ${rejReq?.building}${rejReq?.roomNumber} ที่คุณได้ลงคิวไว้ ตอนนี้ถึงคิวของคุณแล้วครับ\n\nกรุณาเข้าไปที่เมนู "แดชบอร์ด" เพื่อชำระเงินมัดจำและอัปโหลดเอกสาร ภายใน 3 วัน เพื่อยืนยันสิทธิ์การจองครับ`,
          senderId: "admin",
          senderName: "ระบบอัตโนมัติ",
          senderRole: "admin",
          type: "text",
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "chats", nextReqDoc.data().tenantId), {
          lastMessage: `🎉 ถึงคิวจองห้อง ${rejReq?.building}${rejReq?.roomNumber} ของคุณแล้ว!`,
          lastMessageTime: serverTimestamp(),
        }, { merge: true });
        
        // ห้องยังคงสถานะ 'ติดจอง' อยู่แล้ว ไม่ต้องเปลี่ยน
      } else {
        // ไม่มีใครต่อคิว อัปเดตห้องพักกลับเป็น "ว่าง"
        await updateDoc(doc(db, "rooms", roomId), {
          status: "ว่าง"
        });
      }

      toast.success("ปฏิเสธคำขอสำเร็จ");
      fetchRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSkipQueue = async (requestId: string, roomId: string) => {
    const hasQueue = requests.some(r => r.roomId === roomId && r.status === 'queued');
    if (!confirm(hasQueue ? "ยืนยันการเลื่อนคิวข้ามผู้ใช้รายนี้? (ผู้ใช้นี้จะถูกตัดสิทธิ์และคิวถัดไปจะได้รับสิทธิ์ทันที)" : "ยืนยันการตัดสิทธิ์ผู้ใช้รายนี้? (เนื่องจากหมดเวลาชำระมัดจำ และห้องจะถูกปรับเป็นสถานะว่าง)")) return;
    
    setProcessingId(requestId);
    try {
      // 1. เปลี่ยนสถานะคำขอนี้เป็น skipped
      await updateDoc(doc(db, "room_requests", requestId), { status: "skipped" });

      // ส่งแจ้งเตือนว่าถูกข้ามคิว
      const rejReq = requests.find(r => r.id === requestId);
      if (rejReq) {
        // แจ้งเตือนผ่าน Push
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: rejReq.tenantId,
            title: "⏱️ หมดเวลาชำระมัดจำ/ถูกเลื่อนคิว",
            body: `คำขอจองห้อง${rejReq.building}${rejReq.roomNumber} ของคุณถูกข้ามคิวแล้วเนื่องจากหมดเวลาที่กำหนด หรือไม่พร้อมชำระเงิน`,
            url: "/tenant/room",
          }),
        }).catch(() => {});

        // แจ้งเตือนผ่านแชท
        await addDoc(collection(db, "chats", rejReq.tenantId, "messages"), {
          text: `⏱️ แจ้งเตือนหมดเวลาชำระมัดจำ\n\nคำขอจองห้อง ${rejReq.building}${rejReq.roomNumber} ของคุณถูกเลื่อนคิวแล้ว เนื่องจากเลยกำหนดเวลาชำระเงิน 3 วันหรือไม่พร้อมชำระเงิน\n\nคุณสามารถดำเนินการจองห้องอื่นที่ยังว่างอยู่ได้ครับ`,
          senderId: "admin",
          senderName: "ระบบอัตโนมัติ",
          senderRole: "admin",
          type: "text",
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "chats", rejReq.tenantId), {
          lastMessage: `⏱️ คำขอจองห้องถูกเลื่อนคิว`,
          lastMessageTime: serverTimestamp(),
        }, { merge: true });
      }

      // 2. หาคิวถัดไปสำหรับห้องนี้
      const queueQ = query(
        collection(db, "room_requests"),
        where("roomId", "==", roomId),
        where("status", "==", "queued"),
        orderBy("createdAt", "asc")
      );
      const queueSnap = await getDocs(queueQ);
      
      if (!queueSnap.empty) {
        // มีคิวถัดไป
        const nextReqDoc = queueSnap.docs[0];
        await updateDoc(doc(db, "room_requests", nextReqDoc.id), { status: "pending_docs" });
        
        // ส่งแจ้งเตือนไปยังคิวถัดไป (Push)
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: nextReqDoc.data().tenantId,
            title: "🎉 ถึงคิวของคุณแล้ว!",
            body: `ถึงคิวห้อง ${rejReq?.building}${rejReq?.roomNumber} แล้ว กรุณาเข้าสู่ระบบเพื่อชำระเงินมัดจำภายใน 3 วัน`,
            url: "/tenant/dashboard",
          }),
        }).catch(() => {});

        // แจ้งเตือนไปยังคิวถัดไปผ่านแชท
        await addDoc(collection(db, "chats", nextReqDoc.data().tenantId, "messages"), {
          text: `🎉 ถึงคิวจองห้องพักของคุณแล้ว!\n\nห้อง ${rejReq?.building}${rejReq?.roomNumber} ที่คุณได้ลงคิวไว้ ตอนนี้ถึงคิวของคุณแล้วครับ\n\nกรุณาเข้าไปที่เมนู "แดชบอร์ด" เพื่อชำระเงินมัดจำและอัปโหลดเอกสาร ภายใน 3 วัน เพื่อยืนยันสิทธิ์การจองครับ`,
          senderId: "admin",
          senderName: "ระบบอัตโนมัติ",
          senderRole: "admin",
          type: "text",
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "chats", nextReqDoc.data().tenantId), {
          lastMessage: `🎉 ถึงคิวจองห้อง ${rejReq?.building}${rejReq?.roomNumber} ของคุณแล้ว!`,
          lastMessageTime: serverTimestamp(),
        }, { merge: true });
        
        toast.success("เลื่อนคิวสำเร็จ มีผู้จองรอคิวอยู่และได้รับสิทธิ์เรียบร้อย");
      } else {
        // ไม่มีใครต่อคิว ให้ห้องกลับไปสถานะ "ว่าง"
        await updateDoc(doc(db, "rooms", roomId), { status: "ว่าง" });
        toast.success("ตัดสิทธิ์สำเร็จ (ไม่มีผู้ต่อคิว ห้องถูกปรับเป็นสถานะว่าง)");
      }

      fetchRequests();
    } catch (error) {
      console.error("Error skipping queue:", error);
      toast.error("เกิดข้อผิดพลาดในการเลื่อนคิว");
    } finally {
      setProcessingId(null);
    }
  };

  const handlePromoteQueue = async (requestId: string, roomId: string) => {
    if (!confirm("ยืนยันการให้สิทธิ์ผู้ใช้รายนี้เป็นคิวปัจจุบัน? (จะใช้ในกรณีที่คิวก่อนหน้าถูกปฏิเสธหรือยกเลิกแล้วผู้ใช้ค้างอยู่ในสถานะรอคิว)")) return;
    
    setProcessingId(requestId);
    try {
      const targetReq = requests.find(r => r.id === requestId);
      
      // อัปเดตสถานะเป็น pending_docs เพื่อให้จ่ายมัดจำ
      await updateDoc(doc(db, "room_requests", requestId), { status: "pending_docs" });
      // บังคับให้ห้องมีสถานะ 'ติดจอง' เผื่อมันว่างอยู่
      await updateDoc(doc(db, "rooms", roomId), { status: "ติดจอง" });

      if (targetReq) {
        // ส่งแจ้งเตือนไปยังผู้ใช้ที่ได้เลื่อนคิว (Push)
        fetch("/api/send-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: targetReq.tenantId,
            title: "🎉 ถึงคิวของคุณแล้ว!",
            body: `ถึงคิวห้อง ${targetReq.building}${targetReq.roomNumber} แล้ว กรุณาเข้าสู่ระบบเพื่อชำระเงินมัดจำภายใน 3 วัน`,
            url: "/tenant/dashboard",
          }),
        }).catch(() => {});

        // แจ้งเตือนผ่านแชท
        await addDoc(collection(db, "chats", targetReq.tenantId, "messages"), {
          text: `🎉 ถึงคิวจองห้องพักของคุณแล้ว!\n\nห้อง ${targetReq.building}${targetReq.roomNumber} ที่คุณได้ลงคิวไว้ ตอนนี้ถึงคิวของคุณแล้วครับ\n\nกรุณาเข้าไปที่เมนู "แดชบอร์ด" เพื่อชำระเงินมัดจำและอัปโหลดเอกสาร ภายใน 3 วัน เพื่อยืนยันสิทธิ์การจองครับ`,
          senderId: "admin",
          senderName: "ระบบอัตโนมัติ",
          senderRole: "admin",
          type: "text",
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "chats", targetReq.tenantId), {
          lastMessage: `🎉 ถึงคิวจองห้อง ${targetReq.building}${targetReq.roomNumber} ของคุณแล้ว!`,
          lastMessageTime: serverTimestamp(),
        }, { merge: true });
      }

      toast.success("ให้สิทธิ์จองสำเร็จ ผู้ใช้สามารถชำระเงินมัดจำได้แล้ว");
      fetchRequests();
    } catch (error) {
      console.error("Error promoting queue:", error);
      toast.error("เกิดข้อผิดพลาดในการเลื่อนคิว");
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAdditional = async (userId: string) => {
    if (!confirm("ยืนยันอนุญาตให้ผู้เช่ารายนี้จองห้องเพิ่มเติม?")) return;
    setProcessingId(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        canBookMultipleRooms: true,
        requestingMultipleRooms: false
      });
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: userId,
          title: "🔑 อนุมัติสิทธิ์การจองห้องพักเพิ่มเติม",
          body: `คำขอสิทธิ์จองห้องพักเพิ่มเติมของคุณได้รับการอนุมัติแล้ว คุณสามารถจองห้องพักเพิ่มได้เลย`,
          url: "/tenant/room",
        }),
      }).catch(() => {});
      toast.success("อนุมัติสิทธิ์การจองสำเร็จ");
      fetchRequests();
    } catch (e: any) {
      console.error("Error approving additional room request:", e);
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAdditional = async (userId: string) => {
    if (!confirm("ยืนยันปฏิเสธคำขอสิทธิ์การจองนี้?")) return;
    setProcessingId(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        requestingMultipleRooms: false
      });
      fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: userId,
          title: "❌ คำขอสิทธิ์การจองถูกปฏิเสธ",
          body: `คำขอสิทธิ์จองห้องพักเพิ่มเติมของคุณถูกปฏิเสธ`,
          url: "/tenant/room",
        }),
      }).catch(() => {});
      toast.success("ปฏิเสธคำขอสิทธิ์สำเร็จ");
      fetchRequests();
    } catch (e: any) {
      console.error("Error rejecting additional room request:", e);
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (timestamp: { toDate: () => Date } | any) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return "-";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">คำขอจองห้องพัก</h1>
          <p className="text-[var(--text-muted)] mt-1">พิจารณาและจัดการคำขอจองห้องเช่าจากผู้ใช้งาน</p>
        </div>
        <button 
          onClick={fetchRequests}
          className="glass-button-outline px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-180 transition-transform duration-500"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          รีเฟรชข้อมูล
        </button>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl flex flex-col">
        {additionalRequests.length > 0 && (
          <div className="bg-amber-50/80 border-b border-amber-100 p-4 sm:p-6 mb-4">
            <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2 mb-4">
              <span className="text-2xl">🔐</span> คำขอสิทธิ์จองห้องพักเพิ่มเติม
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {additionalRequests.map(req => (
                <div key={req.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{req.name}</h3>
                    <div className="text-sm text-gray-600 mt-1 flex flex-col gap-1">
                       <span className="flex items-center gap-2">📞 {req.phone}</span>
                       <span className="flex items-center gap-2">📧 {req.email}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={() => handleApproveAdditional(req.id)}
                      disabled={processingId === req.id}
                      className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      อนุมัติสิทธิ์
                    </button>
                    <button 
                      onClick={() => handleRejectAdditional(req.id)}
                      disabled={processingId === req.id}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      ปฏิเสธ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex justify-center items-center h-full py-32">
              <div className="w-12 h-12 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/50 border border-[var(--glass-border)] shadow-sm mb-6 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-light)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)] relative z-10 group-hover:scale-110 transition-transform"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </div>
              <p className="text-[var(--text-muted)] text-lg mb-6">ยังไม่มีคำขอจองห้องพัก</p>
            </div>
          ) : (
             <table className="w-full text-sm text-left relative z-10 border-collapse block md:table">
              <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">ห้องที่ขอ</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">ข้อมูลผู้ขอเช่า</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">วันที่สร้างคำขอ</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">สถานะ</th>
                  <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {requests.map((request) => (
                  <tr key={request.id} className="block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b hover:bg-white/60 md:hover:bg-white/40 transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group">
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase mt-1">ห้องที่ขอ</span>
                      <div className="text-right md:text-left">
                        <div className="font-bold text-[var(--accent-dark)] border border-[var(--accent-brown)]/30 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/50 shadow-sm backdrop-blur-md">
                          {request.building}{request.roomNumber}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-2 font-medium">฿{request.rentPrice.toLocaleString()}/ด.</div>
                      </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-start md:items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase mt-1">ข้อมูลผู้ขอเช่า</span>
                      <div className="text-right md:text-left">
                        <div className="font-bold text-[var(--text-main)] mb-1">{request.tenantName}</div>
                        <div className="text-xs text-[var(--text-muted)] flex flex-col gap-1 mt-1 font-medium bg-white/30 p-2 rounded-lg inline-block border border-white/40 backdrop-blur-sm">
                          <span className="flex items-center gap-1"><span className="text-[var(--accent-brown)]">📞</span> {request.tenantPhone}</span>
                          <span className="flex items-center gap-1"><span className="text-[var(--accent-brown)]">✉️</span> {request.tenantEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-main)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">วันที่สร้างคำขอ</span>
                      {formatDate(request.createdAt)}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">สถานะ</span>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${
                        request.status === 'pending' || request.status === 'pending_docs' ? 'bg-amber-50/80 text-amber-700 border-amber-200 backdrop-blur-sm' :
                        request.status === 'queued' ? 'bg-sky-50/80 text-sky-700 border-sky-200 backdrop-blur-sm' :
                        request.status === 'pending_approval' ? 'bg-blue-50/80 text-blue-700 border-blue-200 backdrop-blur-sm' :
                        request.status === 'approved' ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm' :
                        'bg-red-50/80 text-red-700 border-red-200 backdrop-blur-sm'
                      }`}>
                        {request.status === 'pending' || request.status === 'pending_docs' ? 'รอผู้เช่าส่งเอกสาร' :
                         request.status === 'queued' ? 'รอคิว' :
                         request.status === 'pending_approval' ? 'รอตรวจสอบเอกสาร' :
                         request.status === 'approved' ? 'อนุมัติแล้ว' : 
                         request.status === 'skipped' ? 'ถูกข้ามคิว' : 'ปฏิเสธ'}
                      </span>
                    </td>
                    <td className="flex justify-end gap-2 md:table-cell px-2 py-3 md:px-6 md:py-4 text-right mt-2 md:mt-0">
                       {request.status === 'pending' || request.status === 'pending_docs' || request.status === 'pending_approval' ? (
                        <div className="flex flex-col md:flex-row items-end md:items-center justify-end gap-2">
                          {(request.slipUrl || request.idCardUrl) && (
                            <button 
                              onClick={() => setSelectedDocs({ slipUrl: request.slipUrl, idCardUrl: request.idCardUrl })}
                              className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:text-blue-800 rounded-xl transition-all font-bold shadow-sm hover:shadow-md whitespace-nowrap"
                            >
                              ดูเอกสาร
                            </button>
                          )}
                          <button 
                            onClick={() => openApproveModal(request)}
                            disabled={processingId === request.id || request.status !== 'pending_approval'}
                            className={`px-4 py-2 rounded-xl transition-all font-bold shadow-sm hover:shadow-md whitespace-nowrap ${request.status === 'pending_approval' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800' : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'}`}
                            title={request.status !== 'pending_approval' ? "รอผู้เช่าอัปโหลดเอกสาร" : ""}
                          >
                            อนุมัติ
                          </button>
                          
                          {(request.status === 'pending' || request.status === 'pending_docs') && (
                            <button 
                              onClick={() => handleSkipQueue(request.id, request.roomId)}
                              disabled={processingId === request.id}
                              className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 rounded-xl transition-all font-bold disabled:opacity-50 shadow-sm hover:shadow-md whitespace-nowrap"
                            >
                              {requests.some(r => r.roomId === request.roomId && r.status === 'queued') ? 'เลื่อนคิว' : 'ตัดสิทธิ์ (หมดเวลา)'}
                            </button>
                          )}

                          <button 
                            onClick={() => handleReject(request.id, request.roomId)}
                            disabled={processingId === request.id}
                            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 hover:text-red-800 rounded-xl transition-all font-bold disabled:opacity-50 shadow-sm hover:shadow-md whitespace-nowrap"
                          >
                            ปฏิเสธ
                          </button>
                        </div>
                       ) : request.status === 'queued' ? (
                         <div className="flex justify-end gap-2 items-center">
                           <span className="text-sky-600 font-bold bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100 text-xs hidden md:inline-block">- รอคิว -</span>
                           <button 
                             onClick={() => handlePromoteQueue(request.id, request.roomId)}
                             disabled={processingId === request.id}
                             className="px-4 py-2 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:text-sky-800 rounded-xl transition-all font-bold disabled:opacity-50 shadow-sm hover:shadow-md whitespace-nowrap"
                           >
                             ให้สิทธิ์จอง
                           </button>
                         </div>
                       ) : (
                         <span className="text-[var(--text-muted)] text-xs font-medium bg-black/5 px-3 py-1.5 rounded-lg border border-black/10">- ดำเนินการแล้ว -</span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* โมดอลแสดงรูปภาพเอกสาร */}
      {selectedDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDocs(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-[var(--text-main)]">เอกสารยืนยันการจอง</h3>
              <button onClick={() => setSelectedDocs(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">สลิปการโอนเงินค่ามัดจำ</h4>
                {selectedDocs.slipUrl ? (
                  <img src={selectedDocs.slipUrl} alt="Slip" className="w-full h-auto rounded-xl border border-gray-200 shadow-sm" />
                ) : (
                  <div className="w-full h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400">ไม่มีรูปภาพ</div>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">สำเนาบัตรประชาชน</h4>
                {selectedDocs.idCardUrl ? (
                  <img src={selectedDocs.idCardUrl} alt="ID Card" className="w-full h-auto rounded-xl border border-gray-200 shadow-sm" />
                ) : (
                  <div className="w-full h-48 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400">ไม่มีรูปภาพ</div>
                )}
              </div>
            </div>
            <div className="mt-6 text-right">
              <button onClick={() => setSelectedDocs(null)} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl">ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      {/* โมดอลกำหนดวันที่เข้าอยู่ */}
      {approvingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-[var(--text-main)] mb-2">กำหนดวันที่เข้าอยู่</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">โปรดระบุวันที่พร้อมเข้าอยู่ สำหรับห้อง {approvingReq.building}{approvingReq.roomNumber}</p>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">วันที่เข้าอยู่</label>
              <input 
                type="date" 
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setApprovingReq(null)} 
                className="flex-1 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold rounded-xl transition-colors"
                disabled={processingId === approvingReq.id}
              >
                ยกเลิก
              </button>
              <button 
                onClick={handleApproveConfirm} 
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center"
                disabled={processingId === approvingReq.id}
              >
                {processingId === approvingReq.id ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "ยืนยันอนุมัติ"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
