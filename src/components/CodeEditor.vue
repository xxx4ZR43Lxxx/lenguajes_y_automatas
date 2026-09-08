<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SyntaxError } from '../core/parser/SyntaxError'

const props = defineProps<{ modelValue: string; currentIndex: number; errorIndex?: number; syntaxErrors: SyntaxError[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const scrollTop = ref(0)
const scrollLeft = ref(0)
const liveCode = ref(props.modelValue)
const lineNumbers = computed(() => liveCode.value.split('\n').map((_, index) => index + 1))
const before = computed(() => props.modelValue.slice(0, props.currentIndex))
const active = computed(() => props.currentIndex < props.modelValue.length ? props.modelValue[props.currentIndex] : 'EOF')
const after = computed(() => props.modelValue.slice(props.currentIndex + 1))

const isLetter = (character: string): boolean => (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || character === '_'
const isDigit = (character: string): boolean => character >= '0' && character <= '9'
const escapeHtml = (text: string): string => {
  let escaped = ''
  for (const character of text) {
    if (character === '&') escaped += '&amp;'
    else if (character === '<') escaped += '&lt;'
    else if (character === '>') escaped += '&gt;'
    else escaped += character
  }
  return escaped
}
const highlightedCode = computed(() => {
  let result = ''
  let index = 0
  const logicalWords = ['and', 'or', 'not', 'xor', 'xort', 'nand', 'nor', 'xnor']
  while (index < liveCode.value.length) {
    const first = liveCode.value[index]
    if (isLetter(first)) {
      let word = first
      index += 1
      while (index < liveCode.value.length && (isLetter(liveCode.value[index]) || isDigit(liveCode.value[index]))) { word += liveCode.value[index]; index += 1 }
      const normalized = word.toLowerCase()
      if (logicalWords.includes(normalized)) result += `<span class="logical-operator logical-operator--${normalized}">${escapeHtml(word)}</span>`
      else if (normalized === 'impresora' || normalized === 'teclado') result += `<span class="reserved-word">${escapeHtml(word)}</span>`
      else result += escapeHtml(word)
      continue
    }
    if (isDigit(first)) {
      let number = first
      index += 1
      while (index < liveCode.value.length && (isDigit(liveCode.value[index]) || liveCode.value[index] === '.')) { number += liveCode.value[index]; index += 1 }
      result += `<span class="number-literal">${escapeHtml(number)}</span>`
      continue
    }
    result += escapeHtml(first)
    index += 1
  }
  return result
})

const editorOffset = computed(() => `translate(${-scrollLeft.value}px, ${-scrollTop.value}px)`)

function syncScroll(event: Event): void {
  const editor = event.target as HTMLTextAreaElement
  scrollTop.value = editor.scrollTop
  scrollLeft.value = editor.scrollLeft
}

function updateCode(event: Event): void {
  const code = (event.target as HTMLTextAreaElement).value
  liveCode.value = code
  emit('update:modelValue', code)
}

function hasSyntaxError(line: number): boolean { return props.syntaxErrors.some(error => error.line === line) }

watch(() => props.modelValue, value => { liveCode.value = value })
</script>

<template>
  <section class="editor panel">
    <div class="editor-title">
      <h2>Fuente</h2>
      <span v-if="currentIndex <= modelValue.length">Cursor AFD: {{ currentIndex }}</span>
    </div>
    <div class="editor-body">
      <div class="line-number-gutter" aria-hidden="true">
        <div class="line-numbers" :style="{ transform: editorOffset }"><span v-for="line in lineNumbers" :key="line" :class="{ 'syntax-error-line': hasSyntaxError(line) }">{{ line }}<b v-if="hasSyntaxError(line)">!</b></span></div>
      </div>
      <div class="editor-code-area">
        <pre class="highlight-layer" aria-hidden="true" :style="{ transform: editorOffset }" v-html="highlightedCode || ' '" />
        <textarea
          :value="modelValue"
          maxlength="100000"
          wrap="off"
          spellcheck="false"
          aria-label="Código fuente"
          @input="updateCode"
          @scroll="syncScroll"
        />
      </div>
    </div>
    <p class="hint">Vista de ejecución (carácter procesado resaltado):</p>
    <pre class="execution-preview"><span>{{ before }}</span><mark>{{ active === '\n' ? '↵\n' : active }}</mark><span>{{ after }}</span></pre>
    <p class="hint">Al elegir un error se indica su índice: {{ errorIndex ?? '—' }}.</p>
  </section>
</template>
