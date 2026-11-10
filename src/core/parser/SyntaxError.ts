import type { Token } from '../tokens/Token'
import { TokenType } from '../tokens/TokenType'

export type SyntaxErrorKind = 'MISMATCH' | 'UNEXPECTED_TOKEN' | 'UNEXPECTED_END_OF_INPUT'

/** Error sintáctico estructurado con una corrección puntual para la interfaz. */
export class SyntaxError extends Error {
  readonly kind: SyntaxErrorKind
  readonly line: number
  readonly column: number
  readonly startIndex: number
  readonly endIndex: number
  readonly expected: string
  readonly received: Token
  readonly suggestion: string

  constructor(expected: string, received: Token, suggestion: string) {
    const isEnd = received.type === TokenType.EOF
    const receivedName = isEnd ? 'fin de entrada' : received.type
    const lexeme = received.lexeme || '∅'
    const message = isEnd
      ? `Error Sintáctico en Línea ${received.line}, Columna ${received.column}: Fin de entrada inesperado; se esperaba '${expected}'.`
      : `Error Sintáctico en Línea ${received.line}, Columna ${received.column}: Se esperaba '${expected}', pero se encontró '${receivedName}' ('${lexeme}').`
    super(message)
    this.name = 'SyntaxError'
    this.kind = isEnd ? 'UNEXPECTED_END_OF_INPUT' : 'MISMATCH'
    this.line = received.line
    this.column = received.column
    this.startIndex = received.startIndex
    this.endIndex = received.endIndex
    this.expected = expected
    this.received = received
    this.suggestion = suggestion
  }
}

export const syntaxSuggestion = (expected: string, received: Token): string => {
  if (expected === ';') return "Se esperaba ';' al final de la sentencia."
  if (expected === 'resultado dentro de una tarea') return "Usa 'resultado' dentro del bloque de una tarea."
  if (expected === ')' && received.type === TokenType.LEFT_BRACE) return "¿Olvidaste cerrar el paréntesis ')' antes de abrir la llave '{'?"
  if (expected === '}') return "¿Olvidaste cerrar la llave '}' del bloque?"
  if (received.type === TokenType.EOF) return `Completa la construcción antes del fin del archivo: falta '${expected}'.`
  return `Revisa esta posición e inserta o reemplaza por '${expected}'.`
}
