<template>
  <AppShell eyebrow="Kommunikation" title="Nachrichten" description="Direkte Nachrichten und Mitteilungen aus der Dienstplan-Verwaltung.">
    <section class="message-layout">
      <article class="compose-card panel"><header><span><i class="fa-solid fa-paper-plane"></i></span><div><p>NEUE NACHRICHT</p><h2>{{ isAdmin ? 'Team informieren' : 'Verwaltung kontaktieren' }}</h2></div></header><div class="compose-content"><label><span>Empfänger</span><select v-model="draft.recipient_id"><option v-if="isAdmin" value="">An alle Mitarbeiter</option><option v-for="recipient in recipients" :key="recipient.id" :value="recipient.id">{{ recipient.name }}<template v-if="isAdmin"> · {{ recipient.role === 'admin' ? 'Admin' : 'Mitarbeiter' }}</template></option></select></label><label><span>Betreff</span><input v-model.trim="draft.subject" maxlength="140" placeholder="z. B. Neuer Dienstplan veröffentlicht"></label><label><span>Nachricht</span><textarea v-model.trim="draft.body" rows="7" maxlength="5000" placeholder="Deine Nachricht …"></textarea></label><p v-if="message" class="feedback" :class="message.type"><i class="fa-solid" :class="message.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>{{ message.text }}</p><button class="send-button" type="button" :disabled="isSending || !draft.subject || !draft.body || (!draft.recipient_id && !isAdmin)" @click="sendMessage"><i class="fa-solid" :class="isSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'"></i>{{ isSending ? 'Wird gesendet …' : 'Nachricht senden' }}</button></div></article>
      <article class="inbox-card panel"><header><div><p>POSTEINGANG</p><h2>Aktuelle Nachrichten</h2></div><button type="button" @click="loadData"><i class="fa-solid fa-rotate-right"></i></button></header><div v-if="isLoading" class="inbox-state"><i class="fa-solid fa-spinner fa-spin"></i> Wird geladen …</div><div v-else-if="!messages.length" class="inbox-state"><i class="fa-regular fa-envelope-open"></i> Noch keine Nachrichten.</div><div v-else class="message-list"><article v-for="item in messages" :key="item.id" class="message-item" :class="{ unread: !item.read_at && item.recipient_id === currentUserId }" @click="markRead(item)"><span class="message-avatar">{{ initials(authorName(item)) }}</span><div><header><h3>{{ item.subject }}</h3><time>{{ formatDate(item.created_at) }}</time></header><p class="from">{{ authorName(item) }}<template v-if="item.recipient_id === null"> · Mitteilung an alle</template></p><p class="body">{{ item.body }}</p></div><i v-if="!item.read_at && item.recipient_id === currentUserId" class="fa-solid fa-circle unread-dot"></i></article></div></article>
    </section>
  </AppShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import AppShell from '../components/AppShell.vue'
import { supabase } from '../config/supabase.js'
import { useCurrentUser } from '../composables/useCurrentUser.js'

