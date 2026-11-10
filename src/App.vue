<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createFiniteAutomaton, type FiniteAutomaton } from './core/automaton/FiniteAutomaton'
import { describeSourceChange } from './core/history/sourceChange'
import type { LexicalError } from './core/errors/LexicalError'
import { parseTokens } from './core/parser/Parser'
import type { SyntaxError } from './core/parser/SyntaxError'
import { analyzeSemantics, type SemanticMode } from './core/semantic/SemanticAnalyzer'
import { interpret, type InterpreterResult } from './core/runtime/Interpreter'
import type { LanguageExample } from './core/language/examples'
import type { SemanticWarning } from './core/semantic/SemanticError'
import {
  applyCorrectionSuggestion,
  buildCorrectionSuggestions,
  canApplySuggestion,
  type CorrectionSuggestion,
} from './core/suggestions/CorrectionSuggestion'
import type { ActivityDetails, ActivityLogEntry, ActivityType, AnalysisSnapshot, AnalysisSummary, AuthenticatedUser, SavedProgram } from './persistence/AnalyzerRepository'
import { analyzerRepository } from './persistence/AnalyzerRepository'
import { migrateLegacyData } from './persistence/legacyMigration'
import { useDebuggerStore } from './stores/debuggerStore'
import ActivityLogPanel from './components/ActivityLogPanel.vue'
import AnalysisFeedback from './components/AnalysisFeedback.vue'
import AstViewer from './components/AstViewer.vue'
import CodeEditor from './components/CodeEditor.vue'
import CodeGallery from './components/CodeGallery.vue'
import CommentTable from './components/CommentTable.vue'
import DebuggerPanel from './components/DebuggerPanel.vue'
import ErrorConsole from './components/ErrorConsole.vue'
import LoginPanel from './components/LoginPanel.vue'
import StatisticsPanel from './components/StatisticsPanel.vue'
import SyntaxErrorPanel from './components/SyntaxErrorPanel.vue'
import SymbolTable from './components/SymbolTable.vue'
import TokenTable from './components/TokenTable.vue'
import InterpreterPanel from './components/InterpreterPanel.vue'

const store = useDebuggerStore()
const initialSourceCode = store.sourceCode
let automaton: FiniteAutomaton | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let activityRefreshTimer: ReturnType<typeof setTimeout> | undefined
let completedAutomaton: FiniteAutomaton | null = null
let historyRequestId = 0
let activityQueue: Promise<void> = Promise.resolve()
let analysisQueue: Promise<void> = Promise.resolve()
let saveQueue: Promise<void> = Promise.resolve()
const pendingActivities: Array<{ userId: string; type: ActivityType; detail: string; details: ActivityDetails }> = []
const pendingAnalyses: Array<{ userId: string; source: string; summary: AnalysisSummary; analysis: AnalysisSnapshot }> = []
const pendingSaves: Array<{ userId: string; title: string; source: string; summary: AnalysisSummary }> = []
const selectedError = ref<LexicalError>()
const selectedSyntaxError = ref<SyntaxError>()
const appReady = ref(false)
const user = ref<AuthenticatedUser | null>(null)
const loginBusy = ref(false)
const logoutBusy = ref(false)
const savingCode = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const authError = ref('')
const persistenceError = ref('')
const migrationNotice = ref('')
const canMigrateLocal = typeof indexedDB !== 'undefined'
const programs = ref<SavedProgram[]>([])
const activities = ref<Awaited<ReturnType<typeof analyzerRepository.listActivities>>>([])
const suggestions = ref<CorrectionSuggestion[]>([])
const semanticMode = ref<SemanticMode>('permissive')
const warningsEnabled = ref(true)
const semanticBlocked = ref(false)
const interpreterResult = ref<InterpreterResult | null>(null)
const executionMessage = ref('')

const latestEvent = computed(() => store.events.at(-1))
const totalLines = computed(() => store.sourceCode ? store.sourceCode.split('\n').length : 1)
const selectedErrorIndex = computed(() => selectedSyntaxError.value?.startIndex ?? selectedError.value?.startIndex)

