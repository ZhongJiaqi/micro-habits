/* Push notification handler — imported by the PWA service worker */

self.addEventListener('push', (event) => {
  const payload = event.data?.json();
  const title = payload?.title || '你还有未完成的任务';
  const options = {
    body: payload?.body || '',
    icon: '/icon-192x192.png',
    tag: payload?.tag || 'daily-reminder',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
