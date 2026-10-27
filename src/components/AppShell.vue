<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'sidebar--open': menuOpen }" aria-label="Hauptnavigation">
      <router-link to="/home" class="brand" @click="closeMenu">
        <span class="brand-mark"><i class="fa-solid fa-calendar-check"></i></span>
        <span>
          <strong>Dienstplan</strong>
          <small>Mein Portal</small>
        </span>
      </router-link>

      <nav class="navigation">
        <template v-for="group in navigation" :key="group.label">
          <p class="nav-caption">{{ group.label }}</p>
          <router-link v-for="item in group.items" :key="item.to" :to="item.to" custom v-slot="{ navigate, isActive }">
            <a href="#" class="nav-link" :class="{ 'nav-link--active': isActive }" @click.prevent="navigate(); closeMenu()">
              <i class="fa-solid" :class="item.icon"></i>
              <span>{{ item.label }}</span>
              <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
            </a>
          </router-link>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-hint"><i class="fa-solid fa-shield-heart"></i><span>Dein Portal ist geschützt.</span></div>
        <router-link to="/profile" class="account-link" @click="closeMenu">
          <span class="avatar">{{ initials }}</span>
          <span class="account-copy">
            <strong>{{ userName }}</strong>
            <small>Mein Profil</small>
          </span>
          <i class="fa-solid fa-chevron-right"></i>
        </router-link>
        <button class="logout-button" type="button" @click="logout">
          <i class="fa-solid fa-arrow-right-from-bracket"></i>
          Abmelden
        </button>
      </div>
    </aside>

    <button v-if="menuOpen" class="scrim" type="button" aria-label="Menü schließen" @click="closeMenu"></button>

    <div class="app-shell__body">
      <header class="desktop-topbar">
        <div class="topbar-context"><span class="topbar-dot"></span><span>Mein Mitarbeiterportal</span></div>
        <div class="topbar-actions">
          <button class="theme-button" type="button" :title="isLightTheme ? 'Dunkles Design aktivieren' : 'Helles Design aktivieren'" @click="toggleTheme">
            <i class="fa-solid" :class="isLightTheme ? 'fa-moon' : 'fa-sun'"></i>
            <span>{{ isLightTheme ? 'Dunkel' : 'Hell' }}</span>
          </button>
          <NotificationBell />
        </div>
      </header>
      <header class="mobile-topbar">
        <router-link to="/home" class="mobile-brand" aria-label="Zur Dienstplan-Übersicht">
          <span class="brand-mark"><i class="fa-solid fa-calendar-check"></i></span>
          <strong>Dienstplan</strong>
        </router-link>
        <div class="mobile-actions"><button class="mobile-theme-button" type="button" :aria-label="isLightTheme ? 'Dunkles Design aktivieren' : 'Helles Design aktivieren'" @click="toggleTheme"><i class="fa-solid" :class="isLightTheme ? 'fa-moon' : 'fa-sun'"></i></button><NotificationBell /><button class="menu-button" type="button" :aria-expanded="menuOpen" aria-label="Menü öffnen" @click="menuOpen = !menuOpen"><i class="fa-solid" :class="menuOpen ? 'fa-xmark' : 'fa-bars'"></i></button></div>
      </header>

      <main class="main-content">
        <header class="page-heading">
          <div>
            <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
            <h1>{{ title }}</h1>
            <p v-if="description" class="page-description">{{ description }}</p>
          </div>
          <slot name="actions"></slot>
        </header>

        <slot></slot>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'
import { useTheme } from '../composables/useTheme.js'
import NotificationBell from './NotificationBell.vue'

defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  description: { type: String, default: '' }
})

const router = useRouter()
const menuOpen = ref(false)
const { userName } = useCurrentUser()
const { isLightTheme, toggleTheme } = useTheme()

const navigation = [
  { label: 'Planung', items: [
    { to: '/home', label: 'Smart-Kalender', icon: 'fa-calendar-days' },
    { to: '/antraege', label: 'Meine Anträge', icon: 'fa-file-circle-plus' }
  ] },
  { label: 'Arbeitsalltag', items: [
    { to: '/ausruestung', label: 'Ausrüstung', icon: 'fa-briefcase' },
    { to: '/anweisungen', label: 'Dokumente', icon: 'fa-folder-open' },
    { to: '/kontakt', label: 'Büro Kontakt', icon: 'fa-message' }
  ] },
  { label: 'Persönlich', items: [
    { to: '/gehalt', label: 'Abrechnungen', icon: 'fa-receipt' },
    { to: '/profile', label: 'Profil & Einstellungen', icon: 'fa-user-gear' }
  ] }
]

const initials = computed(() => userName.value
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'M')

const closeMenu = () => {
  menuOpen.value = false
}

const logout = async () => {
  await supabase.auth.signOut()
  router.replace('/')
}
</script>

<style scoped>
.app-shell { min-height: 100vh; background: var(--page-bg); color: var(--text-primary); }

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 30;
  width: 264px;
  display: flex;
  flex-direction: column;
  padding: 26px 16px 18px;
  border-right: 1px solid var(--line);
  background: var(--sidebar-bg);
  backdrop-filter: blur(18px);
}

