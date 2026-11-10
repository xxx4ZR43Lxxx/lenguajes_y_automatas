import {
  type AssignmentNode,
  type BinaryExpressionNode,
  type BlockNode,
  type CallExpressionNode,
  type ClassDeclarationNode,
  type DeclaredValueType,
  type ErrorExpressionNode,
  type ExpressionStatementNode,
  type ExpressionNode,
  type ForStatementNode,
  type ForEachStatementNode,
  type FunctionNode,
  type IdentifierNode,
  type IfStatementNode,
  type InputStatementNode,
  type LiteralNode,
  type LambdaExpressionNode,
  type MemberExpressionNode,
  type NewExpressionNode,
  type ProgramNode,
  type OutputStatementNode,
  type ParallelNode,
  type ReturnStatementNode,
  type StatementNode,
  type UnaryExpressionNode,
  type UpdateExpressionNode,
  type VarDeclarationNode,
  type WhileStatementNode,
} from './Ast'
import { SyntaxError, syntaxSuggestion } from './SyntaxError'
import type { Token } from '../tokens/Token'
import { TokenType } from '../tokens/TokenType'
import { isIdentifierTokenType, type LexicalSymbolTable } from '../symbols/LexicalSymbolTable'

export interface ParserResult { ast: ProgramNode; errors: SyntaxError[] }

const binaryPrecedence: Partial<Record<TokenType, number>> = {
  [TokenType.LOGICAL_OR]: 1,
  [TokenType.LOGICAL_OR_SYM]: 1,
  [TokenType.LOGICAL_XOR]: 1,
  [TokenType.LOGICAL_XORT]: 1,
  [TokenType.LOGICAL_NOR]: 1,
  [TokenType.LOGICAL_AND]: 2,
  [TokenType.LOGICAL_AND_SYM]: 2,
  [TokenType.LOGICAL_NAND]: 2,
  [TokenType.LOGICAL_XNOR]: 2,
  [TokenType.EQUAL]: 3,
  [TokenType.DOUBLE_EQUAL]: 3,
  [TokenType.NOT_EQUAL]: 3,
  [TokenType.LESS]: 3,
  [TokenType.GREATER]: 3,
  [TokenType.LESS_EQUAL]: 3,
  [TokenType.GREATER_EQUAL]: 3,
  [TokenType.KEYWORD_EN]: 3,
  [TokenType.KEYWORD_NO_EN]: 3,
  [TokenType.PLUS]: 4,
  [TokenType.MINUS]: 4,
  [TokenType.MULTIPLY]: 5,
  [TokenType.DIVIDE]: 5,
  [TokenType.FLOOR_DIVIDE]: 5,
  [TokenType.MODULO]: 5,
  [TokenType.POWER]: 6,
  [TokenType.DOT_DIVIDE]: 5,
}

const expressionStartTypes: TokenType[] = [
  TokenType.IDENTIFIER, TokenType.DOLLAR_VARIABLE, TokenType.BRACKETED_VARIABLE,
  TokenType.INTEGER, TokenType.DECIMAL, TokenType.STRING, TokenType.IP_ADDRESS, TokenType.INF_LITERAL, TokenType.NAN_LITERAL,
  TokenType.LEFT_PAREN, TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE,
  TokenType.LEFT_BRACKET,
  TokenType.KEYBOARD_INPUT,
  TokenType.LOGICAL_NOT, TokenType.LOGICAL_NOT_SYM, TokenType.LOGICAL_NOT_SYMBOL,
  TokenType.PRE_INCREMENT, TokenType.PRE_DECREMENT, TokenType.POST_INCREMENT, TokenType.POST_DECREMENT,
]

/** Descenso recursivo sobre los tokens ya aceptados por el AFD. */
export class Parser {
  private readonly tokens: Token[]
  private position = 0
  private functionDepth = 0
  private readonly errors: SyntaxError[] = []

  private readonly lexicalSymbolStarts: Set<number>

  constructor(tokens: Token[], symbolTable: LexicalSymbolTable) {
    const last = tokens.at(-1)
    this.tokens = last?.type === TokenType.EOF ? tokens : [...tokens, {
      type: TokenType.EOF, lexeme: '', value: null, finalState: 'SYNTHETIC_EOF',
      line: last?.line ?? 1, column: last ? last.column + last.lexeme.length : 1,
      startIndex: last?.endIndex ?? 0, endIndex: last?.endIndex ?? 0,
    }]
    this.lexicalSymbolStarts = new Set(symbolTable.flatMap(symbol => symbol.occurrences.map(occurrence => occurrence.startIndex)))
  }

  parse(): ParserResult {
    const start = this.current()
    const statements: StatementNode[] = []
    while (!this.at(TokenType.EOF)) {
      const before = this.position
      const statement = this.parseStatement()
      if (statement) statements.push(statement)
      if (this.position === before && !this.at(TokenType.EOF)) this.advance()
    }
    const end = this.current()
    return { ast: { kind: 'Program', statements, start, end }, errors: [...this.errors] }
  }

