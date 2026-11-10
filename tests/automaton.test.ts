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

  it('trabaja con notación funcional simbólica +(+(5,3), 2)', () => {
    const result = analyzeSource('+(+(5,3), 2)')
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.map(token => token.type)).toEqual([
      TokenType.PLUS, TokenType.LEFT_PAREN, TokenType.PLUS, TokenType.LEFT_PAREN,
      TokenType.INTEGER, TokenType.COMMA, TokenType.INTEGER, TokenType.RIGHT_PAREN,
      TokenType.COMMA, TokenType.INTEGER, TokenType.RIGHT_PAREN, TokenType.EOF,
    ])
  })

  it('reconoce los operadores lógicos en español y deja libres las palabras inglesas antiguas', () => {
    const resultWords = analyzeSource('Y o No and or not xor')
    expect(resultWords.errors).toHaveLength(0)
    expect(resultWords.tokens.map(token => token.type)).toEqual([
      TokenType.LOGICAL_AND, TokenType.LOGICAL_OR, TokenType.LOGICAL_NOT,
      TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER,
      TokenType.IDENTIFIER, TokenType.EOF,
    ])

    const resultSymbols = analyzeSource('&& || ! & | ~ ¬')
    expect(resultSymbols.errors).toHaveLength(0)
    expect(resultSymbols.tokens.map(token => token.type)).toEqual([
      TokenType.LOGICAL_AND_SYM, TokenType.LOGICAL_OR_SYM, TokenType.LOGICAL_NOT_SYM,
      TokenType.BITWISE_AND, TokenType.BITWISE_OR, TokenType.BITWISE_NOT,
      TokenType.LOGICAL_NOT_SYMBOL, TokenType.EOF,
    ])
  })

  it('reserva solo palabras del lenguaje implementado', () => {
    const result = analyzeSource('GUARDA fijo Si sino bucle_por BUCLE_MIENTRAS tarea resultado mas; menos; por entre menor_igual mayor_igual igual_a distinto_de')
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.filter(token => token.type !== TokenType.SEMICOLON).map(token => token.type)).toEqual([
      TokenType.KEYWORD_GUARDA, TokenType.KEYWORD_FIJO, TokenType.KEYWORD_SI,
      TokenType.KEYWORD_SINO, TokenType.KEYWORD_BUCLE_POR, TokenType.KEYWORD_BUCLE_MIENTRAS,
      TokenType.KEYWORD_TAREA, TokenType.KEYWORD_RESULTADO, TokenType.PLUS, TokenType.MINUS,
      TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL,
      TokenType.EQUAL, TokenType.NOT_EQUAL, TokenType.EOF,
    ])

    const oldWords = analyzeSource('simera notons recorre chamba regresa if while for class menor mayor igual')
    expect(oldWords.errors).toHaveLength(0)
    expect(oldWords.tokens.slice(0, -1).every(token => token.type === TokenType.IDENTIFIER)).toBe(true)

    const inputOutput = analyzeSource('impresora chismea atrapa pregunta dameDatos print sout get input scanf')
    expect(inputOutput.tokens.slice(0, -1).map(token => token.type)).toEqual([
      TokenType.OUTPUT,
      TokenType.KEYBOARD_INPUT, TokenType.KEYBOARD_INPUT, TokenType.KEYBOARD_INPUT, TokenType.KEYBOARD_INPUT,
      TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER,
    ])
  })

  it('valida números decimales (.81, .2, 80., 25.36) y rechaza números mal formados (7.3.1, 2.34.81.2)', () => {
    // Válidos
    const valid = analyzeSource('25.36 80. .81 .2 0 12')
    expect(valid.errors).toHaveLength(0)
    expect(valid.tokens.filter(t => t.type === TokenType.DECIMAL)).toHaveLength(4)

    // Separados por espacios es válido léxicamente
    const spaced = analyzeSource('x = 2.34 .81 .2')
    expect(spaced.errors).toHaveLength(0)
    expect(spaced.tokens.map(t => t.type)).toEqual([
      TokenType.IDENTIFIER, TokenType.ASSIGN, TokenType.DECIMAL,
      TokenType.DECIMAL, TokenType.DECIMAL, TokenType.EOF,
    ])

    // Mal formados (múltiples puntos): deben marcar error y detenerse
    const invalid1 = analyzeSource('7.3.1')
    expect(invalid1.errors).toHaveLength(1)
    expect(invalid1.errors[0].type).toBe(LexicalErrorType.INVALID_DECIMAL_LITERAL)

    const invalid2 = analyzeSource('X = 2.34.81.2')
    expect(invalid2.errors).toHaveLength(1)
    expect(invalid2.errors[0].type).toBe(LexicalErrorType.INVALID_DECIMAL_LITERAL)
    // Se detiene y no analiza tokens después del error
    expect(invalid2.tokens.some(t => t.type === TokenType.EOF)).toBe(false)

    // La secuencia ... inicia texto, incluso cuando sigue directamente a un número.
    const adjacent = analyzeSource('3...hola... .81 ...mundo...')
    expect(adjacent.errors).toHaveLength(0)
    expect(adjacent.tokens.map(token => token.type)).toEqual([
      TokenType.INTEGER, TokenType.STRING, TokenType.DECIMAL, TokenType.STRING, TokenType.EOF,
    ])
  })

  it('acepta cadenas solo entre tres puntos, incluso vacías y multilínea', () => {
    const result = analyzeSource('...Hola mundo... ...... ...línea 1\nlínea 2...')
    expect(result.errors).toHaveLength(0)
    expect(result.tokens.slice(0, -1)).toMatchObject([
      { type: TokenType.STRING, lexeme: '...Hola mundo...', value: 'Hola mundo' },
      { type: TokenType.STRING, lexeme: '......', value: '' },
      { type: TokenType.STRING, lexeme: '...línea 1\nlínea 2...', value: 'línea 1\nlínea 2' },
    ])
    expect(result.tokens[2]).toMatchObject({ line: 1 })

    const unclosed = analyzeSource('...sin cierre\ny segunda línea')
    expect(unclosed.errors[0]).toMatchObject({ type: LexicalErrorType.UNCLOSED_STRING, line: 1 })
    expect(unclosed.tokens.some(token => token.type === TokenType.EOF)).toBe(false)

    for (const oldDelimiter of ['"hola"', "'hola'", '¿Hola mundo?']) {
      expect(analyzeSource(oldDelimiter).errors[0].type).toBe(LexicalErrorType.UNKNOWN_CHARACTER)
    }
  })

  it('deja disponibles como identificadores los nombres de tipos aún no implementados', () => {
    const valid = analyzeSource('arreglo vector lista matriz array matrix')
    expect(valid.errors).toHaveLength(0)
    expect(valid.tokens.map(token => token.type)).toEqual([
      TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER,
      TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.EOF,
    ])
  })

  it('aplica ley de signos y analiza expresiones complejas de incremento/decremento: X = - --x + z++;', () => {
    const expr = analyzeSource('X = - --x + z++; //esto está bien')
    expect(expr.errors).toHaveLength(0)
    expect(expr.tokens.map(token => token.type)).toEqual([
      TokenType.IDENTIFIER,
      TokenType.ASSIGN,
      TokenType.MINUS,
      TokenType.PRE_DECREMENT,
      TokenType.IDENTIFIER,
      TokenType.PLUS,
      TokenType.IDENTIFIER,
      TokenType.POST_INCREMENT,
      TokenType.SEMICOLON,
      TokenType.EOF,
    ])
    expect(expr.comments).toHaveLength(1)
    expect(expr.comments[0].content).toContain('//esto está bien')

    // Ley de signos adyacentes
    const signs = analyzeSource('x = mas menos 5 mas 7')
    expect(signs.tokens.map(token => token.type)).toEqual([
      TokenType.IDENTIFIER, TokenType.ASSIGN, TokenType.MINUS,
      TokenType.INTEGER, TokenType.PLUS, TokenType.INTEGER, TokenType.EOF,
    ])
  })

  it('reconoce variables con prefijo dólar ($a, $b) y entre corchetes ([a], [b])', () => {
    const vars = analyzeSource('A B C $a $b [a] [b]')
    expect(vars.errors).toHaveLength(0)
    expect(vars.tokens.map(t => t.type)).toEqual([
      TokenType.IDENTIFIER, TokenType.IDENTIFIER, TokenType.IDENTIFIER,
      TokenType.DOLLAR_VARIABLE, TokenType.DOLLAR_VARIABLE,
      TokenType.BRACKETED_VARIABLE, TokenType.BRACKETED_VARIABLE,
      TokenType.EOF,
    ])
  })

  it('reconoce comentarios de una línea con // y \\\\ junto a los formatos compatibles', () => {
    const source = `// comentario barra
\\\\ comentario doble barra invertida
guarda visible = 1;
:) comentario del lenguaje
con varias líneas :(
/* comentario
bloque */
# comentario hash
% comentario porcentaje
rem comentario rem`
    const result = analyzeSource(source)
    expect(result.errors).toHaveLength(0)
    expect(result.comments).toHaveLength(6)
    expect(result.comments[1].content).toBe('\\\\ comentario doble barra invertida')
    expect(result.tokens.some(token => token.lexeme === 'visible')).toBe(true)
    expect(result.comments[2].content).toContain(':)')
    expect(result.comments[2].content).toContain(':(')
    expect(result.tokens.some(token => token.lexeme === '%')).toBe(true)
    expect(analyzeSource(':) sin cierre').errors[0].type).toBe(LexicalErrorType.UNCLOSED_COMMENT)
  })

  it('reconoce operadores relacionales, de asignación y de uso especial', () => {
    const ops = analyzeSource('< > <= >= == != <> = <- -> ; ;; :: : ?: NULL NaN Inf à $')
    expect(ops.errors).toHaveLength(0)
    expect(ops.tokens.map(t => t.type)).toEqual([
      TokenType.LESS, TokenType.GREATER, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL,
      TokenType.DOUBLE_EQUAL, TokenType.NOT_EQUAL, TokenType.NOT_EQUAL,
      TokenType.ASSIGN, TokenType.ASSIGN_LEFT, TokenType.ASSIGN_RIGHT,
      TokenType.SEMICOLON, TokenType.DOUBLE_SEMICOLON, TokenType.DOUBLE_COLON, TokenType.COLON,
      TokenType.ELVIS, TokenType.IDENTIFIER, TokenType.NAN_LITERAL, TokenType.INF_LITERAL,
      TokenType.SPECIAL_A, TokenType.DOLLAR, TokenType.EOF,
    ])

    const requested = analyzeSource('=(+) =(-) ==>')
    expect(requested.errors).toHaveLength(0)
    expect(requested.tokens.map(token => token.type)).toEqual([
      TokenType.GREATER_EQUAL, TokenType.LESS_EQUAL, TokenType.EQUAL, TokenType.EOF,
    ])
    expect(requested.tokens.slice(0, -1).map(token => token.lexeme)).toEqual(['=(+)', '=(-)', '==>'])
  })

  it('distingue (+) y (-) comparadores de + y - aritméticos', () => {
    const result = analyzeSource('si (a (-) b) { guarda diferencia = a - b; } si (a (+) b) { guarda suma = a + b; }')
    expect(result.errors).toHaveLength(0)
    const comparison = result.tokens.filter(token => token.type === TokenType.LESS || token.type === TokenType.GREATER)
    expect(comparison.map(token => [token.type, token.lexeme])).toEqual([
      [TokenType.LESS, '(-)'], [TokenType.GREATER, '(+)'],
    ])
    expect(result.tokens.filter(token => token.lexeme === '-').map(token => token.type)).toEqual([TokenType.MINUS])
    expect(result.tokens.filter(token => token.lexeme === '+').map(token => token.type)).toEqual([TokenType.PLUS])
    expect(analyzeSource('(-) (+) ( - ) ( + )').tokens.map(token => token.type)).toEqual([
      TokenType.LESS, TokenType.GREATER,
      TokenType.LEFT_PAREN, TokenType.MINUS, TokenType.RIGHT_PAREN,
      TokenType.LEFT_PAREN, TokenType.PLUS, TokenType.RIGHT_PAREN, TokenType.EOF,
    ])
  })

  it('se detiene inmediatamente al encontrar un token no perteneciente al lenguaje', () => {
    const res = analyzeSource('x = 10 @ y = 20')
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].type).toBe(LexicalErrorType.UNKNOWN_CHARACTER)
    expect(res.errors[0].lexeme).toBe('@')
    // No continúa tokenizando después de @
    expect(res.tokens.some(t => t.lexeme === 'y')).toBe(false)
  })
})
