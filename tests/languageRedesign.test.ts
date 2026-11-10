import { expect, it } from 'vitest'
import { analyzeSource } from '../src/core/automaton/FiniteAutomaton'
import { parseTokens } from '../src/core/parser/Parser'
import { analyzeSemantics } from '../src/core/semantic/SemanticAnalyzer'
import { TokenType } from '../src/core/tokens/TokenType'

it('analiza un programa completo con la nueva sintaxis española', () => {
  const source = `guarda x = 1;
si (x (+) 0) { guarda estado = ...adulto...; } sino { guarda estado = ...menor...; }
bucle_por (guarda i = 0; i (-) 3; i = mas(i, 1)) { guarda paso = i; }
bucle_mientras (x (-) 10) { x = mas(x, 1); }
tarea sumar(a, b) { resultado mas(a, b); }`
  const lexical = analyzeSource(source)
  expect(lexical.errors).toEqual([])
  const syntax = parseTokens(lexical.tokens, lexical.symbolTable)
  expect(syntax.errors).toEqual([])
  expect(syntax.ast.statements.map(statement => statement.kind)).toEqual([
    'VarDeclaration', 'IfStatement', 'ForStatement', 'WhileStatement', 'FunctionDeclaration',
  ])
  expect(analyzeSemantics(syntax.ast).errors).toEqual([])
})

it('distingue comparaciones (-)/(+) de la resta y suma normales', () => {
  const lexical = analyzeSource('guarda a = 2 + 3; guarda b = 8 - 1; si (a (-) b) { guarda t = ......; }')
  expect(lexical.errors).toEqual([])
  expect(lexical.tokens.map(token => token.type)).toEqual(expect.arrayContaining([
    TokenType.PLUS, TokenType.MINUS, TokenType.LESS, TokenType.STRING,
  ]))
  expect(lexical.tokens.find(token => token.type === TokenType.STRING)?.value).toBe('')
  expect(parseTokens(lexical.tokens, lexical.symbolTable).errors).toEqual([])
})

it('rechaza el prefijo ¿ y las comillas como delimitadores de texto', () => {
  expect(analyzeSource('¿ guarda x = 1;').errors.length).toBeGreaterThan(0)
  expect(analyzeSource('guarda x = "texto";').errors.length).toBeGreaterThan(0)
})
