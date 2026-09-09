"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

import { db } from "@/lib/firebase";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";

// =====================================================
// CKEditor
// โหลดเฉพาะฝั่ง Client เพื่อป้องกันปัญหา SSR ของ Next.js
// =====================================================

const EditorWrapper = dynamic(
  async () => {
    const { CKEditor } = await import("@ckeditor/ckeditor5-react");

    const {
      ClassicEditor,
      Essentials,
      Paragraph,
      Bold,
      Italic,
      Link,
      List,
      Heading,
    } = await import("ckeditor5");

    function EditorComponent({ value, onChange }) {
      return (
        <CKEditor
          editor={ClassicEditor}
          data={value}
          config={{
            licenseKey: "GPL",

            plugins: [
              Essentials,
              Paragraph,
              Bold,
              Italic,
              Link,
              List,
              Heading,
            ],

            toolbar: [
              "undo",
              "redo",
              "|",
              "heading",
              "|",
              "bold",
              "italic",
              "|",
              "link",
              "|",
              "bulletedList",
              "numberedList",
            ],
          }}
          onChange={(event, editor) => {
            const data = editor.getData();
            onChange(data);
          }}
        />
      );
    }

    return EditorComponent;
  },
  {
    ssr: false,
    loading: () => <p>กำลังโหลดเครื่องมือเขียนประกาศ...</p>,
  }
);

// =====================================================
// หน้า Admin ประกาศ
// =====================================================

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [editId, setEditId] = useState(null);

  // =====================================================
  // ดึงข้อมูลประกาศจาก Firestore
  // =====================================================

  const fetchAnnouncements = useCallback(async () => {
    try {
      const announcementsRef = collection(db, "announcements");

      const q = query(
        announcementsRef,
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);

      const list = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setAnnouncements(list);
    } catch (error) {
      console.error(
        "Error fetching announcements:",
        error
      );
    }
  }, []);

  // โหลดประกาศเมื่อเปิดหน้า
  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // =====================================================
  // เพิ่ม / แก้ไขประกาศ
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert("กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน");
      return;
    }

    try {
      // =================================================
      // กรณีแก้ไขประกาศ
      // =================================================

      if (editId) {
        const docRef = doc(
          db,
          "announcements",
          editId
        );

        await updateDoc(docRef, {
          title: title.trim(),
          content: content,
          updatedAt: serverTimestamp(),
        });

        alert("แก้ไขประกาศสำเร็จ!");
      }

      // =================================================
      // กรณีเพิ่มประกาศใหม่
      // =================================================

      else {
        await addDoc(
          collection(db, "announcements"),
          {
            title: title.trim(),
            content: content,
            createdAt: serverTimestamp(),
          }
        );

        alert("เพิ่มประกาศสำเร็จ!");
      }

      // ล้างฟอร์ม
      setTitle("");
      setContent("");
      setEditId(null);

      // โหลดข้อมูลใหม่
      await fetchAnnouncements();
    } catch (error) {
      console.error(
        "Error saving announcement:",
        error
      );

      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  // =====================================================
  // ลบประกาศ
  // =====================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "ยืนยันการลบประกาศนี้?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "announcements", id)
      );

      alert("ลบประกาศสำเร็จ!");

      await fetchAnnouncements();
    } catch (error) {
      console.error(
        "Error deleting announcement:",
        error
      );

      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  // =====================================================
  // แก้ไขประกาศ
  // =====================================================

  const handleEdit = (item) => {
    setEditId(item.id);
    setTitle(item.title || "");
    setContent(item.content || "");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =====================================================
  // ยกเลิกการแก้ไข
  // =====================================================

  const handleCancelEdit = () => {
    setEditId(null);
    setTitle("");
    setContent("");
  };

  // =====================================================
  // แสดงหน้าเว็บ
  // =====================================================

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "auto",
      }}
    >
      {/* ================================================
          หัวข้อ
      ================================================= */}

      <h2>
        {editId
          ? "แก้ไขประกาศ"
          : "เพิ่มประกาศใหม่"}
      </h2>

      {/* ================================================
          Form
      ================================================= */}

      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: "40px",
        }}
      >
        {/* หัวข้อประกาศ */}

        <div
          style={{
            marginBottom: "15px",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            หัวข้อประกาศ:
          </label>

          <input
            type="text"
            value={title}
            onChange={(e) =>
              setTitle(e.target.value)
            }
            placeholder="กรอกหัวข้อประกาศ"
            style={{
              width: "100%",
              padding: "10px",
              boxSizing: "border-box",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>

        {/* เนื้อหาประกาศ */}

        <div
          style={{
            marginBottom: "15px",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            เนื้อหา:
          </label>

          <EditorWrapper
            value={content}
            onChange={setContent}
          />
        </div>

        {/* ปุ่มบันทึก */}

        <button
          type="submit"
          style={{
            padding: "10px 20px",
            backgroundColor: "#0d6efd",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            marginRight: "10px",
            borderRadius: "4px",
          }}
        >
          {editId
            ? "บันทึกการแก้ไข"
            : "ลงประกาศ"}
        </button>

        {/* ปุ่มยกเลิก */}

        {editId && (
          <button
            type="button"
            onClick={handleCancelEdit}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              borderRadius: "4px",
            }}
          >
            ยกเลิก
          </button>
        )}
      </form>

      <hr />

      {/* ================================================
          ประวัติประกาศ
      ================================================= */}

      <h2
        style={{
          marginTop: "30px",
        }}
      >
        ประวัติการประกาศทั้งหมด
      </h2>

      {announcements.length > 0 ? (
        announcements.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #ddd",
              padding: "15px",
              marginBottom: "15px",
              borderRadius: "5px",
              background: "#fff",
            }}
          >
            {/* หัวข้อ */}

            <h3
              style={{
                marginTop: 0,
              }}
            >
              {item.title}
            </h3>

            {/* เนื้อหา HTML จาก CKEditor */}

            <div
              dangerouslySetInnerHTML={{
                __html: item.content || "",
              }}
              style={{
                marginBottom: "15px",
                color: "#444",
              }}
            />

            {/* ปุ่ม */}

            <div>
              <button
                type="button"
                onClick={() =>
                  handleEdit(item)
                }
                style={{
                  padding: "5px 10px",
                  marginRight: "10px",
                  backgroundColor: "#ffc107",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "3px",
                }}
              >
                แก้ไข
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDelete(item.id)
                }
                style={{
                  padding: "5px 10px",
                  backgroundColor: "#dc3545",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "3px",
                }}
              >
                ลบ
              </button>
            </div>
          </div>
        ))
      ) : (
        <p>ยังไม่มีประกาศในระบบ</p>
      )}
    </div>
  );
}