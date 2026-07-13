"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Room {
  id: string;
  roomNumber: string;
  building: string;
  floor: string;
  status: "ว่าง" | "มีผู้เช่า" | "กำลังซ่อมแซม";
  roomType: "aircon" | "fan";
  rentPrice: number;
  image?: string; // ลิงก์รูปภาพ (ไม่ต้องระบุก็ได้)
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  // สถานะของหน้าต่างป๊อปอัป (Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);

  // สถานะสำหรับ Quick Add (เพิ่มรวดเร็ว)
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickFormData, setQuickFormData] = useState({
    startRoomNumber: "101",
    roomCount: 10,
    building: "A",
    floor: "1",
    status: "ว่าง" as Room["status"],
    roomType: "fan" as Room["roomType"],
    rentPrice: 3500,
    image: "",
  });

  // สถานะสำหรับ Bulk Edit & Select
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkFieldsToUpdate, setBulkFieldsToUpdate] = useState({
    building: false,
    floor: false,
    status: false,
    roomType: false,
    rentPrice: false,
    image: false,
  });
  const [bulkFormData, setBulkFormData] = useState({
    building: "A",
    floor: "1",
    status: "ว่าง" as Room["status"],
    roomType: "fan" as Room["roomType"],
    rentPrice: 3500,
    image: "",
  });

  // สถานะของฟอร์มกรอกข้อมูล
  const [formData, setFormData] = useState({
    roomNumber: "",
    building: "A",
    floor: "1",
    status: "ว่าง" as Room["status"],
    roomType: "fan" as Room["roomType"],
    rentPrice: 3500,
    image: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      // ดึงข้อมูลห้องทั้งหมดโดยไม่เรียงลำดับเพื่อหลีกเลี่ยงการใช้ index พิเศษ (composite index)
      const q = query(collection(db, "rooms"));
      const querySnapshot = await getDocs(q);
      const roomsData: Room[] = [];
      querySnapshot.forEach((doc) => {
        roomsData.push({ id: doc.id, ...doc.data() } as Room);
      });
      
      // จัดเรียงลำดับด้วยโค้ด Javascript แทน: ตึกก่อน จากนั้นจัดเรียงหมายเลขห้องแบบตัวเลข
      roomsData.sort((a, b) => {
        if (a.building === b.building) {
          return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
        }
        return a.building.localeCompare(b.building);
      });
      
      setRooms(roomsData);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleOpenModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setFormData({
        roomNumber: room.roomNumber,
        building: room.building,
        floor: room.floor,
        status: room.status,
        roomType: room.roomType || "fan",
        rentPrice: room.rentPrice,
        image: room.image || "",
      });
      setImagePreview(room.image || null);
    } else {
      setEditingRoom(null);
      setFormData({
        roomNumber: "",
        building: "A",
        floor: "1",
        status: "ว่าง",
        roomType: "fan",
        rentPrice: 3500,
        image: "",
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSubmit(true);

    try {
      let imageUrl = formData.image;

      // ตรวจสอบให้แน่ใจว่ามีการระบุตึกและหมายเลขห้องเพื่อสร้างชื่อไฟล์ที่ไม่ซ้ำกัน
      if (!formData.building || !formData.roomNumber) {
         throw new Error("กรุณาระบุตึกและหมายเลขห้อง");
      }

      // อัปโหลดรูปภาพใหม่ ผ่าน Vercel Blob แทน Firebase Storage
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload-room-image", {
          method: "POST",
          body: uploadData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
        }

        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      const roomDataToSave = {
        ...formData,
        image: imageUrl
      };

      if (editingRoom) {
        // อัปเดตข้อมูล
        const roomRef = doc(db, "rooms", editingRoom.id);
        await updateDoc(roomRef, roomDataToSave);
      } else {
        // สร้างข้อมูลใหม่
        await addDoc(collection(db, "rooms"), roomDataToSave);
      }
      handleCloseModal();
      fetchRooms(); // โหลดข้อมูลห้องใหม่หลังจากบันทึก
    } catch (error) {
      console.error("Error saving room:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSubmit(true);

    try {
      let imageUrl = quickFormData.image;

      if (!quickFormData.building || !quickFormData.startRoomNumber || quickFormData.roomCount < 1) {
         throw new Error("กรุณาระบุข้อมูลให้ครบถ้วน");
      }

      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload-room-image", {
          method: "POST",
          body: uploadData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
        }

        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      const startNum = parseInt(quickFormData.startRoomNumber.replace(/[^0-9]/g, '')) || 0;
      const prefix = quickFormData.startRoomNumber.replace(/[0-9]/g, '');
      
      const promises = [];
      for (let i = 0; i < quickFormData.roomCount; i++) {
        // ให้มั่นใจว่าตัวเลขจะมีจำนวนหลักเท่าเดิม (เช่น 01, 02..)
        const numMatch = quickFormData.startRoomNumber.match(/[0-9]+/);
        const paddingLength = numMatch ? numMatch[0].length : 0;
        
        let currentRoomStr = (startNum + i).toString();
        if (paddingLength > 0 && currentRoomStr.length < paddingLength) {
           currentRoomStr = currentRoomStr.padStart(paddingLength, '0');
        }
        
        const currentRoomNum = `${prefix}${currentRoomStr}`;
        const roomDataToSave = {
          roomNumber: currentRoomNum,
          building: quickFormData.building,
          floor: quickFormData.floor,
          status: quickFormData.status,
          roomType: quickFormData.roomType,
          rentPrice: quickFormData.rentPrice,
          image: imageUrl
        };
        promises.push(addDoc(collection(db, "rooms"), roomDataToSave));
      }

      await Promise.all(promises);
      
      setIsQuickModalOpen(false);
      setImageFile(null);
      setImagePreview(null);
      fetchRooms();
    } catch (error) {
      console.error("Error Quick saving rooms:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบห้องนี้? ข้อมูลจะไม่สามารถกู้คืนได้")) {
      try {
        await deleteDoc(doc(db, "rooms", id));
        fetchRooms(); // โหลดข้อมูลใหม่หลังจากลบสำเร็จ
        setSelectedRoomIds(prev => prev.filter(roomId => roomId !== id));
      } catch (error) {
        console.error("Error deleting room:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedRoomIds.length === rooms.length && rooms.length > 0) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(rooms.map(r => r.id));
    }
  };

  const toggleSelectRoom = (id: string) => {
    setSelectedRoomIds(prev => 
      prev.includes(id) ? prev.filter(roomId => roomId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบห้องพักที่เลือกจำนวน ${selectedRoomIds.length} ห้อง? ข้อมูลจะไม่สามารถกู้คืนได้`)) {
      setIsLoadingSubmit(true);
      try {
        const promises = selectedRoomIds.map(id => deleteDoc(doc(db, "rooms", id)));
        await Promise.all(promises);
        setSelectedRoomIds([]);
        fetchRooms();
      } catch (error) {
        console.error("Error bulk deleting:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูลที่เลือก");
      } finally {
        setIsLoadingSubmit(false);
      }
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingSubmit(true);

    try {
      let imageUrl = bulkFormData.image;

      if (bulkFieldsToUpdate.image && imageFile) {
        const uploadData = new FormData();
        uploadData.append("file", imageFile);

        const uploadRes = await fetch("/api/upload-room-image", {
          method: "POST",
          body: uploadData,
        });

        if (!uploadRes.ok) {
           throw new Error("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ");
        }

        const data = await uploadRes.json();
        imageUrl = data.url;
      }

      const updates: any = {};
      if (bulkFieldsToUpdate.building) updates.building = bulkFormData.building;
      if (bulkFieldsToUpdate.floor) updates.floor = bulkFormData.floor;
      if (bulkFieldsToUpdate.status) updates.status = bulkFormData.status;
      if (bulkFieldsToUpdate.roomType) updates.roomType = bulkFormData.roomType;
      if (bulkFieldsToUpdate.rentPrice) updates.rentPrice = bulkFormData.rentPrice;
      if (bulkFieldsToUpdate.image) updates.image = imageUrl;

      if (Object.keys(updates).length > 0) {
        const promises = selectedRoomIds.map(id => updateDoc(doc(db, "rooms", id), updates));
        await Promise.all(promises);
      }

      setIsBulkEditModalOpen(false);
      setSelectedRoomIds([]);
      setImageFile(null);
      setImagePreview(null);
      
      // รีเซ็ตฟิลด์สำหรับการจัดการหลายรายการ
      setBulkFieldsToUpdate({
        building: false, floor: false, status: false, roomType: false, rentPrice: false, image: false
      });
      fetchRooms();
    } catch (error) {
      console.error("Error bulk saving:", error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลแก้ไขหลายรายการ");
    } finally {
      setIsLoadingSubmit(false);
    }
  };

  // ฟังก์ชันช่วยกำหนดสีสถานะห้อง
  const getStatusColor = (status: Room["status"]) => {
    switch (status) {
      case "ว่าง": return "bg-emerald-50/80 text-emerald-700 border-emerald-200 backdrop-blur-sm";
      case "มีผู้เช่า": return "bg-blue-50/80 text-blue-700 border-blue-200 backdrop-blur-sm";
      case "กำลังซ่อมแซม": return "bg-amber-50/80 text-amber-700 border-amber-200 backdrop-blur-sm";
      default: return "bg-slate-50/80 text-slate-700 border-slate-200 backdrop-blur-sm";
    }
  };

  // หารูปภาพทั้งหมดที่มีอยู่แล้วเพื่อนำมาใช้ซ้ำ
  const existingImages = Array.from(new Set(rooms.map(r => r.image).filter(Boolean))) as string[];

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 relative z-10 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] tracking-tight">จัดการตึกและห้องพัก</h1>
          <p className="text-[var(--text-muted)] mt-1">เพิ่ม ลบ และแก้ไขข้อมูลห้องพักในระบบ</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {isSelectionMode ? (
            <div className="animate-in fade-in flex gap-2 mr-2 border-r border-[var(--glass-border)] pr-4 py-1 flex-wrap">
              <span className="text-sm font-bold text-[var(--accent-dark)] self-center mr-2 hidden sm:inline-block">เลือกแล้ว {selectedRoomIds.length}</span>
              {selectedRoomIds.length > 0 && (
                <>
                  <button 
                    onClick={() => {
                       setBulkFieldsToUpdate({ building: false, floor: false, status: false, roomType: false, rentPrice: false, image: false });
                       setImageFile(null);
                       setImagePreview(null);
                       setIsBulkEditModalOpen(true);
                    }}
                    className="glass-button-outline px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 group hover:text-blue-600 hover:border-blue-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    <span className="hidden sm:inline">แก้ไขที่เลือก</span>
                  </button>
                  <button 
                    onClick={handleBulkDelete}
                    className="glass-button-outline px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 group hover:text-red-600 hover:border-red-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    <span className="hidden sm:inline">ลบที่เลือก</span>
                  </button>
                </>
              )}
              <button 
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedRoomIds([]);
                }}
                className="glass-button-outline px-3 py-2 rounded-xl text-sm font-semibold flex items-center justify-center group hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                title="ยกเลิกการเลือก"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ) : (
            <div className="animate-in fade-in flex mr-2 border-r border-[var(--glass-border)] pr-4 py-1">
              <button 
                onClick={() => setIsSelectionMode(true)}
                className="glass-button-outline px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 group hover:bg-[var(--accent-light)]/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span className="hidden sm:inline">เลือกหลายรายการ</span>
              </button>
            </div>
          )}
          <button 
            onClick={() => {
              setQuickFormData({
                startRoomNumber: "101",
                roomCount: 10,
                building: "A",
                floor: "1",
                status: "ว่าง",
                roomType: "fan",
                rentPrice: 3500,
                image: "",
              });
              setImageFile(null);
              setImagePreview(null);
              setIsQuickModalOpen(true);
            }}
            className="glass-button-outline px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 group"
            title="เพิ่มทีละหลายห้อง"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
            เพิ่มรวดเร็ว
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="glass-button px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-90 transition-transform"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            เพิ่มห้องพัก
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-3xl flex flex-col">
        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex justify-center items-center h-full py-32">
              <div className="w-12 h-12 border-4 border-[var(--accent-light)] border-t-[var(--accent-brown)] rounded-full animate-spin"></div>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/50 border border-[var(--glass-border)] shadow-sm mb-6 relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-light)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-brown)] relative z-10 group-hover:scale-110 transition-transform"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <p className="text-[var(--text-muted)] text-lg mb-6">ยังไม่มีข้อมูลห้องพัก</p>
              <button 
                onClick={() => handleOpenModal()}
                className="glass-button-outline px-6 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                + เพิ่มห้องพักแรกของคุณ
              </button>
            </div>
          ) : (
            <table className="w-full text-sm text-left relative z-10 border-collapse block md:table">
              <thead className="hidden md:table-header-group text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] uppercase border-b border-[var(--glass-border)] sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  {isSelectionMode && (
                    <th className="px-4 py-4 w-12 text-center animate-in slide-in-from-left-2 fade-in">
                      <input 
                        type="checkbox" 
                        checked={rooms.length > 0 && selectedRoomIds.length === rooms.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]"
                      />
                    </th>
                  )}
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">หมายเลขห้อง</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">ตึก</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">ชั้น</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">ประเภทห้อง</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">ราคาเช่า (บาท/เดือน)</th>
                  <th className="px-6 py-4 font-semibold whitespace-nowrap">สถานะ</th>
                  <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {rooms.map((room) => (
                  <tr key={room.id} className={`block md:table-row border border-[var(--glass-border)] md:border-0 md:border-b transition-colors mb-4 md:mb-0 p-4 md:p-0 rounded-2xl md:rounded-none bg-white/40 md:bg-transparent last:border-0 group ${(isSelectionMode && selectedRoomIds.includes(room.id)) ? 'ring-2 ring-[var(--accent-brown)] md:ring-0 md:bg-[var(--accent-light)]/20 shadow-inner' : 'hover:bg-white/60 md:hover:bg-white/40'}`}>
                    {isSelectionMode && (
                      <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-4 md:py-4 text-center animate-in slide-in-from-left-2 fade-in border-b border-[var(--glass-border)] md:border-0">
                        <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">เลือกรายการนี้</span>
                        <input 
                          type="checkbox" 
                          checked={selectedRoomIds.includes(room.id)}
                          onChange={() => toggleSelectRoom(room.id)}
                          className="w-5 h-5 md:w-4 md:h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]"
                        />
                      </td>
                    )}
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 font-bold text-[var(--text-main)] text-base border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">หมายเลขห้อง</span>
                      {room.roomNumber}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-main)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ตึก</span>
                      <span><span className="hidden md:inline">ตึก </span>{room.building}</span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-main)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ชั้น</span>
                      <span><span className="hidden md:inline">ชั้น </span>{room.floor}</span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ประเภทห้อง</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${
                         room.roomType === 'aircon' ? 'bg-sky-50/80 text-sky-700 border-sky-200 backdrop-blur-sm' : 'bg-slate-50/80 text-slate-700 border-slate-200 backdrop-blur-sm'
                      }`}>
                        {room.roomType === 'aircon' ? '❄️ ห้องแอร์' : '🌀 ห้องพัดลม'}
                      </span>
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 text-[var(--text-muted)] font-medium border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">ราคาเช่า</span>
                      ฿{room.rentPrice.toLocaleString()}
                    </td>
                    <td className="flex justify-between md:table-cell items-center px-2 py-3 md:px-6 md:py-4 border-b border-[var(--glass-border)] md:border-0">
                      <span className="md:hidden font-semibold text-xs text-[var(--text-muted)] uppercase">สถานะ</span>
                       <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${getStatusColor(room.status)}`}>
                        {room.status}
                      </span>
                    </td>
                    <td className="flex justify-end gap-2 md:table-cell px-2 py-3 md:px-6 md:py-4 text-right space-x-0 md:space-x-2 mt-2 md:mt-0">
                       <button 
                        onClick={() => handleOpenModal(room)}
                        className="p-2.5 text-[var(--text-muted)] hover:text-blue-600 hover:bg-blue-50/80 border border-transparent hover:border-blue-200 rounded-xl transition-all shadow-sm hover:shadow-md inline-flex items-center justify-center opacity-70 group-hover:opacity-100 backdrop-blur-sm"
                        title="แก้ไข"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(room.id)}
                        className="p-2.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50/80 border border-transparent hover:border-red-200 rounded-xl transition-all shadow-sm hover:shadow-md inline-flex items-center justify-center opacity-70 group-hover:opacity-100 backdrop-blur-sm"
                        title="ลบ"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* หน้าต่างป๊อปอัปสำหรับเพิ่ม/แก้ไข (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative border border-white/40 shadow-2xl">
            {/* ลูกแก้วตกแต่งสำหรับ Modal */}
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-2xl opacity-40 pointer-events-none z-0"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-[var(--accent-dark)] rounded-full mix-blend-multiply filter blur-xl opacity-30 pointer-events-none z-0"></div>
            <div className="px-6 py-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-white/30 backdrop-blur-md relative z-10">
              <h3 className="text-xl font-bold text-[var(--text-main)]">
                {editingRoom ? "แก้ไขข้อมูลห้องพัก" : "เพิ่มห้องพักใหม่"}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="p-2.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-white/50 rounded-lg transition-all border border-transparent hover:border-[var(--glass-border)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar relative z-10">
              
              {/* ส่วนอัปโหลดรูปภาพ */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-main)] ml-1">รูปภาพห้องพัก</label>
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-44 glass-panel border-[1.5px] border-dashed rounded-2xl cursor-pointer hover:bg-white/50 transition-all overflow-hidden relative group">
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                         <img src={imagePreview} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-medium flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> เปลี่ยนรูปภาพ</span>
                         </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="w-12 h-12 rounded-full bg-[var(--accent-light)]/50 border border-[var(--accent-brown)]/30 text-[var(--accent-brown)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                            </svg>
                        </div>
                        <p className="mb-1 text-sm text-[var(--text-main)] font-bold">คลิกเพื่ออัปโหลดรูปภาพ</p>
                        <p className="text-xs text-[var(--text-muted)] font-medium">SVG, PNG, JPG หรือ GIF</p>
                      </div>
                    )}
                    <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
                
                {existingImages.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[var(--glass-border)]">
                    <p className="text-xs text-[var(--text-main)] opacity-70 font-bold mb-2 ml-1">หรือเลือกรูปภาพที่เคยอัปโหลดแล้ว:</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 px-1 custom-scrollbar">
                      {existingImages.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(img);
                            setFormData({...formData, image: img});
                          }}
                          className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 ${imagePreview === img && !imageFile ? 'border-[var(--accent-brown)] shadow-lg scale-105' : 'border-white/30 shadow-sm hover:scale-105 opacity-80 hover:opacity-100'}`}
                        >
                          <img src={img} alt={`recent-${idx}`} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-main)] ml-1">หมายเลขห้อง</label>
                <input 
                  type="text" 
                  required
                  value={formData.roomNumber}
                  onChange={(e) => setFormData({...formData, roomNumber: e.target.value})}
                  className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] placeholder-slate-400 font-medium"
                  placeholder="เช่น 101, 102"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ตึก</label>
                  <input 
                    type="text"
                    list="buildings-list"
                    value={formData.building}
                    onChange={(e) => setFormData({...formData, building: e.target.value})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                    placeholder="เช่น A, B, หรือพิมพ์ใหม่"
                  />
                  <datalist id="buildings-list">
                    {Array.from(new Set([...rooms.map(r => r.building), "A", "B", "C", "D"])).sort().map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ชั้น</label>
                  <input 
                    type="text"
                    list="floors-list"
                    value={formData.floor}
                    onChange={(e) => setFormData({...formData, floor: e.target.value})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                    placeholder="เช่น 1, 2, หรือพิมพ์ใหม่"
                  />
                  <datalist id="floors-list">
                    {Array.from(new Set([...rooms.map(r => r.floor), "1", "2", "3", "4", "5", "6", "7", "8"]))
                      .sort((a, b) => {
                        const numA = Number(a);
                        const numB = Number(b);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return String(a).localeCompare(String(b));
                      })
                      .map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-main)] ml-1">ราคาเช่า (บาท/เดือน)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={formData.rentPrice}
                  onChange={(e) => setFormData({...formData, rentPrice: Number(e.target.value)})}
                  className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ประเภทห้อง</label>
                  <select 
                    value={formData.roomType}
                    onChange={(e) => setFormData({...formData, roomType: e.target.value as Room["roomType"]})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                  >
                    <option value="fan" className="bg-white">พัดลม</option>
                    <option value="aircon" className="bg-white">แอร์</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">สถานะ</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as Room["status"]})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                  >
                    <option value="ว่าง" className="bg-white">ว่าง</option>
                    <option value="มีผู้เช่า" className="bg-white">มีผู้เช่า</option>
                    <option value="กำลังซ่อมแซม" className="bg-white">กำลังซ่อมแซม</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="glass-button-outline flex-1 px-4 py-3 rounded-lg font-bold text-[var(--accent-dark)] hover:bg-white/50 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isLoadingSubmit}
                  className="glass-button flex-1 px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-70 flex items-center justify-center"
                >
                  {isLoadingSubmit ? (
                     <div className="flex items-center gap-2">
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span>กำลังบันทึก...</span>
                     </div>
                  ) : (
                    "บันทึกข้อมูล"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* หน้าต่างป๊อปอัปสำหรับการแก้ไขหลายรายการ (Bulk Edit Modal) */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="glass-panel w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative border border-white/40 shadow-2xl">
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-2xl opacity-40 pointer-events-none z-0"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-[var(--accent-dark)] rounded-full mix-blend-multiply filter blur-xl opacity-30 pointer-events-none z-0"></div>
            <div className="px-6 py-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-white/30 backdrop-blur-md relative z-10">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-main)]">
                  แก้ไขข้อมูลแบบกลุ่ม
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 font-semibold">กำลังเปลี่ยนข้อมูลห้องที่เลือก {selectedRoomIds.length} รายการพร้อมกัน</p>
              </div>
              <button 
                onClick={() => setIsBulkEditModalOpen(false)}
                className="p-2.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-white/50 rounded-lg transition-all border border-transparent hover:border-[var(--glass-border)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleBulkSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar relative z-10">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-rose-600 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>คำเตือน: โปรดทำเครื่องหมาย ✔️ <b>"อัปเดต"</b> ในฟิลด์ที่คุณต้องการให้ข้อมูลของห้องที่เลือก <u>ทั้งหมด</u> ถูกแทนที่ด้วยค่าใหม่</span>
                </p>

                {/* ตึก */}
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white/40">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[var(--text-main)] min-w-[5rem]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]" 
                      checked={bulkFieldsToUpdate.building}
                      onChange={(e) => setBulkFieldsToUpdate({...bulkFieldsToUpdate, building: e.target.checked})}
                    />
                    อัปเดตตึก
                  </label>
                  <input 
                    type="text"
                    disabled={!bulkFieldsToUpdate.building}
                    list="b-buildings-list"
                    value={bulkFormData.building}
                    onChange={(e) => setBulkFormData({...bulkFormData, building: e.target.value})}
                    className="glass-input w-full px-4 py-2 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] disabled:opacity-50 font-medium"
                    placeholder="ใส่ตึกใหม่"
                  />
                  <datalist id="b-buildings-list">
                    {Array.from(new Set([...rooms.map(r => r.building), "A", "B"])).sort().map(b => ( <option key={b} value={b} /> ))}
                  </datalist>
                </div>

                {/* ชั้น */}
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white/40">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[var(--text-main)] min-w-[5rem]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]" 
                      checked={bulkFieldsToUpdate.floor}
                      onChange={(e) => setBulkFieldsToUpdate({...bulkFieldsToUpdate, floor: e.target.checked})}
                    />
                    อัปเดตชั้น
                  </label>
                  <input 
                    type="text"
                    disabled={!bulkFieldsToUpdate.floor}
                    list="b-floors-list"
                    value={bulkFormData.floor}
                    onChange={(e) => setBulkFormData({...bulkFormData, floor: e.target.value})}
                    className="glass-input w-full px-4 py-2 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] disabled:opacity-50 font-medium"
                    placeholder="ใส่ชั้นใหม่"
                  />
                  <datalist id="b-floors-list">
                    {Array.from(new Set([...rooms.map(r => r.floor), "1", "2", "3"])).sort((a,b) => Number(a)-Number(b)).map(f => ( <option key={f} value={f} /> ))}
                  </datalist>
                </div>

                {/* ราคาเช่า */}
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white/40">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[var(--text-main)] min-w-[5rem]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]" 
                      checked={bulkFieldsToUpdate.rentPrice}
                      onChange={(e) => setBulkFieldsToUpdate({...bulkFieldsToUpdate, rentPrice: e.target.checked})}
                    />
                    เปลี่ยนราคา
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    disabled={!bulkFieldsToUpdate.rentPrice}
                    value={bulkFormData.rentPrice}
                    onChange={(e) => setBulkFormData({...bulkFormData, rentPrice: Number(e.target.value)})}
                    className="glass-input w-full px-4 py-2 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] text-[var(--text-main)] disabled:opacity-50 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>

                {/* ประเภทห้อง */}
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white/40">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[var(--text-main)] min-w-[5rem]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]" 
                      checked={bulkFieldsToUpdate.roomType}
                      onChange={(e) => setBulkFieldsToUpdate({...bulkFieldsToUpdate, roomType: e.target.checked})}
                    />
                    เปลี่ยนชนิด
                  </label>
                  <select 
                    disabled={!bulkFieldsToUpdate.roomType}
                    value={bulkFormData.roomType}
                    onChange={(e) => setBulkFormData({...bulkFormData, roomType: e.target.value as Room["roomType"]})}
                    className="glass-input w-full px-4 py-2 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] text-[var(--text-main)] bg-white/50 disabled:opacity-50 font-medium cursor-pointer"
                  >
                    <option value="fan" className="bg-white">พัดลม</option>
                    <option value="aircon" className="bg-white">แอร์</option>
                  </select>
                </div>

                {/* สถานะ */}
                <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 bg-white/40">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-[var(--text-main)] min-w-[5rem]">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[var(--accent-brown)] focus:ring-[var(--accent-brown)]" 
                      checked={bulkFieldsToUpdate.status}
                      onChange={(e) => setBulkFieldsToUpdate({...bulkFieldsToUpdate, status: e.target.checked})}
                    />
                    เปลี่ยนสถานะ
                  </label>
                  <select 
                    disabled={!bulkFieldsToUpdate.status}
                    value={bulkFormData.status}
                    onChange={(e) => setBulkFormData({...bulkFormData, status: e.target.value as Room["status"]})}
                    className="glass-input w-full px-4 py-2 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] text-[var(--text-main)] bg-white/50 disabled:opacity-50 font-medium cursor-pointer"
                  >
                    <option value="ว่าง" className="bg-white">ว่าง</option>
                    <option value="มีผู้เช่า" className="bg-white">มีผู้เช่า</option>
                    <option value="กำลังซ่อมแซม" className="bg-white">กำลังซ่อมแซม</option>
                  </select>
                </div>

              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="glass-button-outline flex-1 px-4 py-3 rounded-lg font-bold text-[var(--accent-dark)] hover:bg-white/50 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isLoadingSubmit || !Object.values(bulkFieldsToUpdate).some(v => v)}
                  className="glass-button flex-1 px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-70 flex items-center justify-center"
                >
                  {isLoadingSubmit ? (
                     <div className="flex items-center gap-2">
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span>กำลังบันทึก...</span>
                     </div>
                  ) : (
                    "อัปเดตข้อมูลที่เลือก"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* หน้าต่างป๊อปอัปสำหรับเพิ่มรวดเร็ว (Quick Modal) */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
          <div className="glass-panel w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative border border-white/40 shadow-2xl">
            <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[var(--accent-brown)] rounded-full mix-blend-multiply filter blur-2xl opacity-40 pointer-events-none z-0"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-[var(--accent-dark)] rounded-full mix-blend-multiply filter blur-xl opacity-30 pointer-events-none z-0"></div>
            <div className="px-6 py-5 border-b border-[var(--glass-border)] flex justify-between items-center bg-white/30 backdrop-blur-md relative z-10">
              <h3 className="text-xl font-bold text-[var(--text-main)]">
                เพิ่มห้องพักแบบรวดเร็ว
              </h3>
              <button 
                onClick={() => { setIsQuickModalOpen(false); setImageFile(null); setImagePreview(null); }}
                className="p-2.5 text-[var(--text-muted)] hover:text-red-600 hover:bg-white/50 rounded-lg transition-all border border-transparent hover:border-[var(--glass-border)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <form onSubmit={handleQuickSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar relative z-10">
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-main)] ml-1">รูปภาพ (ใช้กับทุกห้อง)</label>
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="quick-dropzone-file" className="flex flex-col items-center justify-center w-full h-44 glass-panel border-[1.5px] border-dashed rounded-2xl cursor-pointer hover:bg-white/50 transition-all overflow-hidden relative group">
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                         <img src={imagePreview} alt="Preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white font-medium flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> เปลี่ยนรูปภาพ</span>
                         </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="w-12 h-12 rounded-full bg-[var(--accent-light)]/50 border border-[var(--accent-brown)]/30 text-[var(--accent-brown)] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <svg className="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                            </svg>
                        </div>
                        <p className="mb-1 text-sm text-[var(--text-main)] font-bold">อัปโหลดรูปภาพใหม่</p>
                      </div>
                    )}
                    <input id="quick-dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                  </label>
                </div>
                
                {existingImages.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[var(--glass-border)]">
                    <p className="text-xs text-[var(--text-main)] opacity-70 font-bold mb-2 ml-1">หรือเลือกรูปที่มีอยู่แล้ว:</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 px-1 custom-scrollbar">
                      {existingImages.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(img);
                            setQuickFormData({...quickFormData, image: img});
                          }}
                          className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-300 ${imagePreview === img && !imageFile ? 'border-[var(--accent-brown)] shadow-lg scale-105' : 'border-white/30 shadow-sm hover:scale-105 opacity-80 hover:opacity-100'}`}
                        >
                          <img src={img} alt={`recent-${idx}`} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ห้องเริ่มต้น</label>
                  <input 
                    type="text" 
                    required
                    value={quickFormData.startRoomNumber}
                    onChange={(e) => setQuickFormData({...quickFormData, startRoomNumber: e.target.value})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] placeholder-slate-400 font-medium"
                    placeholder="เช่น 101, A01"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">จำนวนห้อง</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    max="100"
                    value={quickFormData.roomCount}
                    onChange={(e) => setQuickFormData({...quickFormData, roomCount: Number(e.target.value)})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] placeholder-slate-400 font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ตึก</label>
                  <input 
                    type="text"
                    list="q-buildings-list"
                    value={quickFormData.building}
                    onChange={(e) => setQuickFormData({...quickFormData, building: e.target.value})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                    placeholder="เช่น A"
                  />
                  <datalist id="q-buildings-list">
                    {Array.from(new Set([...rooms.map(r => r.building), "A", "B", "C", "D"])).sort().map(b => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ชั้น</label>
                  <input 
                    type="text"
                    list="q-floors-list"
                    value={quickFormData.floor}
                    onChange={(e) => setQuickFormData({...quickFormData, floor: e.target.value})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                    placeholder="เช่น 1"
                  />
                  <datalist id="q-floors-list">
                    {Array.from(new Set([...rooms.map(r => r.floor), "1", "2", "3", "4", "5", "6", "7", "8"])).sort((a,b) => Number(a) - Number(b)).map(f => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--text-main)] ml-1">ราคาเช่า (บาท/เดือน)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={quickFormData.rentPrice}
                  onChange={(e) => setQuickFormData({...quickFormData, rentPrice: Number(e.target.value)})}
                  className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">ประเภท</label>
                  <select 
                    value={quickFormData.roomType}
                    onChange={(e) => setQuickFormData({...quickFormData, roomType: e.target.value as Room["roomType"]})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                  >
                    <option value="fan" className="bg-white">พัดลม</option>
                    <option value="aircon" className="bg-white">แอร์</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--text-main)] ml-1">สถานะ</label>
                  <select 
                    value={quickFormData.status}
                    onChange={(e) => setQuickFormData({...quickFormData, status: e.target.value as Room["status"]})}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:ring-2 focus:ring-[var(--accent-brown)] focus:border-transparent text-[var(--text-main)] bg-white/50 backdrop-blur-md font-medium"
                  >
                    <option value="ว่าง" className="bg-white">ว่าง</option>
                    <option value="มีผู้เช่า" className="bg-white">มีผู้เช่า</option>
                    <option value="กำลังซ่อมแซม" className="bg-white">กำลังซ่อมแซม</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsQuickModalOpen(false); setImageFile(null); setImagePreview(null); }}
                  className="glass-button-outline flex-1 px-4 py-3 rounded-lg font-bold text-[var(--accent-dark)] hover:bg-white/50 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isLoadingSubmit}
                  className="glass-button flex-1 px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-70 flex items-center justify-center"
                >
                  {isLoadingSubmit ? (
                     <div className="flex items-center gap-2">
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span>กำลังบันทึก...</span>
                     </div>
                  ) : (
                    `สร้าง ${quickFormData.roomCount} ห้อง`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
