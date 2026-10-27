<template>
  <AppShell eyebrow="Planung" title="Meine Präferenzen" description="Deine Wünsche werden vom Planer berücksichtigt, solange sie mit Urlaub, Ruhezeiten und der fairen Verteilung vereinbar sind.">
    <section class="preference-layout">
      <article class="preference-card panel">
        <header><div><p>DIENSTWÜNSCHE</p><h2>{{ isAdmin ? 'Mitarbeiterpräferenzen' : 'So planst du mit' }}</h2><span>Diese Angaben sind Wünsche, keine verbindliche Dienstzusage.</span></div><i class="fa-solid fa-sliders"></i></header>
        <div class="form-content">
          <label v-if="isAdmin" class="field"><span>Mitarbeiter</span><select v-model="selectedUserId"><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select></label>
          <div class="field"><span>Bevorzugte Orte</span><div class="check-grid"><label v-for="location in locations" :key="location.id" class="check-option"><input v-model="form.preferred_locations" type="checkbox" :value="location.name"><i class="fa-solid fa-location-dot"></i>{{ location.name }}</label></div></div>
          <div class="field"><span>Bevorzugte Dienste</span><div class="check-grid two"><label class="check-option"><input v-model="form.preferred_shifts" type="checkbox" value="TD"><i class="fa-solid fa-sun"></i> Tagdienst <small>07–19 Uhr</small></label><label class="check-option"><input v-model="form.preferred_shifts" type="checkbox" value="ND"><i class="fa-solid fa-moon"></i> Nachtdienst <small>19–07 Uhr</small></label></div></div>
          <div class="field"><span>Diese Wochentage möglichst vermeiden</span><div class="weekday-grid"><label v-for="day in weekdays" :key="day.value"><input v-model="form.avoid_weekdays" type="checkbox" :value="day.value"><span>{{ day.label }}</span></label></div></div>
          <div class="form-row"><label class="field"><span>Max. Stunden pro Monat</span><input v-model.number="form.max_monthly_hours" type="number" min="12" max="204"><small>Maximal 204 Stunden.</small></label><label class="field"><span>Nicht verfügbare Daten</span><input v-model="unavailableText" type="text" placeholder="z. B. 2026-11-05, 2026-11-12"><small>Kommagetrennt im Format JJJJ-MM-TT.</small></label></div>
          <label class="field"><span>Hinweis für die Planung</span><textarea v-model.trim="form.notes" rows="4" maxlength="500" placeholder="z. B. bevorzugt zusammenhängende Tagdienste oder Pendelzeit beachten"></textarea></label>
          <p v-if="message" class="form-message" :class="message.type"><i class="fa-solid" :class="message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>{{ message.text }}</p>
          <button class="save-button" type="button" :disabled="isSaving || !selectedUserId" @click="savePreferences"><i class="fa-solid" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'"></i>{{ isSaving ? 'Wird gespeichert …' : 'Präferenzen speichern' }}</button>
        </div>
      </article>
      <aside class="rule-card panel"><span class="rule-icon"><i class="fa-solid fa-shield-heart"></i></span><h2>Was immer Vorrang hat</h2><ul><li><i class="fa-solid fa-check"></i> Urlaub und Krankmeldungen</li><li><i class="fa-solid fa-check"></i> Maximal 4 Dienste pro Woche</li><li><i class="fa-solid fa-check"></i> Maximal 204 Stunden pro Monat</li><li><i class="fa-solid fa-check"></i> Zwei Tage bis zum nächsten Tagdienst nach Nacht</li></ul><p>Der Planer verteilt Dienste mit ähnlicher Last fair zwischen dem ausgewählten Team.</p></aside>
    </section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const { isAdmin, loadCurrentUser } = useCurrentUser()
const employees = ref([])
const locations = ref([])
const selectedUserId = ref('')
const isSaving = ref(false)
const message = ref(null)
const unavailableText = ref('')
const form = ref({ preferred_locations: [], preferred_shifts: [], avoid_weekdays: [], unavailable_dates: [], max_monthly_hours: 204, notes: '' })
const weekdays = [{ label: 'So', value: 0 }, { label: 'Mo', value: 1 }, { label: 'Di', value: 2 }, { label: 'Mi', value: 3 }, { label: 'Do', value: 4 }, { label: 'Fr', value: 5 }, { label: 'Sa', value: 6 }]

const cleanedUnavailableDates = computed(() => unavailableText.value.split(',').map((value) => value.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))

const loadPreferences = async () => {
  if (!selectedUserId.value) return
  message.value = null
  const { data, error } = await supabase.from('employee_preferences').select('*').eq('user_id', selectedUserId.value).maybeSingle()
  if (error) { message.value = { type: 'error', text: 'Präferenzen konnten nicht geladen werden.' }; return }
  form.value = { preferred_locations: data?.preferred_locations || [], preferred_shifts: data?.preferred_shifts || [], avoid_weekdays: (data?.avoid_weekdays || []).map(Number), unavailable_dates: data?.unavailable_dates || [], max_monthly_hours: data?.max_monthly_hours || 204, notes: data?.notes || '' }
  unavailableText.value = form.value.unavailable_dates.join(', ')
}

