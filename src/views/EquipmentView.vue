<template>
  <AppShell eyebrow="Arbeitsmittel" title="Meine Ausrüstung" description="Behalte Ausgabe, Zustand und Rückgabetermine deiner Arbeitsmittel im Blick.">
    <template #actions>
      <button class="report-button" type="button" @click="reportOpen = true"><i class="fa-solid fa-triangle-exclamation"></i> Problem melden</button>
    </template>

    <section class="equipment-summary" aria-label="Ausrüstungsübersicht">
      <article><span class="summary-icon summary-icon--blue"><i class="fa-solid fa-briefcase"></i></span><div><span>Ausgegeben</span><strong>{{ equipment.length }} <small>Artikel</small></strong></div></article>
      <article><span class="summary-icon summary-icon--green"><i class="fa-solid fa-circle-check"></i></span><div><span>Einsatzbereit</span><strong>{{ readyCount }} <small>Artikel</small></strong></div></article>
      <article><span class="summary-icon summary-icon--amber"><i class="fa-regular fa-calendar"></i></span><div><span>Nächste Prüfung</span><strong>{{ nextCheck }}</strong></div></article>
    </section>

    <section class="equipment-panel">
      <header class="equipment-toolbar">
        <div><p>BESTAND</p><h2>Deine Arbeitsmittel</h2></div>
        <div class="filters" aria-label="Ausrüstung filtern">
          <button v-for="filter in filters" :key="filter.id" type="button" :class="{ active: activeFilter === filter.id }" @click="activeFilter = filter.id">{{ filter.label }}</button>
        </div>
      </header>

      <div class="equipment-list">
        <article v-for="item in filteredEquipment" :key="item.id" class="equipment-item">
          <span class="equipment-icon" :class="`equipment-icon--${item.tone}`"><i class="fa-solid" :class="item.icon"></i></span>
          <div class="equipment-main"><h3>{{ item.name }}</h3><p>{{ item.detail }}</p><small><i class="fa-regular fa-calendar"></i> Prüfung: {{ item.checkDate }}</small></div>
          <span class="status" :class="`status--${item.status}`"><i class="fa-solid" :class="item.status === 'ready' ? 'fa-circle-check' : item.status === 'attention' ? 'fa-clock' : 'fa-triangle-exclamation'"></i>{{ statusLabel(item.status) }}</span>
          <button type="button" class="more-button" :aria-label="`${item.name} auswählen`" @click="selectedItem = item"><i class="fa-solid fa-ellipsis"></i></button>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="reportOpen || selectedItem" class="dialog-backdrop" @click.self="closeDialog">
        <form class="report-dialog" @submit.prevent="sendReport">
          <header><div><p>{{ selectedItem ? 'AUSRÜSTUNGSDETAILS' : 'RÜCKMELDUNG' }}</p><h2>{{ selectedItem ? selectedItem.name : 'Problem mit Ausrüstung melden' }}</h2></div><button type="button" aria-label="Schließen" @click="closeDialog"><i class="fa-solid fa-xmark"></i></button></header>
          <template v-if="selectedItem"><div class="detail-grid"><span>Ausgabe</span><strong>{{ selectedItem.detail }}</strong><span>Zustand</span><strong>{{ statusLabel(selectedItem.status) }}</strong><span>Prüftermin</span><strong>{{ selectedItem.checkDate }}</strong></div><button class="dialog-primary" type="button" @click="selectedItem = null; reportOpen = true">Problem zu diesem Artikel melden</button></template>
          <template v-else><p class="dialog-copy">Beschreibe kurz, was fehlt, beschädigt ist oder geprüft werden soll. Die Rückmeldung wird zum Versenden an das Büro vorbereitet.</p><label>Betreff<input v-model.trim="report.subject" required placeholder="z. B. Funkgerät defekt"></label><label>Beschreibung<textarea v-model.trim="report.message" required rows="4" placeholder="Was ist passiert?"></textarea></label><p v-if="reportMessage" class="dialog-success"><i class="fa-solid fa-circle-check"></i>{{ reportMessage }}</p><button class="dialog-primary" type="submit">Rückmeldung vorbereiten</button></template>
        </form>
      </div>
    </Teleport>
  </AppShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppShell from '../components/AppShell.vue'

