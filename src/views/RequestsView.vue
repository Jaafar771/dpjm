<template>
  <AppShell eyebrow="Zeit & Abwesenheit" title="Meine Anträge" description="Reiche Urlaub, Zeitausgleich oder einen Diensttausch direkt ein.">
    <div class="requests-layout">
      <section class="panel request-form-panel">
        <div class="panel-heading"><span class="heading-icon"><i class="fa-solid fa-paper-plane"></i></span><div><h2>Neuen Antrag erstellen</h2><p>Die Verwaltung wird nach dem Einreichen informiert.</p></div></div>
        <p v-if="successMessage" class="alert alert--success"><i class="fa-solid fa-circle-check"></i>{{ successMessage }}</p>
        <p v-if="errorMessage" class="alert alert--error"><i class="fa-solid fa-circle-exclamation"></i>{{ errorMessage }}</p>
        <form class="request-form" @submit.prevent="submitRequest">
          <label><span>Antragsart</span><select v-model="newRequest.type" required><option value="" disabled>Bitte auswählen</option><option value="Erholungsurlaub">Erholungsurlaub</option><option value="Krankmeldung">Krankmeldung</option><option value="Zeitausgleich">Zeitausgleich</option><option value="Diensttausch">Diensttausch</option><option value="Sonderurlaub">Sonderurlaub</option></select></label>
          <div class="form-dates"><label><span>Von</span><input v-model="newRequest.startDate" type="date" required></label><label><span>Bis</span><input v-model="newRequest.endDate" type="date" required></label></div>
          <section v-if="isVacationRequest && newRequest.startDate && newRequest.endDate" class="smart-request-check" :class="`smart-request-check--${availability.status}`" aria-live="polite">
            <span class="smart-request-icon"><i class="fa-solid" :class="availabilityIcon"></i></span>
            <div><p>SMART-KALENDER</p><h3>{{ availability.title }}</h3><span>{{ availability.message }}</span></div>
          </section>
          <section v-if="isVacationRequest" class="mini-smart-calendar" aria-label="Smart-Kalender für Urlaubsanträge">
            <header class="mini-calendar-header"><div><p>SMART-KALENDER</p><h3>Urlaub planen</h3></div><div class="mini-calendar-nav"><button type="button" aria-label="Vorheriger Monat" @click="changeSmartMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button><strong>{{ smartMonthLabel }}</strong><button type="button" aria-label="Nächster Monat" @click="changeSmartMonth(1)"><i class="fa-solid fa-chevron-right"></i></button></div></header>
            <div class="mini-calendar-legend"><span class="mini-legend mini-legend--available"><i></i>Möglich</span><span class="mini-legend mini-legend--review"><i></i>Prüfen</span><span class="mini-legend mini-legend--blocked"><i></i>Nicht möglich</span></div>
            <div class="mini-weekdays" aria-hidden="true"><span v-for="day in weekdayLabels" :key="day">{{ day }}</span></div>
            <div class="mini-calendar-grid" :class="{ 'mini-calendar-grid--loading': smartCalendarLoading }"><span v-for="offset in smartMonthOffset" :key="`empty-${offset}`" class="mini-calendar-empty"></span><button v-for="day in smartCalendarDays" :key="day.date" type="button" :class="[`mini-day--${day.status}`, { 'mini-day--selected': day.selected, 'mini-day--today': day.today }]" :title="day.label" @click="selectSmartDay(day)"><strong>{{ day.number }}</strong><span>{{ day.status === 'available' ? 'frei' : day.status === 'review' ? 'prüfen' : 'belegt' }}</span></button></div>
            <p class="mini-calendar-help"><i class="fa-solid fa-hand-pointer"></i> Tippe auf einen Tag, um Von- und Bis-Datum schnell zu setzen.</p>
          </section>
          <label><span>Nachricht <em>optional</em></span><textarea v-model="newRequest.reason" rows="4" placeholder="Zum Beispiel: Tauschpartner oder kurze Begründung"></textarea></label>
          <button class="submit-button" type="submit" :disabled="isSubmitting"><i class="fa-solid" :class="isSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>{{ isSubmitting ? 'Wird übermittelt …' : 'Antrag einreichen' }}</button>
        </form>
      </section>

      <section class="panel history-panel">
        <header class="history-heading"><div><p>Verlauf</p><h2>Deine Anträge</h2></div><span class="count-badge">{{ requests.length }}</span></header>
        <div v-if="isLoading" class="state"><i class="fa-solid fa-spinner fa-spin"></i>Wird geladen …</div>
        <div v-else-if="!requests.length" class="state"><i class="fa-regular fa-folder-open"></i><span>Noch keine Anträge vorhanden.</span></div>
        <div v-else class="request-list"><article v-for="request in requests" :key="request.id" class="request-item"><div class="request-date"><strong>{{ dateDay(request.start_date) }}</strong><span>{{ dateMonth(request.start_date) }}</span></div><div class="request-copy"><h3>{{ request.request_type }}</h3><p>{{ formatDate(request.start_date) }}<template v-if="request.end_date !== request.start_date"> – {{ formatDate(request.end_date) }}</template></p><small v-if="request.reason">{{ request.reason }}</small></div><span class="status" :class="`status--${request.status}`">{{ formatStatus(request.status) }}</span></article></div>
      </section>
    </div>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'

