<template>
  <div class="page-container">
    <!-- Header -->
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
          <router-link to="/antraege" class="btn-nav active" @click="isMobileMenuOpen = false">
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
      <!-- Neuer Antrag Card -->
      <section class="card">
        <div class="card-header">
          <div class="card-icon">
            <i class="fa-solid fa-file-circle-plus"></i>
          </div>
          <div>
            <h2>Neuer Antrag</h2>
            <p class="card-subtitle">Urlaubs-, Zeitausgleichs- oder Tauschantrag</p>
          </div>
        </div>

        <div v-if="successMessage" class="alert alert-success" role="status">
          <i class="fa-solid fa-circle-check"></i> {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="alert alert-error" role="alert">
          <i class="fa-solid fa-circle-exclamation"></i> {{ errorMessage }}
        </div>

        <form @submit.prevent="submitRequest" class="form-container">
          <div class="form-group">
            <label for="typeSelect">Antragsart</label>
            <select id="typeSelect" v-model="newRequest.type" required>
              <option value="" disabled selected>Bitte wählen...</option>
              <option value="Erholungsurlaub">Erholungsurlaub</option>
              <option value="Zeitausgleich">Zeitausgleich (ZA)</option>
              <option value="Diensttausch">Diensttausch</option>
              <option value="Sonderurlaub">Sonderurlaub</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="startDate">Von Datum</label>
              <input type="date" id="startDate" v-model="newRequest.startDate" required />
            </div>
            <div class="form-group">
              <label for="endDate">Bis Datum</label>
              <input type="date" id="endDate" v-model="newRequest.endDate" required />
            </div>
          </div>

          <div class="form-group">
            <label for="reasonInput">Begründung (Optional)</label>
            <textarea id="reasonInput" v-model="newRequest.reason" placeholder="Grund oder Tauschpartner angeben..."></textarea>
          </div>

          <button type="submit" class="btn-submit" :disabled="isSubmitting">
            <i class="fa-solid" :class="isSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>
            <span>{{ isSubmitting ? 'Wird übermittelt...' : 'Antrag einreichen' }}</span>
          </button>
        </form>
      </section>

      <!-- Historie Card -->
      <section class="card">
        <div class="card-header">
          <div class="card-icon secondary">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <h2>Meine Anträge</h2>
            <p class="card-subtitle">Status-Übersicht eingereichter Anträge</p>
          </div>
        </div>

        <p v-if="isLoading" class="empty-state">Anträge werden geladen …</p>
        <p v-else-if="requests.length === 0" class="empty-state">Noch keine Anträge vorhanden.</p>
        <div v-else class="requests-list">
          <div v-for="req in requests" :key="req.id" class="request-item">
            <div class="request-header">
              <span class="request-type">{{ req.request_type }}</span>
              <span class="status-badge" :class="getStatusClass(req.status)">{{ formatStatus(req.status) }}</span>
            </div>
            <div class="request-dates">
              <i class="fa-regular fa-calendar"></i> {{ formatDate(req.start_date) }} {{ req.end_date !== req.start_date ? 'bis ' + formatDate(req.end_date) : '' }}
            </div>
            <div v-if="req.reason" class="request-reason">"{{ req.reason }}"</div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const router = useRouter()
const isMobileMenuOpen = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const isLoading = ref(true)
const isSubmitting = ref(false)
const { userName } = useCurrentUser()

const newRequest = ref({ type: '', startDate: '', endDate: '', reason: '' })
const requests = ref([])

const formatDate = (dateString) => {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-').map(Number)
  return new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' })
    .format(new Date(year, month - 1, day))
}

const formatStatus = (status) => ({
  pending: 'In Bearbeitung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt'
}[status] || status)

const fetchRequests = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')

    const { data, error } = await supabase
      .from('employee_requests')
      .select('id, request_type, start_date, end_date, reason, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    requests.value = data || []
  } catch (error) {
    errorMessage.value = error?.message || 'Die Anträge konnten nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

const submitRequest = async () => {
  errorMessage.value = ''
  successMessage.value = ''
  if (newRequest.value.endDate < newRequest.value.startDate) {
    errorMessage.value = 'Das Enddatum darf nicht vor dem Startdatum liegen.'
    return
  }

  isSubmitting.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')

    const { data, error } = await supabase
      .from('employee_requests')
      .insert({
        user_id: user.id,
        request_type: newRequest.value.type,
        start_date: newRequest.value.startDate,
        end_date: newRequest.value.endDate,
        reason: newRequest.value.reason.trim() || null
      })
      .select('id, request_type, start_date, end_date, reason, status, created_at')
      .single()

    if (error) throw error
    requests.value.unshift(data)
    successMessage.value = 'Ihr Antrag wurde übermittelt.'
    newRequest.value = { type: '', startDate: '', endDate: '', reason: '' }
  } catch (error) {
    errorMessage.value = error?.message || 'Der Antrag konnte nicht übermittelt werden.'
  } finally {
    isSubmitting.value = false
  }
}

const getStatusClass = (status) => {
  if (status === 'approved') return 'status-approved'
  if (status === 'pending') return 'status-pending'
  return 'status-rejected'
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  router.replace('/')
}

onMounted(fetchRequests)
</script>

<style scoped>
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

/* Zentrierter Seiten-Container ohne Seitenabstände/Ränder */
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

/* Full-Width Header mit fester Höhe & Zentrierung */
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
  touch-action: manipulation;
}

.btn-nav.active { background: #2563eb; border-color: #3b82f6; color: #fff; }
.btn-logout { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.2); cursor: pointer; }

/* Zentrierter Hauptbereich für PC & Mobile */
.app-main {
  flex: 1;
  padding: 20px 16px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

.card {
  background: #161e2e;
  border-radius: 16px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  text-align: left;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.card-icon {
  width: 42px;
  height: 42px;
  background: rgba(37, 99, 235, 0.15);
  color: #60a5fa;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.card-icon.secondary {
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.form-group label {
  font-size: 0.82rem;
  color: #cbd5e1;
  font-weight: 500;
  margin-bottom: 6px;
}

/* Formular-Eingaben mit 16px Font-Size (verhindert iOS Safari Zoom) */
.form-group input,
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

.form-group input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0.8);
  cursor: pointer;
}

.form-group select {
  background-image: url("data:image/svg+xml;utf8,<svg fill='%2394a3b8' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.form-group textarea {
  min-height: 90px;
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

.alert-success {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid #10b981;
  color: #6ee7b7;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 0.88rem;
  margin-bottom: 14px;
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

.empty-state {
  color: #94a3b8;
  font-size: 0.9rem;
  text-align: center;
  padding: 20px 8px;
}

/* Antragsliste */
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.request-item {
  background: #0b0f19;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.request-type { font-weight: 600; font-size: 0.88rem; color: #f8fafc; }

.status-badge {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-approved { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
.status-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
.status-rejected { background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3); }

.request-dates { font-size: 0.78rem; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
.request-reason { font-size: 0.78rem; color: #cbd5e1; margin-top: 6px; font-style: italic; }

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
  .card { padding: 16px 14px; border-radius: 14px; }
  .form-row { grid-template-columns: 1fr; gap: 14px; }
}
</style>