const activeFilter = ref('all')
const selectedItem = ref(null)
const reportOpen = ref(false)
const reportMessage = ref('')
const report = ref({ subject: '', message: '' })
const filters = [{ id: 'all', label: 'Alle' }, { id: 'ready', label: 'Einsatzbereit' }, { id: 'attention', label: 'Prüfung fällig' }]
const equipment = [
  { id: 1, name: 'Dienstausweis', detail: 'Persönlich ausgegeben', checkDate: 'laufend gültig', status: 'ready', icon: 'fa-id-card', tone: 'blue' },
  { id: 2, name: 'Funkgerät', detail: 'Gerät 03 · Ladestation', checkDate: '15. November 2026', status: 'ready', icon: 'fa-walkie-talkie', tone: 'violet' },
  { id: 3, name: 'Schlüsselset', detail: 'Standort-Schlüssel', checkDate: 'Rückgabe bei Austritt', status: 'ready', icon: 'fa-key', tone: 'green' },
  { id: 4, name: 'Dienstkleidung', detail: '2 × Oberteil · 1 × Jacke', checkDate: 'Größencheck im Dezember', status: 'attention', icon: 'fa-shirt', tone: 'amber' },
  { id: 5, name: 'Erste-Hilfe-Tasche', detail: 'Mobile Einsatzreserve', checkDate: '12. November 2026', status: 'attention', icon: 'fa-kit-medical', tone: 'red' }
]

const filteredEquipment = computed(() => activeFilter.value === 'all' ? equipment : equipment.filter((item) => item.status === activeFilter.value))
const readyCount = computed(() => equipment.filter((item) => item.status === 'ready').length)
const nextCheck = '12. Nov.'
const statusLabel = (status) => ({ ready: 'Einsatzbereit', attention: 'Prüfung fällig', issue: 'Rückmeldung offen' }[status] || 'Unbekannt')
const closeDialog = () => { selectedItem.value = null; reportOpen.value = false; reportMessage.value = '' }

const sendReport = () => {
  const officeEmail = import.meta.env.VITE_OFFICE_EMAIL?.trim()
  if (officeEmail) {
    const subject = encodeURIComponent(`[Ausrüstung] ${report.value.subject}`)
    const body = encodeURIComponent(report.value.message)
    window.location.href = `mailto:${officeEmail}?subject=${subject}&body=${body}`
    reportMessage.value = 'Deine E-Mail-App wird geöffnet.'
  } else {
    reportMessage.value = 'Die Rückmeldung ist vorbereitet. Die Büro-E-Mail-Adresse muss noch in .env.local hinterlegt werden.'
  }
}
</script>