const { isAdmin, loadCurrentUser } = useCurrentUser()
const currentUserId = ref('')
const recipients = ref([])
const messages = ref([])
const isLoading = ref(true)
const isSending = ref(false)
const message = ref(null)
const draft = ref({ recipient_id: '', subject: '', body: '' })
const recipientMap = computed(() => new Map(recipients.value.map((recipient) => [recipient.id, recipient])))

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'D'
const formatDate = (date) => new Intl.DateTimeFormat('de-AT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
const authorName = (item) => item.sender_id === currentUserId.value ? 'Du' : recipientMap.value.get(item.sender_id)?.name || 'Dienstplan-Verwaltung'

const loadData = async () => {
  isLoading.value = true
  try {
    const [{ data: { user } }, { data: recipientRows, error: recipientError }, { data: messageRows, error: messagesError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('message_recipients'),
      supabase.from('messages').select('id, sender_id, recipient_id, subject, body, read_at, created_at').order('created_at', { ascending: false }).limit(100)
    ])
    if (recipientError || messagesError) throw recipientError || messagesError
    currentUserId.value = user?.id || ''
    recipients.value = recipientRows || []
    messages.value = messageRows || []
    if (!draft.value.recipient_id && !isAdmin.value) draft.value.recipient_id = recipients.value[0]?.id || ''
  } catch { message.value = { type: 'error', text: 'Nachrichten konnten nicht geladen werden.' } } finally { isLoading.value = false }
}

const sendMessage = async () => {
  isSending.value = true; message.value = null
  try {
    const { error } = await supabase.from('messages').insert({ sender_id: currentUserId.value, recipient_id: draft.value.recipient_id || null, subject: draft.value.subject, body: draft.value.body })
    if (error) throw error
    draft.value = { recipient_id: isAdmin.value ? '' : recipients.value[0]?.id || '', subject: '', body: '' }
    message.value = { type: 'success', text: 'Nachricht gesendet. Der Empfänger wurde in der App benachrichtigt.' }
    await loadData()
  } catch { message.value = { type: 'error', text: 'Nachricht konnte nicht gesendet werden.' } } finally { isSending.value = false }
}

const markRead = async (item) => {
  if (item.read_at || item.recipient_id !== currentUserId.value) return
  const { error } = await supabase.rpc('mark_message_read', { p_message_id: item.id })
  if (!error) item.read_at = new Date().toISOString()
}

onMounted(async () => { await loadCurrentUser(); await loadData() })
</script>

<style scoped>
.message-layout { display: grid; grid-template-columns: minmax(300px, .85fr) minmax(0, 1.25fr); align-items: start; gap: 20px; }.panel { border: 1px solid var(--line); border-radius: 20px; background: var(--surface-card); box-shadow: var(--card-shadow); }.compose-card, .inbox-card { overflow: hidden; }.compose-card > header, .inbox-card > header { display: flex; align-items: center; gap: 12px; padding: 22px; border-bottom: 1px solid var(--line); }.compose-card > header > span { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.15); }.compose-card p, .inbox-card p { margin: 0; }.compose-card header p, .inbox-card header p { color: var(--text-muted); font-size: .63rem; font-weight: 800; letter-spacing: .1em; }.compose-card h2, .inbox-card h2 { margin: 4px 0 0; color: var(--text-heading); font-size: 1.03rem; }.compose-content { display: grid; gap: 16px; padding: 22px; }.compose-content label { display: grid; gap: 7px; color: var(--text-muted); font-size: .68rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }.compose-content input, .compose-content select, .compose-content textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: 10px; outline: 0; color: var(--text-primary); background: var(--surface-raised); font: inherit; text-transform: none; }.compose-content input, .compose-content select { min-height: 42px; padding: 0 11px; }.compose-content textarea { padding: 11px; resize: vertical; }.send-button { min-height: 45px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 11px; color: #fff; background: linear-gradient(135deg,#2563eb,#3b82f6); font-size: .8rem; font-weight: 800; cursor: pointer; }.send-button:disabled { opacity: .65; cursor: wait; }.feedback { display: flex; gap: 8px; align-items: center; padding: 10px 11px; border-radius: 10px; font-size: .73rem; line-height: 1.35; }.feedback.success { color: #86efac; background: rgba(22,163,74,.12); }.feedback.error { color: #fda4af; background: rgba(244,63,94,.12); }.inbox-card > header { justify-content: space-between; }.inbox-card > header button { width: 34px; height: 34px; border: 0; border-radius: 9px; color: var(--brand-light); background: rgba(37,99,235,.13); cursor: pointer; }.inbox-state { min-height: 290px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--text-muted); font-size: .8rem; }.message-list { display: grid; }.message-item { position: relative; display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 12px; padding: 17px 20px; border-bottom: 1px solid var(--line); cursor: pointer; }.message-item:hover { background: var(--surface-soft); }.message-item.unread { background: rgba(37,99,235,.055); }.message-avatar { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; color: #bfdbfe; background: rgba(37,99,235,.16); font-size: .62rem; font-weight: 900; }.message-item header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }.message-item h3 { overflow: hidden; margin: 0; color: var(--text-heading); font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }.message-item time { flex: 0 0 auto; color: var(--text-muted); font-size: .58rem; }.message-item .from { margin-top: 4px; color: var(--brand-light); font-size: .64rem; font-weight: 700; }.message-item .body { display: -webkit-box; overflow: hidden; margin-top: 6px; color: var(--text-secondary); font-size: .72rem; line-height: 1.4; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }.unread-dot { position: absolute; right: 9px; top: 14px; color: #60a5fa; font-size: .45rem; }
@media (max-width: 820px) { .message-layout { grid-template-columns: 1fr; } }
@media (max-width: 500px) { .compose-card > header, .compose-content, .inbox-card > header { padding: 18px; }.message-item { padding: 15px; }.message-item time { font-size: .52rem; } }
</style>
