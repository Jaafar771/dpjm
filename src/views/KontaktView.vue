<template>
  <div class="page-container">
    <header class="app-header">
      <div class="header-inner">
        <!-- Profil-Link im Header -->
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
          <router-link to="/anweisungen" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-file-pdf"></i> Anweisungen
          </router-link>
          <router-link to="/gehalt" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-file-invoice-dollar"></i> Gehalt
          </router-link>
          <router-link to="/kontakt" class="btn-nav active" @click="isMobileMenuOpen = false">
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
          <div class="card-icon">
            <i class="fa-solid fa-envelope-open-text"></i>
          </div>
          <div>
            <h2>Büro Kontakt</h2>
            <p class="card-subtitle">Direkte Nachricht an die Dienstplan-Verwaltung</p>
          </div>
        </div>

        <div v-if="successMessage" class="alert alert-success">
          <i class="fa-solid fa-circle-check"></i> {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="alert alert-error" role="alert">
          <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
        </div>

        <form @submit.prevent="sendMessage" class="form-container">
          <div class="form-group">
            <label for="subject">Betreff / Thema</label>
            <select id="subject" v-model="formData.subject" required>
              <option value="" disabled selected>Bitte wählen...</option>
              <option value="Frage zum Dienstplan">Frage zum Dienstplan</option>
              <option value="Krankmeldung">Krankmeldung nachreichen</option>
              <option value="Diensttausch / Urlaub">Diensttausch / Urlaub Rückfrage</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>

          <div class="form-group">
            <label for="message">Ihre Nachricht</label>
            <textarea id="message" v-model="formData.message" placeholder="Nachricht hier eingeben..." required></textarea>
          </div>

          <button type="submit" class="btn-submit" :disabled="isSending">
            <i class="fa-solid" :class="isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
            <span>{{ isSending ? 'Wird geöffnet...' : 'Nachricht Absenden' }}</span>
          </button>
        </form>
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
const isSending = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const { userName } = useCurrentUser()

const formData = ref({ subject: '', message: '' })

const sendMessage = () => {
  errorMessage.value = ''
  successMessage.value = ''
  isSending.value = true
  const targetEmail = import.meta.env.VITE_OFFICE_EMAIL?.trim()

  if (!targetEmail) {
    errorMessage.value = 'Die E-Mail-Adresse der Dienstplan-Verwaltung ist noch nicht eingerichtet.'
    isSending.value = false
    return
  }

  const mailtoSubject = encodeURIComponent(`[Dienstplan] ${formData.value.subject}`)
  const mailtoBody = encodeURIComponent(`Nachricht:\n${formData.value.message}`)

  window.location.href = `mailto:${targetEmail}?subject=${mailtoSubject}&body=${mailtoBody}`

  successMessage.value = 'E-Mail App wird geöffnet...'
  formData.value = { subject: '', message: '' }
  isSending.value = false

  setTimeout(() => { successMessage.value = '' }, 4000)
}

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

/* Base Page Layout & Desktop-Zentrierung */
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

/* Header Container */
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
  font-size: 1rem;
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

/* Zentrierter Hauptbereich */
.app-main {
  flex: 1;
  padding: 20px 16px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.card {
  width: 100%;
  background: #161e2e;
  border-radius: 16px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.card-icon {
  width: 44px;
  height: 44px;
  background: rgba(37, 99, 235, 0.15);
  color: #60a5fa;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.card h2 { font-size: 1.15rem; font-weight: 700; margin: 0 0 2px 0; color: #f8fafc; }
.card-subtitle { font-size: 0.8rem; color: #94a3b8; margin: 0; }

.form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}

.form-group label {
  font-size: 0.82rem;
  color: #cbd5e1;
  font-weight: 500;
  margin-bottom: 6px;
}

/* Formular-Eingaben mit 16px Font-Size (verhindert iOS Safari Zoom) */
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #0b0f19;
  color: #fff;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  appearance: none;
  transition: all 0.2s ease;
  touch-action: manipulation;
}

.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.form-group select {
  background-image: url("data:image/svg+xml;utf8,<svg fill='%2394a3b8' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.form-group textarea {
  min-height: 140px;
  resize: vertical;
}

.btn-submit {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
  touch-action: manipulation;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alert-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid #10b981;
  color: #6ee7b7;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 0.88rem;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.alert-error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid #ef4444;
  color: #fecaca;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 0.88rem;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Mobile Responsive Breakpoints */
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
}
</style>
