<template>
  <!-- Header -->
  <header class="app-header">
    <div class="header-inner">
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
        <router-link to="/home" class="btn-nav active" @click="closeMobileMenu">
          <i class="fa-solid fa-calendar-days"></i> Home
        </router-link>
        <router-link to="/antraege" class="btn-nav" @click="closeMobileMenu">
          <i class="fa-solid fa-file-pen"></i> Anträge
        </router-link>
        <router-link to="/gehalt" class="btn-nav" @click="closeMobileMenu">
          <i class="fa-solid fa-file-invoice-dollar"></i> Gehalt
        </router-link>
        <router-link to="/anweisungen" class="btn-nav" @click="closeMobileMenu">
          <i class="fa-solid fa-file-pdf"></i> Anweisungen
        </router-link>
        <router-link to="/kontakt" class="btn-nav" @click="closeMobileMenu">
          <i class="fa-solid fa-paper-plane"></i> Büro Kontakt
        </router-link>
        <router-link to="/profile" class="btn-nav" @click="closeMobileMenu">
          <i class="fa-solid fa-user"></i> Profil
        </router-link>
        <button class="btn-nav btn-logout" @click="handleLogout">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      </nav>
    </div>
  </header>

  <!-- Main Content -->
  <main class="app-main">
    <!-- Übersichtskarten -->
    <section class="hours-overview">
      <div class="hours-card">
        <div class="card-icon blue"><i class="fa-solid fa-clock"></i></div>
        <div class="hours-info">
          <span>Ist-Std.</span>
          <strong>{{ currentMonthHours }}</strong>
        </div>
      </div>
      <div class="hours-card">
        <div class="card-icon green"><i class="fa-solid fa-business-time"></i></div>
        <div class="hours-info">
          <span>Soll-Std.</span>
          <strong>160</strong>
        </div>
      </div>
      <div class="hours-card">
        <div class="card-icon orange"><i class="fa-solid fa-umbrella-beach"></i></div>
        <div class="hours-info">
          <span>Urlaub</span>
          <strong>14 <small>T.</small></strong>
        </div>
      </div>
    </section>

    <!-- Steuerung -->
    <section class="calendar-controls">
      <div class="month-nav">
        <i class="fa-solid fa-circle-chevron-left" style="color: #2563eb; font-size: 1.2rem; cursor: pointer;" @click="changeMonth(-1)"></i>
        <div class="month-title">
          {{ monthNames[currentMonth] }} <span>{{ currentYear }}</span>
        </div>
        <i class="fa-solid fa-circle-chevron-right" style="color: #2563eb; font-size: 1.2rem; cursor: pointer;" @click="changeMonth(1)"></i>
      </div>

      <div class="view-switch">
        <button class="btn-switch" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">
          <i class="fa-solid fa-border-all"></i> Detail
        </button>
        <button class="btn-switch desktop-only" :class="{ active: viewMode === 'landscape' }" @click="viewMode = 'landscape'">
          <i class="fa-solid fa-table-cells-large"></i> Querformat (PC)
        </button>
        <button class="btn-switch" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
          <i class="fa-solid fa-list"></i> Liste
        </button>
        <button class="btn-switch" @click="toggleLightMode" title="Helligkeit umschalten">
          <i class="fa-solid" :class="isLightMode ? 'fa-moon' : 'fa-sun'"></i>
        </button>
      </div>
    </section>

    <!-- GRID / LISTE ANSICHT -->
    <template v-if="viewMode === 'grid' || viewMode === 'list'">
      <div class="calendar-grid" :class="{ 'list-view': viewMode === 'list' }">
        <template v-if="viewMode === 'grid'">
          <div v-for="offset in monthOffset" :key="'offset-' + offset" class="day-card offset-day desktop-only"></div>
        </template>

        <div
            v-for="day in calendarDays"
            :key="day.dateKey"
            class="day-card"
            :class="day.cardClass"
            @click="openDetails(day)"
        >
          <div class="day-header">
            <span class="day-number">{{ day.dayNum }}</span>
            <span class="day-name">{{ day.dayName }}</span>
          </div>

          <div class="day-body">
            <template v-if="day.shift && !day.shift.vacation">
              <div class="shift-top-row">
                <span class="shift-badge" :class="day.shift.class">{{ day.shift.badge }}</span>
                <span class="shift-time-badge" :class="day.shift.isNight ? 'time-night' : 'time-day'">
                  <i class="fa-regular fa-clock"></i> {{ day.shift.time }}
                </span>
              </div>
              <div class="shift-details">
                <strong class="shift-title">{{ day.shift.title }}</strong>
                <div v-if="day.shift.ort && day.shift.ort !== '-'" class="shift-location">
                  📍 {{ day.shift.ort }}
                </div>
              </div>
            </template>

            <template v-else-if="day.shift && day.shift.vacation">
              <span class="shift-badge badge-vacation">Urlaub</span>
              <div class="shift-details">
                <strong class="shift-title">Erholungsurlaub</strong>
              </div>
            </template>

            <template v-else>
              <span class="shift-badge badge-off">Frei</span>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- QUERFORMAT TABELLEN-ANSICHT -->
    <template v-else-if="viewMode === 'landscape'">
      <div class="landscape-fullscreen-container">
        <table class="landscape-table">
          <thead>
          <tr class="row-dates">
            <th v-for="day in calendarDays" :key="'num-' + day.dateKey" :class="{ weekend: day.isWeekend }">
              {{ day.dayNum }}
            </th>
          </tr>
          <tr class="row-weekdays">
            <th v-for="day in calendarDays" :key="'name-' + day.dateKey" :class="{ weekend: day.isWeekend }">
              {{ day.dayName }}
            </th>
          </tr>
          </thead>
          <tbody>
          <tr class="row-shifts">
            <td
                v-for="day in calendarDays"
                :key="'shift-' + day.dateKey"
                :class="[
                  day.isWeekend ? 'weekend' : '',
                  day.shift ? (day.shift.vacation ? 'cell-vacation' : (day.shift.isNight ? 'cell-night' : 'cell-day')) : 'is-off'
                ]"
                @click="openDetails(day)"
            >
              <template v-if="day.shift && !day.shift.vacation">
                <span class="shift-badge landscape-badge" :class="day.shift.class">{{ day.shift.badge }}</span>
                <span class="landscape-time">{{ day.shift.time }}</span>
                <span v-if="day.shift.ort && day.shift.ort !== '-'" class="landscape-time" style="color: #60a5fa;">📍 {{ day.shift.ort }}</span>
              </template>
              <template v-else-if="day.shift && day.shift.vacation">
                <span class="shift-badge badge-vacation landscape-badge">URL</span>
                <span class="landscape-time">Urlaub</span>
              </template>
              <template v-else>
                <span class="off-text-landscape">Frei</span>
              </template>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </template>
  </main>

  <!-- Modal Pop-up -->
  <div v-if="selectedDay" class="modal-overlay" @click.self="closeDetails">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3>{{ selectedDay.dayNum }}. {{ monthNames[currentMonth] }} {{ currentYear }}</h3>
          <span class="modal-subtitle">{{ selectedDay.dayName }}tag</span>
        </div>
        <button class="btn-close" @click="closeDetails" aria-label="Schließen"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="modal-body">
        <template v-if="selectedDay.shift && !selectedDay.shift.vacation">
          <div class="detail-row">
            <span class="label">Kürzel:</span>
            <span class="shift-badge" :class="selectedDay.shift.class">{{ selectedDay.shift.badge }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Einsatzort:</span>
            <strong>{{ selectedDay.shift.title }}</strong>
          </div>
          <div class="detail-row" v-if="selectedDay.shift.ort && selectedDay.shift.ort !== '-'">
            <span class="label">Ort / Pavillon:</span>
            <span style="color: #60a5fa; font-weight: 600;">📍 {{ selectedDay.shift.ort }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Dienstzeit:</span>
            <span><i class="fa-regular fa-clock"></i> {{ selectedDay.shift.time }} ({{ selectedDay.shift.hours }} Std.)</span>
          </div>

          <div class="instruction-box">
            <h4><i class="fa-solid fa-circle-info"></i> Dienstanweisung</h4>
            <p>{{ selectedDay.shift.instruction || 'Keine speziellen Anweisungen hinterlegt.' }}</p>
          </div>
        </template>

        <template v-else-if="selectedDay.shift && selectedDay.shift.vacation">
          <div class="status-info green">
            <i class="fa-solid fa-umbrella-beach"></i>
            <span>Erholungsurlaub eingetragen.</span>
          </div>
        </template>

        <template v-else>
          <div class="status-info gray">
            <i class="fa-solid fa-bed"></i>
            <span>Dienstfreier Tag. Keine Schicht eingeteilt.</span>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <button class="btn-primary" @click="closeDetails">Schließen</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../config/supabase.js'

const router = useRouter()
const isMobileMenuOpen = ref(false)
const viewMode = ref('grid')
const selectedDay = ref(null)
const isMobile = ref(false)
const isLightMode = ref(false)

const userName = ref('Wird geladen...')

const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth())

const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]
const daysOfWeekNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

