<script setup lang="ts">
import type { Token } from '../core/tokens/Token'
defineProps<{ tokens: Token[]; errors: number }>()
const printable = (value: unknown) => value === null ? 'null' : String(value)
</script>
<template><section class="panel"><h2>Tabla de tokens <small>{{ tokens.length }} · errores léxicos: {{ errors }}</small></h2><div class="table-wrap"><table><thead><tr><th>#</th><th>Tipo</th><th>Lexema</th><th>Valor</th><th>Estado final</th><th>Línea</th><th>Col.</th><th>Inicio</th><th>Fin</th></tr></thead><tbody><tr v-for="(token,index) in tokens" :key="index"><td>{{ index+1 }}</td><td><code>{{ token.type }}</code></td><td>{{ token.lexeme || '∅' }}</td><td>{{ printable(token.value) }}</td><td><code>{{ token.finalState }}</code></td><td>{{ token.line }}</td><td>{{ token.column }}</td><td>{{ token.startIndex }}</td><td>{{ token.endIndex }}</td></tr><tr v-if="!tokens.length"><td colspan="9" class="empty">Aún no hay tokens.</td></tr></tbody></table></div></section></template>