const initialize = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const [{ data: locationRows }, { data: employeesRows }] = await Promise.all([
    supabase.from('work_locations').select('id, name').eq('active', true).order('name'),
    isAdmin.value ? supabase.from('app_users').select('id, name').eq('role', 'employee').order('name') : Promise.resolve({ data: [] })
  ])
  locations.value = locationRows || []
  employees.value = employeesRows || []
  selectedUserId.value = isAdmin.value ? employees.value[0]?.id || user.id : user.id
  await loadPreferences()
}

const savePreferences = async () => {
  isSaving.value = true; message.value = null
  try {
    const payload = { user_id: selectedUserId.value, preferred_locations: form.value.preferred_locations, preferred_shifts: form.value.preferred_shifts, avoid_weekdays: form.value.avoid_weekdays.map(Number), unavailable_dates: cleanedUnavailableDates.value, max_monthly_hours: Math.min(204, Math.max(12, Number(form.value.max_monthly_hours) || 204)), notes: form.value.notes || null, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('employee_preferences').upsert(payload, { onConflict: 'user_id' })
    if (error) throw error
    form.value.unavailable_dates = payload.unavailable_dates
    message.value = { type: 'success', text: 'Die Präferenzen wurden gespeichert.' }
  } catch { message.value = { type: 'error', text: 'Speichern nicht möglich. Bitte erneut versuchen.' } } finally { isSaving.value = false }
}

watch(selectedUserId, loadPreferences)
onMounted(async () => { await loadCurrentUser(); await initialize() })
</script>

<style scoped>
.preference-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(260px, .7fr); align-items: start; gap: 20px; }.panel { border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.preference-card { overflow: hidden; }.preference-card > header { display: flex; align-items: start; justify-content: space-between; gap: 16px; padding: 24px; border-bottom: 1px solid var(--line); }.preference-card header p { margin: 0 0 5px; color: var(--text-muted); font-size: .64rem; font-weight: 800; letter-spacing: .1em; }.preference-card h2, .rule-card h2 { margin: 0; color: var(--text-heading); font-size: 1.06rem; }.preference-card header span { display: block; margin-top: 7px; color: var(--text-secondary); font-size: .74rem; line-height: 1.4; }.preference-card header > i { width: 41px; height: 41px; display: grid; place-items: center; border-radius: 13px; color: #bfdbfe; background: rgba(37,99,235,.15); }.form-content { display: grid; gap: 20px; padding: 24px; }.field { display: grid; gap: 8px; color: var(--text-muted); font-size: .69rem; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; }.field input, .field select, .field textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: var(--text-primary); background: var(--surface-raised); font: inherit; text-transform: none; }.field input, .field select { min-height: 42px; padding: 0 11px; }.field textarea { padding: 11px; resize: vertical; }.field small { color: var(--text-muted); font-size: .63rem; font-weight: 500; letter-spacing: normal; text-transform: none; }.check-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }.check-grid.two { grid-template-columns: 1fr 1fr; }.check-option { display: flex; align-items: center; gap: 8px; min-height: 45px; padding: 0 10px; border: 1px solid var(--line); border-radius: 10px; color: var(--text-secondary); font-size: .72rem; font-weight: 700; letter-spacing: normal; text-transform: none; cursor: pointer; }.check-option:has(input:checked) { border-color: rgba(96,165,250,.65); color: #dbeafe; background: rgba(37,99,235,.11); }.check-option input { width: auto; min-height: 0; accent-color: #3b82f6; }.check-option i { color: var(--brand-light); }.check-option small { margin-left: auto; font-size: .58rem; }.weekday-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }.weekday-grid label { display: grid; place-items: center; min-height: 38px; border: 1px solid var(--line); border-radius: 9px; color: var(--text-muted); cursor: pointer; }.weekday-grid input { display: none; }.weekday-grid label:has(input:checked) { border-color: rgba(245,158,11,.6); color: #fcd34d; background: rgba(245,158,11,.12); }.weekday-grid span { font-size: .66rem; font-weight: 800; }.form-row { display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; }.form-message { display: flex; gap: 8px; align-items: center; margin: -4px 0 0; padding: 10px 11px; border-radius: 10px; font-size: .74rem; }.form-message.success { color: #86efac; background: rgba(22,163,74,.12); }.form-message.error { color: #fda4af; background: rgba(244,63,94,.12); }.save-button { min-height: 45px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 11px; color: #fff; background: linear-gradient(135deg,#2563eb,#3b82f6); font-size: .8rem; font-weight: 800; cursor: pointer; }.save-button:disabled { opacity: .65; cursor: wait; }.rule-card { padding: 25px; }.rule-icon { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 18px; border-radius: 13px; color: #6ee7b7; background: rgba(16,185,129,.14); }.rule-card ul { display: grid; gap: 13px; margin: 23px 0; padding: 0; list-style: none; }.rule-card li { display: flex; gap: 9px; align-items: start; color: var(--text-secondary); font-size: .76rem; line-height: 1.35; }.rule-card li i { color: #34d399; }.rule-card > p { margin: 0; padding-top: 18px; border-top: 1px solid var(--line); color: var(--text-muted); font-size: .71rem; line-height: 1.5; }
@media (max-width: 850px) { .preference-layout { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .preference-card > header, .form-content { padding: 18px; }.check-grid { grid-template-columns: 1fr 1fr; }.form-row { grid-template-columns: 1fr; }.rule-card { padding: 20px; } }
</style>
