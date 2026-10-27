<template>
  <div class="page-container">
    <header class="app-header">
      <div class="header-inner">
        <!-- Profil-Link -->
        <router-link to="/profile" class="user-info user-info-link">
          <div class="avatar-icon">
            <i class="fa-solid fa-user-gear"></i>
          </div>
          <div class="user-details">
            <span class="user-name">{{ userName }}</span>
            <span class="user-role">Mitarbeiter Portal</span>
          </div>
        </router-link>

        <button class="menu-toggle" @click="isMobileMenuOpen = !isMobileMenuOpen" aria-label="Menü öffnen">
          <i class="fa-solid" :class="isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'"></i>
        </button>

        <nav class="nav-buttons" :class="{ show: isMobileMenuOpen }">
          <router-link to="/home" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-calendar-days"></i> Home
          </router-link>
          <router-link to="/antraege" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-file-pen"></i> Anträge
          </router-link>
          <router-link to="/anweisungen" class="btn-nav active" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-file-pdf"></i> Anweisungen
          </router-link>
          <router-link to="/gehalt" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-file-invoice-dollar"></i> Gehalt
          </router-link>
          <router-link to="/kontakt" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-paper-plane"></i> Büro Kontakt
          </router-link>
          <router-link to="/profile" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-user"></i> Profil
          </router-link>
          <button class="btn-nav btn-logout" @click="handleLogout">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </nav>
      </div>
    </header>

    <main class="app-main">
      <section class="card">
        <div class="card-header">
          <div class="card-icon red">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div>
            <h2>Dienstanweisungen & Dokumente</h2>
            <p class="card-subtitle">Offizielle Richtlinien und PDFs zum Download</p>
          </div>
        </div>

        <div class="pdf-list">
          <div v-for="pdf in pdfDocuments" :key="pdf.id" class="pdf-item">
            <div class="pdf-info">
              <i class="fa-regular fa-file-pdf pdf-icon"></i>
              <div class="pdf-text-details">
                <strong>{{ pdf.title }}</strong>
                <span class="pdf-meta">Datum: {{ pdf.date }} | Größe: {{ pdf.size }}</span>
              </div>
            </div>
            <a :href="pdf.link" target="_blank" class="btn-download">
              <i class="fa-solid fa-download"></i>
              <span>Öffnen / PDF</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const router = useRouter()
const isMobileMenuOpen = ref(false)
const { userName } = useCurrentUser()

const pdfDocuments = ref([
  { id: 1, title: 'Allgemeine Dienstanweisung KH Hietzing', date: '01.01.2026', size: '1.2 MB', link: '#' },
  { id: 2, title: 'Sicherheits- & Hygienevorschriften 2026', date: '15.02.2026', size: '850 KB', link: '#' },
  { id: 3, title: 'Leitfaden für Nachtdienste & Übergaben', date: '10.05.2026', size: '2.1 MB', link: '#' },
  { id: 4, title: 'Notfallplan & Brandschutzordnung', date: '01.07.2026', size: '1.5 MB', link: '#' }
])

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  router.replace('/')
}
</script>

<style scoped>
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

/* Base Layout & Desktop-Zentrierung */
.page-container {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  background: #0b0f19;
  color: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
}

/* Full-Width Header */
.app-header {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info-link { text-decoration: none; }
.user-info { display: flex; align-items: center; gap: 10px; }

.avatar-icon {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.user-details { display: flex; flex-direction: column; text-align: left; }
.user-name { font-size: 0.85rem; font-weight: 600; color: #f8fafc; }
.user-role { font-size: 0.7rem; color: #94a3b8; }

.menu-toggle {
  display: none;
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #f8fafc;
  cursor: pointer;
  padding: 6px;
}

.nav-buttons { display: flex; gap: 8px; }

.btn-nav {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  touch-action: manipulation;
}

.btn-nav:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.btn-nav.active { background: #2563eb; border-color: #3b82f6; color: #fff; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
.btn-logout { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.2); cursor: pointer; }

/* Zentrierter Hauptbereich für PC & Mobile */
.app-main {
  flex: 1;
  padding: 20px 16px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.card {
  background: #161e2e;
  border-radius: 16px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.card-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }

.card-icon.red {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.card h2 { font-size: 1.15rem; font-weight: 700; margin: 0 0 2px 0; color: #f8fafc; }
.card-subtitle { font-size: 0.8rem; color: #94a3b8; margin: 0; }

.pdf-list { display: flex; flex-direction: column; gap: 12px; }

.pdf-item {
  background: #0b0f19;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  transition: all 0.2s ease;
}

.pdf-item:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: #0d1322;
}

.pdf-info { display: flex; align-items: center; gap: 14px; }
.pdf-icon { font-size: 1.8rem; color: #ef4444; flex-shrink: 0; }
.pdf-text-details { display: flex; flex-direction: column; text-align: left; }
.pdf-info strong { font-size: 0.92rem; color: #f8fafc; font-weight: 600; line-height: 1.3; }
.pdf-meta { font-size: 0.78rem; color: #94a3b8; margin-top: 2px; }

.btn-download {
  background: rgba(37, 99, 235, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(37, 99, 235, 0.3);
  padding: 9px 14px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  transition: all 0.2s ease;
  touch-action: manipulation;
}

.btn-download:hover { background: #2563eb; color: #fff; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }

/* Mobile Anpassungen */
@media (max-width: 768px) {
  .menu-toggle { display: block; }

  .nav-buttons {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: #0f172a;
    flex-direction: column;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    gap: 10px;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
  }

  .nav-buttons.show { display: flex; }

  .btn-nav {
    width: 100%;
    justify-content: flex-start;
    padding: 12px 16px;
  }

  .app-main { padding: 14px 12px; }
  .card { padding: 18px 16px; border-radius: 14px; }

  .pdf-item { flex-direction: column; align-items: flex-start; gap: 12px; }
  .btn-download { width: 100%; justify-content: center; padding: 11px; }
}
</style>
