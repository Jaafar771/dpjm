<template>
  <AppShell eyebrow="Arbeitsalltag" :title="isAdmin ? 'Ausrüstung verwalten' : 'Meine Ausrüstung'" description="Ausgabe, Zustand und Prüftermine bleiben für das Team transparent.">
    <section v-if="isAdmin" class="create-panel panel"><header><span><i class="fa-solid fa-briefcase"></i></span><div><p>NEUER ARTIKEL</p><h2>Ausrüstung ausgeben</h2></div></header><div class="create-fields"><input v-model.trim="draft.name" placeholder="Bezeichnung"><input v-model.trim="draft.category" placeholder="Kategorie"><input v-model.trim="draft.serial_number" placeholder="Seriennummer (optional)"><select v-model="draft.assigned_to"><option value="">Nicht zugeteilt</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select><input v-model="draft.next_inspection_date" type="date"><button type="button" :disabled="isSaving || !draft.name" @click="createEquipment"><i class="fa-solid" :class="isSaving ? 'fa-spinner fa-spin' : 'fa-plus'"></i> Hinzufügen</button></div></section>
    <p v-if="message" class="feedback" :class="message.type"><i class="fa-solid" :class="message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>{{ message.text }}</p>
    <section class="equipment-panel panel"><header><div><p>INVENTAR</p><h2>{{ isAdmin ? 'Ausrüstung & Zuordnung' : 'Dir zugeteilt' }}</h2><span>{{ equipment.length }} Artikel</span></div><button type="button" @click="loadEquipment"><i class="fa-solid fa-rotate-right"></i></button></header><div v-if="isLoading" class="state"><i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …</div><div v-else-if="!equipment.length" class="state"><i class="fa-solid fa-briefcase"></i> Keine Ausrüstung vorhanden.</div><div v-else class="equipment-list"><article v-for="item in equipment" :key="item.id"><span class="item-icon" :class="`status-${item.status}`"><i class="fa-solid fa-toolbox"></i></span><div class="item-copy"><h3>{{ item.name }}</h3><p>{{ item.category }}<template v-if="item.serial_number"> · {{ item.serial_number }}</template></p><small><i class="fa-regular fa-calendar"></i> Prüfung: {{ item.next_inspection_date ? formatDate(item.next_inspection_date) : 'nicht hinterlegt' }}</small></div><template v-if="isAdmin"><select v-model="item.assigned_to" @change="saveItem(item)"><option :value="null">Nicht zugeteilt</option><option v-for="employee in employees" :key="employee.id" :value="employee.id">{{ employee.name }}</option></select><select v-model="item.status" @change="saveItem(item)"><option value="ready">Einsatzbereit</option><option value="attention">Prüfung nötig</option><option value="issue">Defekt</option></select><button class="delete" type="button" title="Artikel löschen" @click="deleteItem(item)"><i class="fa-solid fa-trash"></i></button></template><span v-else class="state-badge" :class="`state-${item.status}`">{{ stateLabel(item.status) }}</span></article></div></section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const { isAdmin, loadCurrentUser } = useCurrentUser()
