<template>
  <div ref="notificationRoot" class="notifications">
    <button class="bell-button" type="button" :aria-expanded="isOpen" aria-label="Benachrichtigungen öffnen" @click="toggle">
      <i class="fa-regular fa-bell"></i>
      <span v-if="unreadCount" class="notification-count">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <section v-if="isOpen" class="notification-popover" aria-label="Benachrichtigungen">
      <header>
        <div><p>AKTUELL</p><h2>Benachrichtigungen</h2></div>
        <div class="notification-actions"><button v-if="pushSupported && !pushEnabled" type="button" :disabled="isEnablingPush" @click="enablePushNotifications">{{ isEnablingPush ? 'Wird aktiviert …' : 'Push aktivieren' }}</button><button v-else-if="nativeNotificationsSupported && notificationPermission !== 'granted'" type="button" @click="requestNativePermission">Desktop aktivieren</button><button v-if="unreadCount" type="button" @click="markAllAsSeen">Alle gelesen</button></div>
      </header>

      <div v-if="isLoading" class="notification-state"><i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …</div>
      <div v-else-if="!items.length" class="notification-state notification-state--empty"><i class="fa-regular fa-bell-slash"></i><span>Du hast keine neuen Benachrichtigungen.</span></div>
      <div v-else class="notification-list">
        <article v-for="item in items" :key="item.id" class="notification-item" :class="{ 'notification-item--new': !item.seen }">
          <span class="notification-icon"><i class="fa-solid" :class="iconFor(item)"></i></span>
          <div><h3>{{ item.title }}</h3><p>{{ item.message }}</p><time>{{ formatDate(item.createdAt) }}</time></div>
        </article>
      </div>
    </section>

    <button v-if="toastItem" type="button" class="notification-toast" @click="openToast">
      <i class="fa-solid fa-bell"></i><span><strong>{{ toastItem.title }}</strong><small>{{ toastItem.message }}</small></span>
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { supabase } from '../config/supabase.js'

const isOpen = ref(false)
const isLoading = ref(false)
const items = ref([])
const notificationRoot = ref(null)
const unreadCount = computed(() => items.value.filter((item) => !item.seen).length)
const nativeNotificationsSupported = typeof window !== 'undefined' && 'Notification' in window
const notificationPermission = ref(nativeNotificationsSupported ? window.Notification.permission : 'unsupported')
const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
const pushEnabled = ref(false)
const isEnablingPush = ref(false)
const toastItem = ref(null)
let notificationChannel = null
let notificationPollTimer = null
let toastTimer = null
let hasLoadedInitialNotifications = false

const normaliseNotification = (item, index) => ({
  id: item.id || `notification-${index}`,
  title: item.title || item.subject || item.type || 'Neue Information',
  message: item.message || item.content || item.body || 'Es gibt ein Update für dich.',
  link: item.link || '/',
  createdAt: item.created_at || item.createdAt || new Date().toISOString(),
  seen: Boolean(item.is_read || item.read || item.seen),
  type: String(item.kind || item.type || item.category || '').toLowerCase()
})

const showToast = (item) => {
  toastItem.value = item
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastItem.value = null }, 6500)
}

const showNativeNotification = async (item) => {
  if (!nativeNotificationsSupported || notificationPermission.value !== 'granted') return
  const options = { body: item.message, icon: '/vite.svg', tag: item.id, data: { link: item.link || '/' } }
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      await registration.showNotification(item.title, options)
      return
    }
  } catch {
    // The browser Notification API below is a safe fallback for non-PWA browsers.
  }
  new window.Notification(item.title, options)
}

const announceIncoming = (item) => {
  if (document.visibilityState === 'visible') showToast(item)
  // Once Push is enabled the server sends the system notification through the
  // service worker. Without it, Realtime/polling still covers an open browser.
  else if (!pushEnabled.value) void showNativeNotification(item)
}

const addIncomingNotification = (item) => {
  if (items.value.some((existing) => existing.id === item.id)) return
  items.value.unshift(item)
  announceIncoming(item)
}

const loadNotifications = async ({ announceNew = false } = {}) => {
  isLoading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // select(*) keeps this compatible with the existing notifications table,
    // whose field names may differ between older project versions.
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8)

    if (!error) {
      const freshItems = (data || []).map(normaliseNotification)
      const knownIds = new Set(items.value.map((item) => item.id))
      items.value = freshItems
      if (announceNew && hasLoadedInitialNotifications) freshItems.filter((item) => !knownIds.has(item.id)).forEach(announceIncoming)
      hasLoadedInitialNotifications = true
    }
  } catch {
    // A notification centre must never interrupt the main app when no policy
    // or no notifications table data is configured yet.
  } finally {
    isLoading.value = false
  }
}

const toggle = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value && !items.value.length) await loadNotifications()
}

const markAllAsSeen = async () => {
  items.value = items.value.map((item) => ({ ...item, seen: true }))
  const { data: { user } } = await supabase.auth.getUser()
  if (user) await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
}

const requestNativePermission = async () => {
  if (!nativeNotificationsSupported) return
  notificationPermission.value = await window.Notification.requestPermission()
}

const base64UrlToUint8Array = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
}

const registerPushWorker = async () => {
  if (!pushSupported) return null
  const registration = await navigator.serviceWorker.register('/push-service-worker.js')
  await navigator.serviceWorker.ready
  pushEnabled.value = Boolean(await registration.pushManager.getSubscription())
  return registration
}

