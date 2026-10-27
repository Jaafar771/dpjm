<template>
  <AppShell eyebrow="Admin-Zentrale" title="KI-Dienstplanung" description="Erstellt einen fairen 24/7-Monatsplan nach Abwesenheiten, Präferenzen und Arbeitszeitregeln.">
    <section class="calendar-toolbar panel">
      <label><span>Monat</span><input v-model="monthValue" type="month"></label>
      <label><span>Ort</span><select v-model="locationFilter"><option value="all">Alle Orte</option><option v-for="location in locations" :key="location.id" :value="location.name">{{ location.name }}</option></select></label>
      <label><span>Mitarbeiter</span><select v-model="employeeFilter"><option value="all">Alle Mitarbeiter</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select></label>
      <button class="secondary-button" type="button" :disabled="isLoading" @click="loadCalendar"><i class="fa-solid fa-rotate-right"></i> Aktualisieren</button>
    </section>

    <section class="planner-layout">
      <article class="planner-card panel">
        <header><div><p>KI-PLANUNG</p><h2>24/7-Monatsplan erstellen</h2><span>Harte Regeln vor Präferenzen: Urlaub/Krankheit, 204 Stunden, max. 4 Dienste je Woche und zwei freie Tage vor einem nächsten Tagdienst nach Nacht.</span></div><i class="fa-solid fa-wand-magic-sparkles"></i></header>
        <p v-if="plannerMessage" class="planner-message" :class="plannerMessage.type"><i class="fa-solid" :class="plannerMessage.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'"></i>{{ plannerMessage.text }}</p>
        <div class="planner-form">
          <label><span>Planungsort</span><select v-model="planningLocation"><option v-for="location in locations" :key="location.id" :value="location.name">{{ location.name }}</option></select></label>
          <div class="team-heading"><div><span>Planungsteam</span><small>{{ selectedEmployeeIds.length }} Mitarbeiter ausgewählt<template v-if="planningLocation === 'Pav20'"> · empfohlen: 12</template></small></div><div><button type="button" @click="selectRecommendedTeam">Empfohlene Auswahl</button><button type="button" @click="selectAllEmployees">Alle</button></div></div>
          <div class="employee-picker"><label v-for="employee in employees" :key="employee.id" class="employee-option"><input v-model="selectedEmployeeIds" type="checkbox" :value="employee.id"><span>{{ initials(employee.name) }}</span><strong>{{ employee.name }}</strong><small>{{ preferenceSummary(employee.id) }}</small></label></div>
          <button class="primary-button" type="button" :disabled="isGenerating || !planningLocation || !selectedEmployeeIds.length" @click="generateSchedule"><i class="fa-solid" :class="isGenerating ? 'fa-spinner fa-spin' : 'fa-calendar-plus'"></i>{{ isGenerating ? 'Plan wird geprüft …' : 'Dienstplan erstellen' }}</button>
        </div>
      </article>

      <article class="staffing-card panel">
        <header><div><p>ORTE & BESETZUNG</p><h2>24/7-Vorgaben</h2></div><i class="fa-solid fa-building-shield"></i></header>
        <div class="staffing-list"><div v-for="location in locations" :key="location.id" class="staffing-row"><strong>{{ location.name }}</strong><label>Mo–Fr Tag<input v-model.number="location.day_staff" type="number" min="0" max="20"></label><label>Sa–So Tag<input v-model.number="location.weekend_day_staff" type="number" min="0" max="20"></label><label>Nacht<input v-model.number="location.night_staff" type="number" min="0" max="20"></label><button type="button" title="Besetzung speichern" :disabled="savingLocationId === location.id" @click="saveLocation(location)"><i class="fa-solid" :class="savingLocationId === location.id ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i></button></div></div>
        <p class="staffing-note"><i class="fa-regular fa-clock"></i> Tagdienst 07:00–19:00 · Nachtdienst 19:00–07:00</p>
      </article>
    </section>

    <section class="calendar-panel panel">
      <header><div><p>GESAMTPLAN</p><h2>{{ monthLabel }}</h2><span>{{ visibleSchedules.length }} sichtbare Dienste</span></div><div class="legend"><span><i class="legend-day"></i> Tagdienst</span><span><i class="legend-night"></i> Nachtdienst</span></div></header>
      <div v-if="isLoading" class="calendar-state"><i class="fa-solid fa-spinner fa-spin"></i> Kalender wird geladen …</div>
      <div v-else class="calendar-wrap"><div class="weekday-row"><span v-for="day in weekdays" :key="day">{{ day }}</span></div><div class="month-grid"><span v-for="empty in monthOffset" :key="`empty-${empty}`" class="empty-day"></span><article v-for="day in calendarDays" :key="day.date" class="calendar-day" :class="{ today: day.today }"><header><strong>{{ day.number }}</strong><small>{{ day.items.length }} Dienst{{ day.items.length === 1 ? '' : 'e' }}</small></header><div class="calendar-shifts"><div v-for="shift in day.items" :key="shift.id" class="shift-chip" :class="shift.is_night ? 'shift-chip--night' : 'shift-chip--day'"><b>{{ shift.is_night ? 'ND' : 'TD' }}</b><span>{{ shift.person }}</span><small>{{ shift.ort }}</small></div><span v-if="!day.items.length" class="no-shift">–</span></div></article></div></div>
    </section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'

