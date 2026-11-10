import { describe, expect, it } from 'vitest'
import { buildCorrectionSuggestions } from '../src/core/suggestions/CorrectionSuggestion'
import { LexicalErrorType } from '../src/core/errors/LexicalErrorType'

describe('Sugerencias de corrección', () => {
  it('propone y aplica una corrección léxica segura', () => {
    const source = 'guarda edad = 20@;'
    const suggestions = buildCorrectionSuggestions(source, [{
      type: LexicalErrorType.UNKNOWN_CHARACTER,
      message: 'Carácter no reconocido.',
      lexeme: '@',
      line: 1,
      column: 17,
      startIndex: 16,
      endIndex: 17,
    }], [], [])
    expect(suggestions[0]).toMatchObject({ replacement: '', startIndex: 16, endIndex: 17 })
  })

  it('ofrece insertar el punto y coma faltante', () => {
    const source = 'guarda edad = 20'
    const suggestions = buildCorrectionSuggestions(source, [], [{
      expected: ';', startIndex: source.length, suggestion: 'Agrega ;',
    } as never], [])
    expect(suggestions[0]).toMatchObject({ replacement: ';', startIndex: source.length })
  })

  it('sugiere cerrar una cadena con tres puntos', () => {
    const source = 'guarda saludo = ...Hola'
    const suggestions = buildCorrectionSuggestions(source, [{
      type: LexicalErrorType.UNCLOSED_STRING,
      message: 'Cadena sin cierre.',
      lexeme: '...Hola',
      line: 1,
      column: 17,
      startIndex: 16,
      endIndex: source.length,
    }], [], [])
    expect(suggestions[0]).toMatchObject({ replacement: '...', startIndex: source.length, endIndex: source.length })
  })
})
