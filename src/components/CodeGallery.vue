<script setup lang="ts">
import { ref } from 'vue'
import type { SavedProgram } from '../persistence/AnalyzerRepository'
import { languageExamples, type LanguageExample } from '../core/language/examples'

defineProps<{ programs: SavedProgram[]; busy?: boolean }>()
const emit = defineEmits<{
  save: [title: string, source?: string]
  load: [program: SavedProgram]
  loadExample: [example: LanguageExample]
  saveExample: [example: LanguageExample]
}>()
const title = ref('')

const formatDate = (value: string): string => new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

function save(): void {
  emit('save', title.value)
  title.value = ''
}
</script>

<template>
  <section class="panel gallery">
    <div class="panel-heading"><h2>Mi galería de códigos</h2><small>{{ programs.length }} guardado(s)</small></div>
    <div class="save-code">
      <input v-model="title" :disabled="busy" maxlength="80" placeholder="Nombre del código (opcional)" aria-label="Nombre del código" />
      <button class="primary" :disabled="busy" @click="save">Guardar código</button>
    </div>
    <p class="gallery-note">Cada código probado se conserva automáticamente en esta galería privada.</p>
    <ul v-if="programs.length" class="program-list">
      <li v-for="program in programs" :key="program.id">
        <div>
          <strong>{{ program.title }}</strong>
          <small>{{ program.kind === 'manual' ? 'Guardado manual' : 'Snapshot de análisis' }} · {{ formatDate(program.createdAt) }}</small>
          <span v-if="program.kind === 'analysis'">{{ program.summary.tokens }} tokens · {{ program.summary.lexicalErrors + program.summary.syntaxErrors + program.summary.semanticErrors }} diagnóstico(s)</span>
          <span v-else>Código guardado</span>
        </div>
        <button @click="$emit('load', program)">Cargar</button>
      </li>
    </ul>
    <p v-else class="empty">Aún no hay códigos guardados para esta cuenta.</p>
    <div class="examples-heading">
      <h3>Ejemplos del lenguaje</h3>
      <small>{{ languageExamples.length }} programas</small>
    </div>
    <p class="gallery-note">Carga uno para estudiarlo o guárdalo directamente en tu galería.</p>
    <ul class="example-list">
      <li v-for="example in languageExamples" :key="example.title">
        <div>
          <strong>{{ example.title }}</strong>
          <small>{{ example.level }} · {{ example.topic }}</small>
          <span>{{ example.description }}</span>
        </div>
        <div class="example-actions">
          <button :disabled="busy" @click="$emit('loadExample', example)">Cargar</button>
          <button :disabled="busy" @click="$emit('saveExample', example)">Guardar</button>
        </div>
      </li>
    </ul>
  </section>
</template>
