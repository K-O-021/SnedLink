/* firebase-messaging-sw.js
   ─────────────────────────────────────────────────────────────────────────
   This file MUST live at the ROOT of your deployed site
   (e.g. https://yourapp.com/firebase-messaging-sw.js) — not in a subfolder —
   or the browser will refuse to register it for push notifications.

   This ONE file is shared by all three portals — Teacher, Admin, and
   Parent. It's what lets a critical alert reach anyone's device — with
   sound, vibration, and a system notification popup — even when the
   SNED-LINK+ tab (or the whole browser) is closed. The actual "send" side
   lives in functions/index.js, which is triggered whenever a new alert or
   notification is written to Firestore and pushes it out to every device
   token registered on the recipient's users/{uid} profile — teacher,
   admin, or parent alike.

   Clicking a notification focuses whichever SNED-LINK+ tab is already
   open (teacher_portal.html, admin.html, or parent_portal.html — whichever
   the person has), or opens the right one if none is open.

   Fill in the same firebaseConfig values you used in the three portal
   files (teacher_portal.html, admin.html, parent_portal.html).
   ───────────────────────────────────────────────────────────────────────── */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCbVKy4PIVy7S1ofCMGtq6JQY3X2vArLTo",
  authDomain: "capstone-2-f0d29.firebaseapp.com",
  projectId: "capstone-2-f0d29",
  storageBucket: "capstone-2-f0d29.firebasestorage.app",
  messagingSenderId: "807938562660",
  appId: "1:807938562660:web:8ebbb73aebdc3746595d71"
});

const messaging = firebase.messaging();

/* Background handler — fires when a push arrives and the tab/app is closed
   or in the background. This is what actually pops the system notification,
   plays a sound (device notification sound), and vibrates the device. */
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'SNED-LINK+ Critical Alert';
  const options = {
    body: (payload.notification && payload.notification.body) || 'A new alert needs your attention.',
    icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/1827/1827392.png',
    tag: 'sl-alert-' + (payload.data && payload.data.sid ? payload.data.sid : Date.now()),
    requireInteraction: true,        // keeps it on screen until the teacher acts on it
    vibrate: [250, 120, 250, 120, 500], // Android Chrome; iOS Safari does not support vibration
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

/* Clicking the notification focuses whichever portal tab is already open,
   or opens the right portal file if none is. The Cloud Function stamps
   data.portal ('teacher' | 'admin' | 'parent') based on which person's
   device it's pushing to, so a closed app opens straight to the correct
   portal rather than the landing page. */
const PORTAL_FILES = { teacher: 'teacher_portal.html', admin: 'admin.html', parent: 'parent_portal.html' };
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const sid = data.sid;
  const portalFile = PORTAL_FILES[data.portal] || 'teacher_portal.html';
  const targetUrl = self.registration.scope + portalFile + (sid ? `?openStudent=${sid}` : '');
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Prefer an already-open tab for the SAME portal this alert belongs to.
      for (const client of clientList) {
        if (client.url.includes(portalFile) && 'focus' in client) return client.focus();
      }
      // Otherwise any open SNED-LINK+ tab at all.
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
