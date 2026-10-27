<template>
  <AppShell eyebrow="Admin-Zentrale" title="Dienstplanung" description="Einzelne Dienste manuell planen – mit denselben Schutzregeln wie bei der KI-Planung.">
    <section class="toolbar panel">
      <label><span>Monat</span><input v-model="monthValue" type="month"></label>
      <label><span>Ort filtern</span><select v-model="locationFilter"><option value="all">Alle Orte</option><option v-for="location in locations" :key="location.id" :value="location.name">{{ location.name }}</option></select></label>
      <label><span>Mitarbeiter filtern</span><select v-model="employeeFilter"><option value="all">Alle Mitarbeiter</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select></label>
      <button type="button" :disabled="isLoading" @click="loadData"><i class="fa-solid fa-rotate-right"></i> Aktualisieren</button>
    </section>

    <section class="planning-layout">
      <article class="entry-panel panel">
        <header><span><i class="fa-solid fa-calendar-plus"></i></span><div><p>MANUELLER DIENST</p><h2>Eintragen</h2></div></header>
        <div class="entry-form">
          <label><span>Mitarbeiter</span><select v-model="draft.user_id"><option value="" disabled>Mitarbeiter auswählen</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select></label>
          <div class="form-pair"><label><span>Datum</span><input v-model="draft.date" type="date"></label><label><span>Ort</span><select v-model="draft.ort"><option value="" disabled>Ort wählen</option><option v-for="location in locations" :key="location.id" :value="location.name">{{ location.name }}</option></select></label></div>
          <div class="shift-select"><button type="button" :class="{ active: draft.shift_type === 'TD' }" @click="draft.shift_type = 'TD'"><i class="fa-solid fa-sun"></i><span>Tagdienst</span><small>07:00–19:00</small></button><button type="button" :class="{ active: draft.shift_type === 'ND' }" @click="draft.shift_type = 'ND'"><i class="fa-solid fa-moon"></i><span>Nachtdienst</span><small>19:00–07:00</small></button></div>
          <p v-if="message" class="form-message" :class="message.type"><i class="fa-solid" :class="message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>{{ message.text }}</p>
          <div v-if="editingId" class="edit-hint"><span><i class="fa-solid fa-pen-to-square"></i> Dienst wird bearbeitet</span><button type="button" @click="cancelEdit">Abbrechen</button></div>
          <button class="save-button" type="button" :disabled="isSaving || !draft.user_id || !draft.date || !draft.ort" @click="saveShift"><i class="fa-solid" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>{{ isSaving ? 'Regeln werden geprüft …' : (editingId ? 'Änderung speichern' : 'Dienst speichern') }}</button>
        </div>
      </article>
      <aside class="rule-panel panel"><span><i class="fa-solid fa-shield-halved"></i></span><h2>Automatische Prüfung</h2><p>Beim Speichern werden diese Regeln geprüft:</p><ul><li>genehmigter Urlaub/Krankheit</li><li>ein Dienst pro Tag</li><li>max. 4 Dienste pro Woche</li><li>max. 204 Stunden im Monat</li><li>Nachtdienst → 2 Tage bis zum Tagdienst</li></ul><router-link to="/admin/ki-dienstplanung"><i class="fa-solid fa-wand-magic-sparkles"></i> Zur KI-Dienstplanung</router-link></aside>
    </section>

    <section class="schedule-panel panel"><header><div><p>EDITIERBARER MONATSPLAN</p><h2>{{ monthLabel }}</h2><span>Auf ein leeres Feld klicken, um einen Dienst anzulegen. Einen Dienst anklicken, um ihn zu bearbeiten.</span></div><div class="schedule-actions"><div class="legend"><span><i class="day-dot"></i> Tagdienst</span><span><i class="night-dot"></i> Nachtdienst</span></div><button class="clear-month" type="button" :disabled="isLoading || isDeletingMonth || !deletableSchedules.length" @click="deleteMonthSchedule"><i class="fa-solid" :class="isDeletingMonth ? 'fa-spinner fa-spin' : 'fa-trash-can'"></i>{{ isDeletingMonth ? 'Wird gelöscht …' : deleteMonthLabel }}</button></div></header><div v-if="isLoading" class="state"><i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …</div><div v-else class="roster-wrap"><table class="roster-table"><thead><tr><th class="person-head">Mitarbeiter:in</th><th v-for="day in calendarDays" :key="day.date" :class="{ today: day.today }"><strong>{{ day.number }}</strong><small>{{ weekday(day.date) }}</small></th></tr></thead><tbody><tr v-for="employee in visibleEmployees" :key="employee.id"><th scope="row" class="person-cell"><strong>{{ employee.name }}</strong><small>{{ employeeShiftCount(employee.id) }} Dienst{{ employeeShiftCount(employee.id) === 1 ? '' : 'e' }}</small></th><td v-for="day in calendarDays" :key="`${employee.id}-${day.date}`" :class="{ today: day.today }"><button v-for="shift in shiftsFor(employee.id, day.date)" :key="shift.id" type="button" class="roster-shift" :class="shift.vacation ? 'vacation' : (shift.is_night ? 'night' : 'day')" :disabled="shift.vacation" :title="shift.vacation ? `${shift.ort} – bleibt erhalten` : `${shift.ort}, ${shift.shift_time} – zum Bearbeiten`" @click="editShift(shift)"><b>{{ shift.vacation ? 'FREI' : (shift.is_night ? 'ND' : 'TD') }}</b><span>{{ shift.ort }}</span></button><button v-if="!shiftsFor(employee.id, day.date).length" type="button" class="add-cell" :aria-label="`Dienst für ${employee.name} am ${day.date} anlegen`" @click="startShift(employee.id, day.date)"><i class="fa-solid fa-plus"></i></button></td></tr><tr v-if="!visibleEmployees.length"><td class="empty-roster" :colspan="calendarDays.length + 1">Für diesen Filter gibt es keine Mitarbeitenden.</td></tr></tbody></table></div></section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'

