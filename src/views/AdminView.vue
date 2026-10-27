<template>
  <AppShell eyebrow="Verwaltung" title="Adminbereich" description="Bearbeite Mitarbeiteranträge und halte dein Team auf dem Laufenden.">
    <section class="admin-summary">
      <article><span class="summary-icon summary-icon--amber"><i class="fa-solid fa-hourglass-half"></i></span><div><span>Offene Anträge</span><strong>{{ pendingRequests.length }}</strong></div></article>
      <article><span class="summary-icon summary-icon--blue"><i class="fa-solid fa-users"></i></span><div><span>Mitarbeiter</span><strong>{{ employees.length }}</strong></div></article>
      <article><span class="summary-icon summary-icon--green"><i class="fa-solid fa-bell"></i></span><div><span>Automatik aktiv</span><strong>Ja</strong></div></article>
    </section>

    <section class="admin-hub">
      <router-link to="/admin/kalender"><i class="fa-solid fa-calendar-days"></i><span><strong>Alle Kalender</strong><small>Gesamtübersicht aller Dienste</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
      <router-link to="/admin/dienstplanung"><i class="fa-solid fa-calendar-plus"></i><span><strong>Dienstplanung</strong><small>Dienste manuell planen</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
      <router-link to="/admin/ki-dienstplanung"><i class="fa-solid fa-wand-magic-sparkles"></i><span><strong>KI-Dienstplanung</strong><small>Fairen Monatsplan erstellen</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
      <router-link to="/praeferenzen"><i class="fa-solid fa-sliders"></i><span><strong>Mitarbeiterpräferenzen</strong><small>Wünsche & Verfügbarkeit</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
      <router-link to="/nachrichten"><i class="fa-solid fa-paper-plane"></i><span><strong>Nachrichten</strong><small>Team benachrichtigen</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
      <router-link to="/gehalt"><i class="fa-solid fa-file-invoice-dollar"></i><span><strong>Lohnzettel</strong><small>PDFs bereitstellen</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
      <router-link to="/ausruestung"><i class="fa-solid fa-toolbox"></i><span><strong>Ausrüstung</strong><small>Ausgabe & Prüfungen</small></span><i class="fa-solid fa-arrow-right"></i></router-link>
    </section>

    <section class="admin-panel">
      <header><div><p>ANTRÄGE</p><h2>Urlaub & Abwesenheit</h2><span>Beim Genehmigen oder Ablehnen wird der Mitarbeiter automatisch benachrichtigt.</span></div><button type="button" @click="loadAdminData"><i class="fa-solid fa-rotate-right"></i> Aktualisieren</button></header>
      <div v-if="isLoading" class="admin-state"><i class="fa-solid fa-spinner fa-spin"></i> Anträge werden geladen …</div>
      <div v-else-if="loadError" class="admin-state admin-state--error"><i class="fa-solid fa-circle-exclamation"></i>{{ loadError }}</div>
      <div v-else-if="!requests.length" class="admin-state"><i class="fa-regular fa-folder-open"></i> Aktuell liegen keine Anträge vor.</div>
      <div v-else class="request-table"><article v-for="request in requests" :key="request.id" class="admin-request"><div class="request-avatar">{{ initialsFor(request.user_id) }}</div><div class="request-details"><h3>{{ employeeName(request.user_id) }}</h3><p>{{ request.request_type }} · {{ formatDate(request.start_date) }}<template v-if="request.end_date !== request.start_date"> – {{ formatDate(request.end_date) }}</template></p><small v-if="request.reason">{{ request.reason }}</small></div><span class="request-status" :class="`request-status--${request.status}`">{{ statusLabel(request.status) }}</span><div class="request-actions"><template v-if="request.status === 'pending'"><button class="approve" type="button" :disabled="updatingId === request.id" @click="updateStatus(request, 'approved')"><i class="fa-solid fa-check"></i> Genehmigen</button><button class="reject" type="button" :disabled="updatingId === request.id" @click="updateStatus(request, 'rejected')"><i class="fa-solid fa-xmark"></i> Ablehnen</button></template><button class="delete-request" type="button" :disabled="updatingId === request.id" title="Antrag löschen" @click="deleteRequest(request)"><i class="fa-solid fa-trash"></i></button></div></article></div>
    </section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'

