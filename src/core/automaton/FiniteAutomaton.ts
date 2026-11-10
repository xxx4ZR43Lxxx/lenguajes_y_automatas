import type { Comment } from '../comments/Comment'
import type { LexicalError } from '../errors/LexicalError'
import { LexicalErrorType } from '../errors/LexicalErrorType'
import type { LexerEvent, LexerListener } from '../events/LexerEvent'
import { delimiterTypes, wordTypes } from '../language/Language'
import type { LexicalSymbol } from '../symbols/LexicalSymbolTable'
import type { Token } from '../tokens/Token'
import { TokenType } from '../tokens/TokenType'

export interface AutomatonResult {
  tokens: Token[]
  symbolTable: LexicalSymbol[]
  errors: LexicalError[]
  comments: Comment[]
}

export interface FiniteAutomaton {
  readonly source: string
  readonly index: number
  readonly line: number
  readonly column: number
  readonly currentCharacter: string | null
  readonly currentState: string
  readonly isFinished: boolean
  subscribe(listener: LexerListener): () => void
  step(): AutomatonResult
  tokenize(): AutomatonResult
  result(): AutomatonResult
}

type Capture = { text: string; index: number; line: number; column: number }

const isDigit = (character: string): boolean => character >= '0' && character <= '9'
const isLetter = (character: string): boolean =>
  (character >= 'a' && character <= 'z') ||
  (character >= 'A' && character <= 'Z') ||
  character === 'ñ' ||
  character === 'Ñ'
const isIdentifierStart = (character: string): boolean => isLetter(character) || character === '_'
const isIdentifierPart = (character: string): boolean => isIdentifierStart(character) || isDigit(character)
const isWhitespace = (character: string): boolean =>
  character === ' ' || character === '\t' || character === '\n' || character === '\r'

/**
 * Autómata finito determinista puro implementado mediante estados explícitos
 * y transiciones de un carácter sin usar expresiones regulares ni librerías externas.
 */