const newRequest = ref({ type: '', startDate: '', endDate: '', reason: '' })
const requests = ref([])
const isLoading = ref(true)
const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const availability = ref({ status: 'idle', title: 'Zeitraum wählen', message: 'Wähle Start- und Enddatum für die Prüfung.' })
let availabilityCheckId = 0
const today = new Date()
const smartYear = ref(today.getFullYear())
const smartMonth = ref(today.getMonth())
const smartScheduledDates = ref(new Set())
const smartBlockedDates = ref(new Set())
const smartCalendarLoading = ref(false)
const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const formatDate = (dateString) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(`${dateString}T12:00:00`))
const dateDay = (dateString) => new Date(`${dateString}T12:00:00`).getDate()
const dateMonth = (dateString) => new Intl.DateTimeFormat('de-AT', { month: 'short' }).format(new Date(`${dateString}T12:00:00`)).replace('.', '')
const formatStatus = (status) => ({ pending: 'In Bearbeitung', approved: 'Genehmigt', rejected: 'Abgelehnt' }[status] || status)
const isVacationRequest = computed(() => newRequest.value.type.includes('urlaub'))
const availabilityIcon = computed(() => ({ available: 'fa-circle-check', review: 'fa-clock', blocked: 'fa-circle-xmark', loading: 'fa-spinner fa-spin', idle: 'fa-calendar-day' }[availability.value.status] || 'fa-calendar-day'))
const smartMonthLabel = computed(() => new Intl.DateTimeFormat('de-AT', { month: 'short', year: 'numeric' }).format(new Date(smartYear.value, smartMonth.value, 1)))
const smartMonthOffset = computed(() => (new Date(smartYear.value, smartMonth.value, 1).getDay() + 6) % 7)
const keyFor = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const isDateSelected = (date) => newRequest.value.startDate && newRequest.value.endDate && date >= newRequest.value.startDate && date <= newRequest.value.endDate
const smartCalendarDays = computed(() => {
  const count = new Date(smartYear.value, smartMonth.value + 1, 0).getDate()
  const current = todayKey()
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const date = keyFor(smartYear.value, smartMonth.value, number)
    const status = date < current || smartBlockedDates.value.has(date) ? 'blocked' : smartScheduledDates.value.has(date) ? 'review' : 'available'
    const label = ({ available: 'Möglich', review: 'Prüfung erforderlich', blocked: 'Nicht möglich' })[status]
    return { number, date, status, label, today: date === current, selected: isDateSelected(date) }
  })
})

