<template>
  <AppShell eyebrow="Planung" title="Smart-Kalender" description="Deine Dienste, freien Tage und Hinweise in einer klaren Übersicht.">
    <template #actions>
      <button class="today-button" type="button" @click="goToToday"><i class="fa-solid fa-calendar-day"></i> Heute</button>
    </template>

    <section class="stats-grid" aria-label="Monatsübersicht">
      <article class="stat-card stat-card--blue">
        <span class="stat-icon"><i class="fa-regular fa-clock"></i></span>
        <div><span>Ist-Stunden</span><strong>{{ completedMonthHours }} <small>Std.</small></strong></div>
      </article>
      <article class="stat-card stat-card--violet">
        <span class="stat-icon"><i class="fa-solid fa-calendar-check"></i></span>
        <div><span>Geplant</span><strong>{{ currentMonthHours }} <small>Std.</small></strong></div>
      </article>
      <article class="stat-card stat-card--green">
        <span class="stat-icon"><i class="fa-solid fa-umbrella-beach"></i></span>
        <div><span>Urlaub</span><strong>{{ vacationDays }} <small>Tage</small></strong></div>
      </article>
    </section>

    <section class="schedule-card">
      <header class="schedule-toolbar">
        <div class="month-navigation">
          <button type="button" aria-label="Vorheriger Monat" @click="changeMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
          <div><p>Kalender</p><h2>{{ monthNames[currentMonth] }} {{ currentYear }}</h2></div>
          <button type="button" aria-label="Nächster Monat" @click="changeMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="view-toggle" aria-label="Ansicht auswählen">
          <button type="button" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'"><i class="fa-solid fa-grid-2"></i><span>Raster</span></button>
          <button type="button" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'"><i class="fa-solid fa-list"></i><span>Liste</span></button>
          <button v-if="isWide" type="button" :class="{ active: viewMode === 'landscape' }" @click="viewMode = 'landscape'"><i class="fa-solid fa-table-cells-large"></i><span>Querformat</span></button>
        </div>
      </header>

      <p v-if="loadError" class="notice notice--error"><i class="fa-solid fa-circle-exclamation"></i>{{ loadError }}</p>
      <p v-else-if="isLoading" class="notice"><i class="fa-solid fa-spinner fa-spin"></i>Dienstplan wird geladen …</p>
      <div class="calendar-legend" aria-label="Legende zum Dienstplan"><span class="legend legend--day"><i></i>Tagdienst</span><span class="legend legend--night"><i></i>Nachtdienst</span><span class="legend legend--vacation"><i></i>Urlaub</span><span class="legend legend--sick"><i></i>Krank</span></div>

      <template v-if="viewMode !== 'landscape'">
        <div class="weekdays" aria-hidden="true">
          <span v-for="day in weekdayLabels" :key="day">{{ day }}</span>
        </div>
        <div class="calendar" :class="{ 'calendar--list': viewMode === 'list' }">
          <span v-for="offset in monthOffset" :key="`empty-${offset}`" class="calendar__empty"></span>
          <button v-for="day in calendarDays" :key="day.dateKey" type="button" class="day" :class="[day.kind, { 'day--today': day.isToday }]" @click="selectedDay = day">
            <span class="day__date"><strong>{{ day.dayNum }}</strong><small>{{ day.dayName }}</small></span>
            <template v-if="day.shift?.vacation"><span class="shift-tag shift-tag--vacation"><i class="fa-solid fa-umbrella-beach"></i> Urlaub</span><span class="shift-title">Erholungsurlaub</span><span class="shift-place">Frei von Diensten</span></template>
            <template v-else-if="day.shift?.sick"><span class="shift-tag shift-tag--sick"><i class="fa-solid fa-heart-pulse"></i> Krank</span><span class="shift-title">Krankgemeldet</span><span class="shift-place">Keine Dienstplanung</span></template>
            <template v-else-if="day.shift">
              <span class="shift-tag" :class="day.shift.isNight ? 'shift-tag--night' : 'shift-tag--day'">{{ day.shift.badge }}</span>
              <span class="shift-title">{{ day.shift.title }}</span>
              <span class="shift-time">{{ day.shift.time }}</span>
              <span class="shift-place">{{ day.shift.ort }}</span>
            </template>
            <template v-else><span class="free-tag">Frei</span></template>
          </button>
        </div>
      </template>

      <div v-else class="landscape-scroller">
        <table class="landscape-table">
          <thead><tr><th v-for="day in calendarDays" :key="`header-${day.dateKey}`" :class="{ weekend: day.isWeekend, today: day.isToday }"><strong>{{ day.dayNum }}</strong><span>{{ day.dayName }}</span></th></tr></thead>
          <tbody><tr><td v-for="day in calendarDays" :key="`entry-${day.dateKey}`" :class="[day.kind, { weekend: day.isWeekend, 'day--today': day.isToday }]" @click="selectedDay = day"><template v-if="day.shift?.vacation"><span class="landscape-badge landscape-badge--vacation">URL</span><small>Erholungsurlaub</small></template><template v-else-if="day.shift?.sick"><span class="landscape-badge landscape-badge--sick">KR</span><small>Krankgemeldet</small></template><template v-else-if="day.shift"><span class="landscape-badge" :class="day.shift.isNight ? 'landscape-badge--night' : 'landscape-badge--day'">{{ day.shift.badge }}</span><small>{{ day.shift.title }} · {{ day.shift.time }}</small><em>{{ day.shift.ort }}</em></template><template v-else><span class="landscape-free">Frei</span></template></td></tr></tbody>
        </table>
      </div>
    </section>
  </AppShell>

  <Teleport to="body">
    <div v-if="selectedDay" class="modal-backdrop" @click.self="selectedDay = null">
      <section class="shift-modal" role="dialog" aria-modal="true" :aria-label="`Details für ${selectedDay.dayNum}. ${monthNames[currentMonth]}`">
        <header><div><p>{{ selectedDay.dayName }}, {{ selectedDay.dayNum }}. {{ monthNames[currentMonth] }}</p><h2>{{ selectedDay.shift?.vacation ? 'Urlaub' : selectedDay.shift?.sick ? 'Krank gemeldet' : selectedDay.shift ? selectedDay.shift.title : 'Dienstfreier Tag' }}</h2></div><button type="button" aria-label="Schließen" @click="selectedDay = null"><i class="fa-solid fa-xmark"></i></button></header>
        <div class="modal-content">
          <template v-if="selectedDay.shift && !selectedDay.shift.vacation && !selectedDay.shift.sick">
            <div class="detail"><span>Schicht</span><strong>{{ selectedDay.shift.badge }}</strong></div>
            <div class="detail"><span>Dienstzeit</span><strong>{{ selectedDay.shift.time }} · {{ selectedDay.shift.hours }} Std.</strong></div>
            <div class="detail"><span>Einsatzort</span><strong>{{ selectedDay.shift.ort || 'Nicht angegeben' }}</strong></div>
          </template>
          <p v-else-if="selectedDay.shift?.vacation">Dieser Tag ist als Erholungsurlaub eingetragen.</p>
          <p v-else-if="selectedDay.shift?.sick">Dieser Tag ist als krank gemeldet markiert. Es ist kein Dienst eingeplant.</p>
          <p v-else>An diesem Tag ist kein Dienst eingeteilt.</p>
        </div>
        <button class="modal-close" type="button" @click="selectedDay = null">Schließen</button>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'

