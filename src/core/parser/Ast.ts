import type { Token } from '../tokens/Token'
import type { TokenType } from '../tokens/TokenType'

export interface NodeBase { kind: string; start: Token; end: Token }
export type DeclaredValueType = 'integer' | 'decimal' | 'string' | 'boolean' | 'range' | 'list' | 'tuple' | 'dict' | 'set'

export interface ProgramNode extends NodeBase { kind: 'Program'; statements: StatementNode[] }
export interface BlockNode extends NodeBase { kind: 'Block'; statements: StatementNode[] }
export interface IdentifierNode extends NodeBase { kind: 'Identifier'; name: string }
export interface LiteralNode extends NodeBase { kind: 'Literal'; value: unknown; literalType: TokenType }
export interface RangeLiteralNode extends NodeBase { kind: 'RangeLiteral'; lower: ExpressionNode; upper: ExpressionNode }
export interface CollectionLiteralNode extends NodeBase { kind: 'CollectionLiteral'; collectionType: 'list' | 'tuple' | 'dict' | 'set'; items: ExpressionNode[]; entries?: Array<{ key: ExpressionNode; value: ExpressionNode }> }
export interface ListComprehensionNode extends NodeBase { kind: 'ListComprehension'; element: ExpressionNode; identifier: IdentifierNode; iterable: ExpressionNode; condition?: ExpressionNode }
export interface ErrorExpressionNode extends NodeBase { kind: 'ErrorExpression' }
export interface UnaryExpressionNode extends NodeBase { kind: 'UnaryExpression'; operator: Token; operand: ExpressionNode }
export interface BinaryExpressionNode extends NodeBase { kind: 'BinaryExpression'; left: ExpressionNode; operator: Token; right: ExpressionNode }
export interface CallExpressionNode extends NodeBase {
  kind: 'CallExpression'
  callee: string
  arguments: ExpressionNode[]
  argumentGroups: ExpressionNode[][]
  curried: boolean
  receiver?: ExpressionNode
}
export interface LambdaExpressionNode extends NodeBase { kind: 'LambdaExpression'; parameters: IdentifierNode[]; parameterTypes: Record<string, DeclaredValueType>; body: ExpressionNode }
export interface NewExpressionNode extends NodeBase { kind: 'NewExpression'; className: string; arguments: ExpressionNode[] }
export interface MemberExpressionNode extends NodeBase { kind: 'MemberExpression'; object: ExpressionNode; property: IdentifierNode }
export interface IndexExpressionNode extends NodeBase { kind: 'IndexExpression'; object: ExpressionNode; index: ExpressionNode }
export interface UpdateExpressionNode extends NodeBase { kind: 'UpdateExpression'; operator: Token; argument: IdentifierNode; prefix: boolean }
export interface AssignmentNode extends NodeBase { kind: 'AssignmentStatement'; target: IdentifierNode | MemberExpressionNode | IndexExpressionNode; value: ExpressionNode; compoundOperator?: Token }
export interface VarDeclarationNode extends NodeBase { kind: 'VarDeclaration'; declarationKind: 'guarda' | 'fijo'; identifier: IdentifierNode; initializer?: ExpressionNode; declaredType?: DeclaredValueType }
export interface IfStatementNode extends NodeBase { kind: 'IfStatement'; condition: ExpressionNode; consequent: BlockNode; alternate?: BlockNode }
export interface ForStatementNode extends NodeBase { kind: 'ForStatement'; initialization: VarDeclarationNode | AssignmentNode; condition: ExpressionNode; update: AssignmentNode | UpdateExpressionNode; body: BlockNode }
export interface WhileStatementNode extends NodeBase { kind: 'WhileStatement'; condition: ExpressionNode; body: BlockNode }
export interface ForEachStatementNode extends NodeBase { kind: 'ForEachStatement'; identifier: IdentifierNode; iterable: ExpressionNode; body: BlockNode }
export interface BreakStatementNode extends NodeBase { kind: 'BreakStatement' }
export interface ContinueStatementNode extends NodeBase { kind: 'ContinueStatement' }
export interface PassStatementNode extends NodeBase { kind: 'PassStatement' }
export interface AssertStatementNode extends NodeBase { kind: 'AssertStatement'; condition: ExpressionNode; message?: ExpressionNode }
export interface CatchClauseNode extends NodeBase { kind: 'CatchClause'; identifier?: IdentifierNode; body: BlockNode }
export interface TryStatementNode extends NodeBase { kind: 'TryStatement'; body: BlockNode; catches: CatchClauseNode[]; finalizer?: BlockNode }
export interface ThrowStatementNode extends NodeBase { kind: 'ThrowStatement'; value: ExpressionNode }
export interface MatchCaseNode extends NodeBase { kind: 'MatchCase'; pattern?: ExpressionNode; body: BlockNode }
export interface MatchStatementNode extends NodeBase { kind: 'MatchStatement'; value: ExpressionNode; cases: MatchCaseNode[] }
export interface WithStatementNode extends NodeBase { kind: 'WithStatement'; resource: ExpressionNode; identifier: IdentifierNode; body: BlockNode }
export interface ImportStatementNode extends NodeBase { kind: 'ImportStatement'; moduleName: string; alias: string }
export interface ReturnStatementNode extends NodeBase { kind: 'ReturnStatement'; value: ExpressionNode }
export interface FunctionNode extends NodeBase { kind: 'FunctionDeclaration'; name: IdentifierNode; parameters: IdentifierNode[]; parameterTypes: Record<string, DeclaredValueType>; returnType?: DeclaredValueType; body: BlockNode; returnStatement?: ReturnStatementNode }
export interface ClassDeclarationNode extends NodeBase { kind: 'ClassDeclaration'; name: IdentifierNode; superclass?: IdentifierNode; fields: VarDeclarationNode[]; methods: FunctionNode[] }
export interface OutputStatementNode extends NodeBase { kind: 'OutputStatement'; instruction: string; arguments: ExpressionNode[] }
export interface InputStatementNode extends NodeBase { kind: 'InputStatement'; call: CallExpressionNode }
export interface ExpressionStatementNode extends NodeBase { kind: 'ExpressionStatement'; expression: CallExpressionNode }
export interface ParallelNode extends NodeBase { kind: 'ParallelStatement'; assignments: AssignmentNode[] }

export type ExpressionNode = IdentifierNode | LiteralNode | RangeLiteralNode | CollectionLiteralNode | ListComprehensionNode | ErrorExpressionNode | UnaryExpressionNode | BinaryExpressionNode | CallExpressionNode | UpdateExpressionNode | LambdaExpressionNode | NewExpressionNode | MemberExpressionNode | IndexExpressionNode
export type StatementNode = VarDeclarationNode | AssignmentNode | IfStatementNode | ForStatementNode | WhileStatementNode | ForEachStatementNode | BreakStatementNode | ContinueStatementNode | PassStatementNode | AssertStatementNode | TryStatementNode | ThrowStatementNode | MatchStatementNode | WithStatementNode | ImportStatementNode | FunctionNode | ClassDeclarationNode | ReturnStatementNode | OutputStatementNode | InputStatementNode | ExpressionStatementNode | ParallelNode