const fetchRequests = async () => {
  isLoading.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.from('employee_requests').select('id, request_type, start_date, end_date, reason, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) throw error
    requests.value = data || []
  } catch (error) {
    errorMessage.value = error?.message || 'Die Anträge konnten nicht geladen werden.'
  } finally { isLoading.value = false }
}

const submitRequest = async () => {
  errorMessage.value = ''; successMessage.value = ''
  if (newRequest.value.endDate < newRequest.value.startDate) { errorMessage.value = 'Das Enddatum darf nicht vor dem Startdatum liegen.'; return }
  if (isVacationRequest.value && availability.value.status === 'blocked') { errorMessage.value = 'Dieser Urlaubszeitraum ist derzeit nicht möglich. Bitte wähle einen anderen Zeitraum.'; return }
  isSubmitting.value = true
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.')
    const { data, error } = await supabase.from('employee_requests').insert({ user_id: user.id, request_type: newRequest.value.type, start_date: newRequest.value.startDate, end_date: newRequest.value.endDate, reason: newRequest.value.reason.trim() || null }).select('id, request_type, start_date, end_date, reason, status, created_at').single()
    if (error) throw error
    requests.value.unshift(data); newRequest.value = { type: '', startDate: '', endDate: '', reason: '' }; successMessage.value = 'Dein Antrag wurde erfolgreich übermittelt.'
  } catch (error) { errorMessage.value = error?.message || 'Der Antrag konnte nicht übermittelt werden.' } finally { isSubmitting.value = false }
}

onMounted(async () => { await fetchRequests(); await loadSmartCalendar() })

const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const checkVacationAvailability = async () => {
  const { startDate, endDate } = newRequest.value
  const checkId = ++availabilityCheckId
  if (!isVacationRequest.value || !startDate || !endDate) { availability.value = { status: 'idle', title: 'Zeitraum wählen', message: 'Wähle Start- und Enddatum für die Prüfung.' }; return }
  if (endDate < startDate) { availability.value = { status: 'blocked', title: 'Nicht möglich', message: 'Das Enddatum darf nicht vor dem Startdatum liegen.' }; return }
  if (startDate < todayKey()) { availability.value = { status: 'blocked', title: 'Nicht möglich', message: 'Urlaub kann nicht rückwirkend beantragt werden.' }; return }

  availability.value = { status: 'loading', title: 'Wird geprüft …', message: 'Dienstplan und bestehende Anträge werden abgeglichen.' }
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || checkId !== availabilityCheckId) return

    const [{ data: conflictingRequests, error: requestError }, { data: scheduledDays, error: scheduleError }] = await Promise.all([
      supabase.from('employee_requests').select('id, start_date, end_date, status').eq('user_id', user.id).in('status', ['pending', 'approved']).lte('start_date', endDate).gte('end_date', startDate),
      supabase.from('schedules').select('date, vacation').eq('user_id', user.id).gte('date', startDate).lte('date', endDate)
    ])
    if (checkId !== availabilityCheckId) return

    if (!requestError && conflictingRequests?.length) { availability.value = { status: 'blocked', title: 'Nicht möglich', message: 'Für diesen Zeitraum gibt es bereits einen offenen oder genehmigten Antrag.' }; return }
    if (!scheduleError && scheduledDays?.some((day) => day.vacation)) { availability.value = { status: 'blocked', title: 'Nicht möglich', message: 'Mindestens ein Tag ist bereits als Urlaub eingetragen.' }; return }
    if (!scheduleError && scheduledDays?.length) { availability.value = { status: 'review', title: 'Prüfung erforderlich', message: `${scheduledDays.length} geplanter ${scheduledDays.length === 1 ? 'Dienst' : 'Dienste'} liegt bzw. liegen in diesem Zeitraum. Das Büro muss die Vertretung bestätigen.` }; return }
    availability.value = { status: 'available', title: 'Möglich', message: 'Für diesen Zeitraum sind keine Dienste oder Konflikte eingetragen.' }
  } catch {
    if (checkId === availabilityCheckId) availability.value = { status: 'review', title: 'Manuelle Prüfung nötig', message: 'Der Zeitraum konnte nicht vollständig geprüft werden. Das Büro entscheidet nach dem Einreichen.' }
  }
}

