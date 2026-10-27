<template>
  <AppShell eyebrow="Finanzen" :title="isAdmin ? 'Lohnzettel verwalten' : 'Meine Lohnzettel'" description="Lohnzettel werden geschützt gespeichert und nur dem jeweiligen Mitarbeiter angezeigt.">
    <section v-if="isAdmin" class="upload-panel panel"><header><span><i class="fa-solid fa-file-arrow-up"></i></span><div><p>NEUER LOHNZETTEL</p><h2>PDF sicher zuordnen</h2></div></header><div class="upload-fields"><label><span>Mitarbeiter</span><select v-model="upload.user_id"><option value="" disabled>Mitarbeiter auswählen</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select></label><label><span>Monat</span><input v-model="upload.payroll_month" type="month"></label><label><span>Titel</span><input v-model.trim="upload.title" placeholder="z. B. Lohnzettel Oktober 2026"></label><label class="file-label"><span>PDF-Datei</span><input type="file" accept="application/pdf,.pdf" @change="setFile"><small>{{ selectedFile?.name || 'PDF auswählen (max. 10 MB)' }}</small></label><button type="button" :disabled="isUploading || !canUpload" @click="uploadPayslip"><i class="fa-solid" :class="isUploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'"></i>{{ isUploading ? 'Wird hochgeladen …' : 'Hochladen' }}</button></div></section>
    <p v-if="message" class="feedback" :class="message.type"><i class="fa-solid" :class="message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>{{ message.text }}</p>
    <section class="payslip-panel panel"><header><div><p>GESCHÜTZTE DOKUMENTE</p><h2>{{ isAdmin ? 'Alle Lohnzettel' : 'Abrechnungsverlauf' }}</h2><span>{{ rows.length }} Dokument{{ rows.length === 1 ? '' : 'e' }}</span></div><button type="button" @click="loadRows"><i class="fa-solid fa-rotate-right"></i></button></header><div v-if="isLoading" class="state"><i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …</div><div v-else-if="!rows.length" class="state"><i class="fa-regular fa-folder-open"></i> Noch kein Lohnzettel verfügbar.</div><div v-else class="payslip-list"><article v-for="row in rows" :key="row.id"><span class="document-icon"><i class="fa-regular fa-file-pdf"></i></span><div class="document-copy"><h3>{{ row.title }}</h3><p>{{ employeeName(row.user_id) }} · {{ formatMonth(row.payroll_month) }}</p><small>Bereitgestellt am {{ formatDate(row.created_at) }}</small></div><button class="download" type="button" :disabled="downloadingId === row.id" @click="downloadPayslip(row)"><i class="fa-solid" :class="downloadingId === row.id ? 'fa-spinner fa-spin' : 'fa-download'"></i><span>Öffnen</span></button><button v-if="isAdmin" class="delete" type="button" title="Lohnzettel löschen" @click="deletePayslip(row)"><i class="fa-solid fa-trash"></i></button></article></div></section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const { isAdmin, loadCurrentUser } = useCurrentUser()