async function restoreRecentCode(): Promise<void> {
  const draft = await analyzerRepository.loadDraft()
  store.sourceCode = draft ?? programs.value[0]?.source ?? initialSourceCode
}

async function migrateOldData(showEmptyMessage = false): Promise<void> {
  if (!user.value) return
  if (!canMigrateLocal) return
  try {
    const result = await migrateLegacyData(user.value.username)
    if (result) {
      migrationNotice.value = result.programs || result.activities
        ? `Se migraron ${result.programs} código(s) y ${result.activities} registro(s) anteriores a SQLite.`
        : 'Los datos anteriores de esta cuenta ya estaban migrados.'
      await refreshHistory()
    } else if (showEmptyMessage) {
      migrationNotice.value = 'No se encontraron datos anteriores de esta cuenta en este origen del navegador.'
    }
  } catch (error) {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible migrar los datos anteriores.'
  }
}

function analysisSummary(): AnalysisSummary {
  return {
    tokens: store.tokens.length,
    lexicalErrors: store.errors.length,
    syntaxErrors: store.syntaxErrors.length,
    semanticErrors: store.semanticErrors.length + store.semanticWarnings.length,
  }
}

function summarizeSource(source: string): AnalysisSummary {
  const sampleAutomaton = createFiniteAutomaton(source)
  sampleAutomaton.tokenize()
  const lexical = sampleAutomaton.result()
  if (lexical.errors.length) {
    return { tokens: lexical.tokens.length, lexicalErrors: lexical.errors.length, syntaxErrors: 0, semanticErrors: 0 }
  }
  const parsed = parseTokens(lexical.tokens, lexical.symbolTable)
  const semantic = analyzeSemantics(parsed.ast, { mode: semanticMode.value, warningsEnabled: warningsEnabled.value })
  return {
    tokens: lexical.tokens.length,
    lexicalErrors: 0,
    syntaxErrors: parsed.errors.length,
    semanticErrors: semantic.errors.length + semantic.warnings.length,
  }
}

function sync(): void {
  if (!automaton) return
  const result = automaton.result()
  store.tokens = result.tokens
  store.symbolTable = result.symbolTable
  store.errors = result.errors
  store.comments = result.comments
  store.currentIndex = automaton.index
  store.currentLine = automaton.line
  store.currentColumn = automaton.column
  store.currentCharacter = automaton.currentCharacter
  store.currentState = automaton.currentState
  store.isRunning = !automaton.isFinished
}

function reset(): void {
  automaton = createFiniteAutomaton(store.sourceCode)
  store.clear()
  semanticBlocked.value = false
  automaton.subscribe(event => store.events.push(event))
  sync()
}

function parseCurrentTokens(): void {
  if (store.errors.length) {
    store.ast = null
    store.syntaxErrors = []
    store.semanticErrors = []
    store.semanticWarnings = []
    store.semanticSymbols = []
    semanticBlocked.value = false
    suggestions.value = buildCorrectionSuggestions(store.sourceCode, store.errors, [], [])
    return
  }
  const result = parseTokens(store.tokens, store.symbolTable)
  store.ast = result.ast
  store.syntaxErrors = result.errors
  const semanticResult = analyzeSemantics(result.ast, { mode: semanticMode.value, warningsEnabled: warningsEnabled.value })
  store.semanticErrors = semanticResult.errors
  store.semanticWarnings = semanticResult.warnings
  store.semanticSymbols = semanticResult.symbols
  semanticBlocked.value = semanticResult.blocked
  suggestions.value = buildCorrectionSuggestions(store.sourceCode, store.errors, store.syntaxErrors, semanticResult.diagnostics)
}

