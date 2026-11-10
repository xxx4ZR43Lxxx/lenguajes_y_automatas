import { describe, expect, it } from 'vitest'
import { analyzeSource } from '../src/core/automaton/FiniteAutomaton'
import { parseTokens } from '../src/core/parser/Parser'

const parse = (source: string) => {
  const lexical = analyzeSource(source)
  return parseTokens(lexical.tokens, lexical.symbolTable)
}

describe('Parser descendente recursivo', () => {
  it('genera AST para declaraciones, condicionales, ambos bucles y tareas sin prefijo', () => {
    const result = parse(`guarda edad = 20;
si (edad mayor_igual 18) { fijo mensaje = ...Mayor de edad...; } sino { guarda mensaje = ...Menor de edad...; }
bucle_por (guarda i = 0; i menor_igual 3; i = mas(i, 1)) { guarda paso = i; paso = mas(paso, 1); }
bucle_mientras (edad (+) 18) { edad = menos(edad, 1); }
tarea sumar(a, b) { resultado mas(a, b); }`)
    expect(result.errors.map(error => error.message)).toEqual([])
    expect(result.ast.statements.map(statement => statement.kind)).toEqual([
      'VarDeclaration', 'IfStatement', 'ForStatement', 'WhileStatement', 'FunctionDeclaration',
    ])
    const forNode = result.ast.statements[2]
    expect(forNode.kind).toBe('ForStatement')
    if (forNode.kind === 'ForStatement') {
      expect(forNode.body.statements.map(statement => statement.kind)).toEqual(['VarDeclaration', 'AssignmentStatement'])
    }
    const functionNode = result.ast.statements[4]
    expect(functionNode.kind).toBe('FunctionDeclaration')
    if (functionNode.kind === 'FunctionDeclaration') expect(functionNode.returnStatement?.kind).toBe('ReturnStatement')
  })

  it('conserva contenido de cadenas ...texto... como literales', () => {
    const result = parse('guarda saludo = ...Hola mundo...;')
    expect(result.errors).toHaveLength(0)
    expect(result.ast.statements[0]).toMatchObject({ kind: 'VarDeclaration', initializer: { kind: 'Literal', value: 'Hola mundo' } })
  })

  it('describe delimitadores, resultado fuera de tarea y fin de entrada ausentes', () => {
    const missingSemicolon = parse('guarda edad = 20')
    expect(missingSemicolon.errors[0].suggestion).toBe("Se esperaba ';' al final de la sentencia.")
    const prematureEnd = parse('si (edad mayor_igual 18) { guarda ok = 1;')
    expect(prematureEnd.errors.some(error => error.kind === 'UNEXPECTED_END_OF_INPUT')).toBe(true)
    const outsideTask = parse('resultado 1;')
    expect(outsideTask.errors[0].suggestion).toBe("Usa 'resultado' dentro del bloque de una tarea.")
  })

  it('se recupera después de una sentencia inválida para analizar la siguiente', () => {
    const result = parse('guarda = 1; fijo respuesta = 42;')
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.ast.statements.some(statement => statement.kind === 'VarDeclaration' && statement.declarationKind === 'fijo')).toBe(true)
  })

  it('analiza llamadas funcionales y asignaciones directas en el nivel superior', () => {
    const functionalResult = parse('guarda res = mas(mas(5, 3), 2);')
    expect(functionalResult.errors).toHaveLength(0)
    expect(functionalResult.ast.statements[0].kind).toBe('VarDeclaration')

    const assignResult = parse('guarda x = 1; x = mas(x, 1);')
    expect(assignResult.errors).toHaveLength(0)
    expect(assignResult.ast.statements[1].kind).toBe('AssignmentStatement')
  })

  it('acepta incremento y decremento en la actualización de bucle_por', () => {
    const result = parse(`bucle_por (guarda i = 0; i (-) 3; i++) { guarda paso = i; }
bucle_por (guarda j = 3; j (+) 0; --j) { guarda paso = j; }`)
    expect(result.errors).toHaveLength(0)
    expect(result.ast.statements.map(statement => statement.kind)).toEqual(['ForStatement', 'ForStatement'])
  })

  it('reconoce impresora, lectura en español, valores especiales y aplicaciones currificadas', () => {
    const result = parse(`guarda limite = Inf;
fijo invalido = NaN;
impresora(...Hola..., limite);
impresora(...Listo...);
chismea();
guarda entrada = pregunta(...%d...);
tarea suma(a, b, c) { resultado mas(mas(a, b), c); }
guarda total = suma(6)(4)(2);`)
    expect(result.errors).toHaveLength(0)
    expect(result.ast.statements.map(statement => statement.kind)).toEqual([
      'VarDeclaration', 'VarDeclaration', 'OutputStatement', 'OutputStatement', 'InputStatement',
      'VarDeclaration', 'FunctionDeclaration', 'VarDeclaration',
    ])
    const declaration = result.ast.statements.at(-1)
    expect(declaration?.kind).toBe('VarDeclaration')
    if (declaration?.kind === 'VarDeclaration') {
      expect(declaration.initializer).toMatchObject({ kind: 'CallExpression', callee: 'suma', curried: true, arguments: [{ value: 6 }, { value: 4 }, { value: 2 }] })
    }
  })

  it('acepta variables guarda sin inicializador pero exige valor inicial para fijo', () => {
    const uninitialized = parse('guarda dato; impresora(...dato pendiente...);')
    expect(uninitialized.errors).toHaveLength(0)
    expect(uninitialized.ast.statements[0]).toMatchObject({ kind: 'VarDeclaration', declarationKind: 'guarda', initializer: undefined })

    const fixedWithoutValue = parse('fijo limite;')
    expect(fixedWithoutValue.errors.length).toBeGreaterThan(0)
  })

  it('acepta una llamada a tarea como instrucción independiente', () => {
    const result = parse('tarea saluda(nombre) { resultado nombre; } saluda(...Ana...);')
    expect(result.errors).toHaveLength(0)
    expect(result.ast.statements.at(-1)).toMatchObject({
      kind: 'ExpressionStatement',
      expression: { kind: 'CallExpression', callee: 'saluda', arguments: [{ value: 'Ana' }] },
    })
  })

  it('acepta los nuevos símbolos relacionales pedidos', () => {
    const result = parse(`guarda edad = 18;
si (edad =(+) 18) { guarda mayor = 1; }
si (edad =(-) 18) { guarda menor = 1; }
si (edad ==> 18) { guarda igual = 1; }`)
    expect(result.errors).toHaveLength(0)
  })

  it('informa llamadas encadenadas con sintaxis incompleta', () => {
    const malformed = parse('guarda total = suma(6)(;')
    expect(malformed.errors.length).toBeGreaterThan(0)
    const malformedOutput = parse('impresora,(,(,)')
    expect(malformedOutput.errors.length).toBeGreaterThan(0)
  })

  it('ya no trata print/sout como instrucciones reservadas de salida', () => {
    for (const legacyName of ['print', 'sout']) {
      const source = `${legacyName}(...Hola...);`
      const lexical = analyzeSource(source)
      const result = parseTokens(lexical.tokens, lexical.symbolTable)
      expect(lexical.tokens[0].type).toBe('IDENTIFIER')
      expect(result.errors).toHaveLength(0)
      expect(result.ast.statements[0].kind).toBe('ExpressionStatement')
    }
  })

  it('requiere que los identificadores del parser estén en la tabla léxica recibida', () => {
    const lexical = analyzeSource('guarda valor = 1;')
    expect(parseTokens(lexical.tokens, []).errors.length).toBeGreaterThan(0)
  })

  it('rechaza los antiguos nombres de instrucciones', () => {
    const result = parse('simera (1 igual_a 1) { guarda ok = 1; }')
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
