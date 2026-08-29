"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

interface Announcement {
  id: number | string;
  title: string;
  content: string;
}

// โหลด CKEditor ข้าม SSR
const EditorWrapper = dynamic(
  async () => {
    const { CKEditor } = await import('@ckeditor/ckeditor5-react');
    const ClassicEditor = await import('@ckeditor/ckeditor5-build-classic');

    return function EditorComponent({ value, onChange }: { value: string, onChange: (data: string) => void }) {
      return (
        <CKEditor
          editor={ClassicEditor.default}
          data={value}
          onChange={(event: any, editor: any) => {
            onChange(editor.getData());
          }}
        />
      );
    };
  },
  { ssr: false, loading: () => <p>กำลังโหลดเครื่องมือเขียนประกาศ...</p> }
) as any;

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editId, setEditId] = useState<number | string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const response = await fetch('/api/get_announcements.php');
      if (!response.ok) return; 
      const data = await response.json();
      setAnnouncements(data as Announcement[]);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const response = await fetch('/api/save_announcement.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, title, content }),
      });

      if (response.ok) {
        alert(editId ? 'แก้ไขประกาศสำเร็จ' : 'เพิ่มประกาศสำเร็จ');
        setTitle('');
        setContent('');
        setEditId(null);
        fetchAnnouncements(); 
      }
    } catch (error) {
      console.error('Error saving announcement:', error);
    }
  };

  const handleDelete = async (id: number | string) => {
    if (!confirm('ยืนยันการลบประกาศนี้?')) return;

    try {
      const response = await fetch('/api/delete_announcement.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        fetchAnnouncements();
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
    }
  };

  const handleEdit = (item: Announcement) => {
    setEditId(item.id);
    setTitle(item.title);
    setContent(item.content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto' }}>
      <h2>{editId ? 'แก้ไขประกาศ' : 'เพิ่มประกาศใหม่'}</h2>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '40px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>หัวข้อประกาศ:</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="กรอกหัวข้อประกาศ"
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>เนื้อหา:</label>
          <EditorWrapper 
            value={content} 
            onChange={(data: string) => setContent(data)} 
          />
        </div>

        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', cursor: 'pointer', marginRight: '10px', borderRadius: '4px' }}>
          {editId ? 'บันทึกการแก้ไข' : 'ลงประกาศ'}
        </button>
        
        {editId && (
          <button type="button" onClick={() => { setEditId(null); setTitle(''); setContent(''); }} style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
            ยกเลิก
          </button>
        )}
      </form>

      <hr />

      <h2>ประวัติการประกาศ</h2>
      {announcements.length > 0 ? (
        announcements.map((item) => (
          <div key={item.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '15px', borderRadius: '5px' }}>
            <h3 style={{ marginTop: 0 }}>{item.title}</h3>
            
            <div dangerouslySetInnerHTML={{ __html: item.content }} style={{ marginBottom: '15px', color: '#444' }} />
            
            <div>
              <button type="button" onClick={() => handleEdit(item)} style={{ padding: '5px 10px', marginRight: '10px', backgroundColor: '#ffc107', border: 'none', cursor: 'pointer', borderRadius: '3px' }}>แก้ไข</button>
              <button type="button" onClick={() => handleDelete(item.id)} style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '3px' }}>ลบ</button>
            </div>
          </div>
        ))
      ) : (
        <p>ยังไม่มีประกาศในระบบ</p>
      )}
    </div>
  );
}