import { describe, expect, it } from 'vitest'
import { analyzeSource } from '../src/core/automaton/FiniteAutomaton'
import { parseTokens } from '../src/core/parser/Parser'
import { analyzeSemantics } from '../src/core/semantic/SemanticAnalyzer'

const analyze = (source: string) => {
  const lexical = analyzeSource(source)
  return analyzeSemantics(parseTokens(lexical.tokens, lexical.symbolTable).ast)
}

describe('Analizador semántico', () => {
  it('acepta declaraciones, alcance y llamadas válidas', () => {
    const result = analyze(`guarda edad = 20;
tarea sumar(a, b) { resultado mas(a, b); }
guarda total = sumar(edad, 2);`)
    expect(result.errors).toHaveLength(0)
    expect(result.symbols.map(symbol => symbol.name)).toEqual(['sumar', 'edad', 'total'])
  })

  it('informa identificadores sin declarar, constantes y duplicados', () => {
    const result = analyze(`fijo limite = 2;
limite = 3;
guarda limite = 4;
guarda salida = desconocido;`)
    expect(result.errors.map(error => error.code)).toEqual(expect.arrayContaining([
      'IMMUTABLE_ASSIGNMENT', 'DUPLICATE_DECLARATION', 'UNDECLARED_IDENTIFIER',
    ]))
  })

  it('verifica aridad de funciones y acepta condiciones con verdad/falsedad', () => {
    const result = analyze(`tarea sumar(a, b) { resultado mas(a, b); }
guarda total = sumar(1, 2, 3);
si (1) { guarda ok = 1; }`)
    expect(result.errors.map(error => error.code)).toContain('ARGUMENT_COUNT_MISMATCH')
    expect(result.errors.map(error => error.code)).not.toContain('NON_BOOLEAN_CONDITION')
  })

  it('valida funciones matemáticas integradas y operandos lógicos', () => {
    const valid = analyze(`guarda valor = sin(30) + abs(-4);
guarda potencia = pow(2, 3);
si ((valor mayor_igual 0) y (potencia igual_a 8)) { guarda correcto = 1; }`)
    expect(valid.errors).toHaveLength(0)

    const invalid = analyze('si (1 y 2) { guarda bandera = 1; }')
    expect(invalid.errors.some(error => error.code === 'INVALID_LOGICAL_OPERAND')).toBe(true)

    const invalidPower = analyze('guarda potencia = pow(...dos..., 3);')
    expect(invalidPower.errors.some(error => error.code === 'TYPE_MISMATCH')).toBe(true)
  })

  it('permite aplicaciones currificadas hasta completar la aridad', () => {
    const result = analyze(`tarea suma(a, b) { resultado mas(a, b); }
guarda parcial = suma(4);
guarda total = suma(4)(6);`)
    expect(result.errors).toHaveLength(0)

    const tooMany = analyze(`tarea suma(a, b) { resultado mas(a, b); }
guarda total = suma(4)(6)(8);`)
    expect(tooMany.errors.some(error => error.code === 'ARGUMENT_COUNT_MISMATCH')).toBe(true)
  })

  it('genera warnings para variables sin inicializar y para variables sin uso', () => {
    const readBeforeInit = analyze('guarda x; impresora(x);')
    expect(readBeforeInit.warnings.map(warning => warning.code)).toContain('UNINITIALIZED_VARIABLE')
    expect(readBeforeInit.errors).toHaveLength(0)
    expect(readBeforeInit.blocked).toBe(false)

    const assignedBeforeRead = analyze('guarda x; x = 1; impresora(x);')
    expect(assignedBeforeRead.warnings.some(warning => warning.code === 'UNINITIALIZED_VARIABLE')).toBe(false)

    const unused = analyze('guarda sin_usar = 10;')
    expect(unused.warnings.map(warning => warning.code)).toContain('UNUSED_VARIABLE')
  })

  it('detecta incompatibilidad de tipos en suma y permite concatenar dos textos', () => {
    const mismatch = analyze('guarda x = ...hola... + 5; impresora(x);')
    expect(mismatch.errors.some(error => error.code === 'TYPE_MISMATCH' && error.message.includes('string') && error.message.includes('integer'))).toBe(true)

    const concatenation = analyze('guarda x = ...hola... + ... mundo...; impresora(x);')
    expect(concatenation.errors).toHaveLength(0)
  })

  it('advierte enteros fuera del rango int32', () => {
    const result = analyze('guarda enorme = 9999999999999999999999999; impresora(enorme);')
    expect(result.errors.some(error => error.code === 'INTEGER_OVERFLOW')).toBe(true)
  })

  it('registra y resuelve sobrecargas según la cantidad de argumentos', () => {
    const valid = analyze(`tarea sumita(a, b, c) { resultado a + b + c; }
tarea sumita(x, y) { resultado x + y; }
sumita(4, 5);
guarda total = sumita(4, 5);
impresora(total);`)
    expect(valid.errors).toHaveLength(0)
    expect(valid.symbols.find(symbol => symbol.name === 'sumita')?.signatures).toEqual([2, 3])

    const ambiguousPartial = analyze(`tarea sumita(a, b, c) { resultado a + b + c; }
tarea sumita(x, y) { resultado x + y; }
guarda parcial = sumita(4);`)
    expect(ambiguousPartial.errors.some(error => error.code === 'AMBIGUOUS_FUNCTION_OVERLOAD')).toBe(true)

    const duplicate = analyze(`tarea sumita(a, b) { resultado a + b; }
tarea sumita(x, y) { resultado x + y; }`)
    expect(duplicate.errors.some(error => error.code === 'DUPLICATE_DECLARATION')).toBe(true)
  })

  it('el modo estricto bloquea con warnings y errores; el permisivo deja continuar', () => {
    const lexical = analyzeSource('guarda sin_usar = 1;')
    const ast = parseTokens(lexical.tokens, lexical.symbolTable).ast
    const permissive = analyzeSemantics(ast, { mode: 'permissive' })
    const strict = analyzeSemantics(ast, { mode: 'strict' })
    expect(permissive.warnings.some(warning => warning.code === 'UNUSED_VARIABLE')).toBe(true)
    expect(permissive.blocked).toBe(false)
    expect(strict.blocked).toBe(true)

    const withError = analyze('guarda valor = desconocido;')
    const strictError = analyzeSemantics(parseTokens(analyzeSource('guarda valor = desconocido;').tokens, analyzeSource('guarda valor = desconocido;').symbolTable).ast, { mode: 'strict' })
    expect(withError.errors.length).toBeGreaterThan(0)
    expect(strictError.blocked).toBe(true)
  })

  it('verifica condiciones de bucle_mientras y permite comparadores (+) y (-)', () => {
    const valid = analyze(`guarda contador = 0;
bucle_mientras (contador (-) 3) { contador = contador + 1; }
bucle_por (guarda i = 0; i (-) 3; i = i + 1) { guarda doble = i + i; }`)
    expect(valid.errors).toHaveLength(0)

    const truthyCondition = analyze('bucle_mientras (1) { salir; }')
    expect(truthyCondition.errors).toHaveLength(0)
  })
})