.brand, .mobile-brand { display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; }
.brand { padding: 0 10px 28px; }
.brand-mark { width: 40px; height: 40px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 13px; color: #fff; background: linear-gradient(135deg, #60a5fa, #2563eb); box-shadow: 0 10px 22px rgba(37, 99, 235, .32); }
.brand strong { display: block; font-size: 1rem; letter-spacing: -.02em; }
.brand small { display: block; margin-top: 2px; color: var(--text-muted); font-size: .72rem; }

.navigation { display: grid; gap: 4px; }.nav-caption:not(:first-child) { margin-top: 18px; }
.nav-caption { margin: 0 10px 9px; color: var(--text-muted); font-size: .65rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.nav-link { display: flex; align-items: center; gap: 12px; min-height: 43px; padding: 0 12px; border-radius: 11px; color: var(--text-secondary); font-size: .85rem; font-weight: 700; text-decoration: none; transition: .18s ease; }
.nav-link i { width: 18px; color: #8fa2c2; text-align: center; }
.nav-link:hover { background: var(--nav-hover); color: var(--text-heading); }.nav-badge { min-width: 18px; height: 18px; display: grid; place-items: center; margin-left: auto; border-radius: 99px; color: #fff; background: var(--brand); font-size: .58rem; }
.nav-link--active { color: #fff; background: linear-gradient(100deg, #2563eb, #3b82f6); box-shadow: inset 0 0 0 1px rgba(147, 197, 253, .12), 0 8px 16px rgba(37,99,235,.18); }
.nav-link--active i { color: #fff; }

.sidebar-footer { display: grid; gap: 8px; margin-top: auto; padding-top: 16px; border-top: 1px solid var(--line); }.sidebar-hint { display: flex; align-items: center; gap: 8px; margin: 0 4px 4px; padding: 9px 10px; border-radius: 10px; color: var(--text-muted); background: var(--nav-hover); font-size: .66rem; }.sidebar-hint i { color: var(--success); }
.account-link { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 8px; border-radius: 11px; color: inherit; text-decoration: none; }
.account-link:hover { background: var(--nav-hover); }
.avatar { width: 34px; height: 34px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 11px; color: #dbeafe; background: #1e3a8a; font-size: .72rem; font-weight: 800; }
.account-copy { min-width: 0; flex: 1; }
.account-copy strong { display: block; overflow: hidden; color: var(--text-heading); font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.account-copy small { color: var(--text-muted); font-size: .7rem; }
.account-link > i { color: var(--text-muted); font-size: .7rem; }
.logout-button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: 0; border-radius: 10px; color: #fca5a5; background: transparent; font-size: .8rem; font-weight: 600; text-align: left; cursor: pointer; }
.logout-button:hover { background: rgba(239, 68, 68, .11); }

.app-shell__body { min-height: 100vh; margin-left: 264px; }.desktop-topbar { height: 65px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--page-bg) 82%, transparent); backdrop-filter: blur(14px); }.topbar-context { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: .75rem; font-weight: 700; }.topbar-dot { width: 7px; height: 7px; border-radius: 99px; background: var(--success); box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 14%, transparent); }.topbar-actions { display: flex; align-items: center; gap: 9px; }.theme-button { display: inline-flex; align-items: center; gap: 7px; height: 42px; padding: 0 12px; border: 1px solid var(--line-strong); border-radius: 12px; color: var(--text-secondary); background: var(--surface-raised); font-size: .72rem; font-weight: 800; cursor: pointer; }.theme-button:hover { color: var(--brand); border-color: rgba(96,165,250,.55); }.mobile-topbar { display: none; }
.main-content { width: min(1280px, 100%); margin: 0 auto; padding: 38px 40px 56px; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 30px; }
.eyebrow { margin: 0 0 8px; color: var(--brand-light); font-size: .7rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
.page-heading h1 { margin: 0; color: var(--text-heading); font-size: clamp(1.7rem, 3vw, 2.25rem); letter-spacing: -.045em; line-height: 1.1; }
.page-description { max-width: 650px; margin: 10px 0 0; color: var(--text-secondary); font-size: .95rem; line-height: 1.55; }
.scrim { display: none; }

@media (max-width: 860px) {
  .sidebar { width: min(300px, 84vw); transform: translateX(-105%); transition: transform .2s ease; box-shadow: 18px 0 48px rgba(0,0,0,.35); }
  .sidebar--open { transform: translateX(0); }
  .scrim { position: fixed; inset: 0; z-index: 20; display: block; border: 0; background: rgba(2, 6, 23, .68); }
  .app-shell__body { margin-left: 0; }.desktop-topbar { display: none; }
  .mobile-topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; min-height: 64px; padding: 10px 18px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--page-bg) 88%, transparent); backdrop-filter: blur(16px); }.mobile-actions { display: flex; align-items: center; gap: 7px; margin-left: auto; margin-right: 8px; }.mobile-theme-button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--line-strong); border-radius: 10px; color: var(--text-secondary); background: var(--surface-raised); cursor: pointer; }
  .mobile-brand { font-size: .95rem; }
  .mobile-brand .brand-mark { width: 34px; height: 34px; border-radius: 10px; }
  .menu-button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid var(--line-strong); border-radius: 10px; color: var(--text-heading); background: var(--surface-raised); cursor: pointer; }
  .main-content { padding: 32px 18px 42px; }
  .page-heading { margin-bottom: 24px; }
}

@media (max-width: 460px) {
  .mobile-topbar { min-height: 58px; padding: 8px 13px; }
  .mobile-brand .brand-mark { width: 31px; height: 31px; font-size: .78rem; }
  .mobile-brand { gap: 8px; font-size: .87rem; }
  .mobile-actions { gap: 5px; margin-right: 5px; }
  .mobile-theme-button, .menu-button { width: 36px; height: 36px; }
  .main-content { padding: 25px 13px 34px; }
  .page-heading h1 { font-size: 1.58rem; }
  .page-description { margin-top: 7px; font-size: .85rem; }
}
</style>
