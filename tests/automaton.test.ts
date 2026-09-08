import { describe, expect, it } from 'vitest'
import { analyzeSource, createFiniteAutomaton } from '../src/core/automaton/FiniteAutomaton'
import { LexicalErrorType } from '../src/core/errors/LexicalErrorType'
import { TokenType } from '../src/core/tokens/TokenType'

describe('AFD léxico', () => {
  it('usa operadores matemáticos escritos en español y notación funcional', () => {
    const result = analyzeSource('mas(mas(5,3),2) por 4 entre 2')
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.map(token => token.type)).toEqual([
      TokenType.PLUS, TokenType.LEFT_PAREN, TokenType.PLUS, TokenType.LEFT_PAREN,
      TokenType.INTEGER, TokenType.COMMA, TokenType.INTEGER, TokenType.RIGHT_PAREN,
      TokenType.COMMA, TokenType.INTEGER, TokenType.RIGHT_PAREN, TokenType.MULTIPLY,
      TokenType.INTEGER, TokenType.DIVIDE, TokenType.INTEGER, TokenType.EOF,
    ])
  })

  it('reconoce operadores lógicos sin distinguir mayúsculas', () => {
    const result = analyzeSource('AND or Not xor xort nand nor XNOR')
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.map(token => token.type)).toEqual([
      TokenType.LOGICAL_AND, TokenType.LOGICAL_OR, TokenType.LOGICAL_NOT,
      TokenType.LOGICAL_XOR, TokenType.LOGICAL_XORT, TokenType.LOGICAL_NAND,
      TokenType.LOGICAL_NOR, TokenType.LOGICAL_XNOR, TokenType.EOF,
    ])
  })

  it('reconoce impresora y teclado como palabras reservadas', () => {
    const result = analyzeSource('impresora teclado')
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.map(token => token.type)).toEqual([
      TokenType.PRINT, TokenType.KEYBOARD_INPUT, TokenType.EOF,
    ])
  })

  it('solo acepta flotantes bien formados y no trata ,3 como flotante', () => {
    const valid = analyzeSource('0 12 3.14')
    expect(valid.tokens.map(token => token.type)).toContain(TokenType.DECIMAL)
    for (const source of ['.3', '10.', '1.2.3']) expect(analyzeSource(source).errors[0].type).toBe(LexicalErrorType.INVALID_DECIMAL_LITERAL)
    const comma = analyzeSource(',3')
    expect(comma.tokens.map(token => token.type)).toEqual([TokenType.COMMA, TokenType.INTEGER, TokenType.EOF])
    expect(comma.tokens.some(token => token.type === TokenType.DECIMAL)).toBe(false)
  })

  it('reconoce exclusivamente cadenas ¿... ?', () => {
    const valid = analyzeSource('¿Hola mundo?')
    expect(valid.tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'Hola mundo', finalState: 'STRING_ACCEPT' })
    expect(analyzeSource('"Hola"').errors).toHaveLength(2)
    expect(analyzeSource('¿sin cierre').errors[0].type).toBe(LexicalErrorType.UNCLOSED_STRING)
  })

  it('clasifica estructuras e IP válidas y reporta IP inválida', () => {
    const valid = analyzeSource('arreglo vector lista matriz 192.168.0.1')
    expect(valid.tokens.map(token => token.type)).toEqual([TokenType.ARRAY, TokenType.VECTOR, TokenType.LIST, TokenType.MATRIX, TokenType.IP_ADDRESS, TokenType.EOF])
    expect(analyzeSource('192.168.999.1').errors[0].type).toBe(LexicalErrorType.INVALID_IP_ADDRESS)
  })

  it('aplica ley de signos y detecta pre/postdecremento', () => {
    const signs = analyzeSource('x = mas menos 5 mas 7')
    expect(signs.tokens.map(token => token.type)).toEqual([TokenType.IDENTIFIER, TokenType.ASSIGN, TokenType.MINUS, TokenType.INTEGER, TokenType.PLUS, TokenType.INTEGER, TokenType.EOF])
    expect(signs.tokens[2]).toMatchObject({ lexeme: 'mas menos', finalState: 'SIGN_RULE_ACCEPT' })
    expect(analyzeSource('menos menos contador').tokens[0].type).toBe(TokenType.PRE_DECREMENT)
    expect(analyzeSource('contador menos menos').tokens[1].type).toBe(TokenType.POST_DECREMENT)
  })

  it('expone transiciones por carácter y estado final para la tabla', () => {
    const automaton = createFiniteAutomaton('mas')
    automaton.step()
    expect(automaton.currentState).toBe('IDENTIFIER')
    automaton.step(); automaton.step(); automaton.step()
    expect(automaton.result().tokens[0].finalState).toBe('WORD_ACCEPT')
  })

  it('conserva índices de inicio y fin al consumir carácter por carácter', () => {
    const token = analyzeSource('  mas').tokens[0]
    expect(token).toMatchObject({ startIndex: 2, endIndex: 5, line: 1, column: 3 })
  })
})
