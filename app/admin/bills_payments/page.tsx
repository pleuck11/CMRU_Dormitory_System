"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, addDoc, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

interface Bill {
  id: string;
  tenantName: string;
  room: string;
  amount: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
  displayBillNumber?: string;
  [key: string]: any;
}

interface Room {
  id: string;
  roomNumber: string;
  building: string;
  floor: string;
  rentPrice: number;
  status: string;
  tenantId?: string;
  tenantName?: string;
}

// โครงสร้างข้อมูลบัญชีธนาคาร
interface BankAccount {
  accountName: string;
  accountNumber: string;
  bankName: string;
  promptPayNumber: string;
  qrImageUrl: string;
}

export default function BillsPaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [filterStatus, setFilterStatus] = useState("สถานะทั้งหมด");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  // ห้องที่มีสถานะ "มีผู้เช่า"
  const [rentedRooms, setRentedRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // ข้อมูลฟอร์มสร้างบิล
  const [billMonth, setBillMonth] = useState("");
  const [billDueDate, setBillDueDate] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [billAmount, setBillAmount] = useState<number | "">("");
  const [waterFee, setWaterFee] = useState<number | "">(150);
  const [electricFee, setElectricFee] = useState<number | "">("");
  const [garbageFee, setGarbageFee] = useState<number | "">(30);

  // ค่าธรรมเนียมจากระบบส่วนกลาง
  const [globalFees, setGlobalFees] = useState({
    waterFeeFlat: 150,
    garbageFeeFlat: 30,
    electricUnitPrice: 8,
    billDueDaysLimit: 5,
    lateFeePerDay: 0
  });

  // ============ บัญชีธนาคาร ============
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState<BankAccount>({
    accountName: "",
    accountNumber: "",
    bankName: "",
    promptPayNumber: "",
    qrImageUrl: "",
  });
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string>("");
  const [isSavingBank, setIsSavingBank] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // คำนวณยอดรวมทั้งหมดอัตโนมัติ
  const totalAmount =
    (Number(billAmount) || 0) +
    (Number(waterFee) || 0) +
    (Number(electricFee) || 0) +
    (Number(garbageFee) || 0);

  const filteredBills = bills.filter(
    (b) => {
      const matchSearch =
        b.tenantName.includes(searchQuery) ||
        b.room.includes(searchQuery) ||
        b.id.includes(searchQuery);
      
      let matchStatus = true;
      if (filterStatus === "ชำระแล้ว") matchStatus = b.status === "paid";
      if (filterStatus === "รอชำระ") matchStatus = b.status === "pending";
      if (filterStatus === "ค้างชำระ") matchStatus = b.status === "overdue";
      
      return matchSearch && matchStatus;
    }
  );

  const fetchBills = async () => {
    setLoadingBills(true);
    try {
      const q = query(collection(db, "bills"));
      const snapshot = await getDocs(q);
      const billsData: Bill[] = [];
      const tempBills: any[] = [];
      
      snapshot.forEach((doc) => {
        tempBills.push({ id: doc.id, ...doc.data() });
      });
      
      // เรียงจากเก่าไปใหม่ เพื่อตั้งเลขบิลให้ถูกต้อง (เก่าสุด = 1)
      tempBills.sort((a, b) => {
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });
      
      tempBills.forEach((data, index) => {
        billsData.push({
          ...data,
          id: data.id,
          displayBillNumber: data.billNumber ? data.billNumber : `INV-${String(index + 1).padStart(4, '0')}`,
          tenantName: data.tenantName || "ไม่ทราบชื่อ",
          room: data.building && data.roomNumber ? `ตึก ${data.building} ห้อง ${data.roomNumber}` : data.roomNumber || "-",
          amount: data.totalAmount || 0,
          dueDate: data.dueDate || "-",
          status: data.status || "pending",
        });
      });
      
      // กลับด้านให้บิลใหม่สุดอยู่บน
      billsData.reverse();
      
      setBills(billsData);
    } catch (error) {
      console.error("Error fetching bills:", error);
    } finally {
      setLoadingBills(false);
    }
  };

  // ดึงข้อมูลบัญชีธนาคารจาก Firestore
  const fetchBankAccount = async () => {
    try {
      const docRef = doc(db, "bankAccount", "owner");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as BankAccount;
        setBankAccount(data);
      }
    } catch (error) {
      console.error("Error fetching bank account:", error);
    }
  };

  // ดึงข้อมูลการตั้งค่าบิลจาก Firestore
  const fetchGlobalFees = async () => {
    try {
      const docRef = doc(db, "settings", "general");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalFees({
          waterFeeFlat: data.waterFeeFlat !== undefined ? data.waterFeeFlat : 150,
          garbageFeeFlat: data.garbageFeeFlat !== undefined ? data.garbageFeeFlat : 30,
          electricUnitPrice: data.electricUnitPrice !== undefined ? data.electricUnitPrice : 8,
          billDueDaysLimit: data.billDueDaysLimit !== undefined ? data.billDueDaysLimit : 5,
          lateFeePerDay: data.lateFeePerDay !== undefined ? data.lateFeePerDay : 0
        });
      }
    } catch (error) {
      console.error("Error fetching global fees:", error);
    }
  };

  useEffect(() => {
    fetchBills();
    fetchBankAccount();
    fetchGlobalFees();
  }, []);

  // ดึงห้องที่มีผู้เช่าจาก Firestore
  const fetchRentedRooms = async () => {
    setLoadingRooms(true);
    try {
      const q = query(
        collection(db, "rooms"),
        where("status", "==", "มีผู้เช่า")
      );
      const snapshot = await getDocs(q);
      const roomsTemp: any[] = [];
      const tenantIds = new Set<string>();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tenantId) tenantIds.add(data.tenantId);
        roomsTemp.push({ id: doc.id, ...data });
      });

      const usersMap = new Map<string, string>();
      const tenantIdsArray = Array.from(tenantIds);
      
      for (let i = 0; i < tenantIdsArray.length; i += 10) {
        const chunk = tenantIdsArray.slice(i, i + 10);
        if (chunk.length === 0) continue;
        const userQ = query(collection(db, "users"), where("__name__", "in", chunk));
        const userSnapshot = await getDocs(userQ);
        userSnapshot.forEach((uDoc) => {
          usersMap.set(uDoc.id, uDoc.data().name || "ไม่ทราบชื่อ");
        });
      }

      const rooms = roomsTemp.map(r => ({
        ...r,
        tenantName: r.tenantId ? (usersMap.get(r.tenantId) || "ไม่ทราบชื่อ") : "ไม่ทราบชื่อ"
      })) as Room[];

      // จัดเรียงตามตึกและหมายเลขห้อง
      rooms.sort((a, b) => {
        if (a.building === b.building) {
          return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
        }
        return a.building.localeCompare(b.building);
      });
      setRentedRooms(rooms);
    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลห้อง:", error);
    } finally {
      setLoadingRooms(false);
    }
  };

  const openCreateBill = () => {
    // รีเซ็ตฟอร์มและดึงข้อมูลห้องใหม่
    setBillMonth("");
    setBillDueDate("");
    setSelectedRoomId("");
    setBillAmount("");
    setWaterFee(globalFees.waterFeeFlat);
    setElectricFee("");
    setGarbageFee(globalFees.garbageFeeFlat);
    fetchRentedRooms();
    setIsCreateBillOpen(true);
  };

  const closeCreateBill = () => setIsCreateBillOpen(false);

  // ============ ฟังก์ชันจัดการบัญชีธนาคาร ============
  const openBankModal = () => {
    // โหลดข้อมูลเดิม (ถ้ามี)
    if (bankAccount) {
      setBankForm({ ...bankAccount });
      setQrPreview(bankAccount.qrImageUrl || "");
    } else {
      setBankForm({ accountName: "", accountNumber: "", bankName: "", promptPayNumber: "", qrImageUrl: "" });
      setQrPreview("");
    }
    setQrFile(null);
    setIsBankModalOpen(true);
  };

  const closeBankModal = () => setIsBankModalOpen(false);

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrFile(file);
    setQrPreview(URL.createObjectURL(file));
  };

  const handleSaveBankAccount = async () => {
    if (!bankForm.promptPayNumber) {
      toast.warning("กรุณากรอกเบอร์โทรศัพท์ หรือเลขบัตรประชาชนสำหรับพร้อมเพย์");
      return;
    }
    setIsSavingBank(true);
    try {
      const payload = { promptPayNumber: bankForm.promptPayNumber };
      // บันทึกเฉพาะพร้อมเพย์
      await setDoc(doc(db, "bankAccount", "owner"), payload, { merge: true });
      
      // อัปเดต state
      setBankAccount(prev => ({ ...prev, ...payload } as BankAccount));
      
      toast.success("บันทึกข้อมูลพร้อมเพย์เรียบร้อยแล้ว");
      closeBankModal();
    } catch (error) {
      console.error("Error saving bank account:", error);
      toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleCancelBill = async (billId: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการยกเลิกบิลนี้?")) return;
    try {
      await updateDoc(doc(db, "bills", billId), { status: "cancelled" });
      toast.success("ยกเลิกบิลเรียบร้อยแล้ว");
      fetchBills(); // รีเฟรชรายการ
    } catch (error) {
      console.error("Error cancelling bill:", error);
      toast.error("เกิดข้อผิดพลาดในการยกเลิกบิล");
    }
  };

  // เมื่อเลือกห้อง ให้ดึงราคาเช่าอัตโนมัติ
  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    const room = rentedRooms.find((r) => r.id === roomId);
    if (room) {
      setBillAmount(room.rentPrice);
    } else {
      setBillAmount("");
    }
  };

  const handleCreateBill = async () => {
    if (!selectedRoomId || !billMonth || !billDueDate || !billAmount) {
      toast.warning("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const room = rentedRooms.find(r => r.id === selectedRoomId);
      if (!room || !room.tenantId) {
        toast.error("ไม่พบข้อมูลผู้เช่าสำหรับห้องนี้ หรือห้องยังไม่มีผู้เช่า");
        setIsSubmitting(false);
        return;
      }

      const billData = {
        tenantId: room.tenantId,
        tenantName: room.tenantName || "ไม่ทราบชื่อ",
        roomId: room.id,
        roomNumber: room.roomNumber,
        building: room.building,
        month: billMonth,
        dueDate: billDueDate,
        rentAmount: Number(billAmount) || 0,
        waterFee: Number(waterFee) || 0,
        electricFee: Number(electricFee) || 0,
        garbageFee: Number(garbageFee) || 0,
        totalAmount: totalAmount,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "bills"), billData);
      toast.success("สร้างบิลเรียบร้อยแล้ว");
      closeCreateBill();
      fetchBills(); // รีเฟรชรายการ
    } catch (error) {
      console.error("Error creating bill:", error);
      toast.error("เกิดข้อผิดพลาดในการสร้างบิล");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden print:overflow-visible">
      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">
            บิลและการชำระเงิน
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            จัดการรอบบิลและตรวจสอบสถานะการจ่ายเงินของผู้เช่า
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin/bills_payments/history_bills" className="glass-button-outline flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-sm group hover:bg-white/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-hover:scale-110 transition-transform"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            ประวัติการชำระเงิน
          </Link>
          {/* ปุ่มตั้งค่าบัญชีธนาคาร */}
          <button
            onClick={openBankModal}
            className="glass-button-outline flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-sm group hover:bg-white/50 relative"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            บัญชีธนาคาร
            {bankAccount && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
            )}
          </button>
          <button
            onClick={openCreateBill}
            className="glass-button flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-all shadow-sm group"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-hover:-translate-y-1 transition-transform"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
              <line x1="16" x2="8" y1="17" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            สร้างบิลเดือนนี้
          </button>
        </div>
      </div>

      {/* ภาพรวมสถิติ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 print:hidden">
        <div className="glass-panel p-6 rounded-3xl flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-sm backdrop-blur-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">
              ชำระแล้ว
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--text-main)]">
                {bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
              </span>
              <span className="text-sm font-medium text-[var(--text-muted)]">
                บาท
              </span>
            </div>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-3xl flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-600 flex items-center justify-center shadow-sm backdrop-blur-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">
              รอชำระ
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--text-main)]">
                {bills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
              </span>
              <span className="text-sm font-medium text-[var(--text-muted)]">
                บาท
              </span>
            </div>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-3xl flex items-center gap-5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-red-50/80 border border-red-200 text-red-600 flex items-center justify-center shadow-sm backdrop-blur-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-muted)] mb-1">
              ค้างชำระ
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[var(--text-main)]">
                {bills.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.amount, 0).toLocaleString()}
              </span>
              <span className="text-sm font-medium text-[var(--text-muted)]">
                บาท
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* การ์ดเนื้อหาหลัก */}
      <div className="glass-panel overflow-hidden rounded-3xl flex flex-col print:hidden">
        {/* แถบเครื่องมือ */}
        <div className="p-5 border-b border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex flex-col sm:flex-row gap-4 items-center justify-between relative z-10">
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-brown)] transition-colors"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="ค้นหาเลขที่บิล, ชื่อ, หรือห้อง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input w-full pl-11 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent transition-all text-sm font-medium text-[var(--text-main)] placeholder-[var(--text-muted)]"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="glass-input px-4 py-2.5 rounded-xl text-sm font-bold text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent w-full sm:w-auto bg-white/50 backdrop-blur-md cursor-pointer"
            >
              <option className="bg-white">สถานะทั้งหมด</option>
              <option className="bg-white">ชำระแล้ว</option>
              <option className="bg-white">รอชำระ</option>
              <option className="bg-white">ค้างชำระ</option>
            </select>
            <button
              className="glass-button-outline flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-white/50 transition-all w-full sm:w-auto justify-center"
              aria-label="กรองข้อมูล"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          </div>
        </div>

        {/* ข้อมูลตาราง */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-sm text-left relative z-10 border-collapse block md:table">
            <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">
                  เลขที่บิล
                </th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">
                  ห้อง
                </th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">
                  ผู้เช่า
                </th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">
                  ยอดชำระ
                </th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">
                  กำหนดชำระ
                </th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">
                  สถานะ
                </th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">
                  ดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {loadingBills ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin mb-2"></div>
                      <span>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-16 text-center text-[var(--text-muted)] font-medium text-lg"
                  >
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-30"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" x2="8" y1="13" y2="13" />
                        <line x1="16" x2="8" y1="17" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <span>ไม่พบข้อมูลบิล</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill, idx) => (
                  <tr
                    key={bill.id}
                    className="block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b hover:bg-white/60 md:hover:bg-white/40 transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group"
                  >
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--accent-dark)] text-base border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">เลขที่บิล</span>
                      {bill.displayBillNumber || bill.id}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ห้อง</span>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-light)]/40 border border-[var(--accent-brown)]/20 text-[var(--accent-dark)] font-bold text-sm shadow-sm backdrop-blur-sm whitespace-nowrap w-max">
                        {bill.room}
                      </div>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--text-main)] text-base border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ผู้เช่า</span>
                      {bill.tenantName}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--text-main)] text-base mt-2 md:mt-2 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ยอดชำระ</span>
                      ฿{bill.amount.toLocaleString()}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">กำหนดชำระ</span>
                      <span>
                        <span className="text-[var(--accent-brown)] mr-1">
                          📅
                        </span>
                        {bill.dueDate}
                      </span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">สถานะ</span>
                      <span
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit border shadow-sm ${
                          bill.status === "paid"
                            ? "bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm"
                            : bill.status === "overdue"
                              ? "bg-red-50/80 text-red-700 border-red-200 backdrop-blur-sm"
                              : "bg-amber-50/80 text-amber-700 border-amber-200 backdrop-blur-sm"
                        }`}
                      >
                        {bill.status === "paid" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                        )}
                        {bill.status === "overdue" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
                        )}
                        {bill.status === "pending" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
                        )}
                        {bill.status === "cancelled" && (
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shadow-[0_0_5px_rgba(156,163,175,0.5)]"></span>
                        )}
                        {bill.status === "paid"
                          ? "ชำระแล้ว"
                          : bill.status === "overdue"
                            ? "ค้างชำระ"
                            : bill.status === "cancelled"
                              ? "ยกเลิกแล้ว"
                              : "รอชำระ"}
                      </span>
                    </td>
                    <td className="flex justify-end gap-2 md:table-cell px-2 py-3 md:px-6 md:py-4 text-right mt-2 md:mt-0">
                      <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-70 group-hover:opacity-100 transition-opacity">

                        {bill.status !== 'cancelled' && (
                          <button
                            onClick={() => setPreviewBill(bill)}
                            className="p-2.5 text-[var(--text-muted)] hover:text-blue-600 hover:bg-blue-50/80 border border-transparent hover:border-blue-200 rounded-lg transition-all shadow-sm hover:shadow-md inline-flex items-center justify-center backdrop-blur-sm"
                            title="พิมพ์/ดาวน์โหลด/ดูตัวอย่าง"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 6 2 18 2 18 9" />
                              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                              <rect width="12" height="8" x="6" y="14" />
                            </svg>
                          </button>
                        )}
                        {bill.status === 'pending' && (
                          <button
                            onClick={() => handleCancelBill(bill.id)}
                            className="p-2.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50/80 border border-transparent hover:border-red-200 rounded-lg transition-all shadow-sm hover:shadow-md inline-flex items-center justify-center backdrop-blur-sm"
                            title="ยกเลิกบิล"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          </button>
                        )} 
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* การแบ่งหน้า (จำลอง) */}
        <div className="p-5 border-t border-[var(--glass-border)] bg-white/30 backdrop-blur-md flex items-center justify-between text-sm text-[var(--text-muted)] font-medium">
          <div>
            แสดงผล 1 ถึง {filteredBills.length} จาก {filteredBills.length}{" "}
            รายการ
          </div>
          <div className="flex gap-2">
            <button
              className="glass-button-outline px-4 py-2 rounded-lg border border-slate-200 hover:bg-white/50 hover:border-slate-300 disabled:opacity-50 transition-all font-semibold"
              disabled
            >
              ก่อนหน้า
            </button>
            <button className="glass-button px-4 py-2 border border-transparent rounded-lg text-white font-bold shadow-sm">
              1
            </button>
            <button
              className="glass-button-outline px-4 py-2 rounded-lg border border-slate-200 hover:bg-white/50 hover:border-slate-300 disabled:opacity-50 transition-all font-semibold"
              disabled
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
      {/* ============ Modal บัญชีธนาคาร ============ */}
      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeBankModal} />
          <div className="relative glass-panel w-[95%] max-w-md rounded-3xl p-6 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)]">ตั้งค่าพร้อมเพย์รับเงิน</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">ตั้งค่าเบอร์พร้อมเพย์เพื่อให้ผู้เช่าสแกนจ่ายเงิน (QR จะสร้างอัตโนมัติตามยอดบิล)</p>
            </div>

            <div className="space-y-4">
              {/* เบอร์พร้อมเพย์ */}
              <div>
                <label className="text-sm font-bold text-[var(--text-muted)] block mb-1.5">เบอร์โทรศัพท์ / เลขประจำตัวประชาชน</label>
                <input
                  type="text"
                  value={bankForm.promptPayNumber || ""}
                  onChange={(e) => setBankForm({ ...bankForm, promptPayNumber: e.target.value })}
                  placeholder="เช่น 0812345678"
                  className="glass-input w-full px-4 py-2.5 rounded-xl font-mono"
                  maxLength={13}
                />
              </div>
            </div>

            {/* ปุ่มดำเนินการ */}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeBankModal} className="glass-button-outline px-4 py-2 rounded-lg font-bold">ยกเลิก</button>
              <button
                onClick={handleSaveBankAccount}
                disabled={isSavingBank}
                className="glass-button px-5 py-2 rounded-lg font-bold disabled:opacity-70 flex items-center gap-2"
              >
                {isSavingBank ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{bankAccount ? "กำลังอัปเดต..." : "กำลังบันทึก..."}</>
                ) : (bankAccount ? "อัปเดตข้อมูล" : "บันทึก")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateBillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* พื้นหลังมืด */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeCreateBill}
          />

          {/* โมดอล */}
          <div className="relative glass-panel w-[95%] max-w-md rounded-3xl p-6 space-y-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                สร้างบิลเดือนนี้
              </h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                ระบบจะสร้างบิลให้ผู้เช่าทุกห้องอัตโนมัติ
              </p>
            </div>

            {/* เนื้อหา */}
            <div className="space-y-4">
              {/* เดือนบิล */}
              <div>
                <label className="text-sm font-bold text-[var(--text-muted)]">
                  เดือนบิล
                </label>
                <input
                  type="month"
                  value={billMonth}
                  onChange={(e) => setBillMonth(e.target.value)}
                  className="glass-input w-full mt-2 px-4 py-2.5 rounded-xl"
                />
              </div>

              {/* วันครบกำหนดชำระ */}
              <div>
                <label className="text-sm font-bold text-[var(--text-muted)]">
                  วันครบกำหนดชำระ
                </label>
                <input
                  type="date"
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  className="glass-input w-full mt-2 px-4 py-2.5 rounded-xl"
                />
              </div>

              {/* เลือกห้อง */}
              <div>
                <label className="text-sm font-bold text-[var(--text-muted)]">
                  ห้อง
                </label>
                <div className="relative mt-2">
                  <select
                    value={selectedRoomId}
                    onChange={(e) => handleRoomSelect(e.target.value)}
                    disabled={loadingRooms}
                    className="glass-input w-full px-4 py-2.5 rounded-xl bg-white/50 backdrop-blur-md text-[var(--text-main)] font-medium cursor-pointer disabled:opacity-60"
                  >
                    <option value="" className="bg-white">
                      {loadingRooms ? "กำลังโหลดห้อง..." : "-- เลือกห้อง --"}
                    </option>
                    {rentedRooms.map((room) => (
                      <option key={room.id} value={room.id} className="bg-white">
                        ตึก {room.building} ห้อง {room.roomNumber} (ชั้น {room.floor}) — ฿{room.rentPrice.toLocaleString()}/เดือน
                      </option>
                    ))}
                  </select>
                  {loadingRooms && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-[var(--accent-brown)]/30 border-t-[var(--accent-brown)] rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {rentedRooms.length === 0 && !loadingRooms && (
                  <p className="text-xs text-amber-600 mt-1.5 font-medium">
                    ⚠️ ไม่พบห้องที่มีสถานะ "มีผู้เช่า" ในระบบ
                  </p>
                )}
              </div>

              {/* ค่าใช้จ่ายแต่ละรายการ */}
              <div>
                <label className="text-sm font-bold text-[var(--text-muted)] mb-2 block">
                  ค่าใช้จ่าย (บาท)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* ค่าเช่า */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block flex items-center gap-1">
                      🏠 ค่าเช่าห้อง
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        value={billAmount}
                        readOnly
                        placeholder="เลือกห้องก่อน"
                        className="glass-input w-full pl-7 pr-3 py-2 rounded-xl text-[var(--text-main)] font-medium text-sm bg-[var(--accent-light)]/30 cursor-not-allowed select-none"
                      />
                      {selectedRoomId && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-emerald-600 font-bold pointer-events-none">
                          🔒
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                      {selectedRoomId
                        ? "🔒 ล็อกตามราคาเช่าของห้อง"
                        : "กรุณาเลือกห้องก่อน"}
                    </p>
                  </div>

                  {/* ค่าน้ำ */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">
                      💧 ค่าน้ำ
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        value={waterFee}
                        onChange={(e) => setWaterFee(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                        className="glass-input w-full pl-7 pr-3 py-2 rounded-xl text-[var(--text-main)] font-medium text-sm"
                      />
                    </div>
                  </div>

                  {/* ค่าไฟ */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">
                      ⚡ ค่าไฟ
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        value={electricFee}
                        onChange={(e) => setElectricFee(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                        className="glass-input w-full pl-7 pr-3 py-2 rounded-xl text-[var(--text-main)] font-medium text-sm"
                      />
                    </div>
                  </div>

                  {/* ค่าขยะ */}
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-muted)] mb-1 block">
                      🗑️ ค่าขยะ
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold text-xs">฿</span>
                      <input
                        type="number"
                        min="0"
                        value={garbageFee}
                        onChange={(e) => setGarbageFee(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="0"
                        className="glass-input w-full pl-7 pr-3 py-2 rounded-xl text-[var(--text-main)] font-medium text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ยอดรวมอัตโนมัติ */}
              <div className="bg-[var(--accent-light)]/40 border border-[var(--accent-brown)]/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--text-main)]">
                  ยอดรวมทั้งหมด
                </span>
                <span className="text-xl font-bold text-[var(--accent-dark)]">
                  ฿{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* ปุ่มดำเนินการ */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeCreateBill}
                className="glass-button-outline px-4 py-2 rounded-lg font-bold"
              >
                ยกเลิก
              </button>

              <button
                onClick={handleCreateBill}
                disabled={isSubmitting}
                className="glass-button px-4 py-2 rounded-lg font-bold disabled:opacity-70 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  "สร้างบิล"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Modal ดูตัวอย่างบิล (Preview) ============ */}
      {previewBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm print:hidden" onClick={() => setPreviewBill(null)} />
          
          {/* ใบเสร็จ */}
          <div className="relative bg-white w-[95%] max-w-lg rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 overflow-y-auto max-h-[90vh] print:shadow-none print:rounded-none print:w-full print:max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            {/* แถบสีด้านบน */}
            <div className="h-2 bg-gradient-to-r from-[#8B5E3C] via-[#C4874F] to-[#E5B07A] print:h-3" />

            <div className="p-8 print:p-10">
              {/* หัวบิล */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-[#8B5E3C] flex items-center justify-center print:hidden">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">ใบเสร็จรับเงิน</h2>
                  </div>
                  <p className="text-sm text-gray-400 font-medium">หอพักหยาหยี๋ (Yayee Dormitory)</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">เลขที่</p>
                  <p className="text-lg font-extrabold text-[#8B5E3C]">{previewBill.displayBillNumber || previewBill.id}</p>
                </div>
              </div>

              {/* ข้อมูลผู้เช่า */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ผู้เช่า</p>
                  <p className="text-sm font-bold text-gray-800">{previewBill.tenantName}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ห้องพัก</p>
                  <p className="text-sm font-bold text-gray-800">{previewBill.room}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">กำหนดชำระเงิน</p>
                  <p className="text-sm font-bold text-gray-800">📅 {previewBill.dueDate}</p>
                </div>
              </div>

              {/* รายการค่าใช้จ่าย */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden mb-6">
                <div className="bg-gray-50 px-5 py-2.5 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">รายละเอียดค่าใช้จ่าย</p>
                </div>
                <div className="divide-y divide-gray-50">
                  <div className="flex justify-between items-center px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-sm">🏠</span>
                      <span className="text-sm font-semibold text-gray-700">ค่าเช่าห้องพัก</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">฿{(previewBill.rentAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center text-sm">💧</span>
                      <span className="text-sm font-semibold text-gray-700">ค่าน้ำประปา</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">฿{(previewBill.waterFee || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center text-sm">⚡</span>
                      <span className="text-sm font-semibold text-gray-700">ค่าไฟฟ้า</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">฿{(previewBill.electricFee || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-sm">🗑️</span>
                      <span className="text-sm font-semibold text-gray-700">ค่าขยะ</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">฿{(previewBill.garbageFee || 0).toLocaleString()}</span>
                  </div>
                  {/* ค่าปรับล่าช้า */}
                  {(() => {
                    if (previewBill.status === 'paid' || !previewBill.dueDate || previewBill.dueDate === '-') return null;
                    const today = new Date(); today.setHours(0,0,0,0);
                    const due = new Date(previewBill.dueDate); due.setHours(0,0,0,0);
                    const daysLate = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
                    const lateFee = daysLate * globalFees.lateFeePerDay;
                    if (daysLate === 0 || lateFee === 0) return null;
                    return (
                      <div className="flex justify-between items-center px-5 py-3.5 bg-red-50/50">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-sm">⏰</span>
                          <div>
                            <span className="text-sm font-semibold text-red-700">ค่าปรับล่าช้า</span>
                            <span className="ml-2 text-[10px] font-bold text-red-400 bg-red-100 px-1.5 py-0.5 rounded-full">{daysLate} วัน × ฿{globalFees.lateFeePerDay}/วัน</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-red-600">+฿{lateFee.toLocaleString()}</span>
                      </div>
                    );
                  })()}
                </div>
                {/* ยอดรวม */}
                {(() => {
                  const today = new Date(); today.setHours(0,0,0,0);
                  const due = previewBill.dueDate && previewBill.dueDate !== '-' ? new Date(previewBill.dueDate) : null;
                  if (due) due.setHours(0,0,0,0);
                  const daysLate = (due && previewBill.status !== 'paid') ? Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)) : 0;
                  const lateFee = daysLate * globalFees.lateFeePerDay;
                  const grandTotal = previewBill.amount + lateFee;
                  return (
                    <div className="bg-gradient-to-r from-[#8B5E3C]/10 to-[#C4874F]/10 px-5 py-4 border-t-2 border-[#8B5E3C]/20 flex justify-between items-center">
                      <div>
                        <span className="text-base font-extrabold text-gray-800">ยอดรวมทั้งสิ้น</span>
                        {lateFee > 0 && <span className="ml-2 text-xs font-bold text-red-500">(รวมค่าปรับ)</span>}
                      </div>
                      <span className="text-2xl font-extrabold text-[#8B5E3C]">฿{grandTotal.toLocaleString()}</span>
                    </div>
                  );
                })()}
              </div>

              {/* สถานะ */}
              <div className="flex items-center justify-center mb-6">
                {previewBill.status === 'paid' ? (
                  <span className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-50 text-emerald-700 border-2 border-emerald-300 rounded-full font-bold text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ชำระเงินแล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-5 py-2 bg-amber-50 text-amber-700 border-2 border-amber-200 rounded-full font-bold text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    รอการชำระเงิน
                  </span>
                )}
              </div>

              {/* Footer */}
              <p className="text-center text-[10px] text-gray-300 font-medium">ขอบคุณที่ใช้บริการ · Yayee Dormitory Management System</p>
            </div>

            {/* ปุ่ม */}
            <div className="px-8 pb-6 flex justify-end gap-3 print:hidden">
              <button onClick={() => setPreviewBill(null)} className="px-5 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-semibold transition-colors text-sm">
                ปิด
              </button>
              <button onClick={() => window.print()} className="px-5 py-2.5 bg-[#8B5E3C] hover:bg-[#734A2E] text-white rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>
                พิมพ์ใบนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