const enablePushNotifications = async () => {
  if (!pushSupported) {
    await requestNativePermission()
    return
  }
  isEnablingPush.value = true
  try {
    notificationPermission.value = await window.Notification.requestPermission()
    if (notificationPermission.value !== 'granted') return
    const registration = await registerPushWorker()
    if (!registration) return
    const { data: config, error: configError } = await supabase.functions.invoke('push-notification-config')
    if (configError || !config?.publicKey) throw configError || new Error('Push-Konfiguration fehlt.')
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(config.publicKey) })
    const { error: subscribeError } = await supabase.functions.invoke('push-subscribe', { body: { subscription: subscription.toJSON() } })
    if (subscribeError) throw subscribeError
    pushEnabled.value = true
  } catch {
    // Realtime and the regular notification centre remain available even when
    // the browser blocks Push or a user has disabled it at system level.
    pushEnabled.value = false
  } finally {
    isEnablingPush.value = false
  }
}

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Gerade eben'
  const difference = Date.now() - date.getTime()
  if (difference < 60 * 60 * 1000) return 'Vor kurzer Zeit'
  return new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

const iconFor = (item) => item.type.includes('urlaub') || item.type.includes('antrag')
  ? 'fa-file-circle-check'
  : item.type.includes('dienst') || item.type.includes('schedule')
    ? 'fa-calendar-check'
    : 'fa-circle-info'

const closeOnOutsideClick = (event) => {
  if (notificationRoot.value && !notificationRoot.value.contains(event.target)) isOpen.value = false
}

const subscribeToNotifications = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  notificationChannel = supabase
    .channel(`employee-notifications-${user.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => addIncomingNotification(normaliseNotification(payload.new, items.value.length)))
    .subscribe()
}

const openToast = () => {
  toastItem.value = null
  isOpen.value = true
}

onMounted(async () => {
  document.addEventListener('click', closeOnOutsideClick)
  await loadNotifications()
  await subscribeToNotifications()
  try { await registerPushWorker() } catch { /* Push stays optional. */ }
  notificationPollTimer = window.setInterval(() => { void loadNotifications({ announceNew: true }) }, 30000)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  if (notificationChannel) supabase.removeChannel(notificationChannel)
  if (notificationPollTimer) window.clearInterval(notificationPollTimer)
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<style scoped>
.notifications { position: relative; }
.bell-button { position: relative; width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--line-strong); border-radius: 12px; color: var(--text-secondary); background: var(--surface-raised); cursor: pointer; transition: .16s ease; }
.bell-button:hover, .bell-button[aria-expanded="true"] { border-color: rgba(96,165,250,.55); color: var(--brand); background: var(--surface-soft); }
.notification-count { position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px; display: grid; place-items: center; padding: 0 4px; border: 2px solid var(--page-bg); border-radius: 99px; color: #fff; background: #e11d48; font-size: .58rem; font-weight: 800; }
.notification-popover { position: absolute; top: calc(100% + 10px); right: 0; z-index: 60; width: min(370px, calc(100vw - 32px)); overflow: hidden; border: 1px solid var(--line-strong); border-radius: 17px; background: var(--surface-card); box-shadow: 0 22px 65px rgba(2,6,23,.27); }
.notification-popover header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px; border-bottom: 1px solid var(--line); }.notification-popover header p { margin: 0 0 3px; color: var(--text-muted); font-size: .63rem; font-weight: 800; letter-spacing: .08em; }.notification-popover h2 { margin: 0; color: var(--text-heading); font-size: .96rem; }.notification-actions { display: flex; align-items: center; gap: 8px; }.notification-popover header button { border: 0; color: var(--brand); background: transparent; font-size: .72rem; font-weight: 800; cursor: pointer; }
.notification-state { min-height: 118px; display: grid; place-content: center; justify-items: center; gap: 9px; padding: 18px; color: var(--text-muted); font-size: .78rem; text-align: center; }.notification-state--empty i { color: var(--brand); font-size: 1.25rem; }
.notification-list { max-height: min(390px, 58vh); overflow-y: auto; }.notification-item { display: flex; gap: 11px; padding: 14px 18px; border-bottom: 1px solid var(--line); }.notification-item:last-child { border-bottom: 0; }.notification-item--new { background: color-mix(in srgb, var(--brand) 6%, transparent); }.notification-icon { width: 32px; height: 32px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 10px; color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, transparent); font-size: .78rem; }.notification-item h3 { margin: 1px 0 3px; color: var(--text-heading); font-size: .78rem; }.notification-item p { display: -webkit-box; margin: 0; overflow: hidden; color: var(--text-secondary); font-size: .71rem; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.notification-item time { display: block; margin-top: 5px; color: var(--text-muted); font-size: .65rem; }
.notification-toast { position: fixed; right: 22px; bottom: 22px; z-index: 120; width: min(360px, calc(100vw - 32px)); display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 13px; border: 1px solid rgba(96,165,250,.42); border-radius: 14px; color: var(--text-heading); background: var(--surface-card); box-shadow: 0 20px 48px rgba(2,6,23,.3); text-align: left; cursor: pointer; animation: notification-enter .2s ease-out; }.notification-toast > i { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: #bfdbfe; background: rgba(37,99,235,.2); }.notification-toast span { min-width: 0; }.notification-toast strong, .notification-toast small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.notification-toast strong { font-size: .76rem; }.notification-toast small { margin-top: 3px; color: var(--text-secondary); font-size: .68rem; }.notification-toast:hover { border-color: rgba(96,165,250,.75); }@keyframes notification-enter { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
</style>
