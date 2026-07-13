// firebase-messaging-sw.js — Service Worker for FCM Background Messages
// ต้องอยู่ใน /public เพื่อให้ Browser ลงทะเบียนได้จาก root

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ค่า config เหล่านี้ต้อง hardcode เนื่องจาก Service Worker ไม่สามารถเข้าถึง env ของ Next.js ได้
firebase.initializeApp({
  apiKey: "AIzaSyB_3FxTt5-ivjGVm1rQchuxMoa16F9y9y8",
  authDomain: "cmru-project.firebaseapp.com",
  projectId: "cmru-project",
  storageBucket: "cmru-project.firebasestorage.app",
  messagingSenderId: "32354613640",
  appId: "1:32354613640:web:2b12a144a5641d7925223d"
});

const messaging = firebase.messaging();

// รับข้อความขณะที่แอปทำงานอยู่ใน Background
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'CMRU Dormitory';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data,
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// รองรับการกดที่การแจ้งเตือนเพื่อเปิดแอป
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
