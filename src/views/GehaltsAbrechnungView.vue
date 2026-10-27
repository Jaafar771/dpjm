<template>
  <div class="page-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-inner">
        <router-link to="/profile" class="user-info user-info-link">
          <div class="avatar-icon">
            <i class="fa-solid fa-user-gear"></i>
          </div>
          <div class="user-details">
            <span class="user-name">{{ userName }}</span>
            <span class="user-role">Mitarbeiter Portal</span>
          </div>
        </router-link>

        <!-- Mobile Menü Button -->
        <button class="menu-toggle" @click.stop="toggleMobileMenu" aria-label="Menü öffnen">
          <i class="fa-solid" :class="isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'"></i>
        </button>

        <nav class="nav-buttons" :class="{ show: isMobileMenuOpen }">
          <router-link to="/home" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-calendar-days"></i> Home
          </router-link>
          <router-link to="/antraege" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-file-pen"></i> Anträge
          </router-link>
          <router-link to="/gehalt" class="btn-nav active" @click="closeMobileMenu">
            <i class="fa-solid fa-file-invoice-dollar"></i> Gehalt
          </router-link>
          <router-link to="/anweisungen" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-file-pdf"></i> Anweisungen
          </router-link>
          <router-link to="/kontakt" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-paper-plane"></i> Büro Kontakt
          </router-link>
          <router-link to="/profile" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-user"></i> Profil
          </router-link>
          <button class="btn-nav btn-logout" @click="handleLogout">
            <i class="fa-solid fa-right-from-bracket"></i> Logout
          </button>
        </nav>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="app-main">
      <div class="section-title">
        <h2><i class="fa-solid fa-file-invoice-dollar"></i> Gehaltsabrechnungen</h2>
        <p>Übersicht Ihrer monatlichen Lohnzettel und Auszahlungen.</p>
      </div>

      <!-- Gehaltsliste / Karten -->
      <div class="salary-list">
        <div v-for="item in salaryData" :key="item.month" class="salary-card">
          <div class="salary-info">
            <div class="salary-icon"><i class="fa-solid fa-file-pdf"></i></div>
            <div>
              <h3>{{ item.month }} {{ item.year }}</h3>
              <span class="salary-amount">Netto: <strong>{{ item.netto }} €</strong> (Brutto: {{ item.brutto }} €)</span>
            </div>
          </div>
          <div class="salary-action">
            <span class="badge-status" :class="item.statusClass">{{ item.status }}</span>
            <button class="btn-download" @click="downloadPdf(item)">
              <i class="fa-solid fa-download"></i> Lohnzettel
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const router = useRouter()
const isMobileMenuOpen = ref(false)
const { userName } = useCurrentUser()

const salaryData = [
  { month: "Juli", year: 2026, netto: "2.140,50", brutto: "3.050,00", status: "Ausbezahlt", statusClass: "success" },
  { month: "Juni", year: 2026, netto: "2.090,00", brutto: "2.980,00", status: "Ausbezahlt", statusClass: "success" },
  { month: "Mai", year: 2026, netto: "2.150,20", brutto: "3.065,00", status: "Ausbezahlt", statusClass: "success" },
  { month: "April", year: 2026, netto: "1.980,00", brutto: "2.800,00", status: "Ausbezahlt", statusClass: "success" }
]

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const checkScreenSize = () => {
  if (window.innerWidth > 768) {
    isMobileMenuOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', checkScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})

const downloadPdf = (item) => {
  alert(`Lohnzettel für ${item.month} ${item.year} wird heruntergeladen...`)
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

.page-container {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  background-color: #0b0f19;
}

/* Header & Desktop Standard */
.app-header {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
  width: 100%;
}

.header-inner {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  gap: 24px;
}

.user-info-link { text-decoration: none; flex-shrink: 0; }
.user-info { display: flex; align-items: center; gap: 12px; }

.avatar-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.user-details { display: flex; flex-direction: column; text-align: left; }
.user-name { font-size: 0.9rem; font-weight: 600; color: #f8fafc; line-height: 1.2; white-space: nowrap; }
.user-role { font-size: 0.72rem; color: #94a3b8; margin-top: 2px; }

.menu-toggle {
  display: none;
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #f8fafc;
  cursor: pointer;
  padding: 8px;
}

.nav-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn-nav {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.btn-nav:active { transform: scale(0.96); }
.btn-nav.router-link-active, .btn-nav.active { background: #2563eb; border-color: #3b82f6; color: #fff; }
.btn-logout { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.2); }

/* Main Content Standard (Desktop) */
.app-main {
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title h2 { font-size: 1.3rem; color: #fff; margin: 0 0 4px 0; display: flex; align-items: center; gap: 10px; }
.section-title p { font-size: 0.85rem; color: #94a3b8; margin: 0; }

.salary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.salary-card {
  background: #161e2e;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  gap: 16px;
}

.salary-info { display: flex; align-items: center; gap: 14px; }
.salary-icon { width: 42px; height: 42px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
.salary-card h3 { font-size: 1rem; color: #fff; margin: 0 0 4px 0; }
.salary-amount { font-size: 0.82rem; color: #94a3b8; }
.salary-amount strong { color: #34d399; }

.salary-action { display: flex; align-items: center; gap: 14px; }

.badge-status {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
}
.badge-status.success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }

.btn-download {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
  white-space: nowrap;
}
.btn-download:hover { background: #1d4ed8; }

/* 📱 Mobile Vollbild-Modus (Hebt die Begrenzungen auf) */
@media (max-width: 768px) {
  .app-main {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 16px 12px !important; /* Minimaler, gleichmäßiger Rand links/rechts */
  }

  .header-inner {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 12px 14px !important;
  }

  .menu-toggle {
    display: block !important;
  }

  .nav-buttons {
    display: none !important;
    position: absolute !important;
    top: 100% !important;
    left: 0 !important;
    width: 100% !important;
    background: #0f172a !important;
    flex-direction: column !important;
    padding: 16px !important;
    gap: 8px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
    z-index: 1000 !important;
  }

  .nav-buttons.show {
    display: flex !important;
  }

  .btn-nav {
    width: 100% !important;
    justify-content: flex-start !important;
    padding: 12px 14px !important;
    font-size: 0.9rem !important;
  }

  .salary-card {
    padding: 14px !important;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .salary-action {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