const shiftData = ref({})

// Hilfsfunktion: E-Mail in einen schönen Namen umwandeln (falls kein Profilname existiert)
const formatNameFromEmail = (email) => {
  if (!email) return 'Mitarbeiter'
  const namePart = email.split('@')[0]
  const parts = namePart.split(/[._-]/)
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

const fetchUserDataAndSchedules = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    shiftData.value = {}
    return
  }

  // 1. Benutzername ermitteln (Priorität: profiles Tabelle -> user_metadata -> E-Mail formatiert)
  let currentUserName = ''

  const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, name')
      .eq('id', user.id)
      .single()

  if (profileData) {
    currentUserName = profileData.full_name || profileData.name || ''
  }

  if (!currentUserName && user.user_metadata?.full_name) {
    currentUserName = user.user_metadata.full_name
  }

  if (!currentUserName) {
    currentUserName = formatNameFromEmail(user.email)
  }

  userName.value = currentUserName

  // 2. Neue Standortpläne: eine Datenbankzeile pro tatsächlicher Schicht.
  // Diese Form wird von der KI-Planung geschrieben und ist für einen ganzen
  // Standort sicherer als ein Monats-JSON pro Person.
  const monthStart = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-01`
  const monthEnd = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(new Date(currentYear.value, currentMonth.value + 1, 0).getDate()).padStart(2, '0')}`
  const { data: datedRows, error: datedRowsError } = await supabase
      .from('schedules')
      .select('date, ort, shift_time, shift_type, hours, is_night, vacation')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date')

  if (!datedRowsError) {
    const map = {}

    datedRows?.forEach(row => {
      if (row.vacation) {
        map[row.date] = { vacation: true, hours: 0, ort: '-' }
        return
      }

      map[row.date] = {
        badge: row.shift_type || 'KH',
        class: 'badge-kh',
        title: row.shift_type === 'ND' ? 'Nachtdienst' : 'Tagdienst',
        time: row.shift_time,
        ort: row.ort || '-',
        hours: Number(row.hours) || 0,
        isNight: Boolean(row.is_night) || row.shift_type === 'ND',
        instruction: 'Pünktlich zum Dienst erscheinen.'
      }
    })

    if (datedRows?.length) {
      shiftData.value = map
      return
    }
  }

  // 3. Rückwärtskompatibilität mit den bisherigen Monats-JSON-Plänen.
  const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .or(`user_id.eq.${user.id},employee_name.ilike.%${currentUserName}%`)
      .eq('month', currentMonth.value + 1)
      .eq('year', currentYear.value)

  if (!error && data && data.length > 0) {
    const map = {}

    data.forEach(row => {
      let shiftsArray = row.shifts

      if (typeof shiftsArray === 'string') {
        try { shiftsArray = JSON.parse(shiftsArray) } catch (e) { shiftsArray = [] }
      }

      if (Array.isArray(shiftsArray)) {
        const year = currentYear.value
        const month = currentMonth.value
        const totalDays = new Date(year, month + 1, 0).getDate()

        shiftsArray.forEach((item, index) => {
          const dayNum = index + 1
          if (dayNum <= totalDays) {
            const dayStr = dayNum < 10 ? '0' + dayNum : '' + dayNum
            const monthStr = (month + 1) < 10 ? '0' + (month + 1) : '' + (month + 1)
            const dateKey = `${year}-${monthStr}-${dayStr}`

            const schichtVal = typeof item === 'object' && item !== null ? item.schicht : item
            const ortVal = typeof item === 'object' && item !== null ? item.ort : '-'

            if (!schichtVal || schichtVal.toLowerCase() === 'frei') {
              // Frei
            } else if (schichtVal.toLowerCase().includes('urlaub')) {
              map[dateKey] = { vacation: true, hours: 0, ort: '-' }
            } else {
              let hoursCalc = 8
              if (schichtVal.includes('-')) {
                const parts = schichtVal.split('-')
                const startHour = parseInt(parts[0].trim().split(':')[0])
                const endHour = parseInt(parts[1].trim().split(':')[0])
                hoursCalc = endHour >= startHour ? endHour - startHour : (24 - startHour) + endHour
              }

              map[dateKey] = {
                badge: "KH",
                class: "badge-kh",
                title: "Regeldienst",
                time: schichtVal,
                ort: ortVal,
                hours: hoursCalc,
                isNight: schichtVal.includes("19:00"),
                instruction: "Pünktlich zum Dienst erscheinen."
              }
            }
          }
        })
      }
    })
    shiftData.value = map
  } else {
    shiftData.value = {}
  }
}

