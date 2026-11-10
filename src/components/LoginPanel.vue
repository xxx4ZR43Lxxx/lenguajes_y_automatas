<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ busy: boolean; error?: string }>()
const emit = defineEmits<{
  login: [username: string, password: string]
  register: [username: string, displayName: string, password: string]
  modeChanged: []
}>()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const displayName = ref('')
const password = ref('')
const confirmation = ref('')
const formError = ref('')

function submit(): void {
  formError.value = ''
  if (mode.value === 'register') {
    if (password.value !== confirmation.value) {
      formError.value = 'Las contraseñas no coinciden.'
      return
    }
    emit('register', username.value, displayName.value, password.value)
  } else {
    emit('login', username.value, password.value)
  }
}

function switchMode(next: 'login' | 'register'): void {
  mode.value = next
  formError.value = ''
  password.value = ''
  confirmation.value = ''
  emit('modeChanged')
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">noEsPython:( · cuentas en SQLite</p>
      <h1>Analizador con bitácora</h1>
      <p>Entra o crea tu cuenta para guardar tus códigos y tu historial personal.</p>
      <div class="auth-tabs" role="group" aria-label="Tipo de acceso">
        <button type="button" :class="{ active: mode === 'login' }" :disabled="busy" @click="switchMode('login')">Iniciar sesión</button>
        <button type="button" :class="{ active: mode === 'register' }" :disabled="busy" @click="switchMode('register')">Crear cuenta</button>
      </div>
      <form @submit.prevent="submit">
        <label>Usuario<input v-model="username" autocomplete="username" required minlength="3" maxlength="30" pattern="[a-zA-Z0-9_.-]+" :disabled="busy" /></label>
        <label v-if="mode === 'register'">Nombre visible<input v-model="displayName" autocomplete="name" required maxlength="80" :disabled="busy" /></label>
        <label>Contraseña<input v-model="password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" required :minlength="mode === 'register' ? 8 : undefined" :disabled="busy" /></label>
        <label v-if="mode === 'register'">Confirmar contraseña<input v-model="confirmation" type="password" autocomplete="new-password" required minlength="8" :disabled="busy" /></label>
        <p v-if="formError || error" class="auth-error" role="alert">{{ formError || error }}</p>
        <button class="primary" type="submit" :disabled="busy">{{ busy ? 'Espere…' : mode === 'register' ? 'Crear cuenta' : 'Entrar' }}</button>
      </form>
      <div class="demo-accounts">
        <strong>Cuentas de demostración</strong>
        <span><code>ana</code> / <code>1234</code> · Ana Torres</span>
        <span><code>luis</code> / <code>1234</code> · Luis Pérez</span>
      </div>
    </section>
  </main>
</template>