const now = new Date()
const monthValue = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const locations = ref([])
const employees = ref([])
const schedules = ref([])
const locationFilter = ref('all')
const employeeFilter = ref('all')
const planningLocation = ref('')
const selectedEmployeeIds = ref([])
const isLoading = ref(true)
const isGenerating = ref(false)
const savingLocationId = ref(null)
const plannerMessage = ref(null)
const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const selectedYear = computed(() => Number(monthValue.value.slice(0, 4)))
const selectedMonth = computed(() => Number(monthValue.value.slice(5, 7)))
const monthStart = computed(() => `${monthValue.value}-01`)
const monthEnd = computed(() => `${monthValue.value}-${String(new Date(selectedYear.value, selectedMonth.value, 0).getDate()).padStart(2, '0')}`)
const monthLabel = computed(() => new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' }).format(new Date(selectedYear.value, selectedMonth.value - 1, 1)))
const monthOffset = computed(() => (new Date(selectedYear.value, selectedMonth.value - 1, 1).getDay() + 6) % 7)
const employeeMap = computed(() => new Map(employees.value.map((employee) => [employee.id, employee])))
const visibleSchedules = computed(() => schedules.value.filter((schedule) => (locationFilter.value === 'all' || schedule.ort === locationFilter.value) && (employeeFilter.value === 'all' || schedule.user_id === employeeFilter.value)))
const calendarDays = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  const count = new Date(selectedYear.value, selectedMonth.value, 0).getDate()
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const date = `${monthValue.value}-${String(number).padStart(2, '0')}`
    const items = visibleSchedules.value.filter((schedule) => schedule.date === date).map((schedule) => ({ ...schedule, person: employeeMap.value.get(schedule.user_id)?.name || 'Mitarbeiter:in' }))
    return { number, date, items, today: date === today }
  })
})

const initials = (name) => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
const preferenceSummary = (id) => { const preference = employees.value.find((employee) => employee.id === id)?.preferences; return preference?.preferred_shifts?.join(' / ') || 'Keine Präferenz' }

const loadCalendar = async () => {
  isLoading.value = true
  try {
    const [{ data: locationsData, error: locationsError }, { data: employeesData, error: employeesError }, { data: schedulesData, error: schedulesError }] = await Promise.all([
      supabase.from('work_locations').select('*').order('name'),
      supabase.from('app_users').select('id, name, username').eq('role', 'employee').order('name'),
      supabase.from('schedules').select('id, user_id, date, ort, shift_type, shift_time, hours, is_night, is_published').gte('date', monthStart.value).lte('date', monthEnd.value).order('date')
    ])
    if (locationsError || employeesError || schedulesError) throw locationsError || employeesError || schedulesError
    locations.value = locationsData || []
    employees.value = employeesData || []
    schedules.value = schedulesData || []
    if (!planningLocation.value && locations.value.length) planningLocation.value = locations.value[0].name
    if (!selectedEmployeeIds.value.length) selectRecommendedTeam()
  } catch {
    plannerMessage.value = { type: 'error', text: 'Die Planungsdaten konnten nicht geladen werden.' }
  } finally { isLoading.value = false }
}

const selectRecommendedTeam = () => { selectedEmployeeIds.value = employees.value.slice(0, planningLocation.value === 'Pav20' ? 12 : employees.value.length).map((employee) => employee.id) }
const selectAllEmployees = () => { selectedEmployeeIds.value = employees.value.map((employee) => employee.id) }

