import { describe, expect, it } from 'vitest'
import { analyzeSource } from '../src/core/automaton/FiniteAutomaton'
import { parseTokens } from '../src/core/parser/Parser'

const parse = (source: string) => parseTokens(analyzeSource(source).tokens)

describe('Parser descendente recursivo', () => {
  it('genera AST para declaraciones, condicionales, bucles y funciones', () => {
    const result = parse(`¿ guarda edad = 20;
¿ simera ( edad mayor 17 ) { ¿ fijo mensaje = ¿Mayor de edad?; } notons { ¿ guarda mensaje = ¿Menor de edad?; }
¿ recorre ( guarda i = 0 ; i menor 3 ; i = mas(i, 1) ) { ¿ guarda paso = i; }
¿ chamba sumar(a, b) { regresa mas(a, b); }`)
    expect(result.errors).toHaveLength(0)
    expect(result.ast.statements.map(statement => statement.kind)).toEqual([
      'VarDeclaration', 'IfStatement', 'ForStatement', 'FunctionDeclaration',
    ])
    const functionNode = result.ast.statements[3]
    expect(functionNode.kind).toBe('FunctionDeclaration')
    if (functionNode.kind === 'FunctionDeclaration') expect(functionNode.returnStatement?.kind).toBe('ReturnStatement')
  })

  it('mantiene ¿ como cadena salvo cuando antecede una cabecera estructural', () => {
    const result = parse('¿ guarda saludo = ¿Hola mundo?;')
    expect(result.errors).toHaveLength(0)
    expect(result.ast.statements[0]).toMatchObject({ kind: 'VarDeclaration', initializer: { kind: 'Literal', value: 'Hola mundo' } })
  })

  it('describe delimitadores, cabeceras y fin de entrada ausentes', () => {
    const missingHeader = parse('guarda edad = 20;')
    expect(missingHeader.errors[0].suggestion).toBe("Toda sentencia debe comenzar con el símbolo '¿'.")
    const missingSemicolon = parse('¿ guarda edad = 20')
    expect(missingSemicolon.errors[0].suggestion).toBe("Se esperaba ';' al final de la declaración de variable.")
    const prematureEnd = parse('¿ simera ( edad mayor 18 ) { ¿ guarda ok = 1;')
    expect(prematureEnd.errors.some(error => error.kind === 'UNEXPECTED_END_OF_INPUT')).toBe(true)
  })

  it('se recupera después de una sentencia inválida para analizar la siguiente', () => {
    const result = parse('¿ guarda = 1; ¿ fijo respuesta = 42;')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.ast.statements.some(statement => statement.kind === 'VarDeclaration' && statement.declarationKind === 'fijo')).toBe(true)
  })
})