  private parseStatement(): StatementNode | null {
    if (this.at(TokenType.KEYWORD_GUARDA) || this.at(TokenType.KEYWORD_FIJO)) return this.parseDeclaration(true)
    if (this.at(TokenType.KEYWORD_SI)) return this.parseIf()
    if (this.at(TokenType.KEYWORD_BUCLE_POR)) return this.parseFor()
    if (this.at(TokenType.KEYWORD_PARA_CADA)) return this.parseForEach()
    if (this.at(TokenType.KEYWORD_BUCLE_MIENTRAS)) return this.parseWhile()
    if (this.at(TokenType.KEYWORD_TAREA)) return this.parseFunction()
    if (this.at(TokenType.KEYWORD_CLASS)) return this.parseClass()
    if (this.at(TokenType.KEYWORD_PAR)) return this.parseParallel()
    if (this.at(TokenType.KEYWORD_SALIR)) { const token = this.advance(); const end = this.expect(TokenType.SEMICOLON, ';'); return { kind: 'BreakStatement', start: token, end } }
    if (this.at(TokenType.KEYWORD_CONTINUAR)) { const token = this.advance(); const end = this.expect(TokenType.SEMICOLON, ';'); return { kind: 'ContinueStatement', start: token, end } }
    if (this.at(TokenType.KEYWORD_SIN_OPERACION)) { const token = this.advance(); const end = this.expect(TokenType.SEMICOLON, ';'); return { kind: 'PassStatement', start: token, end } }
    if (this.at(TokenType.KEYWORD_ASEGURAR)) return this.parseAssert()
    if (this.at(TokenType.KEYWORD_INTENTAR)) return this.parseTry()
    if (this.at(TokenType.KEYWORD_LANZAR)) return this.parseThrow()
    if (this.at(TokenType.KEYWORD_SELECCIONAR)) return this.parseMatch()
    if (this.at(TokenType.KEYWORD_CON)) return this.parseWith()
    if (this.at(TokenType.KEYWORD_IMPORTAR)) return this.parseImport()
    if (this.at(TokenType.OUTPUT)) return this.parseOutputStatement()
    if (this.at(TokenType.KEYBOARD_INPUT)) return this.parseInputStatement()
    if (this.at(TokenType.KEYWORD_RESULTADO)) {
      if (this.functionDepth === 0) this.report('resultado dentro de una tarea')
      return this.parseReturn()
    }
    if (this.isIdentifierToken(this.current()) && this.peek().type === TokenType.LEFT_PAREN) return this.parseCallStatement()
    if ((this.isIdentifierToken(this.current()) || this.at(TokenType.KEYWORD_THIS)) && this.peek().type === TokenType.DOT) return this.parseMemberStatement()
    if (this.isIdentifierToken(this.current()) && this.peek().type === TokenType.LEFT_BRACKET) return this.parseIndexStatement()
    if (this.isIdentifierToken(this.current())) return this.parseAssignment(true)
    this.report('guarda, fijo, si, bucle_por, bucle_mientras, tarea, resultado, impresora, una función de lectura o una asignación')
    this.synchronize(true)
    return null
  }