const toggleLightMode = () => {
  isLightMode.value = !isLightMode.value
  if (isLightMode.value) {
    document.body.classList.add('light-theme')
  } else {
    document.body.classList.remove('light-theme')
  }
}

const closeMobileMenu = () => {
  if (window.innerWidth <= 768) {
    isMobileMenuOpen.value = false
  }
}

const checkScreenSize = () => {
  isMobile.value = window.innerWidth <= 768
  if (isMobile.value && viewMode.value === 'landscape') {
    viewMode.value = 'grid'
  }
}

onMounted(async () => {
  checkScreenSize()
  window.addEventListener('resize', checkScreenSize)
  document.body.style.backgroundColor = '#0b0f19'
  await fetchUserDataAndSchedules()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScreenSize)
})

const changeMonth = async (delta) => {
  currentMonth.value += delta
  if (currentMonth.value > 11) {
    currentMonth.value = 0
    currentYear.value++
  } else if (currentMonth.value < 0) {
    currentMonth.value = 11
    currentYear.value--
  }
  await fetchUserDataAndSchedules()
}

const openDetails = (day) => { selectedDay.value = day }
const closeDetails = () => { selectedDay.value = null }

const monthOffset = computed(() => {
  const firstDayObj = new Date(currentYear.value, currentMonth.value, 1)
  let dayIndex = firstDayObj.getDay() - 1
  if (dayIndex < 0) dayIndex = 6
  return dayIndex
})

