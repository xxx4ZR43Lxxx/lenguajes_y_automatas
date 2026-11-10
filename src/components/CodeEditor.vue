<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SyntaxError } from '../core/parser/SyntaxError'

const props = defineProps<{
  modelValue: string
  currentIndex: number
  errorIndex?: number
  syntaxErrors: SyntaxError[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const scrollTop = ref(0)
const scrollLeft = ref(0)
const liveCode = ref(props.modelValue)
const lineNumbers = computed(() => liveCode.value.split('\n').map((_, index) => index + 1))
const before = computed(() => props.modelValue.slice(0, props.currentIndex))
const active = computed(() => (props.currentIndex < props.modelValue.length ? props.modelValue[props.currentIndex] : 'EOF'))
const after = computed(() => props.modelValue.slice(props.currentIndex + 1))

const isLetter = (character: string): boolean =>
  (character >= 'a' && character <= 'z') ||
  (character >= 'A' && character <= 'Z') ||
  character === '_' ||
  character === 'ñ' ||
  character === 'Ñ'
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

const arithmeticWords = new Set(['mas', 'menos', 'por', 'entre', 'entre_entero', 'modulo'])
const logicalWords = new Set(['y', 'o', 'no'])
const relationalWords = new Set(['menor_igual', 'mayor_igual', 'igual_a', 'distinto_de'])
const ioWords = new Set(['impresora', 'chismea', 'atrapa', 'pregunta', 'damedatos', 'abrir', 'leer', 'leer_linea', 'escribir', 'cerrar'])
const mathWords = new Set(['seno', 'coseno', 'tangente', 'logaritmo', 'raiz_cuadrada', 'valor_absoluto', 'potencia'])
const reservedWords = new Set([
  'guarda', 'fijo', 'si', 'sino', 'bucle_por', 'bucle_mientras', 'tarea', 'resultado', 'clase',
  'hereda', 'extiende', 'nuevo', 'este', 'lambda', 'para_cada', 'en', 'salir', 'continuar',
  'sin_operacion', 'afirmar', 'intentar', 'capturar', 'finalmente', 'lanzar', 'importar', 'desde', 'como',
  'con', 'seleccionar', 'caso', 'ceder', 'asincrono', 'esperar', 'verdadero', 'falso', 'nulo', 'no_en',
])

const highlightedCode = computed(() => {
  const code = liveCode.value
  let result = ''
  let index = 0
  const len = code.length

  while (index < len) {
    const ch = code[index]

    // Comentario del lenguaje: :) contenido :( .
    if (code.startsWith(':)', index)) {
      let comment = ':)'
      index += 2
      while (index < len && !code.startsWith(':(', index)) {
        comment += code[index]
        index += 1
      }
      if (index < len) {
        comment += ':('
        index += 2
      }
      result += `<span class="op-comment">${escapeHtml(comment)}</span>`
      continue
    }

    // Comentarios monolínea //
    if (ch === '/' && code[index + 1] === '/') {
      let comment = ''
      while (index < len && code[index] !== '\n') {
        comment += code[index]
        index += 1
      }
      result += `<span class="op-comment">${escapeHtml(comment)}</span>`
      continue
    }

    // Comentarios de una línea con doble barra invertida.
    if (ch === '\\' && code[index + 1] === '\\') {
      let comment = ''
      while (index < len && code[index] !== '\n') {
        comment += code[index]
        index += 1
      }
      result += `<span class="op-comment">${escapeHtml(comment)}</span>`
      continue
    }

    // Comentarios multilínea /* ... */
    if (ch === '/' && code[index + 1] === '*') {
      let comment = '/*'
      index += 2
      while (index < len) {
        if (code[index] === '*' && code[index + 1] === '/') {
          comment += '*/'
          index += 2
          break
        }
        comment += code[index]
        index += 1
      }
      result += `<span class="op-comment">${escapeHtml(comment)}</span>`
      continue
    }

    // Comentarios con #
    if (ch === '#') {
      let comment = ''
      while (index < len && code[index] !== '\n') {
        comment += code[index]
        index += 1
      }
      result += `<span class="op-comment">${escapeHtml(comment)}</span>`
      continue
    }

    // Las cadenas empiezan y terminan con tres puntos; pueden ocupar varias líneas.
    if (code.startsWith('...', index)) {
      let str = '...'
      index += 3
      while (index < len && !code.startsWith('...', index)) {
        str += code[index]
        index += 1
      }
      if (index < len) {
        str += '...'
        index += 3
      }
      result += `<span class="literal-string">${escapeHtml(str)}</span>`
      continue
    }

    // Variables con dólar $a, $b o símbolo $ solo
    if (ch === '$') {
      let name = '$'
      index += 1
      while (index < len && (isLetter(code[index]) || isDigit(code[index]))) {
        name += code[index]
        index += 1
      }
      if (name.length > 1) {
        result += `<span class="op-variable">${escapeHtml(name)}</span>`
      } else {
        result += `<span class="op-special">${escapeHtml(name)}</span>`
      }
      continue
    }

    // Variables entre corchetes [a], [b]
    if (ch === '[') {
      let look = index + 1
      let inner = ''
      while (look < len && code[look] !== ']' && code[look] !== '\n' && code[look] !== ' ' && code[look] !== ',') {
        inner += code[look]
        look += 1
      }
      if (inner.length > 0 && isLetter(inner[0]) && look < len && code[look] === ']') {
        const full = `[${inner}]`
        result += `<span class="op-variable">${escapeHtml(full)}</span>`
        index = look + 1
        continue
      }
    }

    // Palabras e identificadores
    if (isLetter(ch)) {
      let word = ch
      index += 1
      while (index < len && (isLetter(code[index]) || isDigit(code[index]))) {
        word += code[index]
        index += 1
      }
      const lower = word.toLowerCase()

      // Comentario rem
      if (lower === 'rem' && (index >= len || code[index] === ' ' || code[index] === '\t' || code[index] === '\n')) {
        let comment = word
        while (index < len && code[index] !== '\n') {
          comment += code[index]
          index += 1
        }
        result += `<span class="op-comment">${escapeHtml(comment)}</span>`
        continue
      }

      if (arithmeticWords.has(lower)) {
        result += `<span class="op-arithmetic">${escapeHtml(word)}</span>`
      } else if (logicalWords.has(lower)) {
        result += `<span class="op-logical op-logical--${lower}">${escapeHtml(word)}</span>`
      } else if (relationalWords.has(lower)) {
        result += `<span class="op-relational">${escapeHtml(word)}</span>`
      } else if (ioWords.has(lower)) {
        result += `<span class="reserved-word">${escapeHtml(word)}</span>`
      } else if (mathWords.has(lower)) {
        result += `<span class="op-arithmetic">${escapeHtml(word)}</span>`
      } else if (lower === 'inf' || lower === 'infinity' || lower === 'nan') {
        result += `<span class="number-literal">${escapeHtml(word)}</span>`
      } else if (reservedWords.has(lower)) {
        result += `<span class="reserved-word">${escapeHtml(word)}</span>`
      } else {
        result += escapeHtml(word)
      }
      continue
    }

    // Números enteros y decimales.
    if (isDigit(ch) || (ch === '.' && index + 1 < len && isDigit(code[index + 1]))) {
      let num = ch
      index += 1
      while (index < len && (isDigit(code[index]) || (code[index] === '.' && !code.startsWith('...', index)))) {
        num += code[index]
        index += 1
      }
      result += `<span class="number-literal">${escapeHtml(num)}</span>`
      continue
    }

    // Los comparadores con paréntesis se distinguen de suma y resta.
    if (code.startsWith('(-)', index) || code.startsWith('(+)', index)) {
      result += `<span class="op-relational">${escapeHtml(code.slice(index, index + 3))}</span>`
      index += 3
      continue
    }

    // Operadores aritméticos multicarácter y división punto
    if (ch === '+' && code[index + 1] === '+') {
      result += `<span class="op-arithmetic">++</span>`
      index += 2
      continue
    }
    if (ch === '-' && code[index + 1] === '-') {
      result += `<span class="op-arithmetic">--</span>`
      index += 2
      continue
    }
    if (ch === '*' && code[index + 1] === '*') {
      result += `<span class="op-arithmetic">**</span>`
      index += 2
      continue
    }
    if (ch === '.' && code[index + 1] === '/') {
      result += `<span class="op-arithmetic">./</span>`
      index += 2
      continue
    }

    // Operadores aritméticos de 1 carácter
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      result += `<span class="op-arithmetic">${escapeHtml(ch)}</span>`
      index += 1
      continue
    }

    // Operadores lógicos simbólicos multicarácter y de 1 carácter
    if (ch === '&' && code[index + 1] === '&') {
      result += `<span class="op-logical op-logical--and">&amp;&amp;</span>`
      index += 2
      continue
    }
    if (ch === '|' && code[index + 1] === '|') {
      result += `<span class="op-logical op-logical--or">||</span>`
      index += 2
      continue
    }
    if (ch === '&' || ch === '|' || ch === '!' || ch === '~' || ch === '¬') {
      if (ch === '!' && code[index + 1] === '=') {
        result += `<span class="op-relational">!=</span>`
        index += 2
        continue
      }
      result += `<span class="op-logical">${escapeHtml(ch)}</span>`
      index += 1
      continue
    }

    // Comparadores nuevos: mayor/menor igual e igualdad.
    if (code.startsWith('=(+)', index) || code.startsWith('=(-)', index)) {
      result += `<span class="op-relational">${escapeHtml(code.slice(index, index + 4))}</span>`
      index += 4
      continue
    }
    if (code.startsWith('==>', index)) {
      result += `<span class="op-relational">==&gt;</span>`
      index += 3
      continue
    }

    // Operadores relacionales simbólicos
    if (ch === '=' && code[index + 1] === '=') {
      result += `<span class="op-relational">==</span>`
      index += 2
      continue
    }
    if (ch === '<' && code[index + 1] === '=') {
      result += `<span class="op-relational">&lt;=</span>`
      index += 2
      continue
    }
    if (ch === '>' && code[index + 1] === '=') {
      result += `<span class="op-relational">&gt;=</span>`
      index += 2
      continue
    }
    if (ch === '<' && code[index + 1] === '>') {
      result += `<span class="op-relational">&lt;&gt;</span>`
      index += 2
      continue
    }
    if (ch === '<' && code[index + 1] === '-') {
      result += `<span class="op-assignment">&lt;-</span>`
      index += 2
      continue
    }
    if (ch === '-' && code[index + 1] === '>') {
      result += `<span class="op-assignment">-&gt;</span>`
      index += 2
      continue
    }
    if (ch === '<') {
      result += `<span class="op-relational">&lt;</span>`
      index += 1
      continue
    }
    if (ch === '>') {
      result += `<span class="op-relational">&gt;</span>`
      index += 1
      continue
    }
    if (ch === '=') {
      result += `<span class="op-assignment">=</span>`
      index += 1
      continue
    }

    // Operadores especiales
    if (ch === ';' && code[index + 1] === ';') {
      result += `<span class="op-special">;;</span>`
      index += 2
      continue
    }
    if (ch === ':' && code[index + 1] === ':') {
      result += `<span class="op-special">::</span>`
      index += 2
      continue
    }
    if (ch === '?' && code[index + 1] === ':') {
      result += `<span class="op-special">?:</span>`
      index += 2
      continue
    }
    if (ch === 'à') {
      result += `<span class="op-special">à</span>`
      index += 1
      continue
    }

    result += escapeHtml(ch)
    index += 1
  }

  return result
})

const editorOffset = computed(() => `translate(${-scrollLeft.value}px, ${-scrollTop.value}px)`)
const gutterOffset = computed(() => `translateY(${-scrollTop.value}px)`)

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

function applyEditorEdit(editor: HTMLTextAreaElement, code: string, selectionStart: number, selectionEnd: number): void {
  liveCode.value = code
  emit('update:modelValue', code)
  requestAnimationFrame(() => {
    editor.focus()
    editor.setSelectionRange(selectionStart, selectionEnd)
  })
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return

  // Tab se usa para sangrar el código; nunca debe sacar el foco del editor.
  event.preventDefault()
  const editor = event.currentTarget as HTMLTextAreaElement
  const code = editor.value
  const start = editor.selectionStart
  const end = editor.selectionEnd
  const firstLineStart = code.lastIndexOf('\n', Math.max(0, start - 1)) + 1

  // Sin selección, inserta espacios hasta el siguiente tabulador de dos columnas.
  if (start === end && !event.shiftKey) {
    const spaces = 2 - ((start - firstLineStart) % 2)
    const updated = `${code.slice(0, start)}${' '.repeat(spaces)}${code.slice(end)}`
    applyEditorEdit(editor, updated, start + spaces, start + spaces)
    return
  }

  // Con una selección se sangran las líneas completas; Shift+Tab las desindenta.
  const selectedEnd = end > start && code[end - 1] === '\n' ? end - 1 : end
  const nextLineBreak = code.indexOf('\n', selectedEnd)
  const blockEnd = nextLineBreak === -1 ? code.length : nextLineBreak
  const lines = code.slice(firstLineStart, blockEnd).split('\n')
  const updatedLines = event.shiftKey
    ? lines.map(line => line.startsWith('\t') ? line.slice(1) : line.replace(/^ {1,2}/, ''))
    : lines.map(line => `  ${line}`)
  const updatedBlock = updatedLines.join('\n')
  const updated = `${code.slice(0, firstLineStart)}${updatedBlock}${code.slice(blockEnd)}`

  if (event.shiftKey && start === end) {
    const removed = lines[0].length - updatedLines[0].length
    const caret = Math.max(firstLineStart, start - removed)
    applyEditorEdit(editor, updated, caret, caret)
    return
  }

  const newBlockEnd = firstLineStart + updatedBlock.length
  applyEditorEdit(editor, updated, firstLineStart, newBlockEnd)
}

function hasSyntaxError(line: number): boolean {
  return props.syntaxErrors.some(error => error.line === line)
}

watch(
  () => props.modelValue,
  value => {
    liveCode.value = value
  }
)
</script>

<template>
  <section class="editor panel">
    <div class="editor-title">
      <div class="editor-heading">
        <h2>Editor de Código</h2>
        <div class="color-legend">
          <span class="legend-tag tag-arithmetic">Aritméticos (+, -, mas, menos)</span>
          <span class="legend-tag tag-logical">Lógicos (y, o, no)</span>
          <span class="legend-tag tag-string">Cadenas (...texto...)</span>
          <span class="legend-tag tag-number">Números</span>
        </div>
      </div>
      <span v-if="currentIndex <= modelValue.length">Cursor AFD: {{ currentIndex }}</span>
    </div>
    <div class="editor-body">
      <!-- Números de línea alineados del lado izquierdo -->
      <div class="line-number-gutter" aria-hidden="true">
        <div class="line-numbers" :style="{ transform: gutterOffset }">
          <span
            v-for="line in lineNumbers"
            :key="line"
            :class="{ 'syntax-error-line': hasSyntaxError(line) }"
          >
            {{ line }}
            <b v-if="hasSyntaxError(line)">!</b>
          </span>
        </div>
      </div>
      <div class="editor-code-area">
        <pre
          class="highlight-layer"
          aria-hidden="true"
          :style="{ transform: editorOffset }"
          v-html="highlightedCode || ' '"
        />
        <textarea
          :value="modelValue"
          maxlength="100000"
          wrap="off"
          spellcheck="false"
          aria-label="Código fuente"
          @input="updateCode"
          @keydown="handleEditorKeydown"
          @scroll="syncScroll"
        />
      </div>
    </div>
    <p class="hint">Recorrido del AFD (carácter procesado resaltado; el código no se ejecuta):</p>
    <pre class="execution-preview"><span>{{ before }}</span><mark>{{ active === '\n' ? '↵\n' : active }}</mark><span>{{ after }}</span></pre>
    <p class="hint">Al elegir un error se indica su índice: {{ errorIndex ?? '—' }}.</p>
  </section>
</template>
