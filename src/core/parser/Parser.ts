import {
  type AssignmentNode,
  type BinaryExpressionNode,
  type BlockNode,
  type CallExpressionNode,
  type ErrorExpressionNode,
  type ExpressionNode,
  type ForStatementNode,
  type FunctionNode,
  type IdentifierNode,
  type IfStatementNode,
  type LiteralNode,
  type ProgramNode,
  type ReturnStatementNode,
  type StatementNode,
  type UnaryExpressionNode,
  type UpdateExpressionNode,
  type VarDeclarationNode,
} from './Ast'
import { SyntaxError, syntaxSuggestion } from './SyntaxError'
import type { Token } from '../tokens/Token'
import { TokenType } from '../tokens/TokenType'

export interface ParserResult { ast: ProgramNode; errors: SyntaxError[] }

const binaryPrecedence: Partial<Record<TokenType, number>> = {
  [TokenType.LOGICAL_OR]: 1,
  [TokenType.LOGICAL_XOR]: 1,
  [TokenType.LOGICAL_XORT]: 1,
  [TokenType.LOGICAL_NOR]: 1,
  [TokenType.LOGICAL_AND]: 2,
  [TokenType.LOGICAL_NAND]: 2,
  [TokenType.LOGICAL_XNOR]: 2,
  [TokenType.EQUAL]: 3,
  [TokenType.LESS]: 3,
  [TokenType.GREATER]: 3,
  [TokenType.LESS_EQUAL]: 3,
  [TokenType.GREATER_EQUAL]: 3,
  [TokenType.PLUS]: 4,
  [TokenType.MINUS]: 4,
  [TokenType.MULTIPLY]: 5,
  [TokenType.DIVIDE]: 5,
}

const expressionStartTypes: TokenType[] = [
  TokenType.IDENTIFIER, TokenType.INTEGER, TokenType.DECIMAL, TokenType.STRING,
  TokenType.IP_ADDRESS, TokenType.LEFT_PAREN, TokenType.PLUS, TokenType.MINUS,
  TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.LOGICAL_NOT, TokenType.PRE_DECREMENT,
  TokenType.POST_DECREMENT,
]

/** Descenso recursivo sobre los tokens ya aceptados por el AFD. */
export class Parser {
  private position = 0
  private readonly errors: SyntaxError[] = []

  constructor(private readonly tokens: Token[]) {}

  parse(): ParserResult {
    const start = this.current()
    const statements: StatementNode[] = []
    while (!this.at(TokenType.EOF)) {
      const before = this.position
      if (this.at(TokenType.STATEMENT_START)) {
        const statement = this.parseStatement()
        if (statement) statements.push(statement)
      } else {
        this.report('¿')
        this.synchronize()
      }
      if (this.position === before && !this.at(TokenType.EOF)) this.advance()
    }
    const end = this.current()
    return { ast: { kind: 'Program', statements, start, end }, errors: [...this.errors] }
  }

  private parseStatement(): StatementNode | null {
    this.expect(TokenType.STATEMENT_START, '¿')
    if (this.at(TokenType.KEYWORD_GUARDA) || this.at(TokenType.KEYWORD_FIJO)) return this.parseDeclaration(true)
    if (this.at(TokenType.KEYWORD_SIMERA)) return this.parseIf()
    if (this.at(TokenType.KEYWORD_RECORRE)) return this.parseFor()
    if (this.at(TokenType.KEYWORD_CHAMBA)) return this.parseFunction()
    this.report('guarda, fijo, simera, recorre o chamba')
    this.synchronize()
    return null
  }

  private parseDeclaration(requireTerminator: boolean): VarDeclarationNode {
    const start = this.advance()
    const declarationKind = start.type === TokenType.KEYWORD_FIJO ? 'fijo' : 'guarda'
    const identifier = this.parseIdentifier()
    this.expect(TokenType.ASSIGN, '=')
    const initializer = this.parseExpression([TokenType.SEMICOLON, TokenType.RIGHT_PAREN])
    let end = initializer.end
    if (requireTerminator) end = this.expect(TokenType.SEMICOLON, ';')
    return { kind: 'VarDeclaration', declarationKind, identifier, initializer, start, end }
  }