const monthBoundaries = () => {
  const start = keyFor(smartYear.value, smartMonth.value, 1)
  const end = keyFor(smartYear.value, smartMonth.value, new Date(smartYear.value, smartMonth.value + 1, 0).getDate())
  return { start, end }
}

const addRequestDatesTo = (target, request, start, end) => {
  const cursor = new Date(`${request.start_date}T12:00:00`)
  const last = new Date(`${request.end_date}T12:00:00`)
  while (cursor <= last) {
    const date = keyFor(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    if (date >= start && date <= end) target.add(date)
    cursor.setDate(cursor.getDate() + 1)
  }
}

const loadSmartCalendar = async () => {
  smartCalendarLoading.value = true
  const { start, end } = monthBoundaries()
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: scheduleRows, error: scheduleError }, { data: requestRows, error: requestError }] = await Promise.all([
      supabase.from('schedules').select('date, vacation').eq('user_id', user.id).gte('date', start).lte('date', end),
      supabase.from('employee_requests').select('start_date, end_date, status').eq('user_id', user.id).in('status', ['pending', 'approved']).lte('start_date', end).gte('end_date', start)
    ])
    const scheduled = new Set()
    const blocked = new Set()
    if (!scheduleError) (scheduleRows || []).forEach((row) => (row.vacation ? blocked : scheduled).add(row.date))
    if (!requestError) (requestRows || []).forEach((request) => addRequestDatesTo(blocked, request, start, end))
    // If either data source cannot be read, mark unknown future days as yellow
    // rather than misleadingly promising that leave is available.
    if (scheduleError || requestError) {
      const count = new Date(smartYear.value, smartMonth.value + 1, 0).getDate()
      for (let day = 1; day <= count; day += 1) {
        const date = keyFor(smartYear.value, smartMonth.value, day)
        if (date >= todayKey() && !blocked.has(date)) scheduled.add(date)
      }
    }
    smartScheduledDates.value = scheduled
    smartBlockedDates.value = blocked
  } finally { smartCalendarLoading.value = false }
}

const changeSmartMonth = async (offset) => {
  smartMonth.value += offset
  if (smartMonth.value > 11) { smartMonth.value = 0; smartYear.value += 1 }
  if (smartMonth.value < 0) { smartMonth.value = 11; smartYear.value -= 1 }
  await loadSmartCalendar()
}

const selectSmartDay = (day) => {
  if (!newRequest.value.startDate || newRequest.value.endDate) { newRequest.value.startDate = day.date; newRequest.value.endDate = ''; return }
  if (day.date < newRequest.value.startDate) { newRequest.value.startDate = day.date; return }
  newRequest.value.endDate = day.date
}

watch(() => [newRequest.value.type, newRequest.value.startDate, newRequest.value.endDate], checkVacationAvailability)
</script>

