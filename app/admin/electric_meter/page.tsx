"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, doc, setDoc, getDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "@/lib/toast";

interface Room {
  id: string;
  roomNumber: string;
  building: string;
  rentPrice: number;
  status?: string;
  tenantId?: string;
  tenantName?: string;
}

interface MeterReading {
  id?: string;
  roomId: string;
  roomNumber: string;
  month: string;
  reading: number | "";
  previousReading: number | "";
  units: number;
}

export default function ElectricMeterPage() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // ตัวเลือกเดือนและปี (YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // สถานะตัวกรอง
  const [filterBuilding, setFilterBuilding] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // การตั้งค่าค่าธรรมเนียมส่วนกลาง
  const [globalFees, setGlobalFees] = useState({
    waterFeeFlat: 150,
    garbageFeeFlat: 30,
    electricUnitPrice: 8,
    billDueDaysLimit: 5
  });

  const [rentedRooms, setRentedRooms] = useState<Room[]>([]);
  const [readings, setReadings] = useState<Record<string, MeterReading>>({});
  
  // สถานะสำหรับติดตามบิลที่สร้างแล้ว
  const [generatedBillsMap, setGeneratedBillsMap] = useState<Record<string, boolean>>({});

  const handleUpdateUnitFee = async (newFee: number) => {
    try {
      const docRef = doc(db, "settings", "general");
      await setDoc(docRef, { electricUnitPrice: newFee }, { merge: true });
      setGlobalFees(prev => ({ ...prev, electricUnitPrice: newFee }));
      toast.success("อัปเดตราคาค่าไฟสำเร็จ");
    } catch (e) {
      console.error(e);
      toast.error("อัปเดตราคาไม่สำเร็จ");
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
          billDueDaysLimit: data.billDueDaysLimit !== undefined ? data.billDueDaysLimit : 5
        });
      }
    } catch (error) {
      console.error("Error fetching global fees:", error);
    }
  };

  const getPreviousMonthOptions = (monthObj: string) => {
    const date = new Date(`${monthObj}-01`);
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูลห้องที่ถูกเช่าทั้งหมด
      const roomsSnapshot = await getDocs(collection(db, "rooms"));
      const roomsTemp: any[] = [];
      const tenantIds = new Set<string>();
      
      roomsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.tenantId) tenantIds.add(data.tenantId);
        roomsTemp.push({ id: doc.id, ...data });
      });

      // 2. ข้อมูลชื่อผู้เช่าจาก users
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
        tenantName: r.tenantId ? (usersMap.get(r.tenantId) || "ไม่มีผู้เช่า") : "ไม่มีผู้เช่า",
        rentPrice: r.rentPrice || 0
      })) as Room[];

      rooms.sort((a, b) => {
        if (a.building === b.building) return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
        return a.building.localeCompare(b.building);
      });
      setRentedRooms(rooms);

      // 3. ดึงข้อมูลการจดมิเตอร์ของเดือนที่เลือก
      const currentReadingsQ = query(collection(db, "meterReadings"), where("month", "==", selectedMonth));
      const currentReadingsSnap = await getDocs(currentReadingsQ);
      const currentReadingsData: Record<string, MeterReading> = {};
      currentReadingsSnap.forEach((doc) => {
        const data = doc.data() as MeterReading;
        currentReadingsData[data.roomId] = { ...data, id: doc.id };
      });

      // 4. ดึงข้อมูลการจดมิเตอร์เดือนก่อนหน้า เพื่อคำนวณค่าก่อนหน้า
      const previousMonth = getPreviousMonthOptions(selectedMonth);
      const prevReadingsQ = query(collection(db, "meterReadings"), where("month", "==", previousMonth));
      const prevReadingsSnap = await getDocs(prevReadingsQ);
      const prevReadingsData: Record<string, number> = {};
      prevReadingsSnap.forEach((doc) => {
        const data = doc.data() as MeterReading;
        if (typeof data.reading === 'number') {
          prevReadingsData[data.roomId] = data.reading;
        }
      });

      // 5. ตั้งค่า state เริ่มต้นสำหรับ UI
      const initialReadings: Record<string, MeterReading> = {};
      rooms.forEach((room) => {
        if (currentReadingsData[room.id]) {
          // มีข้อมูลของเดือนนี้แล้ว
          initialReadings[room.id] = currentReadingsData[room.id];
        } else {
          // ยังไม่มีข้อมูล สร้างเทมเพลตว่าง
          const prevRead = prevReadingsData[room.id] !== undefined ? prevReadingsData[room.id] : 0;
          initialReadings[room.id] = {
            roomId: room.id,
            roomNumber: `ตึก ${room.building} ห้อง ${room.roomNumber}`,
            month: selectedMonth,
            reading: 0,
            previousReading: prevRead,
            units: 0
          };
        }
      });
      setReadings(initialReadings);

      // 6. ตรวจสอบว่ามีบิลได้สร้างแล้วสำหรับเดือนนี้ (ไม่รวมบิลที่ยกเลิก)
      const billsQ = query(collection(db, "bills"), where("month", "==", selectedMonth));
      const billsSnap = await getDocs(billsQ);
      const tempGeneratedMap: Record<string, boolean> = {};
      billsSnap.forEach(d => {
        const billStatus = d.data().status;
        // ล็อกแถวเฉพาะเมื่อบิลมีการเคลื่อนไหว (รอดำเนินการหรือชำระแล้ว) ไม่รวมบิลที่ยกเลิก
        if (billStatus === "pending" || billStatus === "paid") {
          tempGeneratedMap[d.data().roomId] = true;
        }
      });
      setGeneratedBillsMap(tempGeneratedMap);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("ดึงข้อมูลห้องไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalFees();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleReadingChange = (roomId: string, field: "reading" | "previousReading" | "units", value: string) => {
    setReadings(prev => {
      const roomData = { ...prev[roomId] };
      const numValue = value === "" ? "" : Number(value);
      
      if (field === "reading") {
         roomData.reading = numValue;
      } else if (field === "previousReading") {
         roomData.previousReading = numValue;
      } else if (field === "units") {
         roomData.units = numValue === "" ? 0 : Number(numValue);
      }

      // คำนวณหน่วยอัตโนมัติเฉพาะเมื่อมีการเปลี่ยนแปลงการอ่านค่าหรือค่าก่อนหน้า
      if (field !== "units") {
        if (typeof roomData.reading === "number" && typeof roomData.previousReading === "number") {
          roomData.units = Math.max(0, roomData.reading - roomData.previousReading);
        } else {
          roomData.units = 0;
        }
      }

      return { ...prev, [roomId]: roomData };
    });
  };

  const handleSaveSingleReading = async (roomId: string) => {
    try {
      const data = readings[roomId];
      if (!data) return;
      const docId = `${roomId}_${selectedMonth}`;
      const docRef = doc(db, "meterReadings", docId);
      await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error(e);
      toast.error("บันทึกข้อมูลไม่สำเร็จ");
    }
  };

  const handleSaveReadings = async () => {
    setIsSaving(true);
    try {
      for (const roomId in readings) {
        const data = readings[roomId];
        // สร้าง ID รูปแบบผสม: roomId_YYYY-MM
        const docId = `${roomId}_${selectedMonth}`;
        const docRef = doc(db, "meterReadings", docId);
        
        await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
      }
      toast.success("บันทึกมิเตอร์สำเร็จ");
    } catch (e) {
      console.error(e);
      toast.error("บันทึกมิเตอร์ไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateBills = async () => {
    const unrecordedRooms = Object.values(readings).filter(r => r.reading === "" || r.previousReading === "");
    if (unrecordedRooms.length > 0) {
      if (!window.confirm(`มี ${unrecordedRooms.length} ห้องที่ยังไม่ได้กรอกมิเตอร์ คุณต้องการออกบิลเฉพาะห้องที่กรอกแล้วใช่หรือไม่?`)) {
        return;
      }
    } else {
      if (!window.confirm("ยืนยันการออกบิลให้ทุกห้อง? ระบบจะสร้างบิลใหม่ในหน้า บิลและการชำระเงิน")) {
        return;
      }
    }

    setIsGenerating(true);
    try {
      // ดึงข้อมูลจำนวนบิลล่าสุดเพื่อกำหนดหมายเลขบิล
      const billsSnapshot = await getDocs(query(collection(db, "bills")));
      let totalBills = billsSnapshot.size;

      // ตรวจสอบให้แน่ใจว่าบันทึกการอ่านค่ามิเตอร์ก่อน
      await handleSaveReadings();

      const dueDateObj = new Date();
      dueDateObj.setDate(dueDateObj.getDate() + globalFees.billDueDaysLimit);
      const generatedDueDate = dueDateObj.toISOString().split("T")[0]; // YYYY-MM-DD

      let generatedCount = 0;

      for (const room of rentedRooms) {
        // ข้ามหากห้องไม่ถูกเช่าหรือไม่มีผู้เช่า
        if (room.status !== "มีผู้เช่า" || !room.tenantId) continue;

        // ข้ามหากสร้างบิลของเดือนนี้แล้ว
        if (generatedBillsMap[room.id]) continue;

        const rd = readings[room.id];
        // ข้ามหากข้อมูลการอ่านค่าไม่สมบูรณ์
        if (rd.reading === "" || rd.previousReading === "") continue;

        // คำนวณค่าธรรมเนียม — คำนวณหน่วยโดยตรงจากผลต่างการอ่านค่า
        const units = Math.max(0, Number(rd.reading) - Number(rd.previousReading));
        const electricTotal = units * globalFees.electricUnitPrice;
        const sumTotal = room.rentPrice + electricTotal + globalFees.waterFeeFlat + globalFees.garbageFeeFlat;

        totalBills += 1;
        const nextBillNumber = `INV-${String(totalBills).padStart(4, '0')}`;

        const docRef = doc(collection(db, "bills"));
        await setDoc(docRef, {
          tenantId: room.tenantId,
          tenantName: room.tenantName,
          roomId: room.id,
          roomNumber: room.roomNumber,
          building: room.building,
          month: selectedMonth,
          dueDate: generatedDueDate,
          rentAmount: room.rentPrice,
          waterFee: globalFees.waterFeeFlat,
          electricFee: electricTotal,
          garbageFee: globalFees.garbageFeeFlat,
          totalAmount: sumTotal,
          status: "pending",
          billNumber: nextBillNumber,
          createdAt: new Date().toISOString()
        });

        // ทำเครื่องหมายในสถานะ local ว่าสร้างบิลแล้ว
        generatedBillsMap[room.id] = true;
        generatedCount++;
      }

      setGeneratedBillsMap({...generatedBillsMap});
      toast.success(`ออกบิลสำเร็จ ${generatedCount} บิล`);

    } catch (e) {
      console.error(e);
      toast.error("มีข้อผิดพลาดในการออกบิล");
    } finally {
      setIsGenerating(false);
    }
  };

  const uniqueBuildings = Array.from(new Set(rentedRooms.map(r => r.building))).sort();
  const filteredRooms = rentedRooms.filter(room => {
    const matchBuilding = filterBuilding === "all" || room.building === filterBuilding;
    const matchStatus = filterStatus === "all" || 
                        (filterStatus === "rented" && room.status === "มีผู้เช่า") ||
                        (filterStatus === "vacant" && room.status !== "มีผู้เช่า");
    return matchBuilding && matchStatus;
  });

  if (loading && rentedRooms.length === 0) {
    return <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-brown)]"></div></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">
      {/* ส่วนหัว */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight flex items-center gap-2">
            <span className="text-[var(--accent-brown)]">⚡</span>
            จัดการมิเตอร์ไฟ & ออกบิลอัตโนมัติ
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            จดเลขมิเตอร์เพื่อคำนวณหน่วยไฟฟ้าที่ใช้ และสร้างบิลเรียกเก็บเงินผู้เช่าส่งตรงเข้าสู่ระบบ
          </p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-3xl relative overflow-visible space-y-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white/40 p-4 rounded-2xl border border-[var(--glass-border)]">
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="space-y-2 min-w-0">
              <label className="text-sm font-bold text-[var(--text-main)]">เดือนประจำบิล</label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="glass-input px-4 py-2.5 rounded-xl font-bold text-gray-800 w-full min-w-[180px] overflow-hidden"
              />
            </div>
            
            <div className="space-y-2 border-l border-[var(--glass-border)] pl-4 hidden sm:block"></div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-main)]">ตึก</label>
              <select 
                value={filterBuilding}
                onChange={(e) => setFilterBuilding(e.target.value)}
                className="glass-input px-4 py-2.5 rounded-xl font-medium text-gray-800 w-full min-w-[120px] focus:outline-none focus:border-[var(--accent-brown)]"
              >
                <option value="all">ทุกตึก</option>
                {uniqueBuildings.map(b => (
                  <option key={b} value={b}>ตึก {b}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--text-main)]">สถานะห้อง</label>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="glass-input px-4 py-2.5 rounded-xl font-medium text-gray-800 w-full min-w-[150px] focus:outline-none focus:border-[var(--accent-brown)]"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="rented">🟢 มีผู้เช่า</option>
                <option value="vacant">⚪ ห้องว่าง</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto mt-4 md:mt-0 justify-end">
             <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl flex items-center gap-2 font-medium whitespace-nowrap">
                <span>ค่าไฟ:</span>
                <input 
                  type="number" 
                  className="w-16 px-1.5 py-0.5 rounded text-center border border-amber-300 bg-white text-[var(--accent-dark)] font-bold focus:outline-none focus:ring-2 focus:ring-amber-500" 
                  value={globalFees.electricUnitPrice}
                  step="0.01"
                  onChange={(e) => setGlobalFees(prev => ({...prev, electricUnitPrice: Number(e.target.value)}))}
                  onBlur={(e) => handleUpdateUnitFee(Number(e.target.value))}
                />
                <span>บ./หน่วย</span>
             </div>
             <button 
                onClick={handleGenerateBills} 
                className="glass-button px-6 py-2.5 rounded-xl text-white font-bold shadow-md hover:scale-[1.02] transition-transform whitespace-nowrap"
                disabled={isGenerating || rentedRooms.length === 0}
             >
               {isGenerating ? "กำลังสร้างบิล..." : "เริ่มออกบิลให้ทุกห้อง"}
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--glass-border)]">
           <table className="w-full text-sm text-left">
              <thead className="bg-[#FAEED1]/50 border-b border-[var(--glass-border)] text-[var(--accent-dark)]">
                 <tr>
                    <th className="px-5 py-4 font-bold">ห้อง</th>
                    <th className="px-5 py-4 font-bold">ผู้เช่า</th>
                    <th className="px-5 py-4 font-bold text-right text-xs">เดือนก่อนหน้า<br/><span className="text-[10px] text-gray-500 font-normal">(แก้ไขได้)</span></th>
                    <th className="px-5 py-4 font-bold text-right text-xs">เดือนนี้<br/><span className="text-[10px] text-gray-500 font-normal">(จดมิเตอร์ใหม่)</span></th>
                    <th className="px-5 py-4 font-bold text-center">สถานะบิล</th>
                 </tr>
              </thead>
               <tbody className="divide-y divide-[var(--glass-border)] bg-white/30">
                  {filteredRooms.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="text-center py-12 text-[var(--text-muted)] font-medium">ไม่พบข้อมูลห้องพักที่ตรงกับเงื่อนไข</td>
                     </tr>
                  ) : (
                    filteredRooms.map(room => {
                       const rd = readings[room.id];
                       const isGenerated = generatedBillsMap[room.id];
                       if (!rd) return null; // Safety check
                       
                       return (
                          <tr key={room.id} className="hover:bg-white/50 transition-colors">
                             <td className="px-5 py-3 font-semibold text-[var(--text-main)] whitespace-nowrap">
                                <span className="bg-white/60 px-2 py-1 rounded-md text-xs mr-2 border border-gray-100">ตึก {room.building}</span>
                                ห้อง {room.roomNumber}
                             </td>
                             <td className="px-5 py-3 font-medium text-[var(--text-muted)] truncate max-w-[150px]">
                                {room.tenantName}
                                {room.status !== "มีผู้เช่า" && <span className="ml-2 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">ห้องว่าง</span>}
                             </td>
                             <td className="px-5 py-3 text-right">
                                <input 
                                   type="number" 
                                   className="glass-input w-24 px-2 py-1.5 text-right font-medium rounded-lg text-sm bg-gray-50/50"
                                   placeholder="0"
                                   min="0"
                                   value={rd.previousReading}
                                   onChange={e => handleReadingChange(room.id, "previousReading", e.target.value)}
                                   onBlur={() => handleSaveSingleReading(room.id)}
                                   disabled={isGenerated}
                                />
                             </td>
                             <td className="px-5 py-3 text-right">
                                <input 
                                   type="number" 
                                   className="glass-input w-24 px-2 py-1.5 text-right font-bold text-[var(--accent-dark)] rounded-lg text-sm border-[var(--accent-brown)]/30 focus:border-[var(--accent-brown)]"
                                   placeholder="พิมพ์เลย..."
                                   min="0"
                                   value={rd.reading}
                                   onChange={e => handleReadingChange(room.id, "reading", e.target.value)}
                                   onBlur={() => handleSaveSingleReading(room.id)}
                                   disabled={isGenerated}
                                />
                             </td>
                             <td className="px-5 py-3 text-center">
                                {room.status !== "มีผู้เช่า" ? (
                                   <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                                      ห้องว่าง (ไม่ออกบิล)
                                   </span>
                                ) : isGenerated ? (
                                   <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      ออกบิลแล้ว
                                   </span>
                                ) : (
                                   <span className="text-xs font-medium text-amber-500 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                                      {rd.reading === "" ? "รอจดมิเตอร์" : "รอออกบิล"}
                                   </span>
                                )}
                             </td>
                          </tr>
                       );
                    })
                 )}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}