  private parseIf(): IfStatementNode {
    const start = this.advance()
    this.expect(TokenType.LEFT_PAREN, '(')
    const condition = this.parseExpression([TokenType.RIGHT_PAREN])
    this.expect(TokenType.RIGHT_PAREN, ')')
    const consequent = this.parseBlock()
    let alternate: BlockNode | undefined
    if (this.at(TokenType.KEYWORD_NOTONS)) { this.advance(); alternate = this.parseBlock() }
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

  private parseForUpdate(): AssignmentNode | UpdateExpressionNode {
    if (this.at(TokenType.PRE_DECREMENT)) return this.parseUpdate(true)
    const identifier = this.parseIdentifier()
    if (this.at(TokenType.POST_DECREMENT)) {
      const operator = this.advance()
      return { kind: 'UpdateExpression', operator, argument: identifier, prefix: false, start: identifier.start, end: operator }
    }
    if (this.at(TokenType.ASSIGN)) {
      this.advance()
      const value = this.parseExpression([TokenType.RIGHT_PAREN])
      return { kind: 'AssignmentStatement', target: identifier, value, start: identifier.start, end: value.end }
    }
    this.report('= o menos menos')
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
    if (!this.at(TokenType.RIGHT_PAREN)) {
      do {
        parameters.push(this.parseIdentifier())
        if (!this.at(TokenType.COMMA)) break
        this.advance()
      } while (!this.at(TokenType.RIGHT_PAREN) && !this.at(TokenType.EOF))
    }
    this.expect(TokenType.RIGHT_PAREN, ')')
    const body = this.parseBlock()
    let returnStatement: ReturnStatementNode | undefined
    for (const statement of body.statements) if (statement.kind === 'ReturnStatement') returnStatement = statement
    return { kind: 'FunctionDeclaration', name, parameters, body, returnStatement, start, end: body.end }
  }

  private parseBlock(): BlockNode {
    const start = this.expect(TokenType.LEFT_BRACE, '{')
    const statements: StatementNode[] = []
    while (!this.at(TokenType.RIGHT_BRACE) && !this.at(TokenType.EOF)) {
      const before = this.position
      if (this.at(TokenType.KEYWORD_REGRESA)) statements.push(this.parseReturn())
      else if (this.at(TokenType.STATEMENT_START)) {
        const statement = this.parseStatement()
        if (statement) statements.push(statement)
      } else {
        this.report('¿ o regresa')
        this.synchronize(true)
      }
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

  private parseAssignment(requireTerminator: boolean): AssignmentNode {
    const target = this.parseIdentifier()
    this.expect(TokenType.ASSIGN, '=')
    const value = this.parseExpression(requireTerminator ? [TokenType.SEMICOLON] : [TokenType.SEMICOLON, TokenType.RIGHT_PAREN])
    const end = requireTerminator ? this.expect(TokenType.SEMICOLON, ';') : value.end
    return { kind: 'AssignmentStatement', target, value, start: target.start, end }
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
    if (type === TokenType.PRE_DECREMENT) return this.parseUpdate(true)
    if (type === TokenType.PLUS || type === TokenType.MINUS || type === TokenType.LOGICAL_NOT) {
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
      const end = this.expect(TokenType.RIGHT_PAREN, ')')
      return { ...expression, start, end }
    }
    if (token.type === TokenType.IDENTIFIER) {
      const identifier = this.parseIdentifier()
      if (!this.at(TokenType.LEFT_PAREN)) return identifier
      return this.parseCall(identifier.name, identifier.start)
    }
    if (token.type === TokenType.PLUS || token.type === TokenType.MINUS || token.type === TokenType.MULTIPLY || token.type === TokenType.DIVIDE) {
      const operator = this.advance()
      if (this.at(TokenType.LEFT_PAREN)) return this.parseCall(operator.lexeme, operator)
      this.report('(')
      return this.errorExpression(operator)
    }
    if (token.type === TokenType.INTEGER || token.type === TokenType.DECIMAL || token.type === TokenType.STRING || token.type === TokenType.IP_ADDRESS) {
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
    this.expect(TokenType.LEFT_PAREN, '(')
    const argumentsList: ExpressionNode[] = []
    if (!this.at(TokenType.RIGHT_PAREN)) {
      do {
        argumentsList.push(this.parseExpression([TokenType.COMMA, TokenType.RIGHT_PAREN]))
        if (!this.at(TokenType.COMMA)) break
        this.advance()
      } while (!this.at(TokenType.RIGHT_PAREN) && !this.at(TokenType.EOF))
    }
    const end = this.expect(TokenType.RIGHT_PAREN, ')')
    return { kind: 'CallExpression', callee, arguments: argumentsList, start, end }
  }

  private parseIdentifier(): IdentifierNode {
    const token = this.current()
    if (token.type === TokenType.IDENTIFIER) {
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
      if (this.at(TokenType.STATEMENT_START) || (stopAtBrace && this.at(TokenType.RIGHT_BRACE))) return
      const token = this.advance()
      if (token.type === TokenType.SEMICOLON) return
    }
  }
  private at(type: TokenType): boolean { return this.current().type === type }
  private current(): Token { return this.tokens[this.position] ?? this.tokens.at(-1)! }
  private peek(): Token { return this.tokens[this.position + 1] ?? this.current() }
  private advance(): Token { const token = this.current(); if (!this.at(TokenType.EOF)) this.position += 1; return token }
}

export const parseTokens = (tokens: Token[]): ParserResult => new Parser(tokens).parse()