const currentUserId = ref('')
const employees = ref([])
const rows = ref([])
const isLoading = ref(true)
const isUploading = ref(false)
const downloadingId = ref(null)
const selectedFile = ref(null)
const message = ref(null)
const today = new Date()
const upload = ref({ user_id: '', payroll_month: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`, title: '' })
const canUpload = computed(() => upload.value.user_id && upload.value.payroll_month && upload.value.title && selectedFile.value)
const employeeMap = computed(() => new Map(employees.value.map((employee) => [employee.id, employee.name])))
const employeeName = (id) => employeeMap.value.get(id) || (id === currentUserId.value ? 'Du' : 'Mitarbeiter:in')
const formatMonth = (date) => new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
const formatDate = (date) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(date))

const loadRows = async () => {
  isLoading.value = true
  try {
    const query = supabase.from('payslips').select('id, user_id, title, payroll_month, document_path, created_at').order('payroll_month', { ascending: false })
    if (!isAdmin.value) query.eq('user_id', currentUserId.value)
    const [{ data, error }, employeeResult] = await Promise.all([query, isAdmin.value ? supabase.from('app_users').select('id, name').eq('role', 'employee').order('name') : Promise.resolve({ data: [] })])
    if (error) throw error
    rows.value = data || []
    employees.value = employeeResult.data || []
  } catch { message.value = { type: 'error', text: 'Die Lohnzettel konnten nicht geladen werden.' } } finally { isLoading.value = false }
}

const setFile = (event) => { selectedFile.value = event.target.files?.[0] || null }
const uploadPayslip = async () => {
  if (!canUpload.value) return
  const file = selectedFile.value
  if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { message.value = { type: 'error', text: 'Bitte eine PDF-Datei bis maximal 10 MB auswählen.' }; return }
  isUploading.value = true; message.value = null
  const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const path = `${upload.value.user_id}/${crypto.randomUUID()}.${extension}`
  try {
    const { error: uploadError } = await supabase.storage.from('payslips').upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (uploadError) throw uploadError
    const month = `${upload.value.payroll_month}-01`
    const { error: recordError } = await supabase.from('payslips').insert({ user_id: upload.value.user_id, title: upload.value.title, payroll_month: month, document_path: path, created_by: currentUserId.value })
    if (recordError) { await supabase.storage.from('payslips').remove([path]); throw recordError }
    message.value = { type: 'success', text: 'Lohnzettel hochgeladen. Der Mitarbeiter wurde benachrichtigt.' }
    upload.value.title = ''; selectedFile.value = null
    await loadRows()
  } catch { message.value = { type: 'error', text: 'Der Upload konnte nicht abgeschlossen werden.' } } finally { isUploading.value = false }
}

const downloadPayslip = async (row) => {
  downloadingId.value = row.id
  try {
    const { data, error } = await supabase.storage.from('payslips').download(row.document_path)
    if (error) throw error
    const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = `${row.title}.pdf`; link.click(); URL.revokeObjectURL(url)
  } catch { message.value = { type: 'error', text: 'Die Datei konnte nicht geöffnet werden.' } } finally { downloadingId.value = null }
}

const deletePayslip = async (row) => {
  if (!window.confirm(`„${row.title}“ wirklich löschen?`)) return
  try {
    const { error } = await supabase.from('payslips').delete().eq('id', row.id)
    if (error) throw error
    await supabase.storage.from('payslips').remove([row.document_path])
    rows.value = rows.value.filter((item) => item.id !== row.id)
    message.value = { type: 'success', text: 'Lohnzettel gelöscht.' }
  } catch { message.value = { type: 'error', text: 'Der Lohnzettel konnte nicht gelöscht werden.' } }
}

onMounted(async () => { await loadCurrentUser(); const { data: { user } } = await supabase.auth.getUser(); currentUserId.value = user?.id || ''; await loadRows() })
</script>

<style scoped>
.panel { overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.upload-panel { margin-bottom: 20px; }.upload-panel > header { display: flex; align-items: center; gap: 12px; padding: 20px 23px; border-bottom: 1px solid var(--line); }.upload-panel header > span { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.15); }.upload-panel p, .payslip-panel p { margin: 0; }.upload-panel header p, .payslip-panel header p { color: var(--text-muted); font-size: .63rem; font-weight: 800; letter-spacing: .1em; }.upload-panel h2, .payslip-panel h2 { margin: 4px 0 0; color: var(--text-heading); font-size: 1.03rem; }.upload-fields { display: grid; grid-template-columns: 1.2fr .7fr 1.2fr 1.3fr auto; align-items: end; gap: 10px; padding: 18px 23px; }.upload-fields label { display: grid; gap: 7px; color: var(--text-muted); font-size: .64rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }.upload-fields input, .upload-fields select { width: 100%; min-height: 41px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: var(--text-primary); background: var(--surface-raised); font: inherit; text-transform: none; }.file-label { overflow: hidden; }.file-label input { position: absolute; width: 1px; height: 1px; opacity: 0; }.file-label small { min-height: 41px; display: flex; align-items: center; overflow: hidden; padding: 0 10px; border: 1px dashed var(--line-strong); border-radius: 10px; color: var(--text-secondary); font-size: .68rem; letter-spacing: normal; text-overflow: ellipsis; white-space: nowrap; text-transform: none; cursor: pointer; }.upload-fields button { min-height: 41px; padding: 0 13px; border: 0; border-radius: 10px; color: #fff; background: #2563eb; font-size: .72rem; font-weight: 800; cursor: pointer; }.upload-fields button:disabled { opacity: .65; cursor: wait; }.feedback { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 11px 12px; border-radius: 10px; font-size: .76rem; }.feedback.success { color: #86efac; background: rgba(22,163,74,.12); }.feedback.error { color: #fda4af; background: rgba(244,63,94,.12); }.payslip-panel > header { display: flex; align-items: center; justify-content: space-between; padding: 23px 25px; border-bottom: 1px solid var(--line); }.payslip-panel header span { display: block; margin-top: 5px; color: var(--text-secondary); font-size: .7rem; }.payslip-panel > header button { width: 34px; height: 34px; border: 0; border-radius: 9px; color: var(--brand-light); background: rgba(37,99,235,.13); cursor: pointer; }.state { min-height: 260px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--text-muted); font-size: .8rem; }.payslip-list { display: grid; }.payslip-list article { display: grid; grid-template-columns: 42px minmax(0,1fr) auto auto; align-items: center; gap: 13px; padding: 16px 23px; border-bottom: 1px solid var(--line); }.document-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; color: #fca5a5; background: rgba(244,63,94,.13); }.document-copy h3 { margin: 0; color: var(--text-heading); font-size: .82rem; }.document-copy p, .document-copy small { display: block; margin: 4px 0 0; color: var(--text-secondary); font-size: .7rem; }.document-copy small { color: var(--text-muted); font-size: .63rem; }.download, .delete { min-height: 35px; display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 9px; color: var(--brand-light); background: var(--surface-raised); font-size: .68rem; font-weight: 800; cursor: pointer; }.delete { width: 35px; justify-content: center; padding: 0; color: #fda4af; }.download:disabled { opacity: .65; cursor: wait; }
@media (max-width: 1000px) { .upload-fields { grid-template-columns: 1fr 1fr; }.upload-fields button { grid-column: span 2; } }
@media (max-width: 560px) { .upload-panel > header, .upload-fields, .payslip-panel > header { padding: 18px; }.upload-fields { grid-template-columns: 1fr; }.upload-fields button { grid-column: auto; }.payslip-list article { grid-template-columns: 40px minmax(0,1fr) auto; padding: 14px; }.delete { grid-column: 3; grid-row: 1 / span 2; }.download span { display: none; } }
</style>