<style scoped>
.requests-layout { display: grid; grid-template-columns: minmax(0, .95fr) minmax(360px, 1.05fr); gap: 20px; align-items: start; }.panel { border: 1px solid var(--line); border-radius: 20px; background: rgba(15, 27, 47, .8); box-shadow: 0 18px 42px rgba(2, 6, 23, .17); }.request-form-panel { padding: 25px; }.panel-heading { display: flex; gap: 13px; align-items: center; margin-bottom: 24px; }.heading-icon { width: 43px; height: 43px; display: grid; place-items: center; border-radius: 13px; color: #bfdbfe; background: rgba(37, 99, 235, .17); }.panel-heading h2, .history-heading h2 { margin: 0; color: #f8fafc; font-size: 1.03rem; letter-spacing: -.02em; }.panel-heading p { margin: 4px 0 0; color: var(--text-muted); font-size: .76rem; }.alert { display: flex; gap: 9px; align-items: center; margin: 0 0 16px; padding: 11px 12px; border-radius: 10px; font-size: .8rem; line-height: 1.35; }.alert--success { color: #bbf7d0; background: rgba(22, 163, 74, .13); }.alert--error { color: #fecdd3; background: rgba(244, 63, 94, .12); }.request-form { display: grid; gap: 17px; }.request-form label { display: grid; gap: 7px; color: #cbd5e1; font-size: .77rem; font-weight: 700; }.request-form label em { color: var(--text-muted); font-style: normal; font-weight: 500; }.request-form input, .request-form select, .request-form textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: #e2e8f0; background: #0a1526; font-size: .88rem; transition: .15s ease; }.request-form input, .request-form select { height: 43px; padding: 0 11px; }.request-form textarea { padding: 11px; resize: vertical; }.request-form input:focus, .request-form select:focus, .request-form textarea:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(59,130,246,.14); }.form-dates { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.submit-button { min-height: 45px; display: inline-flex; justify-content: center; align-items: center; gap: 8px; border: 0; border-radius: 11px; color: #fff; background: linear-gradient(135deg, #2563eb, #3b82f6); box-shadow: 0 10px 18px rgba(37,99,235,.22); font-size: .84rem; font-weight: 800; cursor: pointer; }.submit-button:hover { filter: brightness(1.08); }.submit-button:disabled { opacity: .65; cursor: wait; }.history-panel { min-height: 300px; overflow: hidden; }.history-heading { display: flex; align-items: center; justify-content: space-between; padding: 24px 25px 18px; border-bottom: 1px solid var(--line); }.history-heading p { margin: 0 0 4px; color: var(--text-muted); font-size: .68rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }.count-badge { min-width: 27px; height: 27px; display: grid; place-items: center; border-radius: 9px; color: #bfdbfe; background: rgba(37,99,235,.17); font-size: .74rem; font-weight: 800; }.state { min-height: 230px; display: grid; place-content: center; justify-items: center; gap: 11px; padding: 30px; color: var(--text-muted); font-size: .86rem; text-align: center; }.state i { color: #6685b7; font-size: 1.4rem; }.request-list { display: grid; }.request-item { display: flex; align-items: center; gap: 14px; padding: 15px 20px; border-bottom: 1px solid var(--line); }.request-item:last-child { border-bottom: 0; }.request-date { width: 41px; display: grid; place-items: center; flex: 0 0 auto; padding: 5px 0; border-radius: 10px; color: #bfdbfe; background: rgba(59,130,246,.13); }.request-date strong { font-size: .95rem; line-height: 1; }.request-date span { margin-top: 3px; font-size: .62rem; font-weight: 700; text-transform: uppercase; }.request-copy { min-width: 0; flex: 1; }.request-copy h3 { margin: 0; color: #e5edf9; font-size: .84rem; }.request-copy p { margin: 4px 0 0; color: var(--text-muted); font-size: .72rem; }.request-copy small { display: block; overflow: hidden; margin-top: 5px; color: #94a3b8; font-size: .7rem; text-overflow: ellipsis; white-space: nowrap; }.status { flex: 0 0 auto; padding: 5px 7px; border-radius: 6px; font-size: .62rem; font-weight: 800; }.status--pending { color: #fde68a; background: rgba(245,158,11,.14); }.status--approved { color: #86efac; background: rgba(22,163,74,.14); }.status--rejected { color: #fda4af; background: rgba(244,63,94,.14); }
.smart-request-check { display: flex; gap: 10px; padding: 12px; border: 1px solid var(--line-strong); border-radius: 12px; }.smart-request-icon { width: 35px; height: 35px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 10px; }.smart-request-check p, .mini-calendar-header p { margin: 0 0 3px; color: var(--text-muted); font-size: .62rem; font-weight: 800; letter-spacing: .08em; }.smart-request-check h3 { margin: 0; color: var(--text-heading); font-size: .78rem; }.smart-request-check div > span { display: block; margin-top: 3px; color: var(--text-secondary); font-size: .69rem; line-height: 1.35; }.smart-request-check--available { border-color: rgba(34,197,94,.34); background: rgba(34,197,94,.08); }.smart-request-check--available .smart-request-icon { color: #86efac; background: rgba(34,197,94,.15); }.smart-request-check--review, .smart-request-check--loading { border-color: rgba(245,158,11,.34); background: rgba(245,158,11,.08); }.smart-request-check--review .smart-request-icon, .smart-request-check--loading .smart-request-icon { color: #fcd34d; background: rgba(245,158,11,.15); }.smart-request-check--blocked { border-color: rgba(244,63,94,.34); background: rgba(244,63,94,.08); }.smart-request-check--blocked .smart-request-icon { color: #fda4af; background: rgba(244,63,94,.15); }.mini-smart-calendar { padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-soft); }.mini-calendar-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }.mini-calendar-header h3 { margin: 0; color: var(--text-heading); font-size: .84rem; }.mini-calendar-nav { display: flex; align-items: center; gap: 5px; }.mini-calendar-nav button { width: 27px; height: 27px; border: 1px solid var(--line-strong); border-radius: 8px; color: var(--text-secondary); background: var(--surface-raised); font-size: .65rem; cursor: pointer; }.mini-calendar-nav strong { width: 76px; color: var(--text-secondary); font-size: .65rem; text-align: center; text-transform: capitalize; }.mini-calendar-legend { display: flex; flex-wrap: wrap; gap: 7px; margin: 13px 0 10px; }.mini-legend { display: inline-flex; align-items: center; gap: 4px; color: var(--text-secondary); font-size: .59rem; font-weight: 700; }.mini-legend i { width: 7px; height: 7px; border-radius: 99px; }.mini-legend--available i { background: #22c55e; }.mini-legend--review i { background: #f59e0b; }.mini-legend--blocked i { background: #f43f5e; }.mini-weekdays, .mini-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }.mini-weekdays { margin-bottom: 4px; }.mini-weekdays span { color: var(--text-muted); font-size: .57rem; font-weight: 800; text-align: center; }.mini-calendar-grid button { min-height: 35px; display: grid; place-items: center; align-content: center; gap: 1px; padding: 2px; border: 1px solid transparent; border-radius: 7px; color: var(--text-primary); cursor: pointer; }.mini-calendar-grid button strong { font-size: .67rem; }.mini-calendar-grid button span { color: inherit; font-size: .43rem; font-weight: 700; }.mini-day--available { background: rgba(34,197,94,.16); color: #86efac !important; }.mini-day--review { background: rgba(245,158,11,.15); color: #fcd34d !important; }.mini-day--blocked { background: rgba(244,63,94,.15); color: #fda4af !important; opacity: .88; }.mini-day--selected { border-color: #60a5fa !important; box-shadow: 0 0 0 2px rgba(96,165,250,.22); }.mini-day--today { outline: 1px solid #93c5fd; outline-offset: -2px; }.mini-calendar-grid--loading { opacity: .6; }.mini-calendar-help { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; color: var(--text-muted); font-size: .62rem; }.mini-calendar-help i { color: var(--brand); }
@media (max-width: 880px) { .requests-layout { grid-template-columns: 1fr; } }
@media (max-width: 460px) { .request-form-panel { padding: 18px; }.form-dates { grid-template-columns: 1fr; }.request-item { align-items: flex-start; padding: 14px; }.status { margin-top: 3px; }.request-copy small { white-space: normal; } }
</style>