const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())
const viewMode = ref('grid')
const selectedDay = ref(null)
const shiftData = ref({})
const isLoading = ref(false)
const loadError = ref('')
const isWide = ref(typeof window === 'undefined' ? true : window.innerWidth >= 960)

const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const monthBounds = () => {
  const month = String(currentMonth.value + 1).padStart(2, '0')
  const last = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  return { start: `${currentYear.value}-${month}-01`, end: `${currentYear.value}-${month}-${String(last).padStart(2, '0')}` }
}

const calculateHours = (time) => {
  const matches = String(time || '').match(/(\d{1,2}):\d{2}\s*[-–]\s*(\d{1,2}):\d{2}/)
  if (!matches) return 8
  const start = Number(matches[1])
  const end = Number(matches[2])
  return end >= start ? end - start : 24 - start + end
}

const mapLegacySchedules = (rows) => (rows || []).reduce((schedule, row) => {
  let shifts = row.shifts
  if (typeof shifts === 'string') {
    try { shifts = JSON.parse(shifts) } catch { shifts = [] }
  }
  if (!Array.isArray(shifts)) return schedule

  shifts.forEach((entry, index) => {
    const value = typeof entry === 'object' && entry !== null ? (entry.schicht || entry.shift || entry.time) : entry
    const location = typeof entry === 'object' && entry !== null ? (entry.ort || entry.location || '-') : '-'
    if (!value || String(value).toLowerCase() === 'frei') return
    const dateKey = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
    const normalisedValue = String(value).trim().toLowerCase()
    if (normalisedValue.includes('urlaub')) {
      schedule[dateKey] = { vacation: true, hours: 0 }
      return
    }
    if (/^(kr|krank|krankheit|sick|krankenstand)\b/.test(normalisedValue)) {
      schedule[dateKey] = { sick: true, hours: 0, badge: 'KR', title: 'Krankgemeldet', time: 'Krank', ort: 'Keine Dienstplanung' }
      return
    }
    const isNight = /(^|\D)(19|20|21|22|23):/.test(String(value))
    schedule[dateKey] = {
      badge: isNight ? 'ND' : 'TD',
      title: isNight ? 'Nachtdienst' : 'Regeldienst',
      time: String(value),
      ort: location || 'Einsatzort folgt',
      hours: calculateHours(value),
      isNight,
      instruction: 'Pünktlich zum Dienst erscheinen.'
    }
  })
  return schedule
}, {})