const saveLocation = async (location) => {
  savingLocationId.value = location.id
  try {
    const { error } = await supabase.from('work_locations').update({ day_staff: Number(location.day_staff), weekend_day_staff: Number(location.weekend_day_staff), night_staff: Number(location.night_staff) }).eq('id', location.id)
    if (error) throw error
  } catch { plannerMessage.value = { type: 'error', text: `Die Besetzung für ${location.name} konnte nicht gespeichert werden.` } } finally { savingLocationId.value = null }
}

const generateSchedule = async () => {
  isGenerating.value = true; plannerMessage.value = null
  try {
    const { data, error } = await supabase.functions.invoke('schedule-planner', { body: { action: 'generate', year: selectedYear.value, month: selectedMonth.value, location: planningLocation.value, selected_employee_ids: selectedEmployeeIds.value } })
    if (error) {
      const responseError = await error.context?.clone?.().json?.().catch(() => null)
      throw new Error(responseError?.error || error.message || 'Die Erstellung ist fehlgeschlagen.')
    }
    if (!data?.success) throw new Error(data?.error || 'Die Erstellung ist fehlgeschlagen.')
    plannerMessage.value = { type: 'success', text: `${data.message} ${data.coverage.assigned} Dienste wurden erstellt.` }
    await loadCalendar()
  } catch (error) { plannerMessage.value = { type: 'error', text: error?.message || 'Der Dienstplan konnte nicht erstellt werden.' } } finally { isGenerating.value = false }
}

watch(monthValue, loadCalendar)
watch(planningLocation, () => { if (employees.value.length) selectRecommendedTeam() })
onMounted(loadCalendar)
</script>

