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
          <router-link to="/anweisungen" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-file-pdf"></i> Anweisungen
          </router-link>
          <router-link to="/gehalt" class="btn-nav" @click="closeMobileMenu">
            <i class="fa-solid fa-file-invoice-dollar"></i> Gehalt
          </router-link>
          <router-link to="/kontakt" class="btn-nav" @click="isMobileMenuOpen = false">
            <i class="fa-solid fa-paper-plane"></i> Büro Kontakt
          </router-link>
          <router-link to="/profile" class="btn-nav active" @click="isMobileMenuOpen = false">
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
        <div class="profile-avatar-section">
          <div class="large-avatar">
            <i class="fa-solid fa-user-gear"></i>
          </div>
          <h2>{{ userName }}</h2>
          <span class="user-badge">Mein Benutzerkonto</span>
        </div>

        <div v-if="successMessage" class="alert alert-success">
          <i class="fa-solid fa-circle-check"></i> {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="alert alert-error" role="alert">
          <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
        </div>

        <form @submit.prevent="saveProfile" class="form-container">
          <!-- Kontakt-Informationen -->
          <h3><i class="fa-solid fa-address-book"></i> Kontaktdaten</h3>

          <div class="form-group">
            <label>E-Mail Adresse</label>
            <input type="email" v-model="profileData.email" required />
          </div>

          <div class="form-group">
            <label>Telefonnummer</label>
            <input type="tel" v-model="profileData.phone" />
          </div>

          <hr class="divider" />

          <!-- Adresse & Meldezettel -->
          <h3><i class="fa-solid fa-house-user"></i> Adresse & Meldezettel</h3>

          <div class="form-group">
            <label>Straße & Hausnummer</label>
            <input type="text" v-model="profileData.street" placeholder="z. B. Hauptstraße 12/4" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>PLZ</label>
              <input type="text" v-model="profileData.zip" placeholder="z. B. 1100" />
            </div>
            <div class="form-group">
              <label>Ort</label>
              <input type="text" v-model="profileData.city" placeholder="z. B. Wien" />
            </div>
          </div>

          <hr class="divider" />

          <!-- Passwort Ändern -->
          <h3><i class="fa-solid fa-key"></i> Passwort ändern</h3>

          <div class="form-group">
            <label for="newPassword">Neues Passwort (optional)</label>
            <input id="newPassword" type="password" v-model="profileData.newPassword" minlength="8" autocomplete="new-password" placeholder="Mindestens 8 Zeichen" />
          </div>

          <button type="submit" class="btn-submit" :disabled="isSaving">
            <i class="fa-solid" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>
            <span>{{ isSaving ? 'Wird gespeichert...' : 'Einstellungen speichern' }}</span>
          </button>
        </form>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../config/supabase.js'

const router = useRouter()
const isMobileMenuOpen = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const isSaving = ref(false)
const userName = ref('Mein Profil')

const profileData = ref({
  email: '',
  phone: '',
  street: '',
  zip: '',
  city: '',
  newPassword: ''
})

const formatNameFromEmail = (email) => {
  if (!email) return 'Mein Profil'
  return email.split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const loadProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const metadata = user.user_metadata || {}
  const address = metadata.address || {}
  userName.value = metadata.full_name || metadata.name || formatNameFromEmail(user.email)
  profileData.value = {
    email: user.email || '',
    phone: metadata.phone || '',
    street: address.street || '',
    zip: address.zip || '',
    city: address.city || '',
    newPassword: ''
  }
}

const saveProfile = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (profileData.value.newPassword && profileData.value.newPassword.length < 8) {
    errorMessage.value = 'Das neue Passwort muss mindestens 8 Zeichen lang sein.'
    return
  }

  isSaving.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')

    const emailChanged = profileData.value.email.trim() !== user.email
    const updates = {
      data: {
        ...user.user_metadata,
        phone: profileData.value.phone.trim(),
        address: {
          street: profileData.value.street.trim(),
          zip: profileData.value.zip.trim(),
          city: profileData.value.city.trim()
        }
      }
    }

    if (emailChanged) updates.email = profileData.value.email.trim()
    if (profileData.value.newPassword) updates.password = profileData.value.newPassword

    const { error } = await supabase.auth.updateUser(updates)
    if (error) throw error

    profileData.value.newPassword = ''
    successMessage.value = emailChanged
      ? 'Ihre Daten wurden gespeichert. Bitte bestätigen Sie die neue E-Mail-Adresse.'
      : 'Ihre Daten wurden gespeichert.'
  } catch (error) {
    errorMessage.value = error?.message || 'Die Änderungen konnten nicht gespeichert werden.'
  } finally {
    isSaving.value = false
  }
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  router.replace('/')
}

onMounted(loadProfile)
</script>

<style scoped>
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

/* Base Page Layout & PC Zentrierung */
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
  max-width: 750px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.card {
  background: #161e2e;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

.profile-avatar-section {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.large-avatar {
  width: 68px;
  height: 68px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.2rem;
  color: #fff;
  margin: 0 auto 12px;
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
}

.profile-avatar-section h2 { font-size: 1.15rem; margin: 0 0 6px 0; color: #f8fafc; font-weight: 700; }
.user-badge { font-size: 0.75rem; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); padding: 3px 10px; border-radius: 6px; font-weight: 600; }

.divider { border: 0; height: 1px; background: rgba(255, 255, 255, 0.08); margin: 20px 0; }
.card h3 { font-size: 0.95rem; margin: 0 0 14px 0; color: #f8fafc; display: flex; align-items: center; gap: 8px; font-weight: 600; }
.card h3 i { color: #3b82f6; }

.form-container { display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; align-items: flex-start; width: 100%; }

.form-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 12px;
  width: 100%;
}

.form-group label { font-size: 0.82rem; color: #cbd5e1; font-weight: 500; margin-bottom: 6px; text-align: left; }

/* 16px Font-Size verhindert iOS Safari Auto-Zoom */
.form-group input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #0b0f19;
  color: #fff;
  font-size: 16px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s ease;
  touch-action: manipulation;
}

.form-group input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* File Upload Button Styling */
.file-upload-wrapper {
  width: 100%;
}

.file-input-hidden {
  display: none;
}

.file-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 13px 16px;
  background: #0b0f19;
  border: 1px dashed rgba(59, 130, 246, 0.5);
  border-radius: 10px;
  color: #60a5fa;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  touch-action: manipulation;
}

.file-upload-btn:hover {
  background: rgba(37, 99, 235, 0.1);
  border-color: #3b82f6;
}

.file-upload-btn span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
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
  margin-top: 10px;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
  touch-action: manipulation;
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
  margin-bottom: 16px;
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

  .form-row {
    grid-template-columns: 1fr;
    gap: 14px;
  }
}
</style>