const fetchSchedule = async () => {
  isLoading.value = true
  loadError.value = ''
  shiftData.value = {}
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { start, end } = monthBounds()
    const { data, error } = await supabase
      .from('schedules')
      .select('date, ort, shift_time, shift_type, hours, is_night, vacation')
      .eq('user_id', user.id)
      .gte('date', start)
      .lte('date', end)
      .order('date')
    if (error) throw error
    shiftData.value = (data || []).reduce((schedule, row) => {
      const shiftType = String(row.shift_type || '').trim()
      const isSick = /^(kr|krank|krankheit|sick|krankenstand)\b/i.test(shiftType)
      schedule[row.date] = row.vacation
        ? { vacation: true, hours: 0 }
        : isSick
          ? { sick: true, hours: 0, badge: 'KR', title: 'Krankgemeldet', time: 'Krank', ort: 'Keine Dienstplanung' }
          : { badge: row.shift_type || 'Dienst', title: row.shift_type === 'ND' ? 'Nachtdienst' : 'Tagdienst', time: row.shift_time || 'Zeit folgt', ort: row.ort || 'Einsatzort folgt', hours: Number(row.hours) || calculateHours(row.shift_time), isNight: Boolean(row.is_night) || row.shift_type === 'ND', instruction: 'Pünktlich zum Dienst erscheinen.' }
      return schedule
    }, {})
    if (data?.length) return

    // Rückwärtskompatibilität: alte Versionen speicherten den Monat als JSON.
    const { data: legacyRows, error: legacyError } = await supabase
      .from('schedules')
      .select('shifts')
      .eq('user_id', user.id)
      .eq('month', currentMonth.value + 1)
      .eq('year', currentYear.value)
    if (!legacyError) shiftData.value = mapLegacySchedules(legacyRows)
  } catch (error) {
    loadError.value = 'Der Dienstplan konnte gerade nicht geladen werden.'
  } finally {
    isLoading.value = false
  }
}

const changeMonth = async (offset) => {
  currentMonth.value += offset
  if (currentMonth.value > 11) { currentMonth.value = 0; currentYear.value += 1 }
  if (currentMonth.value < 0) { currentMonth.value = 11; currentYear.value -= 1 }
  selectedDay.value = null
  await fetchSchedule()
}

const goToToday = async () => {
  currentMonth.value = today.getMonth()
  currentYear.value = today.getFullYear()
  selectedDay.value = null
  await fetchSchedule()
}

