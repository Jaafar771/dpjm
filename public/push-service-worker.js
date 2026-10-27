self.addEventListener('push', (event) => {
  let payload = { title: 'Dienstplan', message: 'Du hast eine neue Benachrichtigung.', link: '/' }
  try { payload = { ...payload, ...event.data.json() } } catch { /* A visible default is required for every push. */ }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.message,
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: payload.id || 'dienstplan-notification',
    data: { link: payload.link || '/' },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.link || '/', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin))
    if (existing) return existing.focus().then(() => existing.navigate(target))
    return clients.openWindow(target)
  }))
})