const requests = ref([])
const employees = ref([])
const isLoading = ref(true)
const loadError = ref('')
const updatingId = ref(null)
const employeeById = computed(() => new Map(employees.value.map((employee) => [employee.id, employee])))
const pendingRequests = computed(() => requests.value.filter((request) => request.status === 'pending'))

const formatDate = (date) => new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const statusLabel = (status) => ({ pending: 'Offen', approved: 'Genehmigt', rejected: 'Abgelehnt' }[status] || status)
const employeeName = (id) => employeeById.value.get(id)?.name || employeeById.value.get(id)?.username || 'Mitarbeiter:in'
const initialsFor = (id) => employeeName(id).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'M'

const loadAdminData = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    const [{ data: requestRows, error: requestError }, { data: employeeRows, error: employeeError }] = await Promise.all([
      supabase.from('employee_requests').select('id, user_id, request_type, start_date, end_date, reason, status, created_at').order('created_at', { ascending: false }),
      supabase.from('app_users').select('id, username, name, role').order('name')
    ])
    if (requestError || employeeError) throw requestError || employeeError
    requests.value = requestRows || []
    employees.value = employeeRows || []
  } catch (error) {
    loadError.value = 'Die Verwaltungsdaten konnten nicht geladen werden.'
  } finally { isLoading.value = false }
}

const updateStatus = async (request, status) => {
  updatingId.value = request.id
  try {
    const { error } = await supabase.from('employee_requests').update({ status }).eq('id', request.id)
    if (error) throw error
    request.status = status
  } catch {
    loadError.value = 'Der Antrag konnte nicht aktualisiert werden.'
  } finally { updatingId.value = null }
}

const deleteRequest = async (request) => {
  if (!window.confirm(`Antrag von ${employeeName(request.user_id)} wirklich löschen?`)) return
  updatingId.value = request.id
  try {
    const { error } = await supabase.from('employee_requests').delete().eq('id', request.id)
    if (error) throw error
    requests.value = requests.value.filter((item) => item.id !== request.id)
  } catch { loadError.value = 'Der Antrag konnte nicht gelöscht werden.' } finally { updatingId.value = null }
}

onMounted(loadAdminData)
</script>

