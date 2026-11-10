<script setup lang="ts">
import type { SemanticError } from '../core/semantic/SemanticError'
import type { SemanticWarning } from '../core/semantic/SemanticError'
import type { SemanticMode } from '../core/semantic/SemanticAnalyzer'
import { canApplySuggestion, type CorrectionSuggestion } from '../core/suggestions/CorrectionSuggestion'

defineProps<{
  semanticErrors: SemanticError[]
  semanticWarnings: SemanticWarning[]
  suggestions: CorrectionSuggestion[]
  mode: SemanticMode
  warningsEnabled: boolean
  blocked: boolean
}>()
defineEmits<{ apply: [suggestion: CorrectionSuggestion] }>()
</script>

<template>
  <section class="panel semantic-errors">
    <h2>Diagnósticos semánticos <small>{{ semanticErrors.length }} error(es) · {{ semanticWarnings.length }} advertencia(s)</small></h2>
    <p class="semantic-mode-status" :class="blocked ? 'is-blocked' : 'is-clear'">
      Modo {{ mode === 'strict' ? 'estricto' : 'flexible' }} · warnings {{ warningsEnabled ? 'activados' : 'ocultos' }}:
      {{ blocked ? 'análisis bloqueado por diagnósticos.' : 'el análisis puede continuar.' }}
    </p>
    <article v-for="error in semanticErrors" :key="`${error.code}-${error.startIndex}`" class="semantic-error">
      <span class="diagnostic-severity diagnostic-severity--error">ERROR</span>
      <code>{{ error.code }}</code>
      <span>{{ error.message }}</span>
      <small>Línea {{ error.line }}, columna {{ error.column }}</small>
      <strong>Posible corrección: {{ error.suggestion }}</strong>
    </article>
    <article v-for="warning in semanticWarnings" :key="`${warning.code}-${warning.startIndex}`" class="semantic-error semantic-warning">
      <span class="diagnostic-severity diagnostic-severity--warning">WARNING</span>
      <code>{{ warning.code }}</code>
      <span>{{ warning.message }}</span>
      <small>Línea {{ warning.line }}, columna {{ warning.column }}</small>
      <strong>Sugerencia: {{ warning.suggestion }}</strong>
    </article>
    <p v-if="!semanticErrors.length && !semanticWarnings.length" class="empty">
      {{ warningsEnabled ? 'Sin diagnósticos semánticos.' : 'Sin errores; los warnings están ocultos.' }}
    </p>
  </section>
  <section class="panel suggestions">
    <h2>Sugerencias de corrección <small>{{ suggestions.length }}</small></h2>
    <article v-for="suggestion in suggestions" :key="suggestion.id" class="suggestion">
      <div>
        <span class="stage" :class="`stage-${suggestion.stage.toLowerCase()}`">{{ suggestion.stage }}</span>
        <strong>{{ suggestion.title }}</strong>
        <p>{{ suggestion.description }}</p>
      </div>
      <button v-if="canApplySuggestion(suggestion)" class="primary" @click="$emit('apply', suggestion)">Aplicar</button>
    </article>
    <p v-if="!suggestions.length" class="empty">El análisis no encontró correcciones sugeridas.</p>
  </section>
</template>
