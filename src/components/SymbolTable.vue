<script setup lang="ts">
import type { SemanticSymbol } from '../core/semantic/SemanticAnalyzer'
import type { LexicalSymbol } from '../core/symbols/LexicalSymbolTable'

defineProps<{ lexicalSymbols: LexicalSymbol[]; semanticSymbols: SemanticSymbol[] }>()

const positions = (symbol: LexicalSymbol): string =>
  symbol.occurrences.map(occurrence => `${occurrence.line}:${occurrence.column}`).join(', ')
const kindName = (kind: SemanticSymbol['kind']): string => ({
  variable: 'Variable', constant: 'Constante', function: 'Tarea', class: 'Clase', parameter: 'Parámetro',
})[kind]
</script>

<template>
  <section class="panel">
    <h2>Tabla de símbolos léxicos <small>entrada del parser · {{ lexicalSymbols.length }}</small></h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Identificador</th><th>Token</th><th>Apariciones (línea:columna)</th></tr></thead>
        <tbody>
          <tr v-for="symbol in lexicalSymbols" :key="`${symbol.tokenType}-${symbol.name}`">
            <td><code>{{ symbol.name }}</code></td><td>{{ symbol.tokenType }}</td><td>{{ positions(symbol) }}</td>
          </tr>
          <tr v-if="!lexicalSymbols.length"><td colspan="3" class="empty">El lexer aún no encontró identificadores.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
  <section class="panel">
    <h2>Tabla de símbolos semánticos <small>{{ semanticSymbols.length }}</small></h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Clase</th><th>Tipo inferido</th><th>Firmas (parámetros)</th></tr></thead>
        <tbody>
          <tr v-for="symbol in semanticSymbols" :key="`${symbol.kind}-${symbol.name}`">
            <td><code>{{ symbol.name }}</code></td><td>{{ kindName(symbol.kind) }}</td><td>{{ symbol.valueType }}</td>
            <td>{{ symbol.signatures?.map(arity => `${arity} parámetro(s)`).join(' · ') ?? '—' }}</td>
          </tr>
          <tr v-if="!semanticSymbols.length"><td colspan="4" class="empty">Se llena cuando el análisis sintáctico produce su tabla semántica.</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
