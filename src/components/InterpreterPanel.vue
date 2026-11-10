<script setup lang="ts">
import type { InterpreterResult, RuntimeValue } from '../core/runtime/Interpreter'

defineProps<{ result: InterpreterResult | null; preventedMessage?: string }>()
const showValue = (value: RuntimeValue): string =>
  value === null ? 'nulo'
    : typeof value === 'object' && value.kind === 'range' ? '[' + value.lower + ',...,' + value.upper + ']'
    : typeof value === 'object' && value.kind === 'collection' ? (value.collectionType === 'tuple' ? '(' + value.items.map(showValue).join(', ') + ')' : '[' + value.items.map(showValue).join(', ') + ']')
    : typeof value === 'object' && value.kind === 'dictionary' ? '{' + [...value.entries.values()].map(entry => showValue(entry.key) + ': ' + showValue(entry.value)).join(', ') + '}'
    : typeof value === 'object' && value.kind === 'instance' ? '<' + value.className + '>'
      : typeof value === 'object' ? '<lambda>' : typeof value === 'boolean' ? (value ? 'verdadero' : 'falso') : String(value)
</script>

<template>
  <section class="panel interpreter-panel">
    <h2>Intérprete <small>{{ result ? `${result.steps} paso(s)` : 'sin ejecutar' }}</small></h2>
    <p v-if="preventedMessage" class="runtime-message">{{ preventedMessage }}</p>
    <template v-if="result">
      <h3>Salida</h3>
      <pre v-if="result.outputs.length" class="runtime-output">{{ result.outputs.join('\n') }}</pre>
      <p v-else class="empty">El programa no produjo salida.</p>
      <article v-for="diagnostic in result.diagnostics" :key="`${diagnostic.code}-${diagnostic.line}-${diagnostic.column}`" class="runtime-error">
        <strong>{{ diagnostic.code }}</strong> · {{ diagnostic.message }}
        <small>Línea {{ diagnostic.line }}, columna {{ diagnostic.column }}</small>
      </article>
      <h3>Variables finales</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Valor</th></tr></thead>
          <tbody>
            <tr v-for="variable in result.globals" :key="variable.name">
              <td><code>{{ variable.name }}</code></td><td>{{ variable.type }}</td><td>{{ showValue(variable.value) }}</td>
            </tr>
            <tr v-if="!result.globals.length"><td colspan="3" class="empty">Sin variables globales.</td></tr>
          </tbody>
        </table>
      </div>
    </template>
    <p v-else-if="!preventedMessage" class="empty">Pulsa «Analizar y ejecutar» para correr el intérprete.</p>
  </section>
</template>
