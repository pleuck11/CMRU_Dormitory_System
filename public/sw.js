// sw.js — Minimal stub service worker
// This file prevents 404 errors from browsers that auto-request /sw.js for PWA.
// The actual service worker for Firebase Cloud Messaging is registered via /firebase-messaging-sw.js

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