const now = new Date()
const currentDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
const monthValue = ref(currentDay.slice(0, 7))
const locations = ref([])
const employees = ref([])
const schedules = ref([])
const locationFilter = ref('all')
const employeeFilter = ref('all')
const isLoading = ref(true)
const isSaving = ref(false)
const deletingId = ref(null)
const isDeletingMonth = ref(false)
const editingId = ref(null)
const message = ref(null)
const draft = ref({ user_id: '', date: currentDay, ort: '', shift_type: 'TD' })

const selectedYear = computed(() => Number(monthValue.value.slice(0, 4)))
const selectedMonth = computed(() => Number(monthValue.value.slice(5, 7)))
const monthStart = computed(() => `${monthValue.value}-01`)
const monthEnd = computed(() => `${monthValue.value}-${String(new Date(selectedYear.value, selectedMonth.value, 0).getDate()).padStart(2, '0')}`)
const monthLabel = computed(() => new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' }).format(new Date(selectedYear.value, selectedMonth.value - 1, 1)))
const employeeMap = computed(() => new Map(employees.value.map((employee) => [employee.id, employee.name])))
const visibleSchedules = computed(() => schedules.value.filter((shift) => (locationFilter.value === 'all' || shift.ort === locationFilter.value) && (employeeFilter.value === 'all' || shift.user_id === employeeFilter.value)))
const deletableSchedules = computed(() => visibleSchedules.value.filter((shift) => !shift.vacation))
const visibleEmployees = computed(() => employees.value.filter((employee) => employeeFilter.value === 'all' || employee.id === employeeFilter.value))
const selectedEmployee = computed(() => employees.value.find((employee) => employee.id === employeeFilter.value))
const deleteMonthLabel = computed(() => employeeFilter.value === 'all' ? 'Sichtbaren Monat löschen' : `${selectedEmployee.value?.name || 'Mitarbeiter'} löschen`)
const calendarDays = computed(() => {
  const count = new Date(selectedYear.value, selectedMonth.value, 0).getDate()
  const today = new Date().toISOString().slice(0, 10)
  return Array.from({ length: count }, (_, index) => { const number = index + 1; const date = `${monthValue.value}-${String(number).padStart(2, '0')}`; return { number, date, today: date === today } })
})
const employeeName = (id) => employeeMap.value.get(id) || 'Mitarbeiter:in'
const weekday = (date) => new Intl.DateTimeFormat('de-AT', { weekday: 'short' }).format(new Date(`${date}T12:00:00`)).replace('.', '')
const shiftsFor = (employeeId, date) => visibleSchedules.value.filter((shift) => shift.user_id === employeeId && shift.date === date)
const employeeShiftCount = (employeeId) => visibleSchedules.value.filter((shift) => shift.user_id === employeeId).length

const loadData = async () => {
  isLoading.value = true
  try {
    const [{ data: locationRows, error: locationError }, { data: employeeRows, error: employeeError }, { data: scheduleRows, error: scheduleError }] = await Promise.all([
      supabase.from('work_locations').select('id, name').eq('active', true).order('name'),
      supabase.from('app_users').select('id, name').eq('role', 'employee').order('name'),
      supabase.from('schedules').select('id, user_id, date, ort, shift_type, shift_time, hours, is_night, vacation').gte('date', monthStart.value).lte('date', monthEnd.value).order('date').order('shift_time')
    ])
    if (locationError || employeeError || scheduleError) throw locationError || employeeError || scheduleError
    locations.value = locationRows || []; employees.value = employeeRows || []; schedules.value = scheduleRows || []
    if (!draft.value.ort && locations.value.length) draft.value.ort = locations.value[0].name
  } catch { message.value = { type: 'error', text: 'Dienstplandaten konnten nicht geladen werden.' } } finally { isLoading.value = false }
}

const startShift = (employeeId, date) => {
  editingId.value = null
  draft.value = { user_id: employeeId, date, ort: locationFilter.value === 'all' ? (locations.value[0]?.name || '') : locationFilter.value, shift_type: 'TD' }
  message.value = { type: 'success', text: 'Dienst vorbereiten, Diensttyp und Ort wählen und speichern.' }
  document.querySelector('.entry-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const editShift = (shift) => {
  editingId.value = shift.id
  draft.value = { user_id: shift.user_id, date: shift.date, ort: shift.ort, shift_type: shift.is_night ? 'ND' : 'TD' }
  message.value = { type: 'success', text: 'Dienst bearbeiten und anschließend Änderung speichern.' }
  document.querySelector('.entry-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const cancelEdit = () => { editingId.value = null; message.value = null }

const saveShift = async () => {
  isSaving.value = true; message.value = null
  try {
    const { data, error } = await supabase.functions.invoke('manage-schedule', { body: { action: editingId.value ? 'update' : 'create', id: editingId.value || undefined, ...draft.value } })
    if (error || !data?.success) throw new Error(data?.error || 'Dienst konnte nicht gespeichert werden.')
    message.value = { type: 'success', text: data.message }
    editingId.value = null
    await loadData()
  } catch (error) { message.value = { type: 'error', text: error?.message || 'Dienst konnte nicht gespeichert werden.' } } finally { isSaving.value = false }
}

const deleteShift = async (shift) => {
  if (!window.confirm(`Dienst von ${employeeName(shift.user_id)} am ${shift.date} wirklich löschen?`)) return
  deletingId.value = shift.id
  try {
    const { data, error } = await supabase.functions.invoke('manage-schedule', { body: { action: 'delete', id: shift.id } })
    if (error || !data?.success) throw new Error(data?.error || 'Dienst konnte nicht gelöscht werden.')
    schedules.value = schedules.value.filter((item) => item.id !== shift.id)
  } catch (error) { message.value = { type: 'error', text: error?.message || 'Dienst konnte nicht gelöscht werden.' } } finally { deletingId.value = null }
}

const deleteMonthSchedule = async () => {
  const personScope = employeeFilter.value === 'all' ? 'aller Mitarbeitenden' : `von ${selectedEmployee.value?.name || 'diesem Mitarbeiter'}`
  const placeScope = locationFilter.value === 'all' ? '' : ` am Ort ${locationFilter.value}`
  const confirmation = `Wirklich ${deletableSchedules.value.length} sichtbare Dienste für ${monthLabel.value} ${personScope}${placeScope} löschen?\n\nUrlaub und Krankenstände bleiben erhalten.`
  if (!window.confirm(confirmation)) return

  isDeletingMonth.value = true
  message.value = null
  try {
    let deletion = supabase.from('schedules').delete().gte('date', monthStart.value).lte('date', monthEnd.value).eq('vacation', false)
    if (employeeFilter.value !== 'all') deletion = deletion.eq('user_id', employeeFilter.value)
    if (locationFilter.value !== 'all') deletion = deletion.eq('ort', locationFilter.value)
    const { data: deletedRows, error } = await deletion.select('id')
    if (error) throw error
    editingId.value = null
    message.value = { type: 'success', text: `${deletedRows?.length || 0} Dienste gelöscht. Urlaub und Krankenstände bleiben erhalten.` }
    await loadData()
  } catch (error) { message.value = { type: 'error', text: error?.message || 'Der Monatsplan konnte nicht gelöscht werden.' } } finally { isDeletingMonth.value = false }
}

watch(monthValue, loadData)
onMounted(loadData)
</script>

<style scoped>
.panel { overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.toolbar { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)) auto; align-items: end; gap: 12px; padding: 18px; margin-bottom: 20px; }.toolbar label, .entry-form label { display: grid; gap: 7px; color: var(--text-muted); font-size: .66rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }.toolbar input, .toolbar select, .entry-form input, .entry-form select { min-height: 41px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: var(--text-primary); background: var(--surface-raised); font: inherit; text-transform: none; }.toolbar button { min-height: 41px; padding: 0 13px; border: 0; border-radius: 10px; color: var(--brand-light); background: rgba(37,99,235,.13); font-size: .73rem; font-weight: 800; cursor: pointer; }.planning-layout { display: grid; grid-template-columns: minmax(0,1.28fr) minmax(260px,.72fr); align-items: start; gap: 20px; margin-bottom: 20px; }.entry-panel > header { display: flex; align-items: center; gap: 12px; padding: 20px 23px; border-bottom: 1px solid var(--line); }.entry-panel > header > span, .rule-panel > span { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.15); }.entry-panel header p { margin: 0; color: var(--text-muted); font-size: .63rem; font-weight: 800; letter-spacing: .1em; }.entry-panel h2, .rule-panel h2, .schedule-panel h2 { margin: 4px 0 0; color: var(--text-heading); font-size: 1.04rem; }.entry-form { display: grid; gap: 16px; padding: 22px; }.form-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.shift-select { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }.shift-select button { display: grid; grid-template-columns: 27px 1fr; align-items: center; gap: 2px 8px; min-height: 54px; padding: 8px; border: 1px solid var(--line); border-radius: 11px; color: var(--text-secondary); background: var(--surface-soft); text-align: left; cursor: pointer; }.shift-select button i { grid-row: span 2; color: var(--brand-light); }.shift-select button span { font-size: .72rem; font-weight: 800; }.shift-select button small { color: var(--text-muted); font-size: .59rem; }.shift-select button.active { border-color: rgba(96,165,250,.7); color: #dbeafe; background: rgba(37,99,235,.14); }.form-message { display: flex; gap: 8px; align-items: center; margin: -4px 0 0; padding: 10px 11px; border-radius: 10px; font-size: .73rem; line-height: 1.35; }.form-message.success { color: #86efac; background: rgba(22,163,74,.12); }.form-message.error { color: #fda4af; background: rgba(244,63,94,.12); }.save-button { min-height: 45px; border: 0; border-radius: 11px; color: #fff; background: linear-gradient(135deg,#2563eb,#3b82f6); font-size: .8rem; font-weight: 800; cursor: pointer; }.save-button:disabled { opacity: .65; cursor: wait; }.rule-panel { padding: 23px; }.rule-panel h2 { margin-top: 14px; }.rule-panel p { margin: 15px 0 10px; color: var(--text-secondary); font-size: .73rem; }.rule-panel ul { display: grid; gap: 10px; margin: 0 0 20px; padding-left: 18px; color: var(--text-secondary); font-size: .7rem; line-height: 1.35; }.rule-panel a { display: inline-flex; align-items: center; gap: 7px; color: var(--brand-light); font-size: .72rem; font-weight: 800; text-decoration: none; }.schedule-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 23px 25px; border-bottom: 1px solid var(--line); }.schedule-panel header p { margin: 0; color: var(--text-muted); font-size: .63rem; font-weight: 800; letter-spacing: .1em; }.schedule-panel header span { display: block; margin-top: 5px; color: var(--text-secondary); font-size: .68rem; }.legend { display: flex; gap: 12px; color: var(--text-secondary); font-size: .66rem; font-weight: 700; }.legend span { display: flex; align-items: center; gap: 5px; }.legend i { width: 7px; height: 7px; border-radius: 99px; }.day-dot { background: #60a5fa; }.night-dot { background: #a78bfa; }.state { min-height: 260px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--text-muted); font-size: .8rem; }.schedule-list { display: grid; }.schedule-list article { display: grid; grid-template-columns: 42px 47px minmax(0,1fr) auto 34px; align-items: center; gap: 12px; padding: 14px 23px; border-bottom: 1px solid var(--line); }.schedule-list time { display: grid; place-items: center; padding: 4px 0; border-radius: 9px; color: #bfdbfe; background: rgba(37,99,235,.14); }.schedule-list time strong { font-size: .8rem; }.schedule-list time span { font-size: .55rem; font-weight: 800; text-transform: uppercase; }.shift-kind { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 7px 0; border-radius: 7px; font-size: .58rem; font-weight: 800; }.shift-kind.day { color: #bfdbfe; background: rgba(37,99,235,.16); }.shift-kind.night { color: #ddd6fe; background: rgba(124,58,237,.18); }.shift-copy h3 { margin: 0; color: var(--text-heading); font-size: .8rem; }.shift-copy p { margin: 4px 0 0; color: var(--text-secondary); font-size: .69rem; }.hours { color: var(--text-muted); font-size: .7rem; font-weight: 700; }.delete { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px; color: #fda4af; background: transparent; cursor: pointer; }.delete:hover { background: rgba(244,63,94,.12); }.delete:disabled { opacity: .6; cursor: wait; }
@media (max-width: 840px) { .planning-layout { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .toolbar { grid-template-columns: 1fr 1fr; }.toolbar button { grid-column: span 2; }.form-pair, .shift-select { grid-template-columns: 1fr; }.entry-panel > header, .entry-form, .schedule-panel > header { padding: 18px; }.schedule-panel > header { align-items: flex-start; flex-direction: column; }.legend { width: 100%; justify-content: space-between; }.schedule-list article { grid-template-columns: 40px 44px minmax(0,1fr) 30px; gap: 9px; padding: 13px; }.hours { display: none; }.delete { grid-column: 4; grid-row: 1 / span 2; } }
.edit-hint { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: -3px; padding: 9px 10px; border-radius: 9px; color: #bfdbfe; background: rgba(37,99,235,.12); font-size: .7rem; font-weight: 700; }.edit-hint button { border: 0; color: #bfdbfe; background: transparent; font: inherit; font-weight: 800; cursor: pointer; }.roster-wrap { overflow: auto; max-height: min(67vh, 710px); }.roster-table { width: 100%; min-width: 1120px; border-collapse: separate; border-spacing: 0; }.roster-table th, .roster-table td { min-width: 54px; padding: 8px 5px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); vertical-align: top; text-align: center; }.roster-table thead th { position: sticky; top: 0; z-index: 3; color: var(--text-secondary); background: var(--surface-raised); font-size: .61rem; font-weight: 800; }.roster-table thead strong { display: block; color: var(--text-heading); font-size: .75rem; }.roster-table thead small { display: block; margin-top: 2px; font-size: .51rem; text-transform: uppercase; }.roster-table .person-head, .roster-table .person-cell { position: sticky; left: 0; z-index: 4; min-width: 155px; max-width: 155px; border-right: 1px solid var(--line-strong); text-align: left; background: var(--surface-card); }.roster-table .person-head { z-index: 5; padding-left: 14px; }.roster-table .person-cell { padding: 11px 13px; }.person-cell strong { display: block; overflow: hidden; color: var(--text-heading); font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }.person-cell small { display: block; margin-top: 4px; color: var(--text-muted); font-size: .57rem; font-weight: 600; }.roster-table tbody tr:hover td, .roster-table tbody tr:hover .person-cell { background: var(--surface-soft); }.roster-table th.today, .roster-table td.today { background-color: rgba(37,99,235,.055); box-shadow: inset 1px 0 0 rgba(96,165,250,.6), inset -1px 0 0 rgba(96,165,250,.6); }.roster-table thead th.today { box-shadow: inset 1px 0 0 #60a5fa, inset -1px 0 0 #60a5fa, inset 0 2px 0 #60a5fa; }.roster-shift { display: grid; width: 100%; gap: 2px; margin-bottom: 4px; padding: 4px 2px; border: 0; border-radius: 6px; color: #dbeafe; font: inherit; font-size: .49rem; line-height: 1.15; cursor: pointer; }.roster-shift:hover { filter: brightness(1.15); }.roster-shift:last-child { margin-bottom: 0; }.roster-shift b { padding: 2px; border-radius: 4px; color: #fff; background: rgba(255,255,255,.18); font-size: .46rem; }.roster-shift span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.roster-shift.day { background: rgba(37,99,235,.24); }.roster-shift.night { background: rgba(124,58,237,.24); }.add-cell { width: 100%; min-height: 30px; border: 1px dashed transparent; border-radius: 7px; color: var(--text-muted); background: transparent; cursor: pointer; }.add-cell:hover, .add-cell:focus-visible { border-color: rgba(96,165,250,.65); color: var(--brand-light); background: rgba(37,99,235,.09); outline: 0; }.empty-roster { padding: 36px !important; color: var(--text-muted); text-align: center !important; }
@media (max-width: 650px) { .roster-wrap { max-height: 62vh; }.roster-table { min-width: 900px; }.roster-table th, .roster-table td { min-width: 47px; padding: 7px 3px; }.roster-table .person-head, .roster-table .person-cell { min-width: 124px; max-width: 124px; }.roster-table .person-cell { padding: 10px; }.roster-shift { font-size: .45rem; } }
.schedule-actions { display: grid; min-width: 230px; justify-items: end; gap: 11px; padding: 11px; border: 1px solid rgba(251,113,133,.24); border-radius: 13px; background: rgba(244,63,94,.045); }.clear-month { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 11px; border: 1px solid rgba(251,113,133,.34); border-radius: 9px; color: #fda4af; background: rgba(244,63,94,.1); font-size: .68rem; font-weight: 800; cursor: pointer; }.clear-month:hover { color: #ffe4e6; background: rgba(244,63,94,.19); }.clear-month:disabled { opacity: .45; cursor: not-allowed; }
.roster-shift.vacation { color: #bbf7d0; background: rgba(16,185,129,.2); cursor: default; }.roster-shift:disabled { opacity: 1; }
@media (max-width: 600px) { .schedule-actions { width: 100%; justify-items: stretch; }.clear-month { width: 100%; } }
</style>
