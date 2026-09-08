import type { Token } from '../tokens/Token'
import type { TokenType } from '../tokens/TokenType'

export interface NodeBase { kind: string; start: Token; end: Token }

export interface ProgramNode extends NodeBase { kind: 'Program'; statements: StatementNode[] }
export interface BlockNode extends NodeBase { kind: 'Block'; statements: StatementNode[] }
export interface IdentifierNode extends NodeBase { kind: 'Identifier'; name: string }
export interface LiteralNode extends NodeBase { kind: 'Literal'; value: unknown; literalType: TokenType }
export interface ErrorExpressionNode extends NodeBase { kind: 'ErrorExpression' }
export interface UnaryExpressionNode extends NodeBase { kind: 'UnaryExpression'; operator: Token; operand: ExpressionNode }
export interface BinaryExpressionNode extends NodeBase { kind: 'BinaryExpression'; left: ExpressionNode; operator: Token; right: ExpressionNode }
export interface CallExpressionNode extends NodeBase { kind: 'CallExpression'; callee: string; arguments: ExpressionNode[] }
export interface UpdateExpressionNode extends NodeBase { kind: 'UpdateExpression'; operator: Token; argument: IdentifierNode; prefix: boolean }
export interface AssignmentNode extends NodeBase { kind: 'AssignmentStatement'; target: IdentifierNode; value: ExpressionNode }
export interface VarDeclarationNode extends NodeBase { kind: 'VarDeclaration'; declarationKind: 'guarda' | 'fijo'; identifier: IdentifierNode; initializer: ExpressionNode }
export interface IfStatementNode extends NodeBase { kind: 'IfStatement'; condition: ExpressionNode; consequent: BlockNode; alternate?: BlockNode }
export interface ForStatementNode extends NodeBase { kind: 'ForStatement'; initialization: VarDeclarationNode | AssignmentNode; condition: ExpressionNode; update: AssignmentNode | UpdateExpressionNode; body: BlockNode }
export interface ReturnStatementNode extends NodeBase { kind: 'ReturnStatement'; value: ExpressionNode }
export interface FunctionNode extends NodeBase { kind: 'FunctionDeclaration'; name: IdentifierNode; parameters: IdentifierNode[]; body: BlockNode; returnStatement?: ReturnStatementNode }

export type ExpressionNode = IdentifierNode | LiteralNode | ErrorExpressionNode | UnaryExpressionNode | BinaryExpressionNode | CallExpressionNode | UpdateExpressionNode
export type StatementNode = VarDeclarationNode | AssignmentNode | IfStatementNode | ForStatementNode | FunctionNode | ReturnStatementNode
