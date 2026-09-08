<script setup lang="ts">
import { computed } from 'vue'
import type { ProgramNode } from '../core/parser/Ast'

const props = defineProps<{ ast: ProgramNode | null }>()
const json = computed(() => props.ast ? JSON.stringify(props.ast, null, 2) : 'Aún no hay un AST para mostrar.')
</script>

<template>
  <section class="panel ast-viewer">
    <h2>Árbol Sintáctico Abstracto (AST)</h2>
    <details open>
      <summary>JSON plegable</summary>
      <pre>{{ json }}</pre>
    </details>
  </section>
</template>
