<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { createFiniteAutomaton, type FiniteAutomaton } from './core/automaton/FiniteAutomaton'
import type { LexicalError } from './core/errors/LexicalError'
import { parseTokens } from './core/parser/Parser'
import type { SyntaxError } from './core/parser/SyntaxError'
import { useDebuggerStore } from './stores/debuggerStore'
import CodeEditor from './components/CodeEditor.vue'
import DebuggerPanel from './components/DebuggerPanel.vue'
import TokenTable from './components/TokenTable.vue'
import CommentTable from './components/CommentTable.vue'
import ErrorConsole from './components/ErrorConsole.vue'
import StatisticsPanel from './components/StatisticsPanel.vue'
import SyntaxErrorPanel from './components/SyntaxErrorPanel.vue'
import AstViewer from './components/AstViewer.vue'
const store = useDebuggerStore(); let automaton: FiniteAutomaton | null = null; let debounceTimer: ReturnType<typeof setTimeout> | undefined; const selectedError = ref<LexicalError>(); const selectedSyntaxError = ref<SyntaxError>()
const latestEvent = computed(() => store.events.at(-1)); const totalLines = computed(() => store.sourceCode ? store.sourceCode.split('\n').length : 1)
const selectedErrorIndex = computed(() => selectedSyntaxError.value?.startIndex ?? selectedError.value?.startIndex)
function sync() { if (!automaton) return; const result=automaton.result(); store.tokens=result.tokens; store.errors=result.errors; store.comments=result.comments; store.currentIndex=automaton.index; store.currentLine=automaton.line; store.currentColumn=automaton.column; store.currentCharacter=automaton.currentCharacter; store.currentState=automaton.currentState; store.isRunning=!automaton.isFinished }
function reset() { automaton = createFiniteAutomaton(store.sourceCode); store.clear(); automaton.subscribe(event => store.events.push(event)); sync() }
function parseCurrentTokens() { const result=parseTokens(store.tokens); store.ast=result.ast; store.syntaxErrors=result.errors }
function step() { if (!automaton || automaton.source !== store.sourceCode) reset(); automaton?.step(); sync(); if (automaton?.isFinished) parseCurrentTokens() }
function nextToken() { if (!automaton || automaton.source !== store.sourceCode) reset(); const before=store.tokens.length; do { automaton?.step() } while (automaton && !automaton.isFinished && store.tokens.length === before); sync(); if (automaton?.isFinished) parseCurrentTokens() }
function run() { reset(); automaton?.tokenize(); sync(); parseCurrentTokens() }
function pause() { store.isPaused=true; store.isRunning=false }
function exportJson() { const payload={ source:store.sourceCode, tokens:store.tokens, lexicalErrors:store.errors, syntaxErrors:store.syntaxErrors, ast:store.ast, comments:store.comments, statistics:{ totalTokens:store.tokens.length,totalLexicalErrors:store.errors.length,totalSyntaxErrors:store.syntaxErrors.length,totalComments:store.comments.length,totalCharacters:store.sourceCode.length,totalLines:totalLines.value,finalState:store.currentState } }; const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})); const a=document.createElement('a'); a.href=url;a.download='analisis-lexico-sintactico.json';a.click();URL.revokeObjectURL(url) }
function selectError(error: LexicalError) { selectedError.value=error }
function selectSyntaxError(error: SyntaxError) { selectedSyntaxError.value=error }
watch(() => store.sourceCode, () => { if (debounceTimer) clearTimeout(debounceTimer); debounceTimer=setTimeout(run, 280) }, { immediate: true })
onBeforeUnmount(() => { if (debounceTimer) clearTimeout(debounceTimer) })
</script>
<template><main><header><div><p class="eyebrow">Vue 3 · TypeScript · AFD · Parser</p><h1>Analizador Léxico y Sintáctico</h1><p>Análisis de tokens, gramática y AST en tiempo real.</p></div><div class="actions"><button class="primary" @click="run">Analizar ahora</button><button @click="step">Siguiente carácter</button><button @click="nextToken">Siguiente token</button><button @click="pause">Pausar</button><button @click="reset">Reiniciar</button><button @click="exportJson">Exportar JSON</button></div></header><div class="workspace"><CodeEditor v-model="store.sourceCode" :current-index="store.currentIndex" :error-index="selectedErrorIndex" :syntax-errors="store.syntaxErrors"/><aside><DebuggerPanel :index="store.currentIndex" :line="store.currentLine" :column="store.currentColumn" :character="store.currentCharacter" :state="store.currentState" :event="latestEvent"/><StatisticsPanel :tokens="store.tokens.length" :errors="store.errors.length + store.syntaxErrors.length" :comments="store.comments.length" :characters="store.currentIndex" :lines="totalLines" :state="store.currentState"/></aside></div><ErrorConsole :errors="store.errors" @select="selectError"/><SyntaxErrorPanel :errors="store.syntaxErrors" @select="selectSyntaxError"/><div class="tables"><TokenTable :tokens="store.tokens" :errors="store.errors.length"/><AstViewer :ast="store.ast"/><CommentTable :comments="store.comments"/></div></main></template>