<style scoped>
.panel { border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.calendar-toolbar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; align-items: end; gap: 12px; padding: 18px; margin-bottom: 20px; }.calendar-toolbar label, .planner-form > label { display: grid; gap: 7px; color: var(--text-muted); font-size: .67rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }.calendar-toolbar input, .calendar-toolbar select, .planner-form select, .staffing-row input { min-height: 41px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: var(--text-primary); background: var(--surface-raised); font: inherit; text-transform: none; }.secondary-button, .primary-button { min-height: 41px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 10px; font-size: .75rem; font-weight: 800; cursor: pointer; }.secondary-button { padding: 0 13px; color: var(--brand-light); background: rgba(37,99,235,.13); }.primary-button { width: 100%; color: #fff; background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 10px 20px rgba(37,99,235,.24); }.primary-button:disabled, .secondary-button:disabled { opacity: .6; cursor: wait; }.planner-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .85fr); gap: 20px; margin-bottom: 20px; }.planner-card, .staffing-card { overflow: hidden; }.planner-card > header, .staffing-card > header, .calendar-panel > header { display: flex; justify-content: space-between; gap: 14px; padding: 22px 24px; border-bottom: 1px solid var(--line); }.planner-card header p, .staffing-card header p, .calendar-panel header p { margin: 0 0 5px; color: var(--text-muted); font-size: .64rem; font-weight: 800; letter-spacing: .1em; }.planner-card h2, .staffing-card h2, .calendar-panel h2 { margin: 0; color: var(--text-heading); font-size: 1.04rem; }.planner-card header span, .calendar-panel header span { display: block; max-width: 610px; margin-top: 7px; color: var(--text-secondary); font-size: .74rem; line-height: 1.45; }.planner-card header > i, .staffing-card header > i { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.14); }.planner-form { display: grid; gap: 15px; padding: 20px 24px 24px; }.team-heading { display: flex; align-items: end; justify-content: space-between; gap: 10px; }.team-heading > div:first-child > span { display: block; color: var(--text-muted); font-size: .67rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }.team-heading small { display: block; margin-top: 5px; color: var(--text-secondary); font-size: .7rem; }.team-heading button { margin-left: 6px; border: 0; color: var(--brand-light); background: transparent; font-size: .68rem; font-weight: 800; cursor: pointer; }.employee-picker { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.employee-option { display: grid; grid-template-columns: 23px minmax(0, 1fr); column-gap: 7px; align-items: center; min-height: 54px; padding: 8px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }.employee-option input { display: none; }.employee-option span { width: 23px; height: 23px; display: grid; place-items: center; grid-row: span 2; border-radius: 8px; color: #bfdbfe; background: rgba(37,99,235,.16); font-size: .55rem; font-weight: 900; }.employee-option:has(input:checked) { border-color: rgba(96,165,250,.65); background: rgba(37,99,235,.08); }.employee-option strong { overflow: hidden; color: var(--text-heading); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }.employee-option small { overflow: hidden; color: var(--text-muted); font-size: .57rem; text-overflow: ellipsis; white-space: nowrap; }.planner-message { display: flex; gap: 8px; align-items: center; margin: 17px 24px 0; padding: 10px 11px; border-radius: 10px; font-size: .74rem; line-height: 1.35; }.planner-message.success { color: #86efac; background: rgba(22,163,74,.12); }.planner-message.error { color: #fda4af; background: rgba(244,63,94,.12); }.staffing-list { display: grid; }.staffing-row { display: grid; grid-template-columns: minmax(52px, 1fr) repeat(3, 58px) 34px; align-items: end; gap: 7px; padding: 14px 17px; border-bottom: 1px solid var(--line); }.staffing-row strong { align-self: center; color: var(--text-heading); font-size: .76rem; }.staffing-row label { display: grid; gap: 4px; color: var(--text-muted); font-size: .5rem; font-weight: 800; text-align: center; }.staffing-row input { min-height: 31px; padding: 0 4px; text-align: center; font-size: .72rem; }.staffing-row button { width: 32px; height: 32px; border: 0; border-radius: 8px; color: var(--brand-light); background: rgba(37,99,235,.14); cursor: pointer; }.staffing-note { display: flex; gap: 7px; margin: 0; padding: 14px 17px; color: var(--text-muted); font-size: .67rem; }.staffing-note i { color: var(--brand-light); }.calendar-panel { overflow: hidden; }.calendar-panel > header { align-items: center; }.legend { display: flex; gap: 12px; color: var(--text-secondary); font-size: .66rem; font-weight: 700; }.legend span { display: inline-flex; align-items: center; gap: 5px; }.legend i { width: 7px; height: 7px; border-radius: 99px; }.legend-day { background: #60a5fa; }.legend-night { background: #a78bfa; }.calendar-state { min-height: 320px; display: grid; place-items: center; color: var(--text-muted); font-size: .82rem; }.calendar-wrap { padding: 13px; overflow-x: auto; }.weekday-row, .month-grid { min-width: 730px; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }.weekday-row { margin-bottom: 6px; }.weekday-row span { padding: 3px; color: var(--text-muted); font-size: .61rem; font-weight: 800; text-align: center; text-transform: uppercase; }.calendar-day { min-height: 132px; padding: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); }.calendar-day.today { border-color: #60a5fa; box-shadow: inset 0 0 0 1px rgba(96,165,250,.4); }.calendar-day > header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }.calendar-day header strong { color: var(--text-heading); font-size: .74rem; }.calendar-day header small { color: var(--text-muted); font-size: .51rem; }.calendar-shifts { display: grid; gap: 4px; }.shift-chip { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: center; gap: 3px; padding: 4px; border-radius: 6px; color: #dbeafe; font-size: .55rem; }.shift-chip b { grid-row: span 2; padding: 3px 0; border-radius: 4px; color: #fff; background: rgba(255,255,255,.17); font-size: .48rem; text-align: center; }.shift-chip span, .shift-chip small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.shift-chip small { opacity: .8; font-size: .47rem; }.shift-chip--day { background: rgba(37,99,235,.23); }.shift-chip--night { background: rgba(124,58,237,.22); }.no-shift { color: var(--text-muted); font-size: .66rem; }
@media (max-width: 900px) { .planner-layout { grid-template-columns: 1fr; }.employee-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 620px) { .calendar-toolbar { grid-template-columns: 1fr 1fr; }.calendar-toolbar .secondary-button { grid-column: span 2; }.planner-card > header, .staffing-card > header, .calendar-panel > header { padding: 18px; }.planner-form { padding: 17px; }.employee-picker { grid-template-columns: 1fr; }.team-heading { align-items: flex-start; flex-direction: column; }.team-heading button { margin-left: 0; margin-right: 9px; }.staffing-row { grid-template-columns: minmax(42px, 1fr) repeat(3, 53px) 30px; gap: 4px; padding: 12px; }.calendar-panel > header { align-items: flex-start; flex-direction: column; }.legend { width: 100%; justify-content: space-between; }.calendar-wrap { padding: 9px; } }
</style>
