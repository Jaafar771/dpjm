<template>
  <AppShell eyebrow="Wissen & Regeln" title="Dokumente" description="Alle wichtigen Dienstanweisungen an einem Ort.">
    <section class="documents-panel"><header><div><h2>Aktuelle Unterlagen</h2><p>Dokumente werden von der Verwaltung bereitgestellt.</p></div><span><i class="fa-solid fa-folder-open"></i></span></header><p v-if="message" class="notice"><i class="fa-solid fa-circle-info"></i>{{ message }}</p><div class="document-list"><article v-for="document in documents" :key="document.id" class="document-item"><span class="document-icon"><i class="fa-regular fa-file-pdf"></i></span><div class="document-copy"><h3>{{ document.title }}</h3><p>Aktualisiert {{ document.date }} <span>•</span> {{ document.size }}</p></div><button type="button" @click="openDocument(document)"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Öffnen</span></button></article></div></section>
  </AppShell>
</template>

<script setup>
import { ref } from 'vue'
import AppShell from '../components/AppShell.vue'

const message = ref('')
const documents = [
  { id: 1, title: 'Allgemeine Dienstanweisung', date: '01.01.2026', size: '1,2 MB', link: '' },
  { id: 2, title: 'Sicherheits- & Hygienevorschriften', date: '15.02.2026', size: '850 KB', link: '' },
  { id: 3, title: 'Leitfaden für Nachtdienste & Übergaben', date: '10.05.2026', size: '2,1 MB', link: '' },
  { id: 4, title: 'Notfallplan & Brandschutzordnung', date: '01.07.2026', size: '1,5 MB', link: '' }
]
const openDocument = (document) => {
  if (document.link) { window.open(document.link, '_blank', 'noopener,noreferrer'); return }
  message.value = 'Dieses Dokument wurde von der Verwaltung noch nicht hinterlegt.'
}
</script>

<style scoped>
.documents-panel { overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: rgba(15,27,47,.8); box-shadow: 0 18px 42px rgba(2,6,23,.17); }.documents-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 25px 27px; border-bottom: 1px solid var(--line); }.documents-panel h2 { margin: 0; color: #fff; font-size: 1.06rem; letter-spacing: -.02em; }.documents-panel header p { margin: 5px 0 0; color: var(--text-muted); font-size: .77rem; }.documents-panel header > span { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; color: #bfdbfe; background: rgba(37,99,235,.16); }.notice { display: flex; align-items: center; gap: 8px; margin: 16px 22px 0; padding: 11px 12px; border-radius: 10px; color: #bfdbfe; background: rgba(37,99,235,.1); font-size: .8rem; }.document-list { display: grid; }.document-item { display: flex; align-items: center; gap: 15px; padding: 18px 27px; border-bottom: 1px solid var(--line); transition: background .15s ease; }.document-item:last-child { border-bottom: 0; }.document-item:hover { background: rgba(148,163,184,.04); }.document-icon { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 12px; color: #fda4af; background: rgba(244,63,94,.12); font-size: 1.08rem; }.document-copy { min-width: 0; flex: 1; }.document-copy h3 { margin: 0; color: #e5edf9; font-size: .89rem; }.document-copy p { margin: 5px 0 0; color: var(--text-muted); font-size: .72rem; }.document-copy p span { padding: 0 4px; }.document-item button { display: inline-flex; align-items: center; gap: 7px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 9px; color: #bfdbfe; background: #12223a; font-size: .73rem; font-weight: 700; cursor: pointer; }.document-item button:hover { border-color: rgba(96,165,250,.5); background: #193154; }
@media (max-width: 560px) { .documents-panel > header { padding: 20px; }.document-item { gap: 11px; padding: 15px; }.document-item button span { display: none; }.document-copy h3 { font-size: .81rem; }.document-copy p { font-size: .68rem; }.document-icon { width: 37px; height: 37px; } }
</style>