function runLexicalStage(): void {
  if (!user.value || logoutBusy.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  void addActivity('LEXICAL_ANALYSIS', 'Se ejecutó el análisis léxico manual.', {
    metadata: { sourceLength: store.sourceCode.length },
  })
  reset()
  automaton?.tokenize()
  sync()
  store.ast = null
  store.syntaxErrors = []
  store.semanticErrors = []
  store.semanticWarnings = []
  store.semanticSymbols = []
  semanticBlocked.value = false
  suggestions.value = buildCorrectionSuggestions(store.sourceCode, store.errors, [], [])
}

function runSyntacticStage(): void {
  // El botón sintáctico siempre relanza primero el lexer y usa su tabla de símbolos.
  run('manual')
}

async function refreshHistory(): Promise<void> {
  const activeUser = user.value
  if (!activeUser) return
  const requestId = ++historyRequestId
  try {
    const [savedPrograms, savedActivities] = await Promise.all([
      analyzerRepository.listPrograms(activeUser.id),
      analyzerRepository.listActivities(activeUser.id),
    ])
    if (requestId !== historyRequestId || user.value?.id !== activeUser.id) return
    programs.value = savedPrograms
    activities.value = savedActivities
  } catch (error) {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible actualizar la base de datos local.'
  }
}

function scheduleHistoryRefresh(): void {
  if (activityRefreshTimer) clearTimeout(activityRefreshTimer)
  activityRefreshTimer = setTimeout(() => { void refreshHistory() }, 200)
}

async function flushPendingActivities(): Promise<void> {
  while (pendingActivities.length) {
    const pending = pendingActivities[0]
    if (!pending) break
    await analyzerRepository.log(pending.userId, pending.type, pending.detail, pending.details)
    pendingActivities.shift()
    scheduleHistoryRefresh()
  }
}

function addActivity(type: ActivityType, detail: string, details: ActivityDetails = {}): Promise<void> {
  const activeUser = user.value
  if (!activeUser || logoutBusy.value) return Promise.resolve()
  pendingActivities.push({ userId: activeUser.id, type, detail, details })
  const operation = activityQueue.then(async () => {
    await flushPendingActivities()
  }).catch(error => {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible registrar la actividad.'
  })
  activityQueue = operation
  return operation
}

function captureAnalysis(): AnalysisSnapshot {
  return {
    tokens: [...store.tokens],
    lexicalSymbols: store.symbolTable.map(symbol => ({ ...symbol, occurrences: symbol.occurrences.map(occurrence => ({ ...occurrence })) })),
    semanticSymbols: [...store.semanticSymbols],
    lexicalErrors: [...store.errors],
    syntaxErrors: store.syntaxErrors.map(error => ({
      kind: error.kind,
      message: error.message,
      suggestion: error.suggestion,
      expected: error.expected,
      line: error.line,
      column: error.column,
      startIndex: error.startIndex,
      endIndex: error.endIndex,
    })),
    semanticErrors: [...store.semanticErrors],
    semanticWarnings: [...store.semanticWarnings],
    semanticMode: semanticMode.value,
    warningsEnabled: warningsEnabled.value,
    semanticBlocked: semanticBlocked.value,
    suggestions: [...suggestions.value],
    ast: store.ast,
  }
}

async function flushPendingAnalyses(): Promise<void> {
  while (pendingAnalyses.length) {
    const pending = pendingAnalyses[0]
    if (!pending) break
    await analyzerRepository.saveAnalysisSnapshot(pending.userId, pending.source, pending.summary, pending.analysis)
    pendingAnalyses.shift()
    scheduleHistoryRefresh()
  }
}

function completeAnalysis(): void {
  if (automaton && completedAutomaton === automaton) return
  parseCurrentTokens()
  completedAutomaton = automaton
  const source = store.sourceCode
  const summary = analysisSummary()
  const analysis = captureAnalysis()
  const activeUser = user.value
  if (!activeUser) return
  pendingAnalyses.push({ userId: activeUser.id, source, summary, analysis })
  analysisQueue = analysisQueue.then(flushPendingAnalyses).catch(error => {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible guardar el resultado del análisis.'
  })
}

function step(): void {
  if (!automaton || automaton.source !== store.sourceCode) reset()
  automaton?.step()
  sync()
  void addActivity('ANALYSIS_STEP', `Se procesó un carácter. Índice ${store.currentIndex}, estado ${store.currentState}.`, {
    metadata: { mode: 'character', index: store.currentIndex, line: store.currentLine, column: store.currentColumn, state: store.currentState },
  })
  if (automaton?.isFinished) completeAnalysis()
}

function nextToken(): void {
  if (!automaton || automaton.source !== store.sourceCode) reset()
  const before = store.tokens.length
  do {
    automaton?.step()
  } while (automaton && !automaton.isFinished && automaton.result().tokens.length === before)
  sync()
  void addActivity('ANALYSIS_STEP', `Se avanzó al siguiente token. Índice ${store.currentIndex}, estado ${store.currentState}.`, {
    metadata: { mode: 'token', index: store.currentIndex, line: store.currentLine, column: store.currentColumn, state: store.currentState },
  })
  if (automaton?.isFinished) completeAnalysis()
}

function run(trigger: 'manual' | 'auto' | 'session' = 'manual'): void {
  if (!user.value || logoutBusy.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  interpreterResult.value = null
  executionMessage.value = ''
  void addActivity('ANALYSIS_STARTED', `Se inició un análisis ${trigger === 'auto' ? 'automático' : trigger === 'session' ? 'al abrir la sesión' : 'manual'}.`, {
    metadata: { trigger, sourceLength: store.sourceCode.length },
  })
  reset()
  automaton?.tokenize()
  sync()
  completeAnalysis()
}

function runInterpreter(): void {
  run('manual')
  if (store.errors.length) {
    executionMessage.value = 'Ejecución detenida: corrige primero los errores léxicos.'
    return
  }
  if (store.syntaxErrors.length || !store.ast) {
    executionMessage.value = 'Ejecución detenida: corrige primero los errores sintácticos.'
    return
  }
  if (store.semanticErrors.length || semanticBlocked.value) {
    executionMessage.value = 'Ejecución detenida por diagnósticos semánticos. En modo flexible, los warnings sí permiten ejecutar.'
    return
  }
  interpreterResult.value = interpret(store.ast, { inputProvider: promptText => window.prompt(promptText) ?? '' })
  if (interpreterResult.value.diagnostics.length) {
    executionMessage.value = 'El intérprete detuvo la ejecución al encontrar un error de ejecución; revisa línea y columna.'
  }
  void addActivity('ANALYSIS_COMPLETED', `Se ejecutó el intérprete con ${interpreterResult.value.steps} paso(s).`, {
    metadata: { outputCount: interpreterResult.value.outputs.length, runtimeErrors: interpreterResult.value.diagnostics.length },
  })
}

function pause(): void {
  store.isPaused = true
  store.isRunning = false
  void addActivity('ANALYSIS_PAUSED', `Análisis pausado en el índice ${store.currentIndex}.`, {
    metadata: { index: store.currentIndex, state: store.currentState },
  })
}

function resetFromButton(): void {
  reset()
  suggestions.value = []
  void addActivity('ANALYSIS_RESET', 'Se reinició el autómata.', {
    metadata: { sourceLength: store.sourceCode.length },
  })
}

function exportJson(): void {
  const payload = {
    source: store.sourceCode,
    tokens: store.tokens,
    lexicalSymbols: store.symbolTable,
    semanticSymbols: store.semanticSymbols,
    lexicalErrors: store.errors,
    syntaxErrors: store.syntaxErrors,
    semanticErrors: store.semanticErrors,
    semanticWarnings: store.semanticWarnings,
    semanticMode: semanticMode.value,
    warningsEnabled: warningsEnabled.value,
    semanticBlocked: semanticBlocked.value,
    suggestions: suggestions.value,
    ast: store.ast,
    comments: store.comments,
    statistics: {
      totalTokens: store.tokens.length,
      totalLexicalErrors: store.errors.length,
      totalSyntaxErrors: store.syntaxErrors.length,
      totalSemanticErrors: store.semanticErrors.length,
      totalSemanticWarnings: store.semanticWarnings.length,
      totalComments: store.comments.length,
      totalCharacters: store.sourceCode.length,
      totalLines: totalLines.value,
      finalState: store.currentState,
    },
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'analisis-lxsn-tsmnt-ptprl.json'
  anchor.click()
  URL.revokeObjectURL(url)
  void addActivity('CODE_EXPORTED', `Se exportó el análisis de ${store.sourceCode.length} carácter(es) a JSON.`, {
    after: store.sourceCode,
    metadata: { filename: anchor.download, ...analysisSummary() },
  })
}

function selectError(error: LexicalError): void {
  selectedError.value = error
}

function selectSyntaxError(error: SyntaxError): void {
  selectedSyntaxError.value = error
}

function editCode(current: string): void {
  if (logoutBusy.value) return
  const previous = store.sourceCode
  if (current === previous) return
  store.sourceCode = current
  const change = describeSourceChange(previous, current)
  if (!change) return
  void addActivity(change.type, change.detail, {
    before: previous,
    after: current,
    metadata: change.metadata,
  })
}

async function flushPendingSaves(): Promise<void> {
  while (pendingSaves.length) {
    const pending = pendingSaves[0]
    if (!pending) break
    await analyzerRepository.saveProgram(pending.userId, pending.title, pending.source, 'manual', pending.summary)
    pendingSaves.shift()
    await refreshHistory()
  }
}

function saveCurrentCode(title = '', source?: string): Promise<void> {
  const activeUser = user.value
  if (!activeUser || logoutBusy.value) return Promise.resolve()
  pendingSaves.push({
    userId: activeUser.id,
    title,
    source: source ?? store.sourceCode,
    summary: source === undefined ? analysisSummary() : summarizeSource(source),
  })
  savingCode.value = true
  saveQueue = saveQueue.then(flushPendingSaves).catch(error => {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible guardar el código.'
  }).finally(() => { savingCode.value = false })
  return saveQueue
}

async function importCode(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    if (logoutBusy.value || !user.value) return
    let source = text
    if (file.name.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(text) as { source?: unknown }
      if (typeof parsed.source !== 'string') throw new Error('El JSON debe incluir un campo "source" con el código.')
      source = parsed.source
    }
    if (source.length > 100000) throw new Error('El archivo supera el límite de 100,000 caracteres.')
    const previous = store.sourceCode
    store.sourceCode = source
    await addActivity('CODE_IMPORTED', `Se importó '${file.name}' al editor.`, {
      before: previous,
      after: source,
      metadata: { filename: file.name, bytes: file.size },
    })
  } catch (error) {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible importar el archivo.'
  }
}

async function exportHistory(): Promise<void> {
  const activeUser = user.value
  if (!activeUser) return
  try {
    await addActivity('HISTORY_EXPORTED', 'Se descargó una copia del historial personal en JSON.')
    const [savedPrograms, savedActivities] = await Promise.all([
      analyzerRepository.listPrograms(activeUser.id),
      analyzerRepository.listActivities(activeUser.id),
    ])
    const payload = { user: activeUser, exportedAt: new Date().toISOString(), programs: savedPrograms, activities: savedActivities }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `historial-${activeUser.username}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible exportar el historial.'
  }
}

async function loadProgram(program: SavedProgram): Promise<void> {
  if (logoutBusy.value) return
  const previous = store.sourceCode
  store.sourceCode = program.source
  await addActivity('CODE_LOADED', `Se cargó '${program.title}' desde la galería personal.`, {
    before: previous,
    after: program.source,
    metadata: { programId: program.id, title: program.title, kind: program.kind },
  })
}

async function loadExample(example: LanguageExample): Promise<void> {
  if (logoutBusy.value) return
  const previous = store.sourceCode
  store.sourceCode = example.source
  await addActivity('CODE_LOADED', `Se cargó el ejemplo '${example.title}' en el editor.`, {
    before: previous,
    after: example.source,
    metadata: { title: example.title, topic: example.topic, source: 'catalog' },
  })
}

function saveExample(example: LanguageExample): Promise<void> {
  return saveCurrentCode(example.title, example.source)
}

function applySuggestion(suggestion: CorrectionSuggestion): void {
  if (logoutBusy.value) return
  if (!canApplySuggestion(suggestion)) return
  const previous = store.sourceCode
  const corrected = applyCorrectionSuggestion(previous, suggestion)
  if (corrected === previous) return
  store.sourceCode = corrected
  void addActivity('AUTO_FIX_APPLIED', `Se aplicó la corrección: ${suggestion.title}.`, {
    before: previous,
    after: corrected,
    metadata: { suggestion },
  })
}

function restoreActivity(activity: ActivityLogEntry): void {
  if (logoutBusy.value) return
  if (activity.after === undefined || activity.userId !== user.value?.id) return
  const previous = store.sourceCode
  store.sourceCode = activity.after
  void addActivity('CODE_RESTORED', `Se restauró la versión del ${new Date(activity.createdAt).toLocaleString('es-MX')}.`, {
    before: previous,
    after: activity.after,
    metadata: { activityId: activity.id, originalSequence: activity.sequence },
  })
}

async function login(username: string, password: string): Promise<void> {
  loginBusy.value = true
  authError.value = ''
  try {
    const authenticatedUser = await analyzerRepository.login(username, password)
    if (!authenticatedUser) {
      authError.value = 'Usuario o contraseña incorrectos. Prueba con ana/1234 o luis/1234.'
      return
    }
    user.value = authenticatedUser
    await migrateOldData()
    await refreshHistory()
    await restoreRecentCode()
    run('session')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible iniciar sesión.'
    if (user.value) persistenceError.value = message
    else authError.value = message
  } finally {
    loginBusy.value = false
  }
}

async function register(username: string, displayName: string, password: string): Promise<void> {
  loginBusy.value = true
  authError.value = ''
  try {
    const registeredUser = await analyzerRepository.register(username, displayName, password)
    user.value = registeredUser
    await migrateOldData()
    await refreshHistory()
    await restoreRecentCode()
    run('session')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible crear la cuenta.'
    if (user.value) persistenceError.value = message
    else authError.value = message
  } finally {
    loginBusy.value = false
  }
}

async function logout(): Promise<void> {
  if (logoutBusy.value) return
  logoutBusy.value = true
  if (debounceTimer) clearTimeout(debounceTimer)
  try {
    await Promise.all([activityQueue, analysisQueue, saveQueue])
    await flushPendingActivities()
    await flushPendingAnalyses()
    await flushPendingSaves()
    await analyzerRepository.logout()
  } catch (error) {
    persistenceError.value = error instanceof Error ? error.message : 'No fue posible cerrar sesión.'
    logoutBusy.value = false
    return
  }
  pendingActivities.length = 0
  pendingAnalyses.length = 0
  pendingSaves.length = 0
  user.value = null
  historyRequestId += 1
  if (debounceTimer) clearTimeout(debounceTimer)
  if (activityRefreshTimer) clearTimeout(activityRefreshTimer)
  programs.value = []
  activities.value = []
  suggestions.value = []
  migrationNotice.value = ''
  store.sourceCode = ''
  store.clear()
  logoutBusy.value = false
}

watch(() => store.sourceCode, (current, previous) => {
  if (!user.value) return
  if (current === previous) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => run('auto'), 280)
})

onMounted(async () => {
  try {
    await analyzerRepository.initialize()
    user.value = await analyzerRepository.currentUser()
    if (user.value) {
      await migrateOldData()
      await refreshHistory()
      await restoreRecentCode()
      run('session')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible preparar la base de datos.'
    if (user.value) persistenceError.value = message
    else authError.value = message
  } finally {
    appReady.value = true
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (activityRefreshTimer) clearTimeout(activityRefreshTimer)
})
</script>

<template>
  <main v-if="!appReady" class="loading-page">Preparando la base de datos local…</main>
  <LoginPanel v-else-if="!user" :busy="loginBusy" :error="authError" @login="login" @register="register" @mode-changed="authError = ''" />
  <main v-else :inert="logoutBusy" :aria-busy="logoutBusy">
    <header>
      <div>
        <p class="eyebrow">Vue 3 · TypeScript · AFD · Parser · Semántica · SQLite</p>
        <h1>Analizador de noEsPython:(</h1>
        <p>Análisis local con correcciones, galería personal e historial cronológico por usuario.</p>
        <p class="session-user">Sesión: <strong>{{ user.displayName }}</strong> (@{{ user.username }}) · Base de datos SQLite activa</p>
      </div>
      <div class="actions">
        <button @click="runLexicalStage">Analizar léxico</button>
        <button class="primary" @click="runSyntacticStage">Analizar sintáctico (primero léxico)</button>
        <button @click="run('manual')">Analizar todo</button>
        <button class="primary" @click="runInterpreter">Analizar y ejecutar</button>
        <label class="semantic-mode-picker">Modo semántico
          <select v-model="semanticMode" aria-label="Modo de análisis semántico">
            <option value="permissive">Flexible · los warnings no bloquean</option>
            <option value="strict">Estricto · bloquear con diagnósticos</option>
          </select>
        </label>
        <label class="warning-toggle">
          <input v-model="warningsEnabled" type="checkbox" />
          Mostrar warnings
        </label>
        <button @click="saveCurrentCode()">Guardar código</button>
        <button @click="fileInput?.click()">Importar código</button>
        <input ref="fileInput" class="visually-hidden" type="file" accept=".txt,.lxs,.lxsn,.json,text/plain,application/json" aria-label="Seleccionar código para importar" @change="importCode" />
        <button @click="step">Siguiente carácter</button>
        <button @click="nextToken">Siguiente token</button>
        <button @click="pause">Pausar</button>
        <button @click="resetFromButton">Reiniciar</button>
        <button @click="exportJson">Exportar JSON</button>
        <button @click="exportHistory">Exportar historial</button>
        <button v-if="canMigrateLocal" @click="migrateOldData(true)">Migrar datos anteriores</button>
        <button class="logout" @click="logout">Salir</button>
      </div>
    </header>
    <p v-if="persistenceError" class="storage-error" role="alert">{{ persistenceError }}</p>
    <p v-if="migrationNotice" class="migration-notice" role="status">{{ migrationNotice }}</p>
    <div class="workspace">
      <CodeEditor :model-value="store.sourceCode" :current-index="store.currentIndex" :error-index="selectedErrorIndex" :syntax-errors="store.syntaxErrors" @update:model-value="editCode" />
      <aside>
        <DebuggerPanel :index="store.currentIndex" :line="store.currentLine" :column="store.currentColumn" :character="store.currentCharacter" :state="store.currentState" :event="latestEvent" />
        <StatisticsPanel :tokens="store.tokens.length" :errors="store.errors.length + store.syntaxErrors.length + store.semanticErrors.length + store.semanticWarnings.length" :comments="store.comments.length" :characters="store.currentIndex" :lines="totalLines" :state="store.currentState" />
        <CodeGallery :programs="programs" :busy="savingCode" @save="saveCurrentCode" @load="loadProgram" @load-example="loadExample" @save-example="saveExample" />
      </aside>
    </div>
    <ErrorConsole :errors="store.errors" @select="selectError" />
    <SyntaxErrorPanel :errors="store.syntaxErrors" @select="selectSyntaxError" />
    <AnalysisFeedback :semantic-errors="store.semanticErrors" :semantic-warnings="store.semanticWarnings" :suggestions="suggestions" :mode="semanticMode" :warnings-enabled="warningsEnabled" :blocked="semanticBlocked" @apply="applySuggestion" />
    <InterpreterPanel :result="interpreterResult" :prevented-message="executionMessage" />
    <div class="tables">
      <TokenTable :tokens="store.tokens" :errors="store.errors.length" />
      <SymbolTable :lexical-symbols="store.symbolTable" :semantic-symbols="store.semanticSymbols" />
      <AstViewer :ast="store.ast" />
      <CommentTable :comments="store.comments" />
    </div>
    <ActivityLogPanel :activities="activities" :username="user.username" :display-name="user.displayName" @restore="restoreActivity" />
  </main>
</template>