const monthOffset = computed(() => (new Date(currentYear.value, currentMonth.value, 1).getDay() + 6) % 7)
const calendarDays = computed(() => {
  const amount = new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return Array.from({ length: amount }, (_, index) => {
    const dayNum = index + 1
    const dayDate = new Date(currentYear.value, currentMonth.value, dayNum)
    const dateKey = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    const shift = shiftData.value[dateKey]
    const weekdayIndex = (dayDate.getDay() + 6) % 7
    return { dayNum, dateKey, shift, isToday: dateKey === currentKey, dayName: weekdayLabels[weekdayIndex], isWeekend: weekdayIndex > 4, kind: shift?.vacation ? 'day--vacation' : shift?.sick ? 'day--sick' : shift ? (shift.isNight ? 'day--night' : 'day--shift') : 'day--free' }
  })
})
const currentMonthHours = computed(() => calendarDays.value.reduce((total, day) => total + (day.shift?.hours || 0), 0))
const completedMonthHours = computed(() => {
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return calendarDays.value.filter((day) => day.dateKey <= currentKey && !day.shift?.vacation && !day.shift?.sick).reduce((total, day) => total + (day.shift?.hours || 0), 0)
})
const vacationDays = computed(() => calendarDays.value.filter((day) => day.shift?.vacation).length)

const syncLayout = () => {
  isWide.value = window.innerWidth >= 960
  if (!isWide.value && viewMode.value === 'landscape') viewMode.value = 'grid'
}

onMounted(() => {
  syncLayout()
  window.addEventListener('resize', syncLayout)
  fetchSchedule()
})

onBeforeUnmount(() => window.removeEventListener('resize', syncLayout))
</script>