<style scoped>
.admin-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px; }.admin-summary article { display: flex; align-items: center; gap: 13px; min-height: 104px; padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface-card); box-shadow: var(--card-shadow); }.summary-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; }.summary-icon--amber { color: #fcd34d; background: rgba(245,158,11,.15); }.summary-icon--blue { color: #93c5fd; background: rgba(37,99,235,.15); }.summary-icon--green { color: #6ee7b7; background: rgba(16,185,129,.14); }.admin-summary span:not(.summary-icon) { display: block; color: var(--text-muted); font-size: .72rem; font-weight: 700; }.admin-summary strong { display: block; margin-top: 5px; color: var(--text-heading); font-size: 1.2rem; }.admin-panel { overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.admin-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 24px 26px; border-bottom: 1px solid var(--line); }.admin-panel header p { margin: 0 0 4px; color: var(--text-muted); font-size: .64rem; font-weight: 800; letter-spacing: .08em; }.admin-panel h2 { margin: 0; color: var(--text-heading); font-size: 1.05rem; }.admin-panel header span { display: block; margin-top: 5px; color: var(--text-secondary); font-size: .74rem; }.admin-panel header button { display: inline-flex; align-items: center; gap: 7px; padding: 9px 11px; border: 1px solid var(--line-strong); border-radius: 9px; color: var(--brand); background: var(--surface-raised); font-size: .72rem; font-weight: 800; cursor: pointer; }.admin-state { min-height: 220px; display: grid; place-content: center; justify-items: center; gap: 9px; padding: 24px; color: var(--text-muted); font-size: .82rem; text-align: center; }.admin-state--error { color: #fda4af; }.request-table { display: grid; }.admin-request { display: grid; grid-template-columns: 39px minmax(0,1fr) auto auto; align-items: center; gap: 13px; padding: 16px 24px; border-bottom: 1px solid var(--line); }.admin-request:last-child { border-bottom: 0; }.request-avatar { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.14); font-size: .68rem; font-weight: 800; }.request-details { min-width: 0; }.request-details h3 { margin: 0; color: var(--text-heading); font-size: .82rem; }.request-details p, .request-details small { display: block; overflow: hidden; margin: 4px 0 0; color: var(--text-secondary); font-size: .71rem; text-overflow: ellipsis; white-space: nowrap; }.request-details small { color: var(--text-muted); }.request-status { padding: 6px 8px; border-radius: 7px; font-size: .64rem; font-weight: 800; }.request-status--pending { color: #fcd34d; background: rgba(245,158,11,.14); }.request-status--approved { color: #6ee7b7; background: rgba(16,185,129,.14); }.request-status--rejected { color: #fda4af; background: rgba(244,63,94,.14); }.request-actions { display: flex; gap: 6px; }.request-actions button { display: inline-flex; align-items: center; gap: 5px; padding: 8px; border: 0; border-radius: 8px; color: #fff; font-size: .66rem; font-weight: 800; cursor: pointer; }.request-actions button:disabled { opacity: .6; cursor: wait; }.approve { background: #059669; }.reject { background: #e11d48; }
.admin-hub { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 22px; }.admin-hub a { display: grid; grid-template-columns: 30px minmax(0,1fr) 10px; align-items: center; gap: 8px; min-height: 76px; padding: 12px; border: 1px solid var(--line); border-radius: 14px; color: inherit; background: var(--surface-card); box-shadow: var(--card-shadow); text-decoration: none; transition: .16s ease; }.admin-hub a:hover { transform: translateY(-2px); border-color: rgba(96,165,250,.55); }.admin-hub a > i:first-child { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; color: #bfdbfe; background: rgba(37,99,235,.15); font-size: .76rem; }.admin-hub span { min-width: 0; }.admin-hub strong, .admin-hub small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.admin-hub strong { color: var(--text-heading); font-size: .67rem; }.admin-hub small { margin-top: 3px; color: var(--text-muted); font-size: .57rem; }.admin-hub a > i:last-child { color: var(--text-muted); font-size: .55rem; }.delete-request { color: #fda4af !important; background: rgba(244,63,94,.13) !important; }
@media (max-width: 900px) { .admin-hub { grid-template-columns: repeat(3, minmax(0,1fr)); } } @media (max-width: 760px) { .admin-summary { grid-template-columns: repeat(3, minmax(0,1fr)); gap: 7px; }.admin-summary article { min-height: 79px; flex-direction: column; align-items: flex-start; gap: 5px; padding: 10px; }.summary-icon { width: 28px; height: 28px; border-radius: 8px; font-size: .7rem; }.admin-summary span:not(.summary-icon) { overflow: hidden; width: 100%; font-size: .58rem; text-overflow: ellipsis; white-space: nowrap; }.admin-summary strong { margin-top: 2px; font-size: .95rem; }.admin-hub { grid-template-columns: 1fr 1fr; gap: 7px; }.admin-hub a { min-height: 67px; padding: 9px; }.admin-panel > header { align-items: flex-start; flex-direction: column; padding: 19px; }.admin-request { grid-template-columns: 39px minmax(0,1fr) auto; align-items: start; gap: 10px; padding: 14px; }.request-status { grid-column: 2; justify-self: start; }.request-actions { grid-column: 2 / -1; }.request-details small { white-space: normal; } }
</style>
