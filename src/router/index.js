import { createRouter, createWebHashHistory } from 'vue-router'

import LoginView from '../views/UsernameSignInView.vue'
import DashboardView from '../views/DashboardView.vue'
import RequestsView from '../views/RequestsView.vue'
import EquipmentView from '../views/EquipmentDataView.vue'
import DocumentsView from '../views/DocumentsView.vue'
import ContactView from '../views/ContactView.vue'
import PayslipsView from '../views/PayslipsDataView.vue'
import ProfileSettingsView from '../views/ProfileSettingsView.vue'
import AdminView from '../views/AdminView.vue'
import PlanningCalendarView from '../views/PlanningCalendarView.vue'
import ManualSchedulingView from '../views/ManualSchedulingView.vue'
import AllCalendarView from '../views/AllCalendarView.vue'
import PreferencesView from '../views/PreferencesView.vue'
import MessagesView from '../views/MessagesView.vue'
import { supabase } from '../config/supabase.js'

const protectedRoute = { requiresAuth: true }
const employeeRoute = { requiresAuth: true, employeeOnly: true }

const routes = [
  { path: '/', name: 'login', component: LoginView },
  { path: '/home', name: 'home', component: DashboardView, meta: employeeRoute },
  { path: '/antraege', name: 'antraege', component: RequestsView, meta: employeeRoute },
  { path: '/ausruestung', name: 'ausruestung', component: EquipmentView, meta: protectedRoute },
  { path: '/anweisungen', name: 'anweisungen', component: DocumentsView, meta: employeeRoute },
  { path: '/kontakt', name: 'kontakt', component: ContactView, meta: employeeRoute },
  { path: '/gehalt', name: 'gehalt', component: PayslipsView, meta: protectedRoute },
  { path: '/praeferenzen', name: 'praeferenzen', component: PreferencesView, meta: protectedRoute },
  { path: '/nachrichten', name: 'nachrichten', component: MessagesView, meta: protectedRoute },
  { path: '/profile', name: 'profile', component: ProfileSettingsView, meta: protectedRoute },
  { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/dienstplanung', name: 'manual-scheduling', component: ManualSchedulingView, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/ki-dienstplanung', name: 'ai-scheduling', component: PlanningCalendarView, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/kalender', name: 'all-calendar', component: AllCalendarView, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/:pathMatch(.*)*', redirect: { name: 'login' } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: (_to, _from, savedPosition) => savedPosition || { top: 0 }
})

router.beforeEach(async (to) => {
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = session ? await supabase.auth.getUser() : { data: { user: null } }
  let isAdmin = user?.app_metadata?.role === 'admin'
  // Fall back to the protected profile row. This keeps routing correct for
  // sessions that were created before the role was written to Auth metadata.
  if (user && !isAdmin) {
    const { data: profile } = await supabase.from('app_users').select('role').eq('id', user.id).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  if (to.meta.requiresAuth && !session) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && !isAdmin) return { name: 'home' }
  if (to.meta.employeeOnly && isAdmin) return { name: 'admin' }

  if (to.name === 'login' && session) return { name: isAdmin ? 'admin' : 'home' }
  if (to.name === 'home' && isAdmin) return { name: 'admin' }

  return true
})

export default router
