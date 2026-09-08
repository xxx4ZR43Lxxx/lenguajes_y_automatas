import type { LexicalError } from '../errors/LexicalError'
import { LexicalErrorType } from '../errors/LexicalErrorType'
import type { LexerEvent, LexerListener } from '../events/LexerEvent'
import { delimiterTypes, statementWords, wordTypes } from '../language/Language'
import type { Token } from '../tokens/Token'
import { TokenType } from '../tokens/TokenType'

export interface AutomatonResult { tokens: Token[]; errors: LexicalError[]; comments: [] }

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
const isLetter = (character: string): boolean => (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || character === 'ñ' || character === 'Ñ'
const isIdentifierStart = (character: string): boolean => isLetter(character) || character === '_'
const isIdentifierPart = (character: string): boolean => isIdentifierStart(character) || isDigit(character)
const isWhitespace = (character: string): boolean => character === ' ' || character === '\t' || character === '\n' || character === '\r'

/**
 * A deterministic finite automaton written with states and one-character
 * transitions. It intentionally uses neither regular expressions nor a lexer
 * or scanner library.
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
  const errors: LexicalError[] = []
  const listeners = new Set<LexerListener>()

  const currentCharacter = (): string | null => source[index] ?? null
  const isStatementHeader = (): boolean => {
    let position = index
    while (position < source.length && isWhitespace(source[position])) position += 1
    let word = ''
    while (position < source.length && isIdentifierPart(source[position])) {
      word += source[position]
      position += 1
    }
    return statementWords[word.toLowerCase()] === true
  }
  const emit = (partial: Omit<LexerEvent, 'index' | 'line' | 'column'>): void => {
    const event: LexerEvent = { ...partial, index, line, column }
    listeners.forEach(listener => listener(event))
  }
  const transition = (next: string): void => { state = next; emit({ type: 'STATE_CHANGED', state }) }
  const take = (): string => {
    const character = currentCharacter()
    if (character === null) return ''
    index += 1
    if (character === '\n') { line += 1; column = 1 } else column += 1
    emit({ type: 'CHAR_READ', character })
    return character
  }
  const startCapture = (next: string): void => {
    const start = { index, line, column }
    capture = { text: take(), ...start }
    transition(next)
  }
  const makeToken = (type: TokenType, lexeme: string, value: unknown, finalState: string, start: Capture, endIndex = index): Token => ({ type, lexeme, value, finalState, line: start.line, column: start.column, startIndex: start.index, endIndex })
  const addError = (type: LexicalErrorType, message: string, lexeme: string, start: Capture): void => {
    const error: LexicalError = { type, message, lexeme, line: start.line, column: start.column, startIndex: start.index, endIndex: index }
    errors.push(error)
    emit({ type: 'LEXICAL_ERROR', error })
  }
  const normalizeSigns = (): void => {
    const normalized: Token[] = []
    for (let position = 0; position < rawTokens.length; position += 1) {
      const first = rawTokens[position]
      const second = rawTokens[position + 1]
      if (first.type === TokenType.PLUS || first.type === TokenType.MINUS) {
        if (second && (second.type === TokenType.PLUS || second.type === TokenType.MINUS)) {
          const previous = normalized.at(-1)
          const following = rawTokens[position + 2]
          const joined = `${first.lexeme} ${second.lexeme}`
          const base = { lexeme: joined, line: first.line, column: first.column, startIndex: first.startIndex, endIndex: second.endIndex, finalState: 'SIGN_RULE_ACCEPT' }
          if (first.type === TokenType.MINUS && second.type === TokenType.MINUS && previous?.type === TokenType.IDENTIFIER) {
            normalized.push({ ...base, type: TokenType.POST_DECREMENT, value: '--' })
          } else if (first.type === TokenType.MINUS && second.type === TokenType.MINUS && following?.type === TokenType.IDENTIFIER) {
            normalized.push({ ...base, type: TokenType.PRE_DECREMENT, value: '--' })
          } else {
            const isNegative = first.type !== second.type
            normalized.push({ ...base, type: isNegative ? TokenType.MINUS : TokenType.PLUS, value: isNegative ? '-' : '+' })
          }
          position += 1
          continue
        }
      }
      normalized.push(first)
    }
    tokens.splice(0, tokens.length, ...normalized)
  }
  const addToken = (type: TokenType, lexeme: string, value: unknown, finalState: string, start: Capture): void => {
    const token = makeToken(type, lexeme, value, finalState, start)
    rawTokens.push(token)
    normalizeSigns()
    emit({ type: 'TOKEN_CREATED', token })
  }
  const allDigits = (text: string): boolean => {
    if (text.length === 0) return false
    for (let position = 0; position < text.length; position += 1) if (!isDigit(text[position])) return false
    return true
  }
  const parseDecimal = (text: string): number | null => {
    if (!allDigits(text)) return null
    let value = 0
    for (let position = 0; position < text.length; position += 1) value = value * 10 + (text.charCodeAt(position) - 48)
    return value
  }
  const classifyNumber = (numeric: Capture): void => {
    let dots = 0
    for (let position = 0; position < numeric.text.length; position += 1) if (numeric.text[position] === '.') dots += 1
    if (dots === 0) { addToken(TokenType.INTEGER, numeric.text, Number(numeric.text), 'INTEGER_ACCEPT', numeric); return }
    if (dots === 1) {
      const dot = numeric.text.indexOf('.')
      const left = numeric.text.slice(0, dot)
      const right = numeric.text.slice(dot + 1)
      if (allDigits(left) && allDigits(right)) { addToken(TokenType.DECIMAL, numeric.text, Number(numeric.text), 'DECIMAL_ACCEPT', numeric); return }
      addError(LexicalErrorType.INVALID_DECIMAL_LITERAL, 'Un flotante requiere dígitos a ambos lados del punto.', numeric.text, numeric)
      return
    }
    if (dots === 3) {
      const parts = numeric.text.split('.')
      let valid = parts.length === 4
      for (const part of parts) {
        const value = parseDecimal(part)
        if (value === null || value > 255) valid = false
      }
      if (valid) { addToken(TokenType.IP_ADDRESS, numeric.text, numeric.text, 'IP_ADDRESS_ACCEPT', numeric); return }
      addError(LexicalErrorType.INVALID_IP_ADDRESS, 'Una dirección IP requiere cuatro octetos entre 0 y 255.', numeric.text, numeric)
      return
    }
    addError(LexicalErrorType.INVALID_DECIMAL_LITERAL, 'Número con puntos mal formado.', numeric.text, numeric)
  }
  const completeIdentifier = (): void => {
    const identifier = capture
    if (!identifier) return
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
      if (character !== null && isIdentifierPart(character)) { capture!.text += take(); return result() }
      completeIdentifier(); return result()
    }
    if (state === 'NUMBER') {
      if (character !== null && (isDigit(character) || character === '.')) { capture!.text += take(); return result() }
      completeNumber(); return result()
    }
    if (state === 'STRING') {
      if (character === null) { addError(LexicalErrorType.UNCLOSED_STRING, 'Cadena sin cierre con ?. ', capture!.text, capture!); capture = null; transition('START'); return result() }
      capture!.text += take()
      if (character === '?') {
        const string = capture!
        addToken(TokenType.STRING, string.text, string.text.slice(1, -1), 'STRING_ACCEPT', string)
        capture = null
        transition('START')
      }
      return result()
    }
    if (character === null) { finish(); return result() }
    if (isWhitespace(character)) { take(); return result() }
    if (isIdentifierStart(character)) { startCapture('IDENTIFIER'); return result() }
    if (isDigit(character) || character === '.') { startCapture('NUMBER'); return result() }
    if (character === '¿') {
      const start: Capture = { text: character, index, line, column }
      take()
      if (isStatementHeader()) addToken(TokenType.STATEMENT_START, '¿', '¿', 'STATEMENT_START_ACCEPT', start)
      else { capture = start; transition('STRING') }
      return result()
    }
    const start: Capture = { text: character, index, line, column }
    if (character === '=') { take(); addToken(TokenType.ASSIGN, '=', '=', 'ASSIGN_ACCEPT', start); return result() }
    if (character === '<') {
      take()
      if (currentCharacter() === '=') { take(); addToken(TokenType.LESS_EQUAL, '<=', '<=', 'LESS_EQUAL_ACCEPT', start) }
      else addToken(TokenType.LESS, '<', '<', 'LESS_ACCEPT', start)
      return result()
    }
    if (character === '>') {
      take()
      if (currentCharacter() === '=') { take(); addToken(TokenType.GREATER_EQUAL, '>=', '>=', 'GREATER_EQUAL_ACCEPT', start) }
      else addToken(TokenType.GREATER, '>', '>', 'GREATER_ACCEPT', start)
      return result()
    }
    const delimiter = delimiterTypes[character]
    if (delimiter) { take(); addToken(delimiter, character, character, `${delimiter}_ACCEPT`, start); return result() }
    take()
    addError(LexicalErrorType.UNKNOWN_CHARACTER, `Carácter no reconocido: ${character}`, character, start)
    transition('ERROR')
    transition('START')
    return result()
  }
  const result = (): AutomatonResult => ({ tokens: [...tokens], errors: [...errors], comments: [] })
  const tokenize = (): AutomatonResult => { while (!ended) step(); return result() }

  if (source.length > 100_000) {
    const start: Capture = { text: source.slice(0, 100_000), index: 0, line: 1, column: 1 }
    addError(LexicalErrorType.INPUT_TOO_LARGE, 'La entrada excede el máximo de 100,000 caracteres.', start.text, start)
    ended = true
  }
  return {
    source,
    get index() { return index },
    get line() { return line },
    get column() { return column },
    get currentCharacter() { return currentCharacter() },
    get currentState() { return state },
    get isFinished() { return ended },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    step,
    tokenize,
    result,
  }
}

export const analyzeSource = (source: string): AutomatonResult => createFiniteAutomaton(source).tokenize()
