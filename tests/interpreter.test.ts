import { describe, expect, it } from 'vitest'
import { analyzeSource } from '../src/core/automaton/FiniteAutomaton'
import { parseTokens } from '../src/core/parser/Parser'
import { analyzeSemantics } from '../src/core/semantic/SemanticAnalyzer'
import { interpret } from '../src/core/runtime/Interpreter'

const compile = (source: string) => {
  const lexical = analyzeSource(source)
  const parsed = parseTokens(lexical.tokens, lexical.symbolTable)
  return { lexical, parsed, semantic: analyzeSemantics(parsed.ast) }
}

describe('Intérprete noEsPython', () => {
  it('ejecuta expresiones sobre rangos y conserva sus extremos', () => {
    const source = 'guarda x: rango = [1,...,5]; x = x * 3 + 1; impresora(x);'
    const { lexical, parsed, semantic } = compile(source)
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
    expect(semantic.errors).toHaveLength(0)
    const result = interpret(parsed.ast)
    expect(result.outputs).toEqual(['[4,...,16]'])
    expect(result.diagnostics).toHaveLength(0)
  })

  it('aplica asignaciones paralelas usando los valores previos al bloque', () => {
    const { parsed, semantic } = compile(`guarda izquierda = 2;
guarda derecha = 100;
par { izquierda = derecha, derecha = izquierda; }
impresora(izquierda, derecha);`)
    expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
    expect(semantic.errors).toHaveLength(0)
    expect(interpret(parsed.ast).outputs).toEqual(['100 2'])
  })

  it('valida tipos anotados de argumentos y retorno de tareas', () => {
    const argumentMismatch = compile(`tarea duplicar(x: entero): entero { resultado x * 2; }
guarda salida = duplicar(5.8);`)
    expect(argumentMismatch.semantic.errors.some(error => error.code === 'TYPE_MISMATCH')).toBe(true)

    const returnMismatch = compile(`tarea codigo(): entero { resultado 7; }
guarda texto: texto = codigo();`)
    expect(returnMismatch.semantic.errors.some(error => error.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('detecta overflow con constantes propagadas y valores dinámicos de ejecución', () => {
    const staticOverflow = compile('guarda maximo = 2147483647; maximo = maximo + 1;')
    expect(staticOverflow.semantic.errors.some(error => error.code === 'INTEGER_OVERFLOW')).toBe(true)

    const dynamicOverflow = compile(`tarea eleva(base: entero): real { resultado base ** 10; }
guarda salida = eleva(100000);`)
    expect(dynamicOverflow.semantic.errors, JSON.stringify(dynamicOverflow.semantic.errors)).toHaveLength(0)
    expect(interpret(dynamicOverflow.parsed.ast).diagnostics[0]?.code).toBe('INTEGER_OVERFLOW')
  })
})
