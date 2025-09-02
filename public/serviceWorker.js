self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  const registrations = await self.registration.getRegistrations?.();
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {}
  if (self.registration && self.registration.unregister) {
    self.registration.unregister();
  }
});

self.addEventListener('fetch', () => {});