<style scoped>
.today-button, .schedule-toolbar button, .view-toggle button { border: 0; cursor: pointer; }
.today-button { display: inline-flex; align-items: center; gap: 8px; padding: 11px 15px; border-radius: 11px; color: #dbeafe; background: rgba(59, 130, 246, .16); font-size: .84rem; font-weight: 700; }
.today-button:hover { background: rgba(59, 130, 246, .28); }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px; }
.stat-card { min-height: 126px; display: flex; align-items: flex-start; gap: 14px; padding: 21px; overflow: hidden; border: 1px solid var(--line); border-radius: 18px; background: linear-gradient(135deg, rgba(20, 34, 58, .95), rgba(15, 27, 47, .86)); box-shadow: 0 14px 28px rgba(2, 6, 23, .16); }
.stat-icon { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 13px; font-size: 1.05rem; }
.stat-card span:not(.stat-icon) { display: block; color: var(--text-secondary); font-size: .76rem; font-weight: 600; }
.stat-card strong { display: block; margin-top: 7px; color: #fff; font-size: 1.65rem; letter-spacing: -.05em; }
.stat-card strong small { color: var(--text-secondary); font-size: .75rem; letter-spacing: 0; }
.stat-card--blue .stat-icon { color: #93c5fd; background: rgba(59, 130, 246, .18); }.stat-card--violet .stat-icon { color: #c4b5fd; background: rgba(139, 92, 246, .16); }.stat-card--green .stat-icon { color: #6ee7b7; background: rgba(16, 185, 129, .14); }
.schedule-card { border: 1px solid var(--line); border-radius: 20px; background: rgba(15, 27, 47, .8); box-shadow: 0 20px 45px rgba(2, 6, 23, .2); overflow: hidden; }
.schedule-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 24px 26px; border-bottom: 1px solid var(--line); }
.month-navigation { display: flex; align-items: center; gap: 13px; }.month-navigation button { width: 35px; height: 35px; border: 1px solid var(--line-strong); border-radius: 10px; color: #dbeafe; background: var(--surface-raised); }.month-navigation button:hover { background: #203557; }.month-navigation p { margin: 0 0 3px; color: var(--text-muted); font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }.month-navigation h2 { margin: 0; color: #fff; font-size: 1.05rem; letter-spacing: -.02em; }
.view-toggle { display: flex; padding: 4px; border: 1px solid var(--line); border-radius: 11px; background: #0a1526; }.view-toggle button { display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 7px; color: var(--text-muted); background: transparent; font-size: .75rem; font-weight: 700; }.view-toggle button.active { color: #eaf2ff; background: #20385c; }
.notice { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 16px 24px 0; padding: 10px; border-radius: 10px; color: var(--text-secondary); background: rgba(148, 163, 184, .08); font-size: .82rem; }.notice--error { color: #fecdd3; background: rgba(244, 63, 94, .1); }.calendar-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; padding: 14px 20px 0; color: var(--text-secondary); font-size: .67rem; font-weight: 700; }.legend { display: inline-flex; align-items: center; gap: 5px; }.legend i { width: 8px; height: 8px; border-radius: 50%; }.legend--day i { background: #3b82f6; }.legend--night i { background: #8b5cf6; }.legend--vacation i { background: #22c55e; }.legend--sick i { background: #f43f5e; }
.weekdays, .calendar { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }.weekdays { padding: 20px 20px 9px; }.weekdays span { color: var(--text-muted); font-size: .66rem; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: .05em; }.calendar { gap: 8px; padding: 8px 20px 20px; }.calendar__empty { min-height: 136px; }.day { min-height: 136px; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 11px; overflow: hidden; border: 1px solid var(--line); border-top: 3px solid #64748b; border-radius: 13px; color: inherit; background: rgba(10, 21, 38, .58); text-align: left; transition: transform .15s ease, border-color .15s ease, background .15s ease; cursor: pointer; }.day:hover { transform: translateY(-2px); border-color: rgba(96, 165, 250, .75); background: #12223a; }.day--shift { border-top-color: #3b82f6; background: linear-gradient(150deg, rgba(37,99,235,.16), rgba(10,21,38,.58) 58%); }.day--night { border-top-color: #8b5cf6; background: linear-gradient(150deg, rgba(139,92,246,.17), rgba(10,21,38,.58) 58%); }.day--vacation { border-top-color: #22c55e; background: linear-gradient(150deg, rgba(34,197,94,.14), rgba(10,21,38,.58) 58%); }.day--sick { border-top-color: #f43f5e; background: linear-gradient(150deg, rgba(244,63,94,.14), rgba(10,21,38,.58) 58%); }.day--today { outline: 2px solid #60a5fa; outline-offset: -2px; box-shadow: 0 0 0 3px rgba(96,165,250,.18), inset 0 0 0 1px rgba(191,219,254,.7); }.day__date { display: flex; align-items: baseline; gap: 5px; }.day__date strong { color: #f1f5f9; font-size: .9rem; }.day__date small { color: var(--text-muted); font-size: .68rem; }.shift-tag, .free-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border-radius: 6px; font-size: .66rem; font-weight: 800; }.shift-tag--day { color: #bfdbfe; background: rgba(37, 99, 235, .18); }.shift-tag--night { color: #ddd6fe; background: rgba(109, 40, 217, .23); }.shift-tag--vacation { color: #86efac; background: rgba(22, 163, 74, .16); }.shift-tag--sick { color: #fda4af; background: rgba(244,63,94,.16); }.shift-title { overflow: hidden; max-width: 100%; color: var(--text-primary); font-size: .7rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }.free-tag { color: #7e8ca6; background: rgba(100, 116, 139, .12); }.shift-time { color: #dbeafe; font-size: .72rem; font-weight: 700; }.shift-place { overflow: hidden; width: 100%; color: var(--text-muted); font-size: .66rem; text-overflow: ellipsis; white-space: nowrap; }
.calendar--list { grid-template-columns: 1fr; gap: 7px; }.calendar--list .calendar__empty { display: none; }.calendar--list .day { min-height: 61px; flex-direction: row; align-items: center; gap: 15px; padding: 10px 14px; }.calendar--list .day__date { width: 75px; }.calendar--list .shift-place { width: auto; margin-left: auto; }.calendar--list .free-tag { margin-left: auto; }
.landscape-scroller { overflow-x: auto; padding: 20px; }.landscape-table { width: 100%; min-width: 1020px; border-collapse: separate; border-spacing: 4px; table-layout: fixed; }.landscape-table th { padding: 8px 3px; color: var(--text-muted); font-size: .66rem; text-align: center; }.landscape-table th strong, .landscape-table th span { display: block; }.landscape-table th strong { color: var(--text-heading); font-size: .84rem; }.landscape-table th.weekend { background: var(--surface-soft); border-radius: 8px; }.landscape-table th.today { color: var(--brand); }.landscape-table td { height: 132px; padding: 9px 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-soft); text-align: center; vertical-align: top; cursor: pointer; transition: .15s ease; }.landscape-table td:hover { transform: translateY(-2px); border-color: var(--brand); }.landscape-table td.weekend { background: color-mix(in srgb, var(--surface-soft) 80%, var(--warning)); }.landscape-table td.day--today { outline: 2px solid #60a5fa; outline-offset: -2px; box-shadow: 0 0 0 3px rgba(96,165,250,.18); }.landscape-badge { display: inline-grid; min-width: 29px; padding: 4px; border-radius: 6px; color: #bfdbfe; background: rgba(37,99,235,.2); font-size: .61rem; font-weight: 800; }.landscape-badge--night { color: #ddd6fe; background: rgba(109,40,217,.23); }.landscape-badge--vacation { color: #86efac; background: rgba(22,163,74,.16); }.landscape-badge--sick { color: #fda4af; background: rgba(244,63,94,.16); }.landscape-table td small, .landscape-table td em { display: block; overflow: hidden; margin-top: 7px; color: var(--text-secondary); font-size: .62rem; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }.landscape-table td em { margin-top: 4px; color: var(--text-muted); }.landscape-free { display: inline-block; margin-top: 38px; color: var(--text-muted); font-size: .67rem; font-weight: 700; }
.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 18px; background: rgba(2, 6, 23, .72); backdrop-filter: blur(5px); }.shift-modal { width: min(430px, 100%); padding: 24px; border: 1px solid var(--line-strong); border-radius: 20px; background: #101e34; box-shadow: 0 26px 70px rgba(0,0,0,.4); }.shift-modal header { display: flex; justify-content: space-between; gap: 15px; }.shift-modal header p { margin: 0; color: var(--text-muted); font-size: .76rem; }.shift-modal h2 { margin: 6px 0 0; color: #fff; font-size: 1.25rem; }.shift-modal header button { width: 34px; height: 34px; border: 0; border-radius: 9px; color: #cbd5e1; background: #1d2e49; cursor: pointer; }.modal-content { display: grid; gap: 12px; margin: 24px 0; color: var(--text-secondary); font-size: .9rem; line-height: 1.5; }.modal-content p { margin: 0; }.detail { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--line); }.detail span { color: var(--text-muted); font-size: .78rem; }.detail strong { color: #e8f0ff; font-size: .84rem; text-align: right; }.modal-close { width: 100%; padding: 11px; border: 0; border-radius: 10px; color: #dbeafe; background: #2563eb; font-weight: 700; cursor: pointer; }
@media (max-width: 700px) { .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }.stat-card { min-width: 0; min-height: 82px; flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px; }.stat-icon { width: 27px; height: 27px; border-radius: 8px; font-size: .67rem; }.stat-card span:not(.stat-icon) { overflow: hidden; font-size: .58rem; text-overflow: ellipsis; white-space: nowrap; }.stat-card strong { margin-top: 2px; font-size: 1rem; }.stat-card strong small { display: none; }.schedule-toolbar { align-items: flex-start; flex-direction: column; padding: 18px; }.month-navigation { width: 100%; justify-content: center; }.month-navigation > div { min-width: 148px; text-align: center; }.view-toggle { width: 100%; }.view-toggle button { flex: 1; justify-content: center; }.weekdays { display: none; }.calendar { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 10px; }.calendar__empty { display: none; }.calendar:not(.calendar--list) .day { min-height: 145px; flex-direction: column; align-items: flex-start; gap: 5px; padding: 8px; }.calendar:not(.calendar--list) .day__date { width: auto; }.calendar:not(.calendar--list) .shift-tag { max-width: 100%; overflow: hidden; padding: 3px 5px; font-size: .56rem; text-overflow: ellipsis; white-space: nowrap; }.calendar:not(.calendar--list) .shift-title { font-size: .61rem; white-space: normal; }.calendar:not(.calendar--list) .shift-time { margin-left: 0; font-size: .61rem; }.calendar:not(.calendar--list) .shift-place { width: 100%; margin-left: 0; font-size: .57rem; line-height: 1.2; white-space: normal; overflow-wrap: anywhere; }.calendar:not(.calendar--list) .free-tag { margin-left: 0; font-size: .58rem; }.calendar--list { grid-template-columns: 1fr; }.calendar--list .day { min-height: 66px; flex-direction: row; align-items: center; gap: 12px; padding: 11px 13px; }.calendar--list .day__date { width: 70px; }.calendar--list .shift-place { width: auto; margin-left: auto; }.calendar--list .free-tag { margin-left: auto; }.calendar--list .shift-time { margin-left: auto; }.calendar--list.day--shift .shift-place, .calendar--list.day--night .shift-place { display: none; }.today-button { display: none; } }
@media (max-width: 390px) { .stat-card { padding: 9px 7px; }.stat-card strong { font-size: .92rem; }.view-toggle button { padding: 7px 6px; font-size: .68rem; } }
</style>