export function createFiniteAutomaton(source: string): FiniteAutomaton {
  let index = 0
  let line = 1
  let column = 1
  let state = 'START'
  let ended = false
  let capture: Capture | null = null
  const rawTokens: Token[] = []
  const tokens: Token[] = []
  const lexicalSymbols = new Map<string, LexicalSymbol>()
  const errors: LexicalError[] = []
  const comments: Comment[] = []
  const listeners = new Set<LexerListener>()

  const currentCharacter = (): string | null => source[index] ?? null
  const peek = (offset = 0): string | null => source[index + offset] ?? null

  const emit = (partial: Omit<LexerEvent, 'index' | 'line' | 'column'>): void => {
    const event: LexerEvent = { ...partial, index, line, column }
    listeners.forEach(listener => listener(event))
  }

  const transition = (next: string): void => {
    state = next
    emit({ type: 'STATE_CHANGED', state })
  }

  const take = (): string => {
    const character = currentCharacter()
    if (character === null) return ''
    index += 1
    if (character === '\n') {
      line += 1
      column = 1
    } else {
      column += 1
    }
    emit({ type: 'CHAR_READ', character })
    return character
  }

  const startCapture = (next: string): void => {
    const start = { index, line, column }
    capture = { text: take(), ...start }
    transition(next)
  }

  const makeToken = (
    type: TokenType,
    lexeme: string,
    value: unknown,
    finalState: string,
    start: Capture,
    endIndex = index
  ): Token => ({
    type,
    lexeme,
    value,
    finalState,
    line: start.line,
    column: start.column,
    startIndex: start.index,
    endIndex,
  })

  const addError = (type: LexicalErrorType, message: string, lexeme: string, start: Capture): void => {
    const error: LexicalError = {
      type,
      message,
      lexeme,
      line: start.line,
      column: start.column,
      startIndex: start.index,
      endIndex: index,
    }
    errors.push(error)
    emit({ type: 'LEXICAL_ERROR', error })
    ended = true
    transition('ERROR')
  }

  const isIdentifierToken = (type?: TokenType): boolean =>
    type === TokenType.IDENTIFIER ||
    type === TokenType.DOLLAR_VARIABLE ||
    type === TokenType.BRACKETED_VARIABLE

  const normalizeSigns = (): void => {
    const normalized: Token[] = []
    for (let position = 0; position < rawTokens.length; position += 1) {
      const current = rawTokens[position]
      const next = rawTokens[position + 1]
      const previous = normalized.at(-1)

      // Identificar incrementos ++ o pre/post
      if (current.lexeme === '++') {
        if (isIdentifierToken(previous?.type)) {
          normalized.push({ ...current, type: TokenType.POST_INCREMENT, value: '++', finalState: 'POST_INCREMENT_ACCEPT' })
          continue
        }
        if (isIdentifierToken(next?.type)) {
          normalized.push({ ...current, type: TokenType.PRE_INCREMENT, value: '++', finalState: 'PRE_INCREMENT_ACCEPT' })
          continue
        }
      }

      // Identificar decrementos -- o pre/post
      if (current.lexeme === '--') {
        if (isIdentifierToken(previous?.type)) {
          normalized.push({ ...current, type: TokenType.POST_DECREMENT, value: '--', finalState: 'POST_DECREMENT_ACCEPT' })
          continue
        }
        if (isIdentifierToken(next?.type)) {
          normalized.push({ ...current, type: TokenType.PRE_DECREMENT, value: '--', finalState: 'PRE_DECREMENT_ACCEPT' })
          continue
        }
      }

      // Caso de dos signos consecutivos en palabras ("mas menos", "menos menos", etc.) o símbolos
      if (current.type === TokenType.PLUS || current.type === TokenType.MINUS) {
        if (next && (next.type === TokenType.PLUS || next.type === TokenType.MINUS)) {
          const following = rawTokens[position + 2]
          const joined = `${current.lexeme} ${next.lexeme}`
          const base = {
            lexeme: joined,
            line: current.line,
            column: current.column,
            startIndex: current.startIndex,
            endIndex: next.endIndex,
            finalState: 'SIGN_RULE_ACCEPT',
          }

          // Si el siguiente es un decremento/incremento explícito que precede un identificador (como - --x),
          // no consumimos el decremento aquí, dejamos que current sea signo unario.
          if ((next.lexeme === '--' || next.lexeme === '++') && isIdentifierToken(following?.type)) {
            normalized.push(current)
            continue
          }

          // Si son dos signos que forman decremento con identificador
          if (current.type === TokenType.MINUS && next.type === TokenType.MINUS && isIdentifierToken(previous?.type)) {
            normalized.push({ ...base, type: TokenType.POST_DECREMENT, value: '--' })
            position += 1
            continue
          }
          if (current.type === TokenType.MINUS && next.type === TokenType.MINUS && isIdentifierToken(following?.type)) {
            normalized.push({ ...base, type: TokenType.PRE_DECREMENT, value: '--' })
            position += 1
            continue
          }

          // Si son dos signos que forman incremento con identificador
          if (current.type === TokenType.PLUS && next.type === TokenType.PLUS && isIdentifierToken(previous?.type)) {
            normalized.push({ ...base, type: TokenType.POST_INCREMENT, value: '++' })
            position += 1
            continue
          }
          if (current.type === TokenType.PLUS && next.type === TokenType.PLUS && isIdentifierToken(following?.type)) {
            normalized.push({ ...base, type: TokenType.PRE_INCREMENT, value: '++' })
            position += 1
            continue
          }

          // Ley de signos estándar: (+ +) -> +, (+ -) -> -, (- +) -> -, (- -) -> +
          const isNegative = current.type !== next.type
          normalized.push({
            ...base,
            type: isNegative ? TokenType.MINUS : TokenType.PLUS,
            value: isNegative ? '-' : '+',
          })
          position += 1
          continue
        }
      }

      normalized.push(current)
    }
    tokens.splice(0, tokens.length, ...normalized)
  }

  const addToken = (
    type: TokenType,
    lexeme: string,
    value: unknown,
    finalState: string,
    start: Capture
  ): void => {
    const token = makeToken(type, lexeme, value, finalState, start)
    if (isIdentifierToken(type)) {
      const key = `${type}\u0000${lexeme}`
      let symbol = lexicalSymbols.get(key)
      if (!symbol) {
        symbol = { name: lexeme, tokenType: type, occurrences: [] }
        lexicalSymbols.set(key, symbol)
      }
      symbol.occurrences.push({ line: token.line, column: token.column, startIndex: token.startIndex, endIndex: token.endIndex })
    }
    rawTokens.push(token)
    normalizeSigns()
    emit({ type: 'TOKEN_CREATED', token })
  }

  const allDigits = (text: string): boolean => {
    if (text.length === 0) return false
    for (let pos = 0; pos < text.length; pos += 1) {
      if (!isDigit(text[pos])) return false
    }
    return true
  }

  const classifyNumber = (numeric: Capture): void => {
    let dots = 0
    for (let pos = 0; pos < numeric.text.length; pos += 1) {
      if (numeric.text[pos] === '.') dots += 1
    }

    if (dots === 0) {
      addToken(TokenType.INTEGER, numeric.text, Number(numeric.text), 'INTEGER_ACCEPT', numeric)
      return
    }

    if (dots === 1) {
      const dot = numeric.text.indexOf('.')
      const left = numeric.text.slice(0, dot)
      const right = numeric.text.slice(dot + 1)
      const validLeft = left.length === 0 || allDigits(left)
      const validRight = right.length === 0 || allDigits(right)
      if ((left.length > 0 || right.length > 0) && validLeft && validRight) {
        addToken(TokenType.DECIMAL, numeric.text, Number(numeric.text), 'DECIMAL_ACCEPT', numeric)
        return
      }
      addError(LexicalErrorType.INVALID_DECIMAL_LITERAL, 'Número con formato decimal inválido.', numeric.text, numeric)
      return
    }

    // Más de un punto decimal (e.g. 7.3.1 o 2.34.81.2) es un error léxico estricto y se detiene
    addError(LexicalErrorType.INVALID_DECIMAL_LITERAL, 'Número con puntos mal formado.', numeric.text, numeric)
  }

  const completeIdentifier = (): void => {
    const identifier = capture
    if (!identifier) return

    const lower = identifier.text.toLowerCase()
    if (lower === 'inf' || lower === 'infinity') {
      addToken(TokenType.INF_LITERAL, identifier.text, 'Infinity', 'INF_ACCEPT', identifier)
      capture = null
      transition('START')
      return
    }
    if (lower === 'nan') {
      addToken(TokenType.NAN_LITERAL, identifier.text, 'NaN', 'NAN_ACCEPT', identifier)
      capture = null
      transition('START')
      return
    }

    // Comentario estilo BASIC: 'rem ' hasta fin de línea
    if (lower === 'rem' && (currentCharacter() === null || isWhitespace(currentCharacter()!))) {
      let content = identifier.text
      while (currentCharacter() !== null && currentCharacter() !== '\n') {
        content += take()
      }
      comments.push({
        type: 'COMMENT',
        content,
        startIndex: identifier.index,
        endIndex: index,
        startLine: identifier.line,
        startColumn: identifier.column,
        endLine: line,
        endColumn: column,
      })
      capture = null
      transition('START')
      return
    }

    const type = wordTypes[identifier.text.toLowerCase()] ?? TokenType.IDENTIFIER
    const finalState = type === TokenType.IDENTIFIER ? 'IDENTIFIER_ACCEPT' : 'WORD_ACCEPT'
    addToken(type, identifier.text, identifier.text, finalState, identifier)
    capture = null
    transition('START')
  }

  const completeNumber = (): void => {
    const numeric = capture
    if (!numeric) return
    classifyNumber(numeric)
    capture = null
    transition('START')
  }

  const finish = (): void => {
    if (ended) return
    ended = true
    const eof: Capture = { text: '', index, line, column }
    addToken(TokenType.EOF, '', null, 'END_ACCEPT', eof)
    transition('END')
    emit({ type: 'EOF_REACHED' })
  }

  const step = (): AutomatonResult => {
    if (ended) return result()
    const character = currentCharacter()

    if (state === 'IDENTIFIER') {
      if (character !== null && isIdentifierPart(character)) {
        capture!.text += take()
        return result()
      }
      completeIdentifier()
      return result()
    }

    if (state === 'NUMBER') {
      // Tres puntos consecutivos pertenecen al siguiente literal de texto.
      const stringStartsHere = character === '.' && peek(1) === '.' && peek(2) === '.'
      if (character !== null && !stringStartsHere && (isDigit(character) || character === '.')) {
        capture!.text += take()
        return result()
      }
      completeNumber()
      return result()
    }

    if (state === 'TRIPLE_DOT_STRING') {
      if (character === null) {
        addError(LexicalErrorType.UNCLOSED_STRING, 'Cadena sin los tres puntos de cierre (...).', capture!.text, capture!)
        capture = null
        return result()
      }
      if (character === '.' && peek(1) === '.' && peek(2) === '.') {
        capture!.text += take() + take() + take()
        const string = capture!
        addToken(TokenType.STRING, string.text, string.text.slice(3, -3), 'STRING_ACCEPT', string)
        capture = null
        transition('START')
      } else {
        capture!.text += take()
      }
      return result()
    }

    if (character === null) {
      finish()
      return result()
    }

    if (isWhitespace(character)) {
      take()
      return result()
    }

    // Comentario propio del lenguaje: :) contenido :( . Puede abarcar varias líneas.
    if (character === ':' && peek(1) === ')') {
      const start: Capture = { text: character, index, line, column }
      let content = take() + take()
      transition('COMMENT_BLOCK')
      let closed = false
      while (currentCharacter() !== null) {
        if (currentCharacter() === ':' && peek(1) === '(') {
          content += take() + take()
          closed = true
          break
        }
        content += take()
      }
      if (!closed) {
        addError(LexicalErrorType.UNCLOSED_COMMENT, 'Comentario sin el delimitador de cierre :(.', content, start)
        return result()
      }
      comments.push({
        type: 'COMMENT', content, startIndex: start.index, endIndex: index,
        startLine: start.line, startColumn: start.column, endLine: line, endColumn: column,
      })
      transition('START')
      return result()
    }

    // Comentarios // o /* o división /
    if (character === '/') {
      const start: Capture = { text: character, index, line, column }
      const next = peek(1)
      if (next === '/') {
        let content = take() + take() // //
        transition('COMMENT_LINE')
        while (currentCharacter() !== null && currentCharacter() !== '\n') {
          content += take()
        }
        comments.push({
          type: 'COMMENT',
          content,
          startIndex: start.index,
          endIndex: index,
          startLine: start.line,
          startColumn: start.column,
          endLine: line,
          endColumn: column,
        })
        transition('START')
        return result()
      }
      if (next === '*') {
        let content = take() + take() // /*
        transition('COMMENT_BLOCK')
        let closed = false
        while (currentCharacter() !== null) {
          if (currentCharacter() === '*' && peek(1) === '/') {
            content += take() + take()
            closed = true
            break
          }
          content += take()
        }
        if (!closed) {
          addError(LexicalErrorType.UNCLOSED_COMMENT, 'Comentario multilínea sin cerrar.', content, start)
          return result()
        }
        comments.push({
          type: 'COMMENT',
          content,
          startIndex: start.index,
          endIndex: index,
          startLine: start.line,
          startColumn: start.column,
          endLine: line,
          endColumn: column,
        })
        transition('START')
        return result()
      }
      take()
      if (currentCharacter() === '=') {
        take()
        addToken(TokenType.DIVIDE_ASSIGN, '/=', '/=', 'DIVIDE_ASSIGN_ACCEPT', start)
      } else {
        addToken(TokenType.DIVIDE, '/', '/', 'DIVIDE_ACCEPT', start)
      }
      return result()
    }

    // Comentario de una sola línea con dos barras invertidas: \\...
    if (character === '\\' && peek(1) === '\\') {
      const start: Capture = { text: character, index, line, column }
      let content = take() + take()
      transition('COMMENT_LINE')
      while (currentCharacter() !== null && currentCharacter() !== '\n') content += take()
      comments.push({
        type: 'COMMENT', content, startIndex: start.index, endIndex: index,
        startLine: start.line, startColumn: start.column, endLine: line, endColumn: column,
      })
      transition('START')
      return result()
    }

    // Comentarios con #. El símbolo % se reconoce como operador más abajo.
    if (character === '#') {
      const start: Capture = { text: character, index, line, column }
      let content = take()
      transition('COMMENT_LINE')
      while (currentCharacter() !== null && currentCharacter() !== '\n') {
        content += take()
      }
      comments.push({
        type: 'COMMENT',
        content,
        startIndex: start.index,
        endIndex: index,
        startLine: start.line,
        startColumn: start.column,
        endLine: line,
        endColumn: column,
      })
      transition('START')
      return result()
    }

    // Identificadores y palabras reservadas
    if (isIdentifierStart(character)) {
      startCapture('IDENTIFIER')
      return result()
    }

    // Números enteros o decimales (incluyendo .81 o .2), cadenas o división punto ./
    if (isDigit(character)) {
      startCapture('NUMBER')
      return result()
    }

    if (character === '.') {
      const start: Capture = { text: character, index, line, column }
      if (peek(1) === '.' && peek(2) === '.') {
        const before = source.slice(0, index).match(/[^\s]$/)?.[0]
        const beforeBefore = source.slice(0, index).trimEnd().slice(-2, -1)
        const afterRange = source.slice(index + 3).match(/^\s*,\s*\d/)
        if (before === ',' && /\d/.test(beforeBefore) && afterRange) {
          take(); take(); take()
          addToken(TokenType.RANGE, '...', '...', 'RANGE_ACCEPT', start)
          return result()
        }
        capture = { ...start, text: take() + take() + take() }
        transition('TRIPLE_DOT_STRING')
        return result()
      }
      if (peek(1) === '/') {
        take()
        take()
        addToken(TokenType.DOT_DIVIDE, './', './', 'DOT_DIVIDE_ACCEPT', start)
        return result()
      }
      if (peek(1) !== null && isDigit(peek(1)!)) {
        startCapture('NUMBER')
        return result()
      }
      take()
      addToken(TokenType.DOT, '.', '.', 'DOT_ACCEPT', start)
      return result()
    }

    // Variables con dólar: $a, $b o símbolo $ solo
    if (character === '$') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() !== null && isIdentifierStart(currentCharacter()!)) {
        let name = '$'
        while (currentCharacter() !== null && isIdentifierPart(currentCharacter()!)) {
          name += take()
        }
        addToken(TokenType.DOLLAR_VARIABLE, name, name, 'VARIABLE_ACCEPT', start)
      } else {
        addToken(TokenType.DOLLAR, '$', '$', 'SPECIAL_OP_ACCEPT', start)
      }
      return result()
    }

    // Variables entre corchetes [a], [b] o corchetes delimitadores [ y ]
    if (character === '[') {
      const start: Capture = { text: character, index, line, column }
      let look = index + 1
      let inner = ''
      while (look < source.length && source[look] !== ']' && source[look] !== '\n' && !isWhitespace(source[look]) && source[look] !== ',') {
        inner += source[look]
        look += 1
      }
      if (inner.length > 0 && isIdentifierStart(inner[0]) && look < source.length && source[look] === ']') {
        take()
        for (let i = 0; i < inner.length; i += 1) take()
        take()
        addToken(TokenType.BRACKETED_VARIABLE, `[${inner}]`, inner, 'VARIABLE_ACCEPT', start)
        return result()
      }
      take()
      addToken(TokenType.LEFT_BRACKET, '[', '[', 'LEFT_BRACKET_ACCEPT', start)
      return result()
    }

    // Operadores aritméticos simbólicos
    if (character === '+') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '+') {
        take()
        addToken(TokenType.PLUS, '++', '++', 'INCREMENT_ACCEPT', start)
      } else if (currentCharacter() === '=') {
        take()
        addToken(TokenType.PLUS_ASSIGN, '+=', '+=', 'PLUS_ASSIGN_ACCEPT', start)
      } else {
        addToken(TokenType.PLUS, '+', '+', 'PLUS_ACCEPT', start)
      }
      return result()
    }

    if (character === '-') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '-') {
        take()
        addToken(TokenType.MINUS, '--', '--', 'DECREMENT_ACCEPT', start)
      } else if (currentCharacter() === '=') {
        take()
        addToken(TokenType.MINUS_ASSIGN, '-=', '-=', 'MINUS_ASSIGN_ACCEPT', start)
      } else if (currentCharacter() === '>') {
        take()
        addToken(TokenType.ASSIGN_RIGHT, '->', '->', 'ASSIGN_RIGHT_ACCEPT', start)
      } else {
        addToken(TokenType.MINUS, '-', '-', 'MINUS_ACCEPT', start)
      }
      return result()
    }

    if (character === '*') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '*') {
        take()
        addToken(TokenType.POWER, '**', '**', 'POWER_ACCEPT', start)
      } else if (currentCharacter() === '=') {
        take()
        addToken(TokenType.MULTIPLY_ASSIGN, '*=', '*=', 'MULTIPLY_ASSIGN_ACCEPT', start)
      } else {
        addToken(TokenType.MULTIPLY, '*', '*', 'MULTIPLY_ACCEPT', start)
      }
      return result()
    }

    if (character === '%') {
      const start: Capture = { text: character, index, line, column }
      take()
      addToken(TokenType.MODULO, '%', '%', 'MODULO_ACCEPT', start)
      return result()
    }

    // Operadores de asignación y relacionales
    if (character === '=') {
      const start: Capture = { text: character, index, line, column }
      if (peek(1) === '>') {
        take()
        take()
        addToken(TokenType.ARROW, '=>', '=>', 'ARROW_ACCEPT', start)
        return result()
      }
      if (peek(1) === '(' && (peek(2) === '+' || peek(2) === '-') && peek(3) === ')') {
        const isGreater = peek(2) === '+'
        const lexeme = take() + take() + take() + take()
        addToken(isGreater ? TokenType.GREATER_EQUAL : TokenType.LESS_EQUAL, lexeme, lexeme,
          isGreater ? 'GREATER_EQUAL_ACCEPT' : 'LESS_EQUAL_ACCEPT', start)
        return result()
      }
      if (peek(1) === '=' && peek(2) === '>') {
        const lexeme = take() + take() + take()
        addToken(TokenType.EQUAL, lexeme, lexeme, 'EQUAL_ACCEPT', start)
        return result()
      }
      take()
      if (currentCharacter() === '=') {
        take()
        addToken(TokenType.DOUBLE_EQUAL, '==', '==', 'DOUBLE_EQUAL_ACCEPT', start)
      } else {
        addToken(TokenType.ASSIGN, '=', '=', 'ASSIGN_ACCEPT', start)
      }
      return result()
    }

    if (character === '<') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '-') {
        take()
        addToken(TokenType.ASSIGN_LEFT, '<-', '<-', 'ASSIGN_LEFT_ACCEPT', start)
      } else if (currentCharacter() === '>') {
        take()
        addToken(TokenType.NOT_EQUAL, '<>', '<>', 'NOT_EQUAL_ACCEPT', start)
      } else if (currentCharacter() === '=') {
        take()
        addToken(TokenType.LESS_EQUAL, '<=', '<=', 'LESS_EQUAL_ACCEPT', start)
      } else {
        addToken(TokenType.LESS, '<', '<', 'LESS_ACCEPT', start)
      }
      return result()
    }

    if (character === '>') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '=') {
        take()
        addToken(TokenType.GREATER_EQUAL, '>=', '>=', 'GREATER_EQUAL_ACCEPT', start)
      } else {
        addToken(TokenType.GREATER, '>', '>', 'GREATER_ACCEPT', start)
      }
      return result()
    }

    if (character === '!') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '=') {
        take()
        addToken(TokenType.NOT_EQUAL, '!=', '!=', 'NOT_EQUAL_ACCEPT', start)
      } else {
        addToken(TokenType.LOGICAL_NOT_SYM, '!', '!', 'LOGICAL_NOT_SYM_ACCEPT', start)
      }
      return result()
    }

    // Operadores lógicos y de bits simbólicos
    if (character === '&') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '&') {
        take()
        addToken(TokenType.LOGICAL_AND_SYM, '&&', '&&', 'LOGICAL_AND_SYM_ACCEPT', start)
      } else {
        addToken(TokenType.BITWISE_AND, '&', '&', 'BITWISE_AND_ACCEPT', start)
      }
      return result()
    }

    if (character === '|') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === '|') {
        take()
        addToken(TokenType.LOGICAL_OR_SYM, '||', '||', 'LOGICAL_OR_SYM_ACCEPT', start)
      } else {
        addToken(TokenType.BITWISE_OR, '|', '|', 'BITWISE_OR_ACCEPT', start)
      }
      return result()
    }

    if (character === '~') {
      const start: Capture = { text: character, index, line, column }
      take()
      addToken(TokenType.BITWISE_NOT, '~', '~', 'BITWISE_NOT_ACCEPT', start)
      return result()
    }

    if (character === '¬') {
      const start: Capture = { text: character, index, line, column }
      take()
      addToken(TokenType.LOGICAL_NOT_SYMBOL, '¬', '¬', 'LOGICAL_NOT_SYMBOL_ACCEPT', start)
      return result()
    }

    // Operadores especiales de puntuación
    if (character === ';') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === ';') {
        take()
        addToken(TokenType.DOUBLE_SEMICOLON, ';;', ';;', 'DOUBLE_SEMICOLON_ACCEPT', start)
      } else {
        addToken(TokenType.SEMICOLON, ';', ';', 'SEMICOLON_ACCEPT', start)
      }
      return result()
    }

    if (character === ':') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === ':') {
        take()
        addToken(TokenType.DOUBLE_COLON, '::', '::', 'DOUBLE_COLON_ACCEPT', start)
      } else {
        addToken(TokenType.COLON, ':', ':', 'COLON_ACCEPT', start)
      }
      return result()
    }

    if (character === '?') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (currentCharacter() === ':') {
        take()
        addToken(TokenType.ELVIS, '?:', '?:', 'ELVIS_ACCEPT', start)
        return result()
      }
      addError(LexicalErrorType.UNKNOWN_CHARACTER, 'Carácter no reconocido: ?', '?', start)
      return result()
    }

    if (character === 'à') {
      const start: Capture = { text: character, index, line, column }
      take()
      addToken(TokenType.SPECIAL_A, 'à', 'à', 'SPECIAL_A_ACCEPT', start)
      return result()
    }

    // Los comparadores (+) y (-) son tokens únicos; + y - solos siguen siendo aritméticos.
    if (character === '(' && (peek(1) === '+' || peek(1) === '-') && peek(2) === ')') {
      const start: Capture = { text: character, index, line, column }
      const isGreater = peek(1) === '+'
      const lexeme = take() + take() + take()
      addToken(isGreater ? TokenType.GREATER : TokenType.LESS, lexeme, lexeme,
        isGreater ? 'GREATER_ACCEPT' : 'LESS_ACCEPT', start)
      return result()
    }

    // Delimitadores estándares
    const delimiter = delimiterTypes[character]
    if (delimiter) {
      const start: Capture = { text: character, index, line, column }
      take()
      addToken(delimiter, character, character, `${delimiter}_ACCEPT`, start)
      return result()
    }

    // Carácter no reconocido: se emite error y SE DETIENE inmediatamente
    const start: Capture = { text: character, index, line, column }
    take()
    addError(LexicalErrorType.UNKNOWN_CHARACTER, `Carácter no reconocido: ${character}`, character, start)
    return result()
  }

  const result = (): AutomatonResult => ({
    tokens: [...tokens],
    symbolTable: [...lexicalSymbols.values()].map(symbol => ({
      ...symbol,
      occurrences: symbol.occurrences.map(occurrence => ({ ...occurrence })),
    })),
    errors: [...errors],
    comments: [...comments],
  })

  const tokenize = (): AutomatonResult => {
    while (!ended) step()
    return result()
  }

  if (source.length > 100_000) {
    const start: Capture = { text: source.slice(0, 100_000), index: 0, line: 1, column: 1 }
    addError(LexicalErrorType.INPUT_TOO_LARGE, 'La entrada excede el máximo de 100,000 caracteres.', start.text, start)
  }

  return {
    source,
    get index() { return index },
    get line() { return line },
    get column() { return column },
    get currentCharacter() { return currentCharacter() },
    get currentState() { return state },
    get isFinished() { return ended },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    step,
    tokenize,
    result,
  }
}

export const analyzeSource = (source: string): AutomatonResult => createFiniteAutomaton(source).tokenize()
