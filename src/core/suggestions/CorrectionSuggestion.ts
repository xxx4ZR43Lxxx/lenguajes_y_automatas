import type { LexicalError } from '../errors/LexicalError'
import type { SyntaxError } from '../parser/SyntaxError'
import type { SemanticDiagnostic } from '../semantic/SemanticError'

export type AnalysisStage = 'Léxico' | 'Sintáctico' | 'Semántico'

export interface CorrectionSuggestion {
  id: string
  stage: AnalysisStage
  title: string
  description: string
  startIndex?: number
  endIndex?: number
  replacement?: string
}

const decimalFix = (lexeme: string): string => {
  let hasDot = false
  let fixed = ''
  for (const character of lexeme) {
    if (character !== '.') fixed += character
    else if (!hasDot) {
      fixed += character
      hasDot = true
    }
  }
  return fixed
}

const closingDelimiter = (lexeme: string): string => {
  if (lexeme.startsWith('/*')) return '*/'
  return '...'
}

export function buildCorrectionSuggestions(
  _source: string,
  lexicalErrors: LexicalError[],
  syntaxErrors: SyntaxError[],
  semanticDiagnostics: SemanticDiagnostic[],
): CorrectionSuggestion[] {
  const lexical = lexicalErrors.map((error, index): CorrectionSuggestion => {
    if (error.type === 'UNKNOWN_CHARACTER') {
      return {
        id: `lexical-${index}-${error.startIndex}`,
        stage: 'Léxico',
        title: 'Eliminar carácter no reconocido',
        description: `Quitar '${error.lexeme}' para que el AFD pueda continuar.`,
        startIndex: error.startIndex,
        endIndex: error.endIndex,
        replacement: '',
      }
    }
    if (error.type === 'INVALID_DECIMAL_LITERAL') {
      return {
        id: `lexical-${index}-${error.startIndex}`,
        stage: 'Léxico',
        title: 'Normalizar decimal',
        description: `Reemplazar '${error.lexeme}' por '${decimalFix(error.lexeme)}' y conservar un solo punto decimal.`,
        startIndex: error.startIndex,
        endIndex: error.endIndex,
        replacement: decimalFix(error.lexeme),
      }
    }
    if (error.type === 'UNCLOSED_STRING' || error.type === 'UNCLOSED_COMMENT') {
      const delimiter = closingDelimiter(error.lexeme)
      return {
        id: `lexical-${index}-${error.startIndex}`,
        stage: 'Léxico',
        title: 'Cerrar literal sin terminar',
        description: `Insertar '${delimiter}' para cerrar la construcción abierta.`,
        startIndex: error.endIndex,
        endIndex: error.endIndex,
        replacement: delimiter,
      }
    }
    return {
      id: `lexical-${index}-${error.startIndex}`,
      stage: 'Léxico',
      title: 'Revisar error léxico',
      description: error.message,
    }
  })

  const syntax = syntaxErrors.map((error, index): CorrectionSuggestion => {
    const insertable = new Set([';', ')', '}'])
    if (insertable.has(error.expected)) {
      return {
        id: `syntax-${index}-${error.startIndex}`,
        stage: 'Sintáctico',
        title: `Insertar '${error.expected}'`,
        description: error.suggestion,
        startIndex: error.startIndex,
        endIndex: error.startIndex,
        replacement: error.expected,
      }
    }
    return {
      id: `syntax-${index}-${error.startIndex}`,
      stage: 'Sintáctico',
      title: 'Revisión sintáctica sugerida',
      description: error.suggestion,
    }
  })

  const semantic = semanticDiagnostics.map((error, index): CorrectionSuggestion => ({
    id: `semantic-${index}-${error.startIndex}`,
    stage: 'Semántico',
    title: `${error.severity === 'warning' ? 'Advertencia' : 'Error'}: ${error.code.replaceAll('_', ' ')}`,
    description: `${error.message} ${error.suggestion}`,
  }))

  return [...lexical, ...syntax, ...semantic]
}

export const canApplySuggestion = (suggestion: CorrectionSuggestion): boolean =>
  suggestion.replacement !== undefined && suggestion.startIndex !== undefined && suggestion.endIndex !== undefined

export const applyCorrectionSuggestion = (source: string, suggestion: CorrectionSuggestion): string => {
  if (!canApplySuggestion(suggestion)) return source
  return `${source.slice(0, suggestion.startIndex)}${suggestion.replacement}${source.slice(suggestion.endIndex)}`
}