const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate()

  const days = []
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayStr = day < 10 ? '0' + day : '' + day
    const monthStr = (month + 1) < 10 ? '0' + (month + 1) : '' + (month + 1)
    const dateKey = `${year}-${monthStr}-${dayStr}`
    const dateObj = new Date(year, month, day)

    let dayIndex = dateObj.getDay() - 1
    if (dayIndex < 0) dayIndex = 6
    const dayName = daysOfWeekNames[dayIndex]
    const isWeekend = dayIndex === 5 || dayIndex === 6

    const shift = shiftData.value[dateKey]

    let cardClass = "day-card"
    if (shift) {
      if (shift.vacation) cardClass += " vacation"
      else if (shift.isNight) cardClass += " night-shift-card"
      else cardClass += " day-shift-card"
    } else {
      cardClass += " off-day"
    }

    days.push({ dayNum: day, dayName, dateKey, shift, cardClass, isWeekend })
  }
  return days
})

const currentMonthHours = computed(() => {
  return calendarDays.value.reduce((total, day) => total + (day.shift?.hours || 0), 0)
})

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

:global(body) {
  margin: 0;
  padding: 0;
  background: #0b0f19;
  color: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
}

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
  width: 100%;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info-link { text-decoration: none; }
.user-info { display: flex; align-items: center; gap: 10px; }
.avatar-icon {
  width: 38px; height: 38px; background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1rem; color: #fff; flex-shrink: 0;
}
.user-details { display: flex; flex-direction: column; text-align: left; }
.user-name { font-size: 0.85rem; font-weight: 600; color: #f8fafc; white-space: nowrap; }
.user-role { font-size: 0.7rem; color: #94a3b8; }

.menu-toggle { display: none; background: none; border: none; font-size: 1.4rem; color: #f8fafc; cursor: pointer; padding: 6px; }

.nav-buttons {
  display: flex !important;
  gap: 10px;
  align-items: center;
}

.btn-nav {
  padding: 8px 14px; background: rgba(255, 255, 255, 0.05); color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; text-decoration: none;
  font-size: 0.85rem; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;
}
.btn-nav.active { background: #2563eb; border-color: #3b82f6; color: #fff; }
.btn-logout { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: rgba(239, 68, 68, 0.2); cursor: pointer; }

.app-main {
  width: 100%;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hours-overview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; }
.hours-card {
  background: transparent; padding: 10px 12px; border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12); display: flex; align-items: center; gap: 8px; text-align: left;
}
.card-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; }
.card-icon.blue { background: rgba(37, 99, 235, 0.2); color: #60a5fa; }
.card-icon.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.card-icon.orange { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
.hours-info span { display: block; font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
.hours-info strong { font-size: 1.05rem; font-weight: 700; color: #f8fafc; }

.calendar-controls {
  display: flex; justify-content: space-between; align-items: center;
  background: transparent; padding: 4px 0; border: none; gap: 10px; width: 100%;
}
.month-nav { display: flex; align-items: center; gap: 8px; }
.month-title { font-size: 1rem; font-weight: 700; }

.view-switch { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.05); padding: 4px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); align-items: center; }
.btn-switch { padding: 6px 10px; font-size: 0.78rem; border: none; background: transparent; color: #94a3b8; border-radius: 6px; font-weight: 600; cursor: pointer; }
.btn-switch.active { background: #2563eb; color: #fff; }

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  width: 100%;
}

.day-card {
  background: #131c2e;
  border-radius: 10px;
  padding: 10px;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease;
}

.day-card:active { transform: scale(0.98); }
.day-card.offset-day { background: transparent; border: none; cursor: default; pointer-events: none; }

.day-card.day-shift-card { border-color: rgba(56, 189, 248, 0.6); background: #0c273d; }
.day-card.night-shift-card { border-color: rgba(168, 85, 247, 0.6); background: #24133b; }
.day-card.vacation { border-color: rgba(16, 185, 129, 0.6); background: #0c3322; }

.day-card.off-day {
  background: #3b181b;
  border: 1px solid rgba(239, 68, 68, 0.6);
}

.day-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #94a3b8; margin-bottom: 6px; }
.day-number { font-weight: 700; color: #f8fafc; font-size: 0.95rem; }
.day-name { font-size: 0.72rem; text-transform: uppercase; font-weight: 600; }

.day-body { display: flex; flex-direction: column; gap: 5px; }
.shift-top-row { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }

.shift-badge { padding: 4px 6px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.badge-drt { background: rgba(34, 197, 94, 0.35); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.6); }
.badge-kh { background: rgba(56, 189, 248, 0.35); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.6); }
.badge-kps { background: rgba(168, 85, 247, 0.35); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.6); }
.badge-vacation { background: rgba(16, 185, 129, 0.35); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.6); width: 100%; text-align: center; padding: 5px; }

.badge-off {
  background: rgba(239, 68, 68, 0.35);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.6);
  font-weight: 700;
  width: 100%;
  text-align: center;
  padding: 5px;
}

.shift-time-badge { font-size: 0.65rem; padding: 3px 6px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px; }
.time-day { background: rgba(56, 189, 248, 0.25); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.5); }
.time-night { background: rgba(168, 85, 247, 0.25); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.5); }
.shift-title { font-size: 0.75rem; color: #cbd5e1; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shift-location { font-size: 0.7rem; color: #60a5fa; font-weight: 600; margin-top: 2px; }

.calendar-grid.list-view { grid-template-columns: 1fr !important; gap: 8px; }
.list-view .day-card { min-height: 56px; flex-direction: row; align-items: center; justify-content: space-between; padding: 10px 14px; }
.list-view .day-header { gap: 12px; margin-bottom: 0; width: 25%; justify-content: flex-start; }
.list-view .day-body { flex-direction: row; align-items: center; gap: 15px; width: 75%; justify-content: flex-end; }
.list-view .shift-top-row { align-items: center; }
.list-view .shift-details { text-align: right; display: flex; align-items: center; gap: 10px; }

.list-view .day-card.off-day .day-body { justify-content: center; }
.list-view .day-card.off-day .badge-off { width: auto; min-width: 120px; margin: 0 auto; }

.landscape-fullscreen-container {
  width: 100%;
  overflow-x: hidden;
}
.landscape-table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
  text-align: center;
}
.landscape-table th, .landscape-table td {
  width: calc(100% / 31);
  padding: 8px 1px;
}
.landscape-table th {
  font-size: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-dates th { background: #2563eb; color: #ffffff; font-weight: 700; font-size: 0.75rem; }
.row-dates th.weekend { background: #1d4ed8; }
.row-weekdays th { background: #1e293b; color: #94a3b8; font-weight: 600; font-size: 0.65rem; }

.row-shifts td {
  height: 70px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  vertical-align: middle;
  cursor: pointer;
  overflow: hidden;
  padding: 4px 1px;
}
.row-shifts td.cell-day { background: #0c273d; }
.row-shifts td.cell-night { background: #24133b; }
.row-shifts td.cell-vacation { background: #0c3322; }
.row-shifts td.is-off { background: #3b181b; }

.landscape-badge {
  display: block;
  margin: 0 auto 2px auto;
  font-size: 0.55rem;
  padding: 2px 2px;
  width: 95%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.landscape-time {
  display: block;
  font-size: 0.52rem;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.off-text-landscape {
  font-size: 0.68rem;
  color: #fca5a5;
  font-weight: 700;
}

.modal-overlay {
  position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh;
  background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 16px;
}
.modal-card {
  background: #161e2e; border-radius: 16px; width: 100%; max-width: 420px;
  border: 1px solid rgba(255, 255, 255, 0.15); overflow: hidden; text-align: left;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
}
.modal-header { padding: 16px; background: #0b0f19; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
.modal-header h3 { font-size: 1rem; margin: 0; color: #fff; }
.modal-subtitle { font-size: 0.78rem; color: #94a3b8; }
.btn-close { background: none; border: none; color: #94a3b8; font-size: 1.4rem; cursor: pointer; padding: 4px; }
.modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.detail-row .label { color: #94a3b8; }
.instruction-box { background: #0b0f19; padding: 14px; border-radius: 10px; border-left: 3px solid #3b82f6; margin-top: 4px; }
.instruction-box h4 { font-size: 0.85rem; color: #60a5fa; margin: 0 0 6px 0; }
.instruction-box p { font-size: 0.85rem; color: #cbd5e1; margin: 0; line-height: 1.4; }
.status-info { padding: 14px; border-radius: 10px; font-size: 0.88rem; display: flex; gap: 10px; align-items: center; }
.status-info.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.status-info.gray { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
.modal-footer { padding: 14px 18px; background: #0b0f19; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.btn-primary { padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }

:global(body.light-theme) {
  background: #f4f6f9 !important;
  color: #111111 !important;
}

:global(body.light-theme) .app-header {
  background: #ffffff !important;
  border-bottom: 1px solid #cbd5e1 !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

:global(body.light-theme) .user-name,
:global(body.light-theme) .month-title,
:global(body.light-theme) .day-number,
:global(body.light-theme) h3,
:global(body.light-theme) .hours-info strong,
:global(body.light-theme) .hours-info span {
  color: #000000 !important;
}

:global(body.light-theme) .user-role,
:global(body.light-theme) .day-header {
  color: #000000 !important;
  font-weight: 700;
}

:global(body.light-theme) .menu-toggle {
  color: #000000 !important;
}

:global(body.light-theme) .nav-buttons {
  background: #ffffff;
  border-bottom: 1px solid #cbd5e1;
}

:global(body.light-theme) .btn-nav {
  background: #f1f5f9;
  color: #000000;
  border: 1px solid #cbd5e1;
  font-weight: 700;
}

:global(body.light-theme) .btn-nav.active {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
}

:global(body.light-theme) .btn-logout {
  background: #fee2e2;
  color: #991b1b;
  border-color: #fca5a5;
}

:global(body.light-theme) .hours-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}

:global(body.light-theme) .view-switch {
  background: #e2e8f0;
  border: 1px solid #cbd5e1;
}

:global(body.light-theme) .btn-switch {
  color: #334155;
}

:global(body.light-theme) .btn-switch.active {
  background: #0284c7;
  color: #ffffff;
}

:global(body.light-theme) .day-card {
  background: #ffffff;
  border: 2px solid #64748b;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}

:global(body.light-theme) .day-card.day-shift-card {
  background: #bae6fd;
  border-color: #0284c7;
}

:global(body.light-theme) .day-card.night-shift-card {
  background: #d8b4fe;
  border-color: #7e22ce;
}

:global(body.light-theme) .day-card.vacation {
  background: #bbf7d0;
  border-color: #15803d;
}

:global(body.light-theme) .day-card.off-day {
  background: #fecaca;
  border-color: #b91c1c;
}

:global(body.light-theme) .shift-title {
  color: #000000 !important;
  font-weight: 700;
}

:global(body.light-theme) .time-day {
  background: #7dd3fc;
  color: #0c4a6e;
  border: 1px solid #0284c7;
  font-weight: 700;
}

:global(body.light-theme) .time-night {
  background: #c084fc;
  color: #3b0764;
  border: 1px solid #7e22ce;
  font-weight: 700;
}

:global(body.light-theme) .badge-off {
  background: #f87171;
  color: #450a0a;
  border: 1px solid #b91c1c;
  font-weight: 800;
}

:global(body.light-theme) .badge-vacation {
  background: #4ade80;
  color: #052e16;
  border: 1px solid #15803d;
  font-weight: 800;
}

:global(body.light-theme) .badge-drt {
  background: #4ade80;
  color: #052e16;
  border: 1px solid #15803d;
  font-weight: 800;
}

:global(body.light-theme) .badge-kh {
  background: #38bdf8;
  color: #082f49;
  border: 1px solid #0284c7;
  font-weight: 800;
}

:global(body.light-theme) .badge-kps {
  background: #c084fc;
  color: #3b0764;
  border: 1px solid #7e22ce;
  font-weight: 800;
}

:global(body.light-theme) .landscape-table th,
:global(body.light-theme) .landscape-table td {
  border-color: #64748b;
}

:global(body.light-theme) .row-dates th {
  background: #0284c7;
  color: #ffffff;
}

:global(body.light-theme) .row-dates th.weekend {
  background: #0369a1;
}

:global(body.light-theme) .row-weekdays th {
  background: #cbd5e1;
  color: #000000;
  font-weight: 700;
}

:global(body.light-theme) .row-shifts td.cell-day { background: #bae6fd; }
:global(body.light-theme) .row-shifts td.cell-night { background: #d8b4fe; }
:global(body.light-theme) .row-shifts td.cell-vacation { background: #bbf7d0; }
:global(body.light-theme) .row-shifts td.is-off { background: #fecaca; }
:global(body.light-theme) .off-text-landscape { color: #991b1b; font-weight: 800; }

:global(body.light-theme) .modal-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
}

:global(body.light-theme) .modal-header,
:global(body.light-theme) .modal-footer {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

:global(body.light-theme) .detail-row {
  border-bottom: 1px solid #e2e8f0;
}

:global(body.light-theme) .detail-row .label {
  color: #000000;
  font-weight: 600;
}

:global(body.light-theme) .instruction-box {
  background: #f1f5f9;
  border-left-color: #0284c7;
}

:global(body.light-theme) .instruction-box h4 {
  color: #0284c7;
}

:global(body.light-theme) .instruction-box p {
  color: #000000;
}

@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .menu-toggle { display: block; }
  .nav-buttons {
    display: none !important;
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: rgba(15, 23, 42, 0.98);
    backdrop-filter: blur(12px);
    flex-direction: column;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    gap: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  }
  .nav-buttons.show { display: flex !important; }
  .btn-nav { width: 100%; justify-content: flex-start; padding: 12px 14px; }
  .hours-overview { grid-template-columns: 1fr; gap: 8px; }
  .calendar-grid { grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .day-card { min-height: 80px; padding: 6px; }
  .shift-title { display: none; }
  .calendar-grid.list-view { grid-template-columns: 1fr !important; }
  .list-view .day-card { min-height: 50px; padding: 8px 10px; }
  .list-view .day-header { width: 30%; }
  .list-view .day-body { width: 70%; }
  .list-view .shift-title { display: block; font-size: 0.7rem; }
}
</style>
