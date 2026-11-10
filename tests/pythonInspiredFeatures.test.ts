import { describe, expect, it } from 'vitest'
import { analyzeSource } from '../src/core/automaton/FiniteAutomaton'
import { parseTokens } from '../src/core/parser/Parser'
import { analyzeSemantics } from '../src/core/semantic/SemanticAnalyzer'
import { interpret } from '../src/core/runtime/Interpreter'

const compile = (source: string) => {
  const lexical = analyzeSource(source)
  const parsed = parseTokens(lexical.tokens, lexical.symbolTable)
  const semantic = analyzeSemantics(parsed.ast)
  return { lexical, parsed, semantic }
}

describe('verificación integral de noEsPython', () => {
  it('detecta errores léxicos con ubicación', () => {
    const { lexical } = compile('guarda dato = 1;\n¿')
    expect(lexical.errors.length).toBeGreaterThan(0)
    expect(lexical.errors[0]).toMatchObject({ line: 2, column: 1 })
  })

  it('detecta errores sintácticos por separado de la fase léxica', () => {
    const { lexical, parsed } = compile('guarda dato = ;')
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors.length).toBeGreaterThan(0)
    expect(parsed.errors[0].line).toBe(1)
  })

  it('detecta errores semánticos principales y conserva sus ubicaciones', () => {
    const cases = [
      ['guarda dato = 5 + ...hola...;', 'TYPE_MISMATCH'],
      ['guarda dato = ausente + 1;', 'UNDECLARED_IDENTIFIER'],
      ['guarda dato = 1; guarda dato = 2;', 'DUPLICATE_DECLARATION'],
      ['tarea duplicar(x: entero): entero { resultado x * 2; } guarda salida = duplicar(...cinco...);', 'TYPE_MISMATCH'],
      ['tarea sumar(a: entero, b: entero): entero { resultado a + b; } guarda total = sumar(1, 2, 3);', 'ARGUMENT_COUNT_MISMATCH'],
      ['guarda tope = 2147483647; tope = tope + 1;', 'INTEGER_OVERFLOW'],
    ] as const

    for (const [source, expectedCode] of cases) {
      const { lexical, parsed, semantic } = compile(source)
      expect(lexical.errors, source).toHaveLength(0)
      expect(parsed.errors, source).toHaveLength(0)
      const diagnostic = semantic.errors.find(error => error.code === expectedCode)
      expect(diagnostic, source).toBeDefined()
      expect(diagnostic?.line).toBeGreaterThan(0)
      expect(diagnostic?.column).toBeGreaterThan(0)
    }
  })

  it('emite warnings por variables y funciones declaradas que no se usan; permite desactivarlos', () => {
    const { parsed } = compile('guarda olvidada = 1; tarea nunca_usada() { resultado 3; }')
    const enabled = analyzeSemantics(parsed.ast)
    expect(enabled.warnings.map(warning => warning.code)).toEqual(expect.arrayContaining(['UNUSED_VARIABLE', 'UNUSED_FUNCTION']))

    const disabled = analyzeSemantics(parsed.ast, { warningsEnabled: false })
    expect(disabled.warnings).toHaveLength(0)
  })

  it('detecta lectura sin inicializar, alcance local incorrecto y código inalcanzable', () => {
    const uninitialized = compile('guarda pendiente; impresora(pendiente);')
    expect(uninitialized.semantic.warnings.some(warning => warning.code === 'UNINITIALIZED_VARIABLE')).toBe(true)
    expect(interpret(uninitialized.parsed.ast).diagnostics[0]?.code).toBe('UNINITIALIZED_VARIABLE')

    const localLeak = compile(`tarea primera() { guarda secreto = 5; resultado secreto; }
tarea segunda() { impresora(secreto); }`)
    expect(localLeak.semantic.errors.some(error => error.code === 'UNDECLARED_IDENTIFIER')).toBe(true)

    const unreachable = compile(`tarea con_salida(valor) {
  resultado valor;
  impresora(valor);
}
impresora(con_salida(2));`)
    expect(unreachable.semantic.warnings.some(warning => warning.code === 'UNREACHABLE_CODE')).toBe(true)
    expect(unreachable.semantic.warnings.some(warning => warning.code === 'UNUSED_FUNCTION')).toBe(false)
  })

  it('detecta incompatibilidades dinámicas al ejecutar valores de entrada', () => {
    const { lexical, parsed, semantic } = compile('guarda entrada = pregunta(); guarda total = entrada + 1;')
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors).toHaveLength(0)
    expect(semantic.errors).toHaveLength(0)
    const result = interpret(parsed.ast, { inputValues: ['no-numérico'] })
    expect(result.diagnostics[0]?.code).toBe('TYPE_MISMATCH')
    expect(result.diagnostics[0]?.line).toBe(1)
  })

  it('ejecuta listas, comprensión, pertenencia, iteración y asignaciones compuestas', () => {
    const source = `guarda numeros = secuencia(1, 6);
guarda cuadrados = [n * n para_cada n en numeros si n modulo 2 == 0];
guarda total = 0;
para_cada valor en cuadrados {
  total += valor;
}
afirmar 16 en cuadrados, ...debe contener 16...;
impresora(cuadrados, total);`
    const { lexical, parsed, semantic } = compile(source)
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
    expect(semantic.errors, JSON.stringify(semantic.errors)).toHaveLength(0)
    const result = interpret(parsed.ast)
    expect(result.diagnostics).toHaveLength(0)
    expect(result.outputs).toEqual(['[4, 16] 20'])
  })

  it('ejecuta diccionarios, indexación, nulo y selección de casos', () => {
    const source = `guarda datos = { ...nombre...: ...Ada..., ...edad...: 20 };
datos[...edad...] = 21;
guarda opcion = verdadero;
seleccionar (opcion) {
  caso falso { impresora(...incorrecto...); }
  caso verdadero { impresora(datos[...nombre...], datos[...edad...], nulo); }
  caso _ { impresora(...comodín...); }
}`
    const { lexical, parsed, semantic } = compile(source)
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
    expect(semantic.errors, JSON.stringify(semantic.errors)).toHaveLength(0)
    expect(interpret(parsed.ast).outputs).toEqual(['Ada 21 nulo'])
  })

  it('captura errores, ejecuta finally e importa un módulo integrado', () => {
    const source = `importar matematicas como mate;
intentar {
  lanzar ...fallo controlado...;
} capturar (error) {
  impresora(error, mate.raiz_cuadrada(9));
} finalmente {
  impresora(...finally...);
}`
    const { lexical, parsed, semantic } = compile(source)
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
    expect(semantic.errors, JSON.stringify(semantic.errors)).toHaveLength(0)
    const result = interpret(parsed.ast)
    expect(result.diagnostics).toHaveLength(0)
    expect(result.outputs).toEqual(['fallo controlado 3', 'finally'])
  })

  it('abre archivos en memoria y los cierra al salir de con', () => {
    const source = `con abrir(...nota.txt..., ...w...) como salida {
  salida.escribir(...guardado...);
}
con abrir(...nota.txt...) como entrada {
  impresora(entrada.leer());
}`
    const { lexical, parsed, semantic } = compile(source)
    expect(lexical.errors).toHaveLength(0)
    expect(parsed.errors, JSON.stringify(parsed.errors)).toHaveLength(0)
    expect(semantic.errors, JSON.stringify(semantic.errors)).toHaveLength(0)
    const result = interpret(parsed.ast)
    expect(result.diagnostics).toHaveLength(0)
    expect(result.outputs).toEqual(['guardado'])
  })
})
