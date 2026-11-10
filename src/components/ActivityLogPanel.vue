<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ActivityLogEntry, ActivityType } from '../persistence/AnalyzerRepository'

const props = defineProps<{
  activities: ActivityLogEntry[]
  username?: string
  displayName?: string
}>()
const emit = defineEmits<{ restore: [activity: ActivityLogEntry] }>()

const pageSize = 20
const search = ref('')
const selectedType = ref<ActivityType | ''>('')
const page = ref(1)

const titles: Record<ActivityType, string> = {
  ACCOUNT_CREATED: 'Cuenta creada',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  CODE_WRITTEN: 'Escritura de código',
  CODE_DELETED: 'Borrado de código',
  CODE_EDITED: 'Edición de código',
  CODE_RESTORED: 'Versión restaurada',
  CODE_EXPORTED: 'Código exportado',
  CODE_IMPORTED: 'Código importado',
  HISTORY_EXPORTED: 'Historial exportado',
  LEXICAL_ANALYSIS: 'Análisis léxico',
  SYNTAX_ANALYSIS: 'Análisis sintáctico',
  SEMANTIC_ANALYSIS: 'Análisis semántico',
  SUGGESTIONS_GENERATED: 'Sugerencias generadas',
  CODE_SAVED: 'Código guardado',
  CODE_LOADED: 'Código cargado',
  AUTO_FIX_APPLIED: 'Corrección automática',
  ANALYSIS_STARTED: 'Análisis iniciado',
  ANALYSIS_STEP: 'Avance del análisis',
  ANALYSIS_RESET: 'Análisis reiniciado',
  ANALYSIS_PAUSED: 'Análisis pausado',
  ANALYSIS_COMPLETED: 'Intérprete ejecutado',
}

const typeOptions = (Object.keys(titles) as ActivityType[]).map(type => ({ type, title: titles[type] }))
const normalize = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX')

const filteredActivities = computed(() => {
  const query = normalize(search.value.trim())
  return props.activities.filter(activity => {
    if (selectedType.value && activity.type !== selectedType.value) return false
    if (!query) return true
    const content = [
      titles[activity.type],
      activity.type,
      activity.detail,
      activity.before,
      activity.after,
      activity.metadata ? JSON.stringify(activity.metadata) : '',
    ].join(' ')
    return normalize(content).includes(query)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredActivities.value.length / pageSize)))
const visibleActivities = computed(() => filteredActivities.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const visibleStart = computed(() => filteredActivities.value.length ? (page.value - 1) * pageSize + 1 : 0)
const visibleEnd = computed(() => Math.min(page.value * pageSize, filteredActivities.value.length))
const actorName = computed(() => props.displayName || props.username || 'Mi actividad')
const actorInitial = computed(() => actorName.value.trim().charAt(0).toLocaleUpperCase('es-MX') || 'U')

watch([search, selectedType], () => { page.value = 1 })
watch(totalPages, lastPage => { if (page.value > lastPage) page.value = lastPage })

const formatDate = (value: string): string => new Date(value).toLocaleString('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

const formatMetadata = (metadata: Record<string, unknown>): string => JSON.stringify(metadata, null, 2)
</script>

<template>
  <section class="panel activity-log" aria-labelledby="activity-log-heading">
    <div class="panel-heading">
      <div>
        <h2 id="activity-log-heading">Historial de actividad</h2>
        <p class="activity-log-identity">
          <span class="activity-avatar" aria-hidden="true">{{ actorInitial }}</span>
          <span><strong>{{ actorName }}</strong><small v-if="username"> @{{ username }}</small></span>
        </p>
      </div>
      <small>{{ activities.length }} evento{{ activities.length === 1 ? '' : 's' }} registrado{{ activities.length === 1 ? '' : 's' }}</small>
    </div>

    <div class="activity-log-controls">
      <label>
        <span>Buscar en el historial</span>
        <input v-model="search" type="search" placeholder="Código, análisis, corrección…" />
      </label>
      <label>
        <span>Tipo de actividad</span>
        <select v-model="selectedType">
          <option value="">Todos los eventos</option>
          <option v-for="option in typeOptions" :key="option.type" :value="option.type">{{ option.title }}</option>
        </select>
      </label>
    </div>

    <p v-if="activities.length && filteredActivities.length" class="activity-log-count" aria-live="polite">
      Mostrando {{ visibleStart }}–{{ visibleEnd }} de {{ filteredActivities.length }} evento{{ filteredActivities.length === 1 ? '' : 's' }}{{ filteredActivities.length !== activities.length ? ` (de ${activities.length} en total)` : '' }}.
    </p>

    <ol v-if="visibleActivities.length" class="activity-timeline">
      <li v-for="activity in visibleActivities" :key="activity.id" class="activity-event">
        <span class="activity-event-dot" aria-hidden="true"></span>
        <div class="activity-event-content">
          <div class="activity-event-heading">
            <strong>{{ titles[activity.type] }}</strong>
            <time :datetime="activity.createdAt" :title="formatDate(activity.createdAt)">{{ formatDate(activity.createdAt) }}</time>
          </div>
          <p><span class="activity-actor">@{{ username || activity.userId }}</span> · {{ activity.detail }}</p>
          <details class="activity-event-details">
            <summary>Ver registro completo</summary>
            <dl class="activity-event-fields">
              <div v-if="activity.sequence !== undefined"><dt>Secuencia</dt><dd>#{{ activity.sequence }}</dd></div>
              <div><dt>Evento</dt><dd><code>{{ activity.type }}</code></dd></div>
              <div><dt>ID</dt><dd><code>{{ activity.id }}</code></dd></div>
              <div><dt>Usuario</dt><dd><code>{{ activity.userId }}</code></dd></div>
              <div><dt>Fecha y hora</dt><dd>{{ formatDate(activity.createdAt) }}</dd></div>
            </dl>
            <div v-if="activity.before !== undefined" class="activity-code-snapshot">
              <h3>Código anterior</h3>
              <pre>{{ activity.before || '(vacío)' }}</pre>
            </div>
            <div v-if="activity.after !== undefined" class="activity-code-snapshot">
              <h3>Código nuevo</h3>
              <pre>{{ activity.after || '(vacío)' }}</pre>
            </div>
            <div v-if="activity.metadata && Object.keys(activity.metadata).length" class="activity-code-snapshot">
              <h3>Metadatos</h3>
              <pre>{{ formatMetadata(activity.metadata) }}</pre>
            </div>
            <button v-if="activity.after !== undefined" type="button" class="activity-restore" @click="emit('restore', activity)">Restaurar esta versión</button>
          </details>
        </div>
      </li>
    </ol>
    <p v-else-if="activities.length" class="empty">No hay eventos que coincidan con la búsqueda o el filtro.</p>
    <p v-else class="empty">Tu historial aparecerá al escribir, analizar, guardar o cargar código.</p>

    <nav v-if="totalPages > 1" class="activity-pagination" aria-label="Páginas del historial">
      <button type="button" :disabled="page === 1" @click="page--">Más recientes</button>
      <span>Página {{ page }} de {{ totalPages }}</span>
      <button type="button" :disabled="page === totalPages" @click="page++">Más antiguos</button>
    </nav>
  </section>
</template>
