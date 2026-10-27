<template>
  <div class="login-container">
    <div class="login-card">

      <div class="login-header">
        <div class="brand-logo">
          <i class="fa-solid fa-user-shield"></i>
        </div>
        <h2>Mitarbeiter Portal</h2>
        <p>Bitte melden Sie sich mit Ihren Zugangsdaten an</p>
      </div>

      <!-- Login Formular -->
      <form @submit.prevent="handleLogin" class="login-form">
        <!-- E-Mail-Adresse (Supabase Login) -->
        <div class="form-group">
          <label for="username">E-Mail-Adresse</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-envelope input-icon"></i>
            <input
                id="username"
                v-model="username"
                type="email"
                placeholder="name@beispiel.at"
                required
                autocomplete="email"
            />
          </div>
        </div>

        <!-- Passwort -->
        <div class="form-group">
          <label for="password">Passwort</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-lock input-icon"></i>
            <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                required
                autocomplete="current-password"
            />
            <button
                type="button"
                class="toggle-password"
                @click="showPassword = !showPassword"
                aria-label="Passwort anzeigen"
            >
              <i class="fa-solid" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
            </button>
          </div>
        </div>

        <!-- Fehlermeldung -->
        <div v-if="errorMessage" class="error-banner">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Submit Button -->
        <button type="submit" class="btn-submit" :disabled="isLoading">
          <span v-if="!isLoading">
            Anmelden <i class="fa-solid fa-arrow-right-to-bracket"></i>
          </span>
          <span v-else class="spinner-container">
            <i class="fa-solid fa-circle-notch fa-spin"></i> WIRD ANGEMELDET...
          </span>
        </button>
      </form>

      <!-- Footer / Hilfe -->
      <div class="login-footer">
        <router-link to="/kontakt" class="help-link">
          <i class="fa-solid fa-circle-question"></i> Zugangsdaten vergessen?
        </router-link>
      </div>
    </div>
  </div>
</template>


<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace('/home')
})
</script>


<style scoped>
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #0b1220;
}

input, select, textarea {
  font-size: 16px;
}

.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  box-sizing: border-box;
}

.login-card {
  width: 100%;
  max-width: 380px;
  padding: 20px;
  border-radius: 16px;
  box-sizing: border-box;
}

.login-header {
  text-align: center;
}

.brand-logo {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: #ffffff;
  margin: 0 auto 16px auto;
  box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
}

.login-header h2 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #ffffff;
}

.login-header p {
  font-size: 0.85rem;
  color: #94a3b8;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #64748b;
  font-size: 0.95rem;
}

.input-wrapper input {
  width: 100%;
  height: 48px;
  background: #0b0f19;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0 42px 0 42px;
  color: #f8fafc;
  font-size: 16px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.toggle-password {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 1rem;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
}

.error-banner {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  padding: 10px 14px;
  color: #fca5a5;
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-submit {
  width: 100%;
  height: 48px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background-color 0.2s ease, transform 0.1s ease;
  touch-action: manipulation;
  margin-top: 6px;
}

.btn-submit:hover {
  background: #1d4ed8;
}

.btn-submit:active {
  transform: scale(0.98);
}

.btn-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-footer {
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 16px;
  margin-top: 20px;
}

.help-link {
  color: #94a3b8;
  font-size: 0.82rem;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s ease;
}

.help-link:hover {
  color: #38bdf8;
}

@media (max-width: 480px) {
  .login-card {
    padding: 24px 18px;
    border-radius: 14px;
  }

  .brand-logo {
    width: 48px;
    height: 48px;
    font-size: 1.3rem;
  }

  .login-header h2 {
    font-size: 1.2rem;
  }
}
</style>