  private parseDeclaration(requireTerminator: boolean): VarDeclarationNode {
    const start = this.advance()
    const declarationKind = start.type === TokenType.KEYWORD_FIJO ? 'fijo' : 'guarda'
    const identifier = this.parseIdentifier()
    const declaredType = this.at(TokenType.COLON) ? this.parseTypeAnnotation() : undefined
    let initializer: ExpressionNode | undefined
    if (this.at(TokenType.ASSIGN)) {
      this.advance()
      initializer = this.parseExpression([TokenType.SEMICOLON, TokenType.RIGHT_PAREN])
    } else if (declarationKind === 'fijo' || !this.at(TokenType.SEMICOLON)) {
      this.expect(TokenType.ASSIGN, '=')
      initializer = this.parseExpression([TokenType.SEMICOLON, TokenType.RIGHT_PAREN])
    }
    let end = initializer?.end ?? identifier.end
    if (requireTerminator) end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'VarDeclaration', declarationKind, identifier, initializer, declaredType, start, end }
  }

  private parseIf(): IfStatementNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_PAREN, '(')
    const condition = this.parseExpression([TokenType.RIGHT_PAREN])
    this.expect(TokenType.RIGHT_PAREN, ')')
    const consequent = this.parseBlock()
    let alternate: BlockNode | undefined
    if (this.at(TokenType.KEYWORD_SINO)) { this.advance(); alternate = this.parseBlock() }
    return { kind: 'IfStatement', condition, consequent, alternate, start, end: alternate?.end ?? consequent.end }
  }

  private parseFor(): ForStatementNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_PAREN, '(')
    const initialization = this.at(TokenType.KEYWORD_GUARDA) || this.at(TokenType.KEYWORD_FIJO)
      ? this.parseDeclaration(false)
      : this.parseAssignment(false)
    this.expect(TokenType.SEMICOLON, ';')
    const condition = this.parseExpression([TokenType.SEMICOLON])
    this.expect(TokenType.SEMICOLON, ';')
    const update = this.parseForUpdate()
    this.expect(TokenType.RIGHT_PAREN, ')')
    const body = this.parseBlock()
    return { kind: 'ForStatement', initialization, condition, update, body, start, end: body.end }
  }

  private parseWhile(): WhileStatementNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_PAREN, '(')
    const condition = this.parseExpression([TokenType.RIGHT_PAREN])
    this.expect(TokenType.RIGHT_PAREN, ')')
    const body = this.parseBlock()
    return { kind: 'WhileStatement', condition, body, start, end: body.end }
  }

  private parseForEach(): ForEachStatementNode {
    const start = this.advance()
    const parenthesized = this.at(TokenType.LEFT_PAREN)
    if (parenthesized) this.advance()
    const identifier = this.parseIdentifier()
    this.expect(TokenType.KEYWORD_EN, 'en')
    const iterable = this.parseExpression(parenthesized ? [TokenType.RIGHT_PAREN] : [TokenType.LEFT_BRACE])
    if (parenthesized) this.expect(TokenType.RIGHT_PAREN, ')')
    const body = this.parseBlock()
    return { kind: 'ForEachStatement', identifier, iterable, body, start, end: body.end }
  }

  private parseAssert(): StatementNode {
    const start = this.advance()
    const condition = this.parseExpression([TokenType.COMMA, TokenType.SEMICOLON])
    let message: ExpressionNode | undefined
    if (this.at(TokenType.COMMA)) { this.advance(); message = this.parseExpression([TokenType.SEMICOLON]) }
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'AssertStatement', condition, message, start, end }
  }

  private parseTry(): StatementNode {
    const start = this.advance()
    const body = this.parseBlock()
    const catches: Array<{ kind: 'CatchClause'; identifier?: IdentifierNode; body: BlockNode; start: Token; end: Token }> = []
    while (this.at(TokenType.KEYWORD_CAPTURAR)) {
      const catchStart = this.advance()
      let identifier: IdentifierNode | undefined
      if (this.at(TokenType.LEFT_PAREN)) {
        this.advance()
        identifier = this.parseIdentifier()
        this.expect(TokenType.RIGHT_PAREN, ')')
      }
      const catchBody = this.parseBlock()
      catches.push({ kind: 'CatchClause', identifier, body: catchBody, start: catchStart, end: catchBody.end })
    }
    let finalizer: BlockNode | undefined
    if (this.at(TokenType.KEYWORD_FINALMENTE)) { this.advance(); finalizer = this.parseBlock() }
    if (!catches.length && !finalizer) this.report('capturar o finalmente después de intentar')
    return { kind: 'TryStatement', body, catches, finalizer, start, end: finalizer?.end ?? catches.at(-1)?.end ?? body.end }
  }

  private parseThrow(): StatementNode {
    const start = this.advance()
    const value = this.parseExpression([TokenType.SEMICOLON])
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'ThrowStatement', value, start, end }
  }

  private parseMatch(): StatementNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_PAREN, '(')
    const value = this.parseExpression([TokenType.RIGHT_PAREN])
    this.expect(TokenType.RIGHT_PAREN, ')')
    this.expect(TokenType.LEFT_BRACE, '{')
    const cases: Array<{ kind: 'MatchCase'; pattern?: ExpressionNode; body: BlockNode; start: Token; end: Token }> = []
    while (this.at(TokenType.KEYWORD_CASO) && !this.at(TokenType.EOF)) {
      const caseStart = this.advance()
      let pattern: ExpressionNode | undefined
      if (!(this.isIdentifierToken(this.current()) && this.current().lexeme === '_')) pattern = this.parseExpression([TokenType.LEFT_BRACE])
      else this.advance()
      const body = this.parseBlock()
      cases.push({ kind: 'MatchCase', pattern, body, start: caseStart, end: body.end })
    }
    const end = this.expect(TokenType.RIGHT_BRACE, '}')
    if (!cases.length) this.report('al menos un caso dentro de seleccionar')
    return { kind: 'MatchStatement', value, cases, start, end }
  }

  private parseWith(): StatementNode {
    const start = this.advance()
    const resource = this.parseExpression([TokenType.KEYWORD_COMO])
    this.expect(TokenType.KEYWORD_COMO, 'como')
    const identifier = this.parseIdentifier()
    const body = this.parseBlock()
    return { kind: 'WithStatement', resource, identifier, body, start, end: body.end }
  }

  private parseImport(): StatementNode {
    const start = this.advance()
    const moduleToken = this.parseIdentifier()
    let alias = moduleToken.name
    if (this.at(TokenType.KEYWORD_COMO)) {
      this.advance()
      alias = this.parseIdentifier().name
    }
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'ImportStatement', moduleName: moduleToken.name.toLowerCase(), alias, start, end }
  }

  private parseParallel(): ParallelNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_BRACE, '{')
    const assignments: AssignmentNode[] = []
    while (!this.at(TokenType.RIGHT_BRACE) && !this.at(TokenType.EOF)) {
      const target = this.parseIdentifier()
      this.expect(TokenType.ASSIGN, '=')
      const value = this.parseExpression([TokenType.COMMA, TokenType.SEMICOLON, TokenType.RIGHT_BRACE])
      assignments.push({ kind: 'AssignmentStatement', target, value, start: target.start, end: value.end })
      if (this.at(TokenType.COMMA) || this.at(TokenType.SEMICOLON)) this.advance()
      else if (!this.at(TokenType.RIGHT_BRACE)) this.report("',' o ';' entre asignaciones paralelas")
    }
    const end = this.expect(TokenType.RIGHT_BRACE, '}')
    return { kind: 'ParallelStatement', assignments, start, end }
  }

  private parseForUpdate(): AssignmentNode | UpdateExpressionNode {
    if (this.at(TokenType.PRE_DECREMENT) || this.at(TokenType.PRE_INCREMENT)) return this.parseUpdate(true)
    const identifier = this.parseIdentifier()
    if (this.at(TokenType.POST_DECREMENT) || this.at(TokenType.POST_INCREMENT)) {
      const operator = this.advance()
      return { kind: 'UpdateExpression', operator, argument: identifier, prefix: false, start: identifier.start, end: operator }
    }
    if (this.at(TokenType.ASSIGN) || this.isCompoundAssignment(this.current().type)) {
      const operator = this.advance()
      const value = this.parseExpression([TokenType.RIGHT_PAREN])
      return { kind: 'AssignmentStatement', target: identifier, value, compoundOperator: operator.type === TokenType.ASSIGN ? undefined : operator, start: identifier.start, end: value.end }
    }
    this.report('=, +=, -=, *=, /=, ++ o --')
    return { kind: 'AssignmentStatement', target: identifier, value: this.errorExpression(), start: identifier.start, end: identifier.end }
  }

  private parseUpdate(prefix: boolean): UpdateExpressionNode {
    const operator = this.advance()
    const argument = this.parseIdentifier()
    return { kind: 'UpdateExpression', operator, argument, prefix, start: operator, end: argument.end }
  }

  private parseFunction(): FunctionNode {
    const start = this.advance()
    const name = this.parseIdentifier()
    this.expect(TokenType.LEFT_PAREN, '(')
    const parameters: IdentifierNode[] = []
    const parameterTypes: Record<string, DeclaredValueType> = {}
    if (!this.at(TokenType.RIGHT_PAREN)) {
      do {
        parameters.push(this.parseIdentifier())
        const parameter = parameters.at(-1)!
        if (this.at(TokenType.COLON)) parameterTypes[parameter.name] = this.parseTypeAnnotation()
        if (!this.at(TokenType.COMMA)) break
        this.advance()
      } while (!this.at(TokenType.RIGHT_PAREN) && !this.at(TokenType.EOF))
    }
    this.expect(TokenType.RIGHT_PAREN, ')')
    const returnType = this.at(TokenType.COLON) ? this.parseTypeAnnotation() : undefined
    this.functionDepth += 1
    const body = this.parseBlock()
    this.functionDepth -= 1
    let returnStatement: ReturnStatementNode | undefined
    for (const statement of body.statements) if (statement.kind === 'ReturnStatement') returnStatement = statement
    return { kind: 'FunctionDeclaration', name, parameters, parameterTypes, returnType, body, returnStatement, start, end: body.end }
  }

  private parseClass(): ClassDeclarationNode {
    const start = this.advance()
    const name = this.parseIdentifier()
    let superclass: IdentifierNode | undefined
    if (this.at(TokenType.KEYWORD_HERENCIA) || this.at(TokenType.KEYWORD_EXTENDS)) {
      this.advance()
      superclass = this.parseIdentifier()
    }
    this.expect(TokenType.LEFT_BRACE, '{')
    const fields: VarDeclarationNode[] = []
    const methods: FunctionNode[] = []
    while (!this.at(TokenType.RIGHT_BRACE) && !this.at(TokenType.EOF)) {
      const before = this.position
      if (this.at(TokenType.KEYWORD_GUARDA) || this.at(TokenType.KEYWORD_FIJO)) fields.push(this.parseDeclaration(true))
      else if (this.at(TokenType.KEYWORD_TAREA)) methods.push(this.parseFunction())
      else {
        this.report('una declaración de campo guarda/fijo o una tarea')
        this.synchronize(true)
      }
      if (this.position === before && !this.at(TokenType.EOF)) this.advance()
    }
    const end = this.expect(TokenType.RIGHT_BRACE, '}')
    return { kind: 'ClassDeclaration', name, superclass, fields, methods, start, end }
  }

  private parseLambda(): LambdaExpressionNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_PAREN, '(')
    const parameters: IdentifierNode[] = []
    const parameterTypes: Record<string, DeclaredValueType> = {}
    if (!this.at(TokenType.RIGHT_PAREN)) {
      do {
        const parameter = this.parseIdentifier()
        parameters.push(parameter)
        if (this.at(TokenType.COLON)) parameterTypes[parameter.name] = this.parseTypeAnnotation()
        if (!this.at(TokenType.COMMA)) break
        this.advance()
      } while (!this.at(TokenType.RIGHT_PAREN) && !this.at(TokenType.EOF))
    }
    this.expect(TokenType.RIGHT_PAREN, ')')
    this.expect(TokenType.ARROW, '=>')
    const body = this.parseExpression([TokenType.COMMA, TokenType.SEMICOLON, TokenType.RIGHT_PAREN])
    return { kind: 'LambdaExpression', parameters, parameterTypes, body, start, end: body.end }
  }

  private parseMemberStatement(): StatementNode | null {
    let target: ExpressionNode
    if (this.at(TokenType.KEYWORD_THIS)) {
      const token = this.advance()
      target = { kind: 'Identifier', name: 'este', start: token, end: token }
    } else {
      target = this.parseIdentifier()
    }
    while (this.at(TokenType.DOT)) {
      this.advance()
      const property = this.parseIdentifier()
      target = { kind: 'MemberExpression', object: target, property, start: target.start, end: property.end }
    }
    if (target.kind === 'MemberExpression' && this.at(TokenType.LEFT_PAREN)) {
      const group = this.parseArgumentGroup()
      const expression: CallExpressionNode = {
        kind: 'CallExpression', callee: target.property.name, receiver: target.object,
        arguments: group.arguments, argumentGroups: [group.arguments], curried: false,
        start: target.start, end: group.end,
      }
      const end = this.expect(TokenType.SEMICOLON, ';')
      return { kind: 'ExpressionStatement', expression: { ...expression, end }, start: target.start, end }
    }
    if (target.kind === 'MemberExpression' && this.at(TokenType.ASSIGN)) {
      this.advance()
      const value = this.parseExpression([TokenType.SEMICOLON])
      const end = this.expect(TokenType.SEMICOLON, ';')
      return { kind: 'AssignmentStatement', target, value, start: target.start, end }
    }
    this.report('una llamada o asignación de miembro')
    this.synchronize()
    return null
  }

  private parseIndexStatement(): AssignmentNode | null {
    const identifier = this.parseIdentifier()
    let target: ExpressionNode = identifier
    while (this.at(TokenType.LEFT_BRACKET)) {
      this.advance()
      const index = this.parseExpression([TokenType.RIGHT_BRACKET])
      const end = this.expect(TokenType.RIGHT_BRACKET, ']')
      target = { kind: 'IndexExpression', object: target, index, start: target.start, end }
    }
    if (this.at(TokenType.ASSIGN)) {
      this.advance()
      const value = this.parseExpression([TokenType.SEMICOLON])
      const end = this.expect(TokenType.SEMICOLON, ';')
      if (target.kind === 'IndexExpression') return { kind: 'AssignmentStatement', target, value, start: identifier.start, end }
    }
    this.report('una asignación de índice con =')
    this.synchronize()
    return null
  }

  private parseTypeAnnotation(): DeclaredValueType {
    this.expect(TokenType.COLON, ':')
    const token = this.current()
    const types: Partial<Record<TokenType, DeclaredValueType>> = {
      [TokenType.TYPE_INT]: 'integer', [TokenType.TYPE_FLOAT]: 'decimal',
      [TokenType.TYPE_STRING]: 'string', [TokenType.TYPE_BOOL]: 'boolean', [TokenType.TYPE_RANGE]: 'range',
    }
    const typeNames: Record<string, DeclaredValueType> = { lista: 'list', tupla: 'tuple', diccionario: 'dict', conjunto: 'set' }
    const declaredType = types[token.type] ?? typeNames[token.lexeme.toLowerCase()]
    if (!declaredType) {
      this.report('un tipo (entero, real, texto, booleano o rango)')
      return 'integer'
    }
    this.advance()
    return declaredType
  }

  private parseBlock(): BlockNode {
    const start = this.expect(TokenType.LEFT_BRACE, '{')
    const statements: StatementNode[] = []
    while (!this.at(TokenType.RIGHT_BRACE) && !this.at(TokenType.EOF)) {
      const before = this.position
      const statement = this.parseStatement()
      if (statement) statements.push(statement)
      if (this.position === before && !this.at(TokenType.EOF)) this.advance()
    }
    const end = this.expect(TokenType.RIGHT_BRACE, '}')
    return { kind: 'Block', statements, start, end }
  }

  private parseReturn(): ReturnStatementNode {
    const start = this.advance()
    const value = this.parseExpression([TokenType.SEMICOLON])
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'ReturnStatement', value, start, end }
  }

  private parseOutputStatement(): OutputStatementNode {
    const start = this.advance()
    const group = this.parseArgumentGroup()
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'OutputStatement', instruction: start.lexeme, arguments: group.arguments, start, end }
  }

  private parseInputStatement(): InputStatementNode {
    const start = this.advance()
    const call = this.parseCall(start.lexeme, start)
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'InputStatement', call, start, end }
  }

  private parseCallStatement(): ExpressionStatementNode {
    const identifier = this.parseIdentifier()
    const expression = this.parseCall(identifier.name, identifier.start)
    const end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'ExpressionStatement', expression, start: identifier.start, end }
  }

  private parseAssignment(requireTerminator: boolean): AssignmentNode {
    const target = this.parseIdentifier()
    const operator = this.current()
    if (this.at(TokenType.ASSIGN) || this.isCompoundAssignment(operator.type)) this.advance()
    else this.expect(TokenType.ASSIGN, '=')
    const value = this.parseExpression(requireTerminator ? [TokenType.SEMICOLON] : [TokenType.SEMICOLON, TokenType.RIGHT_PAREN])
    const end = requireTerminator ? this.expect(TokenType.SEMICOLON, ';') : value.end
    return { kind: 'AssignmentStatement', target, value, compoundOperator: operator.type === TokenType.ASSIGN ? undefined : operator, start: target.start, end }
  }

  private parseExpression(stop: TokenType[]): ExpressionNode {
    if (stop.includes(this.current().type) || this.at(TokenType.EOF)) {
      this.report('una expresión válida')
      return this.errorExpression()
    }
    return this.parseBinary(0, stop)
  }

  private parseBinary(minimum: number, stop: TokenType[]): ExpressionNode {
    let left = this.parseUnary(stop)
    while (!stop.includes(this.current().type)) {
      const precedence = binaryPrecedence[this.current().type]
      if (precedence === undefined || precedence < minimum) break
      const operator = this.advance()
      const right = this.parseBinary(precedence + 1, stop)
      const binary: BinaryExpressionNode = { kind: 'BinaryExpression', left, operator, right, start: left.start, end: right.end }
      left = binary
    }
    return left
  }

  private parseUnary(stop: TokenType[]): ExpressionNode {
    const type = this.current().type
    const functional = (type === TokenType.PLUS || type === TokenType.MINUS || type === TokenType.MULTIPLY || type === TokenType.DIVIDE) && this.peek().type === TokenType.LEFT_PAREN
    if (functional) return this.parsePrimary(stop)
    if (type === TokenType.PRE_DECREMENT || type === TokenType.PRE_INCREMENT) return this.parseUpdate(true)
    if (type === TokenType.PLUS || type === TokenType.MINUS || type === TokenType.LOGICAL_NOT || type === TokenType.LOGICAL_NOT_SYM || type === TokenType.LOGICAL_NOT_SYMBOL) {
      const operator = this.advance()
      const operand = this.parseUnary(stop)
      const unary: UnaryExpressionNode = { kind: 'UnaryExpression', operator, operand, start: operator, end: operand.end }
      return unary
    }
    return this.parsePrimary(stop)
  }

  private parsePrimary(stop: TokenType[]): ExpressionNode {
    const token = this.current()
    if (token.type === TokenType.LEFT_PAREN) {
      const start = this.advance()
      const expression = this.parseExpression([TokenType.RIGHT_PAREN])
      if (this.at(TokenType.COMMA)) {
        const items = [expression]
        while (this.at(TokenType.COMMA)) {
          this.advance()
          if (this.at(TokenType.RIGHT_PAREN)) break
          items.push(this.parseExpression([TokenType.COMMA, TokenType.RIGHT_PAREN]))
        }
        const end = this.expect(TokenType.RIGHT_PAREN, ')')
        return { kind: 'CollectionLiteral', collectionType: 'tuple', items, start, end }
      }
      const end = this.expect(TokenType.RIGHT_PAREN, ')')
      return { ...expression, start, end }
    }
    if (token.type === TokenType.LEFT_BRACKET) {
      const start = this.advance()
      if (this.at(TokenType.RIGHT_BRACKET)) {
        const end = this.advance()
        return { kind: 'CollectionLiteral', collectionType: 'list', items: [], start, end }
      }
      const first = this.parseExpression([TokenType.COMMA, TokenType.RIGHT_BRACKET, TokenType.KEYWORD_PARA_CADA])
      if (this.at(TokenType.KEYWORD_PARA_CADA)) {
        this.advance()
        const identifier = this.parseIdentifier()
        this.expect(TokenType.KEYWORD_EN, 'en')
        const iterable = this.parseExpression([TokenType.KEYWORD_SI, TokenType.RIGHT_BRACKET])
        const condition = this.at(TokenType.KEYWORD_SI) ? (this.advance(), this.parseExpression([TokenType.RIGHT_BRACKET])) : undefined
        const end = this.expect(TokenType.RIGHT_BRACKET, ']')
        return { kind: 'ListComprehension', element: first, identifier, iterable, condition, start, end }
      }
      if (!this.at(TokenType.COMMA)) {
        const end = this.expect(TokenType.RIGHT_BRACKET, ']')
        return { kind: 'CollectionLiteral', collectionType: 'list', items: [first], start, end }
      }
      this.advance()
      if (this.at(TokenType.RANGE)) {
        this.advance()
        this.expect(TokenType.COMMA, ',')
        const upper = this.parseExpression([TokenType.RIGHT_BRACKET])
        const end = this.expect(TokenType.RIGHT_BRACKET, ']')
        return { kind: 'RangeLiteral', lower: first, upper, start, end }
      }
      const items = [first, this.parseExpression([TokenType.COMMA, TokenType.RIGHT_BRACKET])]
      while (this.at(TokenType.COMMA)) {
        this.advance()
        if (this.at(TokenType.RIGHT_BRACKET)) break
        items.push(this.parseExpression([TokenType.COMMA, TokenType.RIGHT_BRACKET]))
      }
      const end = this.expect(TokenType.RIGHT_BRACKET, ']')
      return { kind: 'CollectionLiteral', collectionType: 'list', items, start, end }
    }
    if (token.type === TokenType.LEFT_BRACE) {
      const start = this.advance()
      if (this.at(TokenType.RIGHT_BRACE)) {
        const end = this.advance()
        return { kind: 'CollectionLiteral', collectionType: 'dict', items: [], entries: [], start, end }
      }
      const first = this.parseExpression([TokenType.COLON, TokenType.COMMA, TokenType.RIGHT_BRACE])
      if (this.at(TokenType.COLON)) {
        const entries: Array<{ key: ExpressionNode; value: ExpressionNode }> = []
        let key: ExpressionNode = first
        do {
          this.expect(TokenType.COLON, ':')
          const value = this.parseExpression([TokenType.COMMA, TokenType.RIGHT_BRACE])
          entries.push({ key, value })
          if (!this.at(TokenType.COMMA)) break
          this.advance()
          if (this.at(TokenType.RIGHT_BRACE)) break
          key = this.parseExpression([TokenType.COLON, TokenType.COMMA, TokenType.RIGHT_BRACE])
        } while (!this.at(TokenType.RIGHT_BRACE) && !this.at(TokenType.EOF))
        const end = this.expect(TokenType.RIGHT_BRACE, '}')
        return { kind: 'CollectionLiteral', collectionType: 'dict', items: [], entries, start, end }
      }
      const items = [first]
      while (this.at(TokenType.COMMA)) {
        this.advance()
        if (this.at(TokenType.RIGHT_BRACE)) break
        items.push(this.parseExpression([TokenType.COMMA, TokenType.RIGHT_BRACE]))
      }
      const end = this.expect(TokenType.RIGHT_BRACE, '}')
      return { kind: 'CollectionLiteral', collectionType: 'set', items, start, end }
    }
    if (this.isIdentifierToken(token) || token.type === TokenType.KEYWORD_THIS) {
      const identifier: IdentifierNode = token.type === TokenType.KEYWORD_THIS
        ? (() => {
            const current = this.advance()
            return { kind: 'Identifier', name: 'este', start: current, end: current }
          })()
        : this.parseIdentifier()
      let initial: ExpressionNode = this.at(TokenType.LEFT_PAREN) ? this.parseCall(identifier.name, identifier.start) : identifier
      if (this.at(TokenType.POST_INCREMENT) || this.at(TokenType.POST_DECREMENT)) {
        const op = this.advance()
        return { kind: 'UpdateExpression', operator: op, argument: identifier, prefix: false, start: identifier.start, end: op }
      }
      while (this.at(TokenType.DOT) || this.at(TokenType.LEFT_BRACKET)) {
        if (this.at(TokenType.LEFT_BRACKET)) {
          this.advance()
          const index = this.parseExpression([TokenType.RIGHT_BRACKET])
          const end = this.expect(TokenType.RIGHT_BRACKET, ']')
          initial = { kind: 'IndexExpression', object: initial, index, start: initial.start, end }
          continue
        }
        this.advance()
        const property = this.parseIdentifier()
        initial = { kind: 'MemberExpression', object: initial, property, start: initial.start, end: property.end }
        if (this.at(TokenType.LEFT_PAREN)) {
          const group = this.parseArgumentGroup()
          initial = {
            kind: 'CallExpression', callee: property.name, receiver: (initial as MemberExpressionNode).object,
            arguments: group.arguments, argumentGroups: [group.arguments], curried: false,
            start: initial.start, end: group.end,
          }
        }
      }
      return initial
    }
    if (token.type === TokenType.KEYWORD_LAMBDA) return this.parseLambda()
    if (token.type === TokenType.KEYWORD_VERDADERO || token.type === TokenType.KEYWORD_FALSO || token.type === TokenType.KEYWORD_NULO) {
      this.advance()
      const value = token.type === TokenType.KEYWORD_VERDADERO ? true : token.type === TokenType.KEYWORD_FALSO ? false : null
      return { kind: 'Literal', value, literalType: token.type, start: token, end: token }
    }
    if (token.type === TokenType.KEYWORD_NEW) {
      const start = this.advance()
      const className = this.parseIdentifier()
      const group = this.parseArgumentGroup()
      return { kind: 'NewExpression', className: className.name, arguments: group.arguments, start, end: group.end }
    }
    if (token.type === TokenType.KEYBOARD_INPUT) {
      this.advance()
      return this.parseCall(token.lexeme, token)
    }
    if (token.type === TokenType.PLUS || token.type === TokenType.MINUS || token.type === TokenType.MULTIPLY || token.type === TokenType.DIVIDE) {
      const operator = this.advance()
      if (this.at(TokenType.LEFT_PAREN)) return this.parseCall(operator.lexeme, operator)
      this.report('(')
      return this.errorExpression(operator)
    }
    if (token.type === TokenType.INTEGER || token.type === TokenType.DECIMAL || token.type === TokenType.STRING ||
      token.type === TokenType.IP_ADDRESS || token.type === TokenType.INF_LITERAL || token.type === TokenType.NAN_LITERAL) {
      this.advance()
      const literal: LiteralNode = { kind: 'Literal', value: token.value, literalType: token.type, start: token, end: token }
      return literal
    }
    if (stop.includes(token.type)) { this.report('una expresión válida'); return this.errorExpression() }
    this.report('una expresión válida')
    if (!this.at(TokenType.EOF)) this.advance()
    return this.errorExpression(token)
  }

  private parseCall(callee: string, start: Token): CallExpressionNode {
    const argumentGroups: ExpressionNode[][] = []
    let end = this.current()
    do {
      const group = this.parseArgumentGroup()
      argumentGroups.push(group.arguments)
      end = group.end
    } while (this.at(TokenType.LEFT_PAREN))
    return {
      kind: 'CallExpression',
      callee,
      arguments: argumentGroups.flat(),
      argumentGroups,
      curried: argumentGroups.length > 1,
      start,
      end,
    }
  }

  private parseArgumentGroup(): { arguments: ExpressionNode[]; end: Token } {
    this.expect(TokenType.LEFT_PAREN, '(')
    const argumentsList: ExpressionNode[] = []
    if (!this.at(TokenType.RIGHT_PAREN)) {
      do {
        argumentsList.push(this.parseExpression([TokenType.COMMA, TokenType.RIGHT_PAREN]))
        if (!this.at(TokenType.COMMA)) break
        this.advance()
      } while (!this.at(TokenType.RIGHT_PAREN) && !this.at(TokenType.EOF))
    }
    return { arguments: argumentsList, end: this.expect(TokenType.RIGHT_PAREN, ')') }
  }

  private parseIdentifier(): IdentifierNode {
    const token = this.current()
    if (this.isIdentifierToken(token)) {
      this.advance()
      return { kind: 'Identifier', name: token.lexeme, start: token, end: token }
    }
    this.report('IDENTIFICADOR')
    if (!this.at(TokenType.EOF)) this.advance()
    return { kind: 'Identifier', name: '<error>', start: token, end: token }
  }

  private errorExpression(token = this.current()): ErrorExpressionNode { return { kind: 'ErrorExpression', start: token, end: token } }
  private expect(type: TokenType, expected: string): Token {
    if (this.at(type)) return this.advance()
    this.report(expected)
    return this.current()
  }
  private report(expected: string): void { this.errors.push(new SyntaxError(expected, this.current(), syntaxSuggestion(expected, this.current()))) }
  private synchronize(stopAtBrace = false): void {
    while (!this.at(TokenType.EOF)) {
      if (this.isStatementStart() || (stopAtBrace && this.at(TokenType.RIGHT_BRACE))) return
      const token = this.advance()
      if (token.type === TokenType.SEMICOLON) return
    }
  }
  private isIdentifierToken(token: Token): boolean {
    return isIdentifierTokenType(token.type) && this.lexicalSymbolStarts.has(token.startIndex)
  }
  private isStatementStart(): boolean {
    const type = this.current().type
    return this.isIdentifierToken(this.current()) || type === TokenType.KEYWORD_GUARDA || type === TokenType.KEYWORD_FIJO ||
      type === TokenType.KEYWORD_SI || type === TokenType.KEYWORD_BUCLE_POR ||
      type === TokenType.KEYWORD_BUCLE_MIENTRAS || type === TokenType.KEYWORD_TAREA ||
      type === TokenType.KEYWORD_RESULTADO || type === TokenType.KEYWORD_PAR || type === TokenType.KEYWORD_CLASS ||
      type === TokenType.OUTPUT || type === TokenType.KEYBOARD_INPUT || type === TokenType.KEYWORD_PARA_CADA ||
      type === TokenType.KEYWORD_SALIR || type === TokenType.KEYWORD_CONTINUAR || type === TokenType.KEYWORD_SIN_OPERACION || type === TokenType.KEYWORD_ASEGURAR
      || type === TokenType.KEYWORD_INTENTAR || type === TokenType.KEYWORD_LANZAR || type === TokenType.KEYWORD_SELECCIONAR || type === TokenType.KEYWORD_CON || type === TokenType.KEYWORD_IMPORTAR
  }
  private isCompoundAssignment(type: TokenType): boolean {
    return [TokenType.PLUS_ASSIGN, TokenType.MINUS_ASSIGN, TokenType.MULTIPLY_ASSIGN, TokenType.DIVIDE_ASSIGN].includes(type)
  }
  private at(type: TokenType): boolean { return this.current().type === type }
  private current(): Token { return this.tokens[this.position] ?? this.tokens.at(-1)! }
  private peek(): Token { return this.tokens[this.position + 1] ?? this.current() }
  private advance(): Token { const token = this.current(); if (!this.at(TokenType.EOF)) this.position += 1; return token }
}

export const parseTokens = (tokens: Token[], symbolTable: LexicalSymbolTable): ParserResult =>
  new Parser(tokens, symbolTable).parse()