const currentUserId = ref('')
const equipment = ref([])
const employees = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const message = ref(null)
const draft = ref({ name: '', category: 'Allgemein', serial_number: '', assigned_to: '', next_inspection_date: '' })
const formatDate = (date) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`))
const stateLabel = (state) => ({ ready: 'Einsatzbereit', attention: 'Prüfung nötig', issue: 'Defekt' }[state] || state)

const loadEquipment = async () => {
  isLoading.value = true
  try {
    const query = supabase.from('equipment').select('id, name, category, serial_number, status, next_inspection_date, assigned_to, notes, created_at').order('name')
    if (!isAdmin.value) query.eq('assigned_to', currentUserId.value)
    const [{ data, error }, employeeResult] = await Promise.all([query, isAdmin.value ? supabase.from('app_users').select('id, name').eq('role', 'employee').order('name') : Promise.resolve({ data: [] })])
    if (error) throw error
    equipment.value = data || []; employees.value = employeeResult.data || []
  } catch { message.value = { type: 'error', text: 'Ausrüstung konnte nicht geladen werden.' } } finally { isLoading.value = false }
}

const createEquipment = async () => {
  isSaving.value = true; message.value = null
  try {
    const { error } = await supabase.from('equipment').insert({ ...draft.value, assigned_to: draft.value.assigned_to || null, next_inspection_date: draft.value.next_inspection_date || null })
    if (error) throw error
    draft.value = { name: '', category: 'Allgemein', serial_number: '', assigned_to: '', next_inspection_date: '' }
    message.value = { type: 'success', text: 'Ausrüstung gespeichert. Bei Zuteilung wurde der Mitarbeiter benachrichtigt.' }
    await loadEquipment()
  } catch { message.value = { type: 'error', text: 'Ausrüstung konnte nicht angelegt werden.' } } finally { isSaving.value = false }
}

const saveItem = async (item) => {
  try { const { error } = await supabase.from('equipment').update({ assigned_to: item.assigned_to || null, status: item.status }).eq('id', item.id); if (error) throw error; message.value = { type: 'success', text: 'Änderung gespeichert.' } } catch { message.value = { type: 'error', text: 'Änderung konnte nicht gespeichert werden.' } }
}
const deleteItem = async (item) => {
  if (!window.confirm(`„${item.name}“ wirklich löschen?`)) return
  try { const { error } = await supabase.from('equipment').delete().eq('id', item.id); if (error) throw error; equipment.value = equipment.value.filter((row) => row.id !== item.id) } catch { message.value = { type: 'error', text: 'Artikel konnte nicht gelöscht werden.' } }
}

onMounted(async () => { await loadCurrentUser(); const { data: { user } } = await supabase.auth.getUser(); currentUserId.value = user?.id || ''; await loadEquipment() })
</script>

<style scoped>
.panel { overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.create-panel { margin-bottom: 20px; }.create-panel > header { display: flex; align-items: center; gap: 12px; padding: 20px 23px; border-bottom: 1px solid var(--line); }.create-panel header > span { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.15); }.create-panel p, .equipment-panel p { margin: 0; }.create-panel header p, .equipment-panel header p { color: var(--text-muted); font-size: .63rem; font-weight: 800; letter-spacing: .1em; }.create-panel h2, .equipment-panel h2 { margin: 4px 0 0; color: var(--text-heading); font-size: 1.03rem; }.create-fields { display: grid; grid-template-columns: 1.2fr .85fr 1fr 1.1fr .85fr auto; gap: 9px; padding: 18px 23px; }.create-fields input, .create-fields select, .equipment-list select { min-height: 40px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: var(--text-primary); background: var(--surface-raised); font: inherit; font-size: .72rem; }.create-fields button { min-height: 40px; padding: 0 12px; border: 0; border-radius: 10px; color: #fff; background: #2563eb; font-size: .7rem; font-weight: 800; cursor: pointer; }.create-fields button:disabled { opacity: .65; cursor: wait; }.feedback { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 11px 12px; border-radius: 10px; font-size: .75rem; }.feedback.success { color: #86efac; background: rgba(22,163,74,.12); }.feedback.error { color: #fda4af; background: rgba(244,63,94,.12); }.equipment-panel > header { display: flex; justify-content: space-between; align-items: center; padding: 23px 25px; border-bottom: 1px solid var(--line); }.equipment-panel header span { display: block; margin-top: 4px; color: var(--text-secondary); font-size: .68rem; }.equipment-panel > header button { width: 34px; height: 34px; border: 0; border-radius: 9px; color: var(--brand-light); background: rgba(37,99,235,.13); cursor: pointer; }.state { min-height: 250px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--text-muted); font-size: .8rem; }.equipment-list { display: grid; }.equipment-list article { display: grid; grid-template-columns: 42px minmax(0,1fr) 155px 125px 35px; align-items: center; gap: 12px; padding: 15px 23px; border-bottom: 1px solid var(--line); }.item-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 12px; }.status-ready { color: #6ee7b7; background: rgba(16,185,129,.14); }.status-attention { color: #fcd34d; background: rgba(245,158,11,.14); }.status-issue { color: #fda4af; background: rgba(244,63,94,.13); }.item-copy h3 { margin: 0; color: var(--text-heading); font-size: .82rem; }.item-copy p, .item-copy small { margin: 4px 0 0; color: var(--text-secondary); font-size: .7rem; }.item-copy small { color: var(--text-muted); font-size: .63rem; }.delete { width: 35px; height: 35px; display: grid; place-items: center; border: 0; border-radius: 9px; color: #fda4af; background: transparent; cursor: pointer; }.delete:hover { background: rgba(244,63,94,.11); }.state-badge { justify-self: end; padding: 6px 8px; border-radius: 7px; font-size: .64rem; font-weight: 800; }
@media (max-width: 1050px) { .create-fields { grid-template-columns: 1fr 1fr 1fr; }.equipment-list article { grid-template-columns: 42px minmax(0,1fr) 140px 35px; }.equipment-list article > select:nth-of-type(2) { grid-column: 3; grid-row: 2; } }
@media (max-width: 620px) { .create-panel > header, .create-fields, .equipment-panel > header { padding: 18px; }.create-fields { grid-template-columns: 1fr; }.equipment-list article { grid-template-columns: 40px minmax(0,1fr) 34px; padding: 14px; }.equipment-list article > select { grid-column: 2; width: 100%; }.equipment-list article > select:nth-of-type(2) { grid-column: 2; grid-row: auto; }.delete { grid-column: 3; grid-row: 1 / span 3; }.state-badge { grid-column: 2; justify-self: start; } }
</style>