<style scoped>
.report-button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 14px; border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent); border-radius: 11px; color: #fbbf24; background: color-mix(in srgb, var(--warning) 10%, transparent); font-size: .8rem; font-weight: 800; cursor: pointer; }.report-button:hover { background: color-mix(in srgb, var(--warning) 18%, transparent); }
.equipment-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px; }.equipment-summary article { display: flex; align-items: center; gap: 13px; min-height: 104px; padding: 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface-card); box-shadow: var(--card-shadow); }.summary-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; }.summary-icon--blue { color: #93c5fd; background: rgba(37,99,235,.15); }.summary-icon--green { color: #6ee7b7; background: rgba(16,185,129,.14); }.summary-icon--amber { color: #fcd34d; background: rgba(245,158,11,.14); }.equipment-summary span:not(.summary-icon) { display: block; color: var(--text-muted); font-size: .72rem; font-weight: 700; }.equipment-summary strong { display: block; margin-top: 5px; color: var(--text-heading); font-size: 1.15rem; letter-spacing: -.03em; }.equipment-summary strong small { color: var(--text-secondary); font-size: .7rem; }
.equipment-panel { overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.equipment-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 23px 25px; border-bottom: 1px solid var(--line); }.equipment-toolbar p { margin: 0 0 4px; color: var(--text-muted); font-size: .65rem; font-weight: 800; letter-spacing: .08em; }.equipment-toolbar h2 { margin: 0; color: var(--text-heading); font-size: 1.05rem; }.filters { display: flex; gap: 5px; padding: 4px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-soft); }.filters button { padding: 7px 10px; border: 0; border-radius: 7px; color: var(--text-muted); background: transparent; font-size: .71rem; font-weight: 800; cursor: pointer; }.filters button.active { color: var(--text-heading); background: var(--surface-raised); box-shadow: 0 2px 6px rgba(2,6,23,.1); }
.equipment-list { display: grid; }.equipment-item { display: grid; grid-template-columns: 44px minmax(0,1fr) auto 34px; align-items: center; gap: 14px; padding: 16px 24px; border-bottom: 1px solid var(--line); }.equipment-item:last-child { border-bottom: 0; }.equipment-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 13px; font-size: 1rem; }.equipment-icon--blue { color: #93c5fd; background: rgba(37,99,235,.14); }.equipment-icon--violet { color: #c4b5fd; background: rgba(139,92,246,.14); }.equipment-icon--green { color: #6ee7b7; background: rgba(16,185,129,.14); }.equipment-icon--amber { color: #fcd34d; background: rgba(245,158,11,.14); }.equipment-icon--red { color: #fda4af; background: rgba(244,63,94,.13); }.equipment-main { min-width: 0; }.equipment-main h3 { margin: 0; color: var(--text-heading); font-size: .85rem; }.equipment-main p, .equipment-main small { margin: 4px 0 0; color: var(--text-secondary); font-size: .72rem; }.equipment-main small { color: var(--text-muted); }.equipment-main small i { margin-right: 4px; }.status { display: inline-flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 7px; font-size: .66rem; font-weight: 800; }.status--ready { color: #34d399; background: rgba(16,185,129,.12); }.status--attention { color: #fbbf24; background: rgba(245,158,11,.13); }.status--issue { color: #fb7185; background: rgba(244,63,94,.13); }.more-button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px; color: var(--text-muted); background: transparent; cursor: pointer; }.more-button:hover { color: var(--text-heading); background: var(--surface-soft); }
.dialog-backdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 18px; background: rgba(2,6,23,.62); backdrop-filter: blur(5px); }.report-dialog { width: min(460px, 100%); padding: 22px; border: 1px solid var(--line-strong); border-radius: 19px; color: var(--text-primary); background: var(--surface-card); box-shadow: 0 25px 70px rgba(2,6,23,.32); }.report-dialog header { display: flex; justify-content: space-between; gap: 15px; margin-bottom: 20px; }.report-dialog header p { margin: 0 0 4px; color: var(--text-muted); font-size: .65rem; font-weight: 800; letter-spacing: .07em; }.report-dialog h2 { margin: 0; color: var(--text-heading); font-size: 1.1rem; }.report-dialog header button { width: 33px; height: 33px; border: 0; border-radius: 9px; color: var(--text-secondary); background: var(--surface-soft); cursor: pointer; }.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 15px 0 21px; }.detail-grid span { color: var(--text-muted); font-size: .75rem; }.detail-grid strong { color: var(--text-heading); font-size: .78rem; text-align: right; }.dialog-copy { margin: 0 0 16px; color: var(--text-secondary); font-size: .82rem; line-height: 1.5; }.report-dialog label { display: grid; gap: 7px; margin: 14px 0; color: var(--text-secondary); font-size: .74rem; font-weight: 800; }.report-dialog input, .report-dialog textarea { width: 100%; padding: 10px 11px; border: 1px solid var(--line-strong); border-radius: 10px; color: var(--text-primary); background: var(--surface-input); outline: 0; resize: vertical; }.report-dialog input:focus, .report-dialog textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59,130,246,.14); }.dialog-primary { width: 100%; min-height: 43px; border: 0; border-radius: 10px; color: #fff; background: var(--brand); font-size: .8rem; font-weight: 800; cursor: pointer; }.dialog-success { display: flex; align-items: center; gap: 7px; padding: 10px; border-radius: 9px; color: #34d399; background: rgba(16,185,129,.12); font-size: .76rem; }
@media (max-width: 720px) { .equipment-summary { grid-template-columns: 1fr; gap: 10px; }.equipment-summary article { min-height: 82px; }.equipment-toolbar { align-items: flex-start; flex-direction: column; padding: 18px; }.filters { width: 100%; }.filters button { flex: 1; }.equipment-item { grid-template-columns: 40px minmax(0,1fr) 32px; gap: 11px; padding: 14px 16px; }.equipment-icon { width: 40px; height: 40px; }.equipment-item .status { grid-column: 2; justify-self: start; margin-top: -6px; }.more-button { grid-column: 3; grid-row: 1 / span 2; }.report-button { display: none; } }
</style>
