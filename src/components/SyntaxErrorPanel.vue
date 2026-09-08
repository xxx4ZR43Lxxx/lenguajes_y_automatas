<script setup lang="ts">
import type { SyntaxError } from '../core/parser/SyntaxError'
defineProps<{ errors: SyntaxError[] }>()
defineEmits<{ select: [error: SyntaxError] }>()
</script>

<template>
  <section class="panel syntax-errors">
    <h2>Errores sintácticos <small>{{ errors.length }}</small></h2>
    <button v-for="error in errors" :key="`${error.startIndex}-${error.expected}`" class="syntax-error" @click="$emit('select', error)">
      <span class="syntax-badge">SyntaxError</span>
      <span>{{ error.message }}</span>
      <strong>Posible corrección: {{ error.suggestion }}</strong>
    </button>
    <p v-if="!errors.length" class="empty">Sin errores sintácticos.</p>
  </section>
</template>
