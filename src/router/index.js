
import { createRouter, createWebHashHistory } from 'vue-router'

import LoginView from '../views/UsernameSignInView.vue'
import HomeView from '../views/DashboardView.vue'
import AntraegeView from '../views/RequestsView.vue'
import KontaktView from '../views/ContactView.vue'
import AnweisungenView from '../views/DocumentsView.vue'
import ProfileView from '../views/ProfileSettingsView.vue'
import GehaltsAbrechnungView from '../views/PayslipsView.vue'
import EquipmentView from '../views/EquipmentView.vue'

import { supabase } from '../config/supabase.js'

// TESTMODUS:
// true nur bei lokaler Entwicklung mit npm run dev
// false beim Produktions-Build
const TEST_MODE = import.meta.env.DEV

const routes = [
    {
        path: '/',
        name: 'login',
        component: LoginView
    },
    {
        path: '/home',
        name: 'home',
        component: HomeView,
        meta: { requiresAuth: true }
    },
    {
        path: '/antraege',
        name: 'antraege',
        component: AntraegeView,
        meta: { requiresAuth: true }
    },
    {
        path: '/kontakt',
        name: 'kontakt',
        component: KontaktView,
        meta: { requiresAuth: true }
    },
    {
        path: '/anweisungen',
        name: 'anweisungen',
        component: AnweisungenView,
        meta: { requiresAuth: true }
    },
    {
        path: '/profile',
        name: 'profile',
        component: ProfileView,
        meta: { requiresAuth: true }
    },
    {
        path: '/gehalt',
        name: 'gehalt',
        component: GehaltsAbrechnungView,
        meta: { requiresAuth: true }
    },
    {
        path: '/ausruestung',
        name: 'ausruestung',
        component: EquipmentView,
        meta: { requiresAuth: true }
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 })
})

// =====================================
// AUTH GUARD
// =====================================

router.beforeEach(async (to) => {

    // Lokaler Testmodus ohne Login
    if (TEST_MODE) {
        if (to.name === 'login') {
            return { name: 'home' }
        }

        return true
    }

    // Normale Supabase-Authentifizierung
    const {
        data: { session }
    } = await supabase.auth.getSession()

    if (to.meta.requiresAuth && !session) {
        return {
            name: 'login',
            query: { redirect: to.fullPath }
        }
    }

    if (to.name === 'login' && session) {
        return { name: 'home' }
    }

    return true
})

export default router
