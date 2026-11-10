import type {
  AssignmentNode,
  BinaryExpressionNode,
  BlockNode,
  ExpressionNode,
  FunctionNode,
  ForEachStatementNode,
  IdentifierNode,
  IfStatementNode,
  InputStatementNode,
  LambdaExpressionNode,
  ProgramNode,
  OutputStatementNode,
  ParallelNode,
  StatementNode,
  UpdateExpressionNode,
  VarDeclarationNode,
  WhileStatementNode,
  NodeBase,
} from '../parser/Ast'
import { TokenType } from '../tokens/TokenType'
import type { SemanticDiagnostic, SemanticError, SemanticWarning } from './SemanticError'

export type SemanticMode = 'permissive' | 'strict'
export type SemanticValueType = 'number' | 'integer' | 'decimal' | 'string' | 'boolean' | 'null' | 'list' | 'tuple' | 'dict' | 'set' | 'file' | 'module' | 'ip' | 'range' | 'function' | 'object' | 'unknown'
type SymbolKind = 'variable' | 'constant' | 'function' | 'class' | 'parameter'

export interface SemanticSymbol {
  name: string
  kind: SymbolKind
  valueType: SemanticValueType
  /** Cantidades de parámetros disponibles para una tarea sobrecargada. */
  signatures?: number[]
}

interface FunctionSignature { arity: number; parameterTypes: SemanticValueType[]; returnType: SemanticValueType }
interface SymbolInfo {
  name: string
  kind: SymbolKind
  valueType: SemanticValueType
  defined: boolean
  readCount: number
  constantValue?: number
  uninitializedReadReported?: boolean
  signatures?: FunctionSignature[]
  callableSignature?: FunctionSignature
  className?: string
}
type Scope = Map<string, SymbolInfo>
interface ClassInfo {
  fields: Map<string, SemanticValueType>
  methods: Map<string, FunctionSignature>
  usedMethods: Set<string>
  superclassName?: string
}

export interface SemanticOptions {
  mode?: SemanticMode
  /** Emitir warnings en los resultados; está activado por defecto. */
  warningsEnabled?: boolean
}
export interface SemanticResult {
  mode: SemanticMode
  errors: SemanticError[]
  warnings: SemanticWarning[]
  diagnostics: SemanticDiagnostic[]
  symbols: SemanticSymbol[]
  /** En modo estricto cualquier diagnóstico bloquea el resultado. */
  blocked: boolean
}

const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

const arithmeticTokenTypes = new Set<TokenType>([
  TokenType.PLUS, TokenType.MINUS, TokenType.MULTIPLY, TokenType.DIVIDE,
  TokenType.FLOOR_DIVIDE, TokenType.MODULO, TokenType.POWER, TokenType.DOT_DIVIDE,
])
const relationalTokenTypes = new Set<TokenType>([
  TokenType.LESS, TokenType.GREATER, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL,
  TokenType.EQUAL, TokenType.DOUBLE_EQUAL, TokenType.NOT_EQUAL,
  TokenType.KEYWORD_EN, TokenType.KEYWORD_NO_EN,
])
const logicalTokenTypes = new Set<TokenType>([
  TokenType.LOGICAL_AND, TokenType.LOGICAL_OR, TokenType.LOGICAL_XOR, TokenType.LOGICAL_XORT,
  TokenType.LOGICAL_NAND, TokenType.LOGICAL_NOR, TokenType.LOGICAL_XNOR,
  TokenType.LOGICAL_AND_SYM, TokenType.LOGICAL_OR_SYM,
])
const builtinFunctionArities = new Map<string, number>([
  ['mas', 2], ['menos', 2], ['por', 2], ['entre', 2],
  ['entre_entero', 2], ['modulo', 2], ['+', 2], ['-', 2], ['*', 2], ['/', 2], ['**', 2], ['./', 2],
  ['sin', 1], ['cos', 1], ['tan', 1], ['log', 1], ['abs', 1], ['sqrt', 1], ['pow', 2],
  ['seno', 1], ['coseno', 1], ['tangente', 1], ['logaritmo', 1], ['valor_absoluto', 1], ['raiz_cuadrada', 1], ['potencia', 2],
  ['a_entero', 1], ['a_real', 1], ['a_texto', 1], ['a_booleano', 1], ['lista', -1], ['tupla', -1], ['diccionario', -1], ['conjunto', -1],
  ['longitud', 1], ['secuencia', -1], ['sumatoria', 1], ['maximo', 1], ['minimo', 1], ['ordenar', 1], ['al_reves', 1],
  ['redondear', -1], ['todos', 1], ['alguno', 1], ['enumerar', -1], ['emparejar', -1], ['transformar', 2], ['filtrar', 2],
  ['tipo_de', 1], ['formatear', -1], ['representar', 1], ['cociente_y_resto', 2],
  ['es_instancia_de', 2], ['es_subclase_de', 2], ['iterador_de', 1], ['siguiente', 1],
  ['abrir', -1],
])
const builtinInputFunctions = new Set(['chismea', 'atrapa', 'pregunta', 'damedatos'])
const numericFunctions = new Set(['sin', 'cos', 'tan', 'log', 'abs', 'sqrt', 'seno', 'coseno', 'tangente', 'logaritmo', 'valor_absoluto', 'raiz_cuadrada', 'potencia'])
const numericTypes = new Set<SemanticValueType>(['number', 'integer', 'decimal', 'unknown'])
const compatibleTypes = (expected: SemanticValueType, actual: SemanticValueType): boolean =>
  expected === actual || expected === 'unknown' || actual === 'unknown' ||
  (numericTypes.has(expected) && actual === 'number') || (expected === 'decimal' && actual === 'integer')
const numericResultType = (left: SemanticValueType, right: SemanticValueType, operator: TokenType): SemanticValueType => {
  if (!numericTypes.has(left) || !numericTypes.has(right)) return 'number'
  if (operator === TokenType.DIVIDE || operator === TokenType.DOT_DIVIDE || operator === TokenType.POWER || left === 'decimal' || right === 'decimal') return 'decimal'
  if (operator === TokenType.FLOOR_DIVIDE || operator === TokenType.MODULO) return 'integer'
  return left === 'integer' && right === 'integer' ? 'integer' : 'number'
}

/**
 * Verifica declaraciones, inicialización, usos, tipos, tareas, clases y lambdas.
 * No ejecuta el programa ni calcula resultados. El modo estricto conserva todos
 * los diagnósticos y marca `blocked` para que el llamador detenga fases siguientes.
 */
export function analyzeSemantics(program: ProgramNode, options: SemanticOptions = {}): SemanticResult {
  const mode = options.mode ?? 'permissive'
  const warningsEnabled = options.warningsEnabled ?? true
  const diagnostics: SemanticDiagnostic[] = []
  const scopes: Scope[] = [new Map()]
  const declaredVariables: Array<{ identifier: IdentifierNode; symbol: SymbolInfo }> = []
  const declaredFunctions: Array<{ identifier: IdentifierNode; symbol: SymbolInfo }> = []
  const returnTypeStack: SemanticValueType[][] = []
  let loopDepth = 0
  const classes = new Map<string, ClassInfo>()
  const currentClassStack: string[] = []
  const lambdaSignatures = new WeakMap<LambdaExpressionNode, FunctionSignature>()
  const callableResults = new WeakMap<ExpressionNode, FunctionSignature>()

  const currentScope = (): Scope => scopes.at(-1)!
  const resolve = (name: string): SymbolInfo | undefined => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      const found = scopes[index].get(name)
      if (found) return found
    }
    return undefined
  }
  const inferClassName = (expression?: ExpressionNode): string | undefined => {
    if (expression?.kind === 'NewExpression') return expression.className
    if (expression?.kind === 'Identifier') return resolve(expression.name)?.className
    return undefined
  }
  const findClassField = (className: string, fieldName: string, visited = new Set<string>()): SemanticValueType | undefined => {
    if (visited.has(className)) return undefined
    visited.add(className)
    const info = classes.get(className)
    return info?.fields.get(fieldName) ?? (info?.superclassName
      ? findClassField(info.superclassName, fieldName, visited)
      : undefined)
  }
  const findClassMethod = (
    className: string,
    methodName: string,
    visited = new Set<string>(),
  ): { owner: ClassInfo; signature: FunctionSignature } | undefined => {
    if (visited.has(className)) return undefined
    visited.add(className)
    const info = classes.get(className)
    const signature = info?.methods.get(methodName)
    if (info && signature) return { owner: info, signature }
    return info?.superclassName ? findClassMethod(info.superclassName, methodName, visited) : undefined
  }
  const report = (
    severity: SemanticDiagnostic['severity'],
    code: SemanticDiagnostic['code'],
    node: NodeBase,
    message: string,
    suggestion: string,
  ): void => {
    diagnostics.push({
      severity, code, message, suggestion,
      line: node.start.line,
      column: node.start.column,
      startIndex: node.start.startIndex,
      endIndex: node.end.endIndex,
    } as SemanticDiagnostic)
  }
  const reportError = (code: SemanticError['code'], node: NodeBase, message: string, suggestion: string): void =>
    report('error', code, node, message, suggestion)
  const reportWarning = (code: SemanticWarning['code'], node: NodeBase, message: string, suggestion: string): void =>
    report('warning', code, node, message, suggestion)

  const declare = (identifier: IdentifierNode, symbol: SymbolInfo): boolean => {
    if (currentScope().has(identifier.name)) {
      reportError(
        'DUPLICATE_DECLARATION', identifier,
        `El identificador '${identifier.name}' ya fue declarado en este ámbito.`,
        `Renombra '${identifier.name}' o usa la declaración existente.`,
      )
      return false
    }
    currentScope().set(identifier.name, symbol)
    if (symbol.kind === 'variable' || symbol.kind === 'constant') declaredVariables.push({ identifier, symbol })
    return true
  }

  const checkIdentifier = (identifier: IdentifierNode): SemanticValueType => {
    const symbol = resolve(identifier.name)
    if (!symbol) {
      reportError(
        'UNDECLARED_IDENTIFIER', identifier,
        `El identificador '${identifier.name}' se usa antes de declararse.`,
        `Declara '${identifier.name}' antes de usarlo, por ejemplo: guarda ${identifier.name} = 0;`,
      )
      return 'unknown'
    }
    symbol.readCount += 1
    if (symbol.kind === 'variable' && !symbol.defined && !symbol.uninitializedReadReported) {
      symbol.uninitializedReadReported = true
      reportWarning(
        'UNINITIALIZED_VARIABLE', identifier,
        `La variable '${identifier.name}' se usa antes de recibir un valor.`,
        `Asigna un valor antes de leerla, por ejemplo: ${identifier.name} = 0;`,
      )
    }
    return symbol.valueType
  }

  const checkIntegerOverflow = (node: ExpressionNode, value: number, lexeme = node.start.lexeme): void => {
    if (diagnostics.some(diagnostic => diagnostic.code === 'INTEGER_OVERFLOW' && diagnostic.startIndex === node.start.startIndex)) return
    if (!Number.isFinite(value) || (Number.isInteger(value) && (value < INT32_MIN || value > INT32_MAX))) {
      reportError(
        'INTEGER_OVERFLOW', node,
        `Overflow: el entero '${lexeme}' está fuera del rango int32 (${INT32_MIN} a ${INT32_MAX}).`,
        'Usa un valor dentro del rango int32 o divídelo en varios cálculos.',
      )
    }
  }

  const constantNumber = (expression: ExpressionNode): number | undefined => {
    if (expression.kind === 'Identifier') {
      const value = resolve(expression.name)?.constantValue
      return typeof value === 'number' ? value : undefined
    }
    if (expression.kind === 'Literal' && (expression.literalType === TokenType.INTEGER || expression.literalType === TokenType.DECIMAL)) return Number(expression.value)
    if (expression.kind === 'UnaryExpression' && expression.operator.type === TokenType.MINUS) {
      const operand = constantNumber(expression.operand)
      return operand === undefined ? undefined : -operand
    }
    if (expression.kind !== 'BinaryExpression') return undefined
    const left = constantNumber(expression.left)
    const right = constantNumber(expression.right)
    if (left === undefined || right === undefined) return undefined
    switch (expression.operator.type) {
      case TokenType.PLUS: return left + right
      case TokenType.MINUS: return left - right
      case TokenType.MULTIPLY: return left * right
      case TokenType.DIVIDE: return right === 0 ? undefined : left / right
      case TokenType.POWER: return left ** right
      default: return undefined
    }
  }

  const checkArithmeticTypes = (
    node: IdentifierNode | ExpressionNode,
    left: SemanticValueType,
    right: SemanticValueType,
    operator: string,
    allowStringConcat: boolean,
  ): SemanticValueType => {
    if (allowStringConcat && left === 'string' && right === 'string') return 'string'
    if (left === 'range' && (numericTypes.has(right) || right === 'range')) return 'range'
    if (right === 'range' && numericTypes.has(left)) return 'range'
    if (numericTypes.has(left) && numericTypes.has(right)) {
      const numericOperator = operator === '/' || operator === 'entre' ? TokenType.DIVIDE
        : operator === 'entre_entero' ? TokenType.FLOOR_DIVIDE
          : operator === 'modulo' || operator === '%' ? TokenType.MODULO
        : operator === '**' || operator === 'pow' ? TokenType.POWER
          : operator === '*' || operator === 'por' ? TokenType.MULTIPLY
            : operator === '-' || operator === 'menos' ? TokenType.MINUS : TokenType.PLUS
      return numericResultType(left, right, numericOperator)
    }
    const operation = allowStringConcat ? 'sumar/concatenar' : 'operar'
    reportError(
      'TYPE_MISMATCH', node,
      `Type mismatch: no se puede ${operation} un tipo '${left}' con un tipo '${right}' usando '${operator}'.`,
      allowStringConcat
        ? 'Usa dos números para sumar o dos textos para concatenar; no mezcles texto y número.'
        : 'Usa operandos del mismo tipo numérico para esta operación.',
    )
    return 'unknown'
  }

  const visitExpression = (expression: ExpressionNode): SemanticValueType => {
    switch (expression.kind) {
      case 'Identifier':
        return checkIdentifier(expression)
      case 'Literal':
        if (expression.literalType === TokenType.STRING) return 'string'
        if (expression.literalType === TokenType.KEYWORD_VERDADERO || expression.literalType === TokenType.KEYWORD_FALSO) return 'boolean'
        if (expression.literalType === TokenType.KEYWORD_NULO) return 'null'
        if (expression.literalType === TokenType.IP_ADDRESS) return 'ip'
        if (expression.literalType === TokenType.INTEGER) {
          checkIntegerOverflow(expression, Number(expression.value))
          return 'integer'
        }
        return expression.literalType === TokenType.DECIMAL || expression.literalType === TokenType.INF_LITERAL || expression.literalType === TokenType.NAN_LITERAL ? 'decimal' : 'number'
      case 'CollectionLiteral': {
        for (const item of expression.items) visitExpression(item)
        for (const entry of expression.entries ?? []) { visitExpression(entry.key); visitExpression(entry.value) }
        return expression.collectionType
      }
      case 'ListComprehension': {
        const iterableType = visitExpression(expression.iterable)
        if (!['list', 'tuple', 'dict', 'set', 'range', 'string', 'unknown'].includes(iterableType)) {
          reportError('TYPE_MISMATCH', expression.iterable, 'La comprensión requiere un valor iterable.', 'Usa una lista, tupla, conjunto, diccionario, texto o rango.')
        }
        scopes.push(new Map())
        declare(expression.identifier, { name: expression.identifier.name, kind: 'variable', valueType: 'unknown', defined: true, readCount: 0 })
        visitExpression(expression.element)
        if (expression.condition) visitExpression(expression.condition)
        scopes.pop()
        return 'list'
      }
      case 'RangeLiteral': {
        const lower = visitExpression(expression.lower)
        const upper = visitExpression(expression.upper)
        if (!numericTypes.has(lower) || !numericTypes.has(upper)) {
          reportError('TYPE_MISMATCH', expression, 'Los extremos de un rango deben ser números.', 'Usa un rango como [1,...,5].')
        }
        return 'range'
      }
      case 'LambdaExpression': {
        scopes.push(new Map())
        const parameterTypes: SemanticValueType[] = []
        for (const parameter of expression.parameters) {
          const type = expression.parameterTypes[parameter.name] ?? 'unknown'
          parameterTypes.push(type)
          declare(parameter, { name: parameter.name, kind: 'parameter', valueType: type, defined: true, readCount: 0 })
        }
        const returnType = visitExpression(expression.body)
        scopes.pop()
        lambdaSignatures.set(expression, { arity: expression.parameters.length, parameterTypes, returnType })
        return 'function'
      }
      case 'NewExpression': {
        const argumentTypes = expression.arguments.map(visitExpression)
        const classInfo = classes.get(expression.className)
        if (!classInfo) {
          reportError('UNKNOWN_CLASS', expression, 'La clase ' + expression.className + ' no está declarada.', 'Declara la clase antes de crear una instancia.')
          return 'unknown'
        }
        const constructor = findClassMethod(expression.className, 'inicia')
        if (constructor) {
          constructor.owner.usedMethods.add('inicia')
          if (constructor.signature.arity !== argumentTypes.length) reportError('ARGUMENT_COUNT_MISMATCH', expression, 'El inicializador de ' + expression.className + ' espera ' + constructor.signature.arity + ' argumento(s), pero recibió ' + argumentTypes.length + '.', 'Pasa la cantidad de argumentos que declara la tarea inicia.')
          constructor.signature.parameterTypes.forEach((expected, index) => {
            if (argumentTypes[index] !== undefined && !compatibleTypes(expected, argumentTypes[index])) reportError('TYPE_MISMATCH', expression.arguments[index], 'El argumento ' + (index + 1) + ' de inicia debe ser ' + expected + ', no ' + argumentTypes[index] + '.', 'Pasa un valor compatible con el inicializador.')
          })
        } else if (argumentTypes.length) {
          reportError('ARGUMENT_COUNT_MISMATCH', expression, 'La clase ' + expression.className + ' no declara un inicializador con parámetros.', 'Crea la instancia sin argumentos o declara tarea inicia dentro de la clase.')
        }
        return 'object'
      }
      case 'MemberExpression': {
        visitExpression(expression.object)
        const className = expression.object.kind === 'Identifier' ? resolve(expression.object.name)?.className : undefined
        const fieldType = className ? findClassField(className, expression.property.name) : undefined
        if (!fieldType) {
          reportError('UNDECLARED_IDENTIFIER', expression.property, 'El atributo ' + expression.property.name + ' no está declarado en el objeto.', 'Comprueba el nombre del campo y el tipo de la instancia.')
          return 'unknown'
        }
        return fieldType
      }
      case 'IndexExpression':
        visitExpression(expression.object)
        visitExpression(expression.index)
        return 'unknown'
      case 'ErrorExpression':
        return 'unknown'
      case 'UnaryExpression': {
        if (expression.operator.type === TokenType.MINUS && expression.operand.kind === 'Literal' && expression.operand.literalType === TokenType.INTEGER) {
          checkIntegerOverflow(expression, -Number(expression.operand.value), `-${expression.operand.start.lexeme}`)
          return 'number'
        }
        const operandType = visitExpression(expression.operand)
        if ([TokenType.LOGICAL_NOT, TokenType.LOGICAL_NOT_SYM, TokenType.LOGICAL_NOT_SYMBOL].includes(expression.operator.type)) {
          if (operandType !== 'boolean' && operandType !== 'unknown') {
            reportError('INVALID_LOGICAL_OPERAND', expression, `El operador '${expression.operator.lexeme}' requiere una condición booleana.`, 'Niega una comparación, por ejemplo: no (edad igual_a 18).')
          }
          return 'boolean'
        }
        return operandType
      }
      case 'UpdateExpression':
        return visitUpdate(expression)
      case 'CallExpression': {
        const argumentTypes = expression.arguments.map(visitExpression)
        const argumentCount = argumentTypes.length
        if (expression.receiver) {
          const receiverType = visitExpression(expression.receiver)
          const receiverName = expression.receiver.kind === 'Identifier' ? resolve(expression.receiver.name)?.className : undefined
          if (receiverType === 'module' && receiverName) {
            const moduleFunctions: Record<string, Set<string>> = {
              matematicas: new Set(['seno', 'coseno', 'tangente', 'logaritmo', 'raiz_cuadrada', 'valor_absoluto', 'potencia']),
              colecciones: new Set(['lista', 'tupla', 'diccionario', 'conjunto', 'longitud', 'sumatoria', 'maximo', 'minimo', 'ordenar', 'al_reves', 'redondear', 'todos', 'alguno']),
              iteracion: new Set(['secuencia', 'enumerar', 'emparejar', 'transformar', 'filtrar', 'iterador_de', 'siguiente']),
              archivos: new Set(['abrir']),
            }
            if (!moduleFunctions[receiverName]?.has(expression.callee)) {
              reportError('UNKNOWN_FUNCTION', expression, `El módulo '${receiverName}' no ofrece '${expression.callee}'.`, 'Comprueba la función integrada y el módulo importado.')
            }
            return expression.callee === 'longitud' ? 'integer' : 'unknown'
          }
          if (receiverType === 'file') {
            const expected = expression.callee === 'escribir' ? 1 : expression.callee === 'leer' ? 1 : 0
            if (!['leer', 'leer_linea', 'escribir', 'cerrar'].includes(expression.callee)) {
              reportError('UNKNOWN_FUNCTION', expression, 'No existe el método ' + expression.callee + ' para un archivo.', 'Usa leer, leer_linea, escribir o cerrar.')
              return 'unknown'
            }
            if ((expression.callee === 'leer' || expression.callee === 'escribir') ? argumentCount > expected : argumentCount !== 0) {
              reportError('ARGUMENT_COUNT_MISMATCH', expression, 'La llamada al método ' + expression.callee + ' tiene una cantidad incorrecta de argumentos.', 'Ajusta los argumentos del método de archivo.')
            }
            return expression.callee === 'leer' || expression.callee === 'leer_linea' ? 'string' : expression.callee === 'escribir' ? 'integer' : 'null'
          }
          const receiverClass = expression.receiver.kind === 'Identifier' ? resolve(expression.receiver.name)?.className : undefined
          const foundMethod = receiverClass ? findClassMethod(receiverClass, expression.callee) : undefined
          if (!foundMethod) {
            reportError('UNKNOWN_FUNCTION', expression, 'El método ' + expression.callee + ' no existe para este objeto.', 'Revisa el nombre del método y la clase del receptor.')
            return 'unknown'
          }
          foundMethod.owner.usedMethods.add(expression.callee)
          const method = foundMethod.signature
          if (argumentCount !== method.arity) {
            reportError('ARGUMENT_COUNT_MISMATCH', expression, 'El método ' + expression.callee + ' espera ' + method.arity + ' argumento(s), pero recibió ' + argumentCount + '.', 'Ajusta la cantidad de argumentos de la llamada.')
          }
          method.parameterTypes.forEach((expected, index) => {
            if (argumentTypes[index] !== undefined && !compatibleTypes(expected, argumentTypes[index])) {
              reportError('TYPE_MISMATCH', expression.arguments[index], 'El argumento ' + (index + 1) + ' de ' + expression.callee + ' debe ser ' + expected + ', no ' + argumentTypes[index] + '.', 'Pasa un valor compatible con el parámetro del método.')
            }
          })
          return method.returnType
        }
        const functionSymbol = resolve(expression.callee)
        const builtinName = expression.callee.toLowerCase()
        const builtinArity = builtinFunctionArities.get(builtinName)
        if (builtinArity !== undefined) {
          const optionalCount = new Set(['lista', 'tupla', 'diccionario', 'conjunto', 'redondear', 'enumerar', 'formatear'])
          const minimumArity = builtinArity < 0 ? (optionalCount.has(builtinName) ? 0 : 1) : (argumentCount < builtinArity && argumentCount > 0 ? argumentCount : builtinArity)
          const invalidArity = builtinArity < 0
            ? argumentCount < minimumArity || (['transformar', 'filtrar', 'cociente_y_resto'].includes(builtinName) && argumentCount !== 2)
              || (['redondear', 'enumerar', 'formatear'].includes(builtinName) && argumentCount > 2)
              || (builtinName === 'secuencia' && (argumentCount < 1 || argumentCount > 3))
              || (builtinName === 'emparejar' && argumentCount < 2)
              || (builtinName === 'abrir' && (argumentCount < 1 || argumentCount > 2))
            : argumentCount > builtinArity || argumentCount === 0
          if (invalidArity) {
            reportError(
              'ARGUMENT_COUNT_MISMATCH', expression,
              `La función '${expression.callee}' recibió una cantidad inválida de argumentos (${argumentCount}).`,
              `Revisa la cantidad de argumentos que requiere '${expression.callee}'.`,
            )
          }
          if (numericFunctions.has(builtinName)) {
            for (const type of argumentTypes) {
              if (!numericTypes.has(type)) {
                reportError('TYPE_MISMATCH', expression, `Type mismatch: '${expression.callee}' requiere argumentos numéricos, no '${type}'.`, 'Pasa un número a la función matemática.')
                break
              }
            }
          }
          if (builtinName === 'mas' || builtinName === '+') {
            if (argumentCount >= 2) return checkArithmeticTypes(expression, argumentTypes[0], argumentTypes[1], expression.callee, true)
            return 'unknown'
          }
          if (['menos', 'por', 'entre', 'entre_entero', 'modulo', '-', '*', '/', '**', './', 'pow'].includes(builtinName) && argumentCount >= 2) {
            return checkArithmeticTypes(expression, argumentTypes[0], argumentTypes[1], expression.callee, false)
          }
          if (['a_entero', 'a_real', 'redondear', 'sumatoria', 'maximo', 'minimo', 'cociente_y_resto'].includes(builtinName)) return builtinName === 'cociente_y_resto' ? 'tuple' : builtinName === 'a_entero' ? 'integer' : 'number'
          if (builtinName === 'a_texto' || builtinName === 'tipo_de' || builtinName === 'formatear' || builtinName === 'representar') return 'string'
          if (builtinName === 'a_booleano' || builtinName === 'todos' || builtinName === 'alguno' || builtinName === 'es_instancia_de' || builtinName === 'es_subclase_de') return 'boolean'
          if (builtinName === 'lista' || builtinName === 'secuencia' || builtinName === 'ordenar' || builtinName === 'al_reves' || builtinName === 'enumerar' || builtinName === 'emparejar' || builtinName === 'transformar' || builtinName === 'filtrar') return 'list'
          if (builtinName === 'tupla') return 'tuple'
          if (builtinName === 'conjunto') return 'set'
          if (builtinName === 'diccionario') return 'dict'
          if (builtinName === 'abrir') return 'file'
          if (builtinName === 'longitud') return 'integer'
          if (builtinName === 'iterador_de' || builtinName === 'siguiente') return 'unknown'
          return argumentCount < builtinArity ? 'unknown' : 'decimal'
        }
        if (builtinInputFunctions.has(builtinName)) return 'unknown'
        if (functionSymbol?.kind === 'variable' && functionSymbol.callableSignature) {
          const signature = functionSymbol.callableSignature
          functionSymbol.readCount += 1
          if (argumentCount > signature.arity) {
            reportError('ARGUMENT_COUNT_MISMATCH', expression, 'La lambda ' + expression.callee + ' acepta ' + signature.arity + ' argumento(s), pero recibió ' + argumentCount + '.', 'Reduce los argumentos o crea otra función lambda.')
            return 'unknown'
          }
          signature.parameterTypes.forEach((expected, index) => {
            if (argumentTypes[index] !== undefined && !compatibleTypes(expected, argumentTypes[index])) {
              reportError('TYPE_MISMATCH', expression.arguments[index], 'El argumento ' + (index + 1) + ' de ' + expression.callee + ' debe ser ' + expected + ', no ' + argumentTypes[index] + '.', 'Pasa un valor compatible con el parámetro de la lambda.')
            }
          })
          if (argumentCount < signature.arity) {
            callableResults.set(expression, {
              arity: signature.arity - argumentCount,
              parameterTypes: signature.parameterTypes.slice(argumentCount),
              returnType: signature.returnType,
            })
            return 'function'
          }
          return signature.returnType
        }
        if (!functionSymbol || functionSymbol.kind !== 'function') {
          reportError(
            'UNKNOWN_FUNCTION', expression,
            `La función '${expression.callee}' no está declarada.`,
            `Declara la tarea '${expression.callee}' antes de llamarla.`,
          )
          return 'unknown'
        }

        const signatures = functionSymbol.signatures ?? []
        functionSymbol.readCount += 1
        const exactSignature = signatures.find(signature => signature.arity === argumentCount)
        if (exactSignature) {
          exactSignature.parameterTypes.forEach((expected, index) => {
            const actual = argumentTypes[index]
            if (!compatibleTypes(expected, actual)) {
              reportError('TYPE_MISMATCH', expression.arguments[index] ?? expression, `El argumento ${index + 1} de '${expression.callee}' debe ser ${expected}, no ${actual}.`, `Pasa un valor de tipo ${expected} a '${expression.callee}'.`)
            }
          })
          return exactSignature.returnType
        }

        const partialSignatures = argumentCount > 0
          ? signatures.filter(signature => signature.arity > argumentCount)
          : []
        if (partialSignatures.length === 1) {
          const signature = partialSignatures[0]
          callableResults.set(expression, {
            arity: signature.arity - argumentCount,
            parameterTypes: signature.parameterTypes.slice(argumentCount),
            returnType: signature.returnType,
          })
          return 'function'
        }
        if (partialSignatures.length > 1) {
          reportError(
            'AMBIGUOUS_FUNCTION_OVERLOAD', expression,
            `La llamada parcial a '${expression.callee}' con ${argumentCount} argumento(s) coincide con varias sobrecargas.`,
            `Aporta argumentos hasta completar una aridad única: ${signatures.map(signature => signature.arity).join(', ')}.`,
          )
          return 'unknown'
        }
        reportError(
          'ARGUMENT_COUNT_MISMATCH', expression,
          `La tarea '${expression.callee}' no tiene una sobrecarga con ${argumentCount} argumento(s). Firmas disponibles: ${signatures.map(signature => signature.arity).join(', ')}.`,
          `Llama '${expression.callee}' con una de estas cantidades: ${signatures.map(signature => signature.arity).join(', ')}.`,
        )
        return 'unknown'
      }
      case 'BinaryExpression':
        {
          const result = visitBinary(expression)
          const constant = constantNumber(expression)
          if (constant !== undefined) checkIntegerOverflow(expression, constant, String(constant))
          return result
        }
    }
  }

  const visitBinary = (expression: BinaryExpressionNode): SemanticValueType => {
    const left = visitExpression(expression.left)
    const right = visitExpression(expression.right)
    if (expression.operator.type === TokenType.KEYWORD_EN || expression.operator.type === TokenType.KEYWORD_NO_EN) {
      if (!['list', 'tuple', 'dict', 'set', 'range', 'string', 'unknown'].includes(right)) {
        reportError('TYPE_MISMATCH', expression, `El valor de la derecha de '${expression.operator.lexeme}' debe ser iterable.`, 'Usa una lista, texto, conjunto, diccionario o rango.')
      }
      return 'boolean'
    }
    if (arithmeticTokenTypes.has(expression.operator.type)) {
      return checkArithmeticTypes(
        expression, left, right, expression.operator.lexeme,
        expression.operator.type === TokenType.PLUS,
      )
    }
    if (relationalTokenTypes.has(expression.operator.type)) {
      if (!compatibleTypes(left, right) && !compatibleTypes(right, left)) {
        reportError('TYPE_MISMATCH', expression, `No se pueden comparar los tipos '${left}' y '${right}'.`, 'Compara valores del mismo tipo.')
      }
      return 'boolean'
    }
    if (logicalTokenTypes.has(expression.operator.type)) {
      if ((left !== 'boolean' && left !== 'unknown') || (right !== 'boolean' && right !== 'unknown')) {
        reportError('INVALID_LOGICAL_OPERAND', expression, `El operador '${expression.operator.lexeme}' requiere condiciones booleanas.`, 'Combina comparaciones booleanas con y / o.')
      }
      return 'boolean'
    }
    return 'unknown'
  }

  const visitUpdate = (expression: UpdateExpressionNode): SemanticValueType => {
    const symbol = resolve(expression.argument.name)
    const valueType = checkIdentifier(expression.argument)
    if (symbol?.kind === 'constant') {
      reportError('IMMUTABLE_ASSIGNMENT', expression.argument, `No se puede modificar la constante '${expression.argument.name}'.`, `Declara '${expression.argument.name}' con 'guarda' si debe cambiar.`)
    } else if (symbol && !numericTypes.has(valueType)) {
      reportError('TYPE_MISMATCH', expression.argument, `Type mismatch: '${expression.argument.name}' no es numérica y no puede incrementarse/decrementarse.`, 'Actualiza con ++/-- solo una variable numérica.')
    } else if (symbol) {
      symbol.defined = true
    }
    return valueType
  }

  const visitDeclaration = (statement: VarDeclarationNode): void => {
    const valueType = statement.initializer ? visitExpression(statement.initializer) : 'unknown'
    const declaredType = statement.declaredType ?? 'unknown'
    if (statement.initializer && !compatibleTypes(declaredType, valueType)) {
      reportError('TYPE_MISMATCH', statement.identifier, `La variable '${statement.identifier.name}' es ${declaredType}, pero recibe ${valueType}.`, 'Haz coincidir la anotación de tipo con el valor asignado.')
    }
    const callableSignature = statement.initializer?.kind === 'LambdaExpression'
      ? lambdaSignatures.get(statement.initializer)
      : statement.initializer ? callableResults.get(statement.initializer) : undefined
    const className = inferClassName(statement.initializer)
    declare(statement.identifier, {
      name: statement.identifier.name,
      kind: statement.declarationKind === 'fijo' ? 'constant' : 'variable',
      valueType: declaredType === 'unknown' ? valueType : declaredType,
      defined: statement.initializer !== undefined,
      readCount: 0,
      constantValue: statement.initializer ? constantNumber(statement.initializer) : undefined,
      callableSignature,
      className,
    })
  }

  const visitAssignment = (statement: AssignmentNode): void => {
    if (statement.target.kind === 'IndexExpression') {
      visitExpression(statement.target.object)
      visitExpression(statement.target.index)
      visitExpression(statement.value)
      return
    }
    if (statement.target.kind === 'MemberExpression') {
      visitExpression(statement.target.object)
      const className = statement.target.object.kind === 'Identifier' ? resolve(statement.target.object.name)?.className : undefined
      const fieldType = className ? findClassField(className, statement.target.property.name) : undefined
      if (!fieldType) reportError('UNDECLARED_IDENTIFIER', statement.target.property, 'El atributo ' + statement.target.property.name + ' no está declarado en el objeto.', 'Comprueba el nombre del campo y la clase de la instancia.')
      const valueType = visitExpression(statement.value)
      if (fieldType && !compatibleTypes(fieldType, valueType)) reportError('TYPE_MISMATCH', statement.target, 'El atributo ' + statement.target.property.name + ' es ' + fieldType + ', pero recibe ' + valueType + '.', 'Asigna un valor del tipo declarado para el atributo.')
      return
    }
    if (statement.target.kind !== 'Identifier') return
    const symbol = resolve(statement.target.name)
    if (!symbol) {
      reportError('UNDECLARED_IDENTIFIER', statement.target, `El identificador '${statement.target.name}' se asigna antes de declararse.`, `Declara '${statement.target.name}' con guarda antes de asignarlo.`)
    } else if (symbol.kind === 'constant') {
      reportError('IMMUTABLE_ASSIGNMENT', statement.target, `No se puede reasignar la constante '${statement.target.name}'.`, `Declara '${statement.target.name}' con 'guarda' si el valor debe cambiar.`)
    }
    const valueType = visitExpression(statement.value)
    if (symbol && symbol.kind !== 'constant' && symbol.kind !== 'function') {
      if (statement.compoundOperator) {
        const operationType = statement.compoundOperator.type === TokenType.PLUS_ASSIGN
          ? checkArithmeticTypes(statement.value, symbol.valueType, valueType, 'mas', true)
          : checkArithmeticTypes(statement.value, symbol.valueType, valueType,
            statement.compoundOperator.type === TokenType.MINUS_ASSIGN ? 'menos' : statement.compoundOperator.type === TokenType.MULTIPLY_ASSIGN ? 'por' : 'entre', false)
        if (!compatibleTypes(symbol.valueType, operationType)) reportError('TYPE_MISMATCH', statement.target, 'El resultado de la asignación compuesta no coincide con el tipo de ' + statement.target.name + '.', 'Usa operandos compatibles con el tipo de la variable.')
      }
      const numericValue = constantNumber(statement.value)
      if (numericValue !== undefined) checkIntegerOverflow(statement.value, numericValue, String(numericValue))
      if (!compatibleTypes(symbol.valueType, valueType)) {
        reportError('TYPE_MISMATCH', statement.target, `La variable '${statement.target.name}' es ${symbol.valueType}, pero se intenta asignar ${valueType}.`, 'Asigna un valor del mismo tipo o declara la variable con el tipo correcto.')
      }
      symbol.defined = true
      symbol.constantValue = numericValue
      if (symbol.valueType === 'unknown' && valueType !== 'unknown') symbol.valueType = valueType
      symbol.className = inferClassName(statement.value)
    }
  }

  const visitParallel = (statement: ParallelNode): void => {
    const values = statement.assignments.map(assignment => visitExpression(assignment.value))
    const numericValues = statement.assignments.map(assignment => constantNumber(assignment.value))
    const classNames = statement.assignments.map(assignment => inferClassName(assignment.value))
    const targets = new Set<string>()
    statement.assignments.forEach((assignment, index) => {
      if (assignment.target.kind !== 'Identifier') {
        reportError('PARALLEL_TARGET_DUPLICATE', assignment.target, 'El destino de una asignación paralela debe ser una variable.', 'Usa un identificador como destino de par.')
        return
      }
      const name = assignment.target.name
      if (targets.has(name)) reportError('PARALLEL_TARGET_DUPLICATE', assignment.target, `La variable '${name}' aparece más de una vez como destino paralelo.`, 'Asigna cada variable destino una sola vez dentro de par.')
      targets.add(name)
      const symbol = resolve(name)
      if (!symbol) {
        reportError('UNDECLARED_IDENTIFIER', assignment.target, `El identificador '${name}' se asigna antes de declararse.`, `Declara '${name}' antes del bloque par.`)
        return
      }
      if (symbol.kind === 'constant') {
        reportError('IMMUTABLE_ASSIGNMENT', assignment.target, `No se puede reasignar la constante '${name}'.`, 'Usa una variable guarda para un destino paralelo.')
        return
      }
      const valueType = values[index]
      if (!compatibleTypes(symbol.valueType, valueType)) {
        reportError('TYPE_MISMATCH', assignment.target, `La variable '${name}' es ${symbol.valueType}, pero se intenta asignar ${valueType}.`, 'Asigna valores compatibles en todas las ramas paralelas.')
      }
      symbol.defined = true
      symbol.constantValue = numericValues[index]
      if (symbol.valueType === 'unknown' && valueType !== 'unknown') symbol.valueType = valueType
      symbol.className = classNames[index]
    })
  }

  const definitelyReturns = (statement: StatementNode): boolean => {
    if (statement.kind === 'ReturnStatement') return true
    if (statement.kind === 'IfStatement') {
      return Boolean(statement.alternate && statement.consequent.statements.at(-1) && statement.alternate.statements.at(-1)
        && definitelyReturns(statement.consequent.statements.at(-1)!) && definitelyReturns(statement.alternate.statements.at(-1)!))
    }
    return false
  }

  const visitBlock = (block: BlockNode, createsScope = true): void => {
    if (createsScope) scopes.push(new Map())
    let unreachable = false
    for (const statement of block.statements) {
      if (unreachable) {
        reportWarning('UNREACHABLE_CODE', statement, 'Esta instrucción no puede ejecutarse porque una ruta anterior siempre devuelve un resultado.', 'Mueve la instrucción antes de resultado o elimina el código inalcanzable.')
      }
      visitStatement(statement)
      if (definitelyReturns(statement)) unreachable = true
    }
    if (createsScope) scopes.pop()
  }

  const visitIf = (statement: IfStatementNode): void => {
    visitExpression(statement.condition)
    visitBlock(statement.consequent)
    if (statement.alternate) visitBlock(statement.alternate)
  }

  const visitFor = (statement: Extract<StatementNode, { kind: 'ForStatement' }>): void => {
    scopes.push(new Map())
    if (statement.initialization.kind === 'VarDeclaration') visitDeclaration(statement.initialization)
    else visitAssignment(statement.initialization)
    visitExpression(statement.condition)
    if (statement.update.kind === 'UpdateExpression') visitUpdate(statement.update)
    else visitAssignment(statement.update)
    loopDepth += 1
    visitBlock(statement.body)
    loopDepth -= 1
    scopes.pop()
  }

  const visitWhile = (statement: WhileStatementNode): void => {
    visitExpression(statement.condition)
    loopDepth += 1
    visitBlock(statement.body)
    loopDepth -= 1
  }

  const visitForEach = (statement: ForEachStatementNode): void => {
    const iterableType = visitExpression(statement.iterable)
    if (!['list', 'tuple', 'dict', 'set', 'range', 'string', 'unknown'].includes(iterableType)) {
      reportError('TYPE_MISMATCH', statement.iterable, 'para_cada requiere una colección o un valor iterable.', 'Recorre una lista, tupla, conjunto, diccionario, texto o rango.')
    }
    scopes.push(new Map())
    declare(statement.identifier, { name: statement.identifier.name, kind: 'variable', valueType: 'unknown', defined: true, readCount: 0 })
    loopDepth += 1
    visitBlock(statement.body)
    loopDepth -= 1
    scopes.pop()
  }

  const visitFunction = (statement: FunctionNode): void => {
    scopes.push(new Map())
    const className = currentClassStack.at(-1)
    const functionSymbol = className ? undefined : resolve(statement.name.name)
    const signature = className
      ? classes.get(className)?.methods.get(statement.name.name)
      : functionSymbol?.signatures?.find(candidate => candidate.arity === statement.parameters.length)
    const returnedTypes: SemanticValueType[] = []
    returnTypeStack.push(returnedTypes)
    if (className) {
      const selfIdentifier: IdentifierNode = { kind: 'Identifier', name: 'este', start: statement.name.start, end: statement.name.end }
      declare(selfIdentifier, {
        name: 'este', kind: 'parameter', valueType: 'object', defined: true, readCount: 0, className,
      })
    }
    for (const parameter of statement.parameters) {
      const valueType = statement.parameterTypes[parameter.name] ?? 'unknown'
      if (signature) signature.parameterTypes[statement.parameters.indexOf(parameter)] = valueType
      declare(parameter, { name: parameter.name, kind: 'parameter', valueType, defined: true, readCount: 0 })
    }
    visitBlock(statement.body, false)
    returnTypeStack.pop()
    scopes.pop()
    const inferredReturn = returnedTypes.find(type => type !== 'unknown') ?? 'unknown'
    if (statement.returnType && inferredReturn !== 'unknown' && inferredReturn !== statement.returnType) {
      reportError('TYPE_MISMATCH', statement.name, `La tarea '${statement.name.name}' declara retorno ${statement.returnType}, pero devuelve ${inferredReturn}.`, 'Corrige el tipo de retorno o el valor de resultado.')
    }
    if (returnedTypes.some(type => type !== 'unknown' && type !== inferredReturn)) {
      reportError('TYPE_MISMATCH', statement.name, `La tarea '${statement.name.name}' devuelve tipos incompatibles en distintas ramas.`, 'Haz que todos los resultado de la tarea tengan el mismo tipo.')
    }
    if (signature) signature.returnType = statement.returnType ?? inferredReturn
  }

  const visitClass = (statement: Extract<StatementNode, { kind: 'ClassDeclaration' }>): void => {
    const info = classes.get(statement.name.name)
    if (!info) return
    currentClassStack.push(statement.name.name)
    for (const field of statement.fields) {
      const initialType = field.initializer ? visitExpression(field.initializer) : 'unknown'
      const fieldType = field.declaredType ?? initialType
      if (field.initializer && field.declaredType && !compatibleTypes(field.declaredType, initialType)) {
        reportError('TYPE_MISMATCH', field.identifier, 'El campo ' + field.identifier.name + ' recibe un valor que no coincide con su tipo.', 'Ajusta el tipo declarado o el valor inicial.')
      }
      info.fields.set(field.identifier.name, fieldType)
    }
    for (const method of statement.methods) visitFunction(method)
    currentClassStack.pop()
  }

  const visitOutput = (statement: OutputStatementNode): void => {
    for (const argument of statement.arguments) visitExpression(argument)
  }
  const visitInput = (statement: InputStatementNode): void => { visitExpression(statement.call) }

  const visitStatement = (statement: StatementNode): void => {
    switch (statement.kind) {
      case 'VarDeclaration': visitDeclaration(statement); break
      case 'AssignmentStatement': visitAssignment(statement); break
      case 'IfStatement': visitIf(statement); break
      case 'ForStatement': visitFor(statement); break
      case 'WhileStatement': visitWhile(statement); break
      case 'ForEachStatement': visitForEach(statement); break
      case 'BreakStatement':
      case 'ContinueStatement':
        if (!loopDepth) reportError('INVALID_CONTROL_FLOW', statement, `'${statement.kind === 'BreakStatement' ? 'salir' : 'continuar'}' solo se puede usar dentro de un bucle.`, 'Mueve esta instrucción dentro de bucle_por, bucle_mientras o para_cada.')
        break
      case 'PassStatement': break
      case 'AssertStatement': {
        visitExpression(statement.condition)
        if (statement.message) visitExpression(statement.message)
        break
      }
      case 'TryStatement':
        visitBlock(statement.body)
        for (const clause of statement.catches) {
          scopes.push(new Map())
          if (clause.identifier) declare(clause.identifier, { name: clause.identifier.name, kind: 'variable', valueType: 'string', defined: true, readCount: 0 })
          visitBlock(clause.body, false)
          scopes.pop()
        }
        if (statement.finalizer) visitBlock(statement.finalizer)
        break
      case 'ThrowStatement': visitExpression(statement.value); break
      case 'MatchStatement':
        visitExpression(statement.value)
        for (const clause of statement.cases) {
          if (clause.pattern) visitExpression(clause.pattern)
          visitBlock(clause.body)
        }
        break
      case 'ImportStatement': {
        if (!['matematicas', 'colecciones', 'iteracion', 'archivos'].includes(statement.moduleName)) {
          reportError('UNKNOWN_FUNCTION', statement, `El módulo '${statement.moduleName}' no está disponible.`, 'Importa matematicas, colecciones, iteracion o archivos.')
          break
        }
        declare({ kind: 'Identifier', name: statement.alias, start: statement.start, end: statement.end }, {
          name: statement.alias, kind: 'variable', valueType: 'module', defined: true, readCount: 0, className: statement.moduleName,
        })
        break
      }
      case 'WithStatement': {
        const resourceType = visitExpression(statement.resource)
        if (resourceType !== 'file' && resourceType !== 'unknown') reportError('TYPE_MISMATCH', statement.resource, 'con requiere un recurso que implemente el contexto de archivo.', 'Usa con abrir(ruta, modo) como archivo.')
        scopes.push(new Map())
        declare(statement.identifier, { name: statement.identifier.name, kind: 'variable', valueType: resourceType, defined: true, readCount: 0 })
        visitBlock(statement.body, false)
        scopes.pop()
        break
      }
      case 'FunctionDeclaration': visitFunction(statement); break
      case 'ClassDeclaration': visitClass(statement); break
      case 'ReturnStatement': {
        const returnType = visitExpression(statement.value)
        returnTypeStack.at(-1)?.push(returnType)
        break
      }
      case 'OutputStatement': visitOutput(statement); break
      case 'InputStatement': visitInput(statement); break
      case 'ExpressionStatement': visitExpression(statement.expression); break
      case 'ParallelStatement': visitParallel(statement); break
    }
  }

  const registerFunction = (statement: FunctionNode): void => {
    const name = statement.name.name
    const arity = statement.parameters.length
    const existing = currentScope().get(name)
    if (!existing) {
      currentScope().set(name, {
        name, kind: 'function', valueType: 'unknown', defined: true, readCount: 0,
        signatures: [{ arity, parameterTypes: statement.parameters.map(parameter => statement.parameterTypes[parameter.name] ?? 'unknown'), returnType: statement.returnType ?? 'unknown' }],
      })
      declaredFunctions.push({ identifier: statement.name, symbol: currentScope().get(name)! })
      return
    }
    if (existing.kind !== 'function') {
      reportError('DUPLICATE_DECLARATION', statement.name, `El nombre '${name}' ya fue declarado como ${existing.kind}.`, 'Usa otro nombre para la tarea.')
      return
    }
    if (existing.signatures?.some(signature => signature.arity === arity)) {
      reportError('DUPLICATE_DECLARATION', statement.name, `La tarea '${name}' ya tiene una firma con ${arity} parámetro(s).`, 'Para sobrecargar, declara la tarea con una cantidad diferente de parámetros.')
      return
    }
    existing.signatures ??= []
    existing.signatures.push({ arity, parameterTypes: statement.parameters.map(parameter => statement.parameterTypes[parameter.name] ?? 'unknown'), returnType: statement.returnType ?? 'unknown' })
  }

  const registerClass = (statement: Extract<StatementNode, { kind: 'ClassDeclaration' }>): void => {
    const name = statement.name.name
    if (currentScope().has(name)) {
      reportError('DUPLICATE_DECLARATION', statement.name, 'El nombre ' + name + ' ya está declarado.', 'Usa un nombre de clase distinto.')
      return
    }
    const info: ClassInfo = { fields: new Map(), methods: new Map(), usedMethods: new Set() }
    statement.fields.forEach(field => {
      if (info.fields.has(field.identifier.name)) {
        reportError('DUPLICATE_DECLARATION', field.identifier, 'La clase ' + name + ' repite el atributo ' + field.identifier.name + '.', 'Renombra el atributo duplicado.')
        return
      }
      info.fields.set(field.identifier.name, field.declaredType ?? 'unknown')
    })
    statement.methods.forEach(method => {
      const methodName = method.name.name
      if (info.methods.has(methodName)) {
        reportError('DUPLICATE_DECLARATION', method.name, 'La clase ' + name + ' repite el método ' + methodName + '.', 'Renombra el método duplicado.')
        return
      }
      info.methods.set(methodName, {
        arity: method.parameters.length,
        parameterTypes: method.parameters.map(parameter => method.parameterTypes[parameter.name] ?? 'unknown'),
        returnType: method.returnType ?? 'unknown',
      })
    })
    classes.set(name, info)
    currentScope().set(name, { name, kind: 'class', valueType: 'object', defined: true, readCount: 0 })
  }

  // Registrar primero todas las firmas de nivel principal para admitir llamadas hacia adelante.
  const classDeclarations = new Map<string, Extract<StatementNode, { kind: 'ClassDeclaration' }>>()
  for (const statement of program.statements) if (statement.kind === 'ClassDeclaration') {
    registerClass(statement)
    classDeclarations.set(statement.name.name, statement)
  }
  for (const statement of program.statements) {
    if (statement.kind !== 'ClassDeclaration' || !statement.superclass) continue
    const info = classes.get(statement.name.name)
    if (!info) continue
    if (!classes.has(statement.superclass.name)) {
      reportError('UNKNOWN_CLASS', statement.superclass, 'La clase base ' + statement.superclass.name + ' no está declarada.', 'Declara la clase base antes de heredar de ella.')
      continue
    }
    info.superclassName = statement.superclass.name
  }
  for (const [className, info] of classes) {
    const path = new Set<string>([className])
    let parentName = info.superclassName
    while (parentName) {
      if (path.has(parentName)) {
        const declaration = classDeclarations.get(className)
        reportError('INVALID_INHERITANCE', declaration?.superclass ?? declaration?.name ?? program, 'La herencia de ' + className + ' forma un ciclo.', 'Cambia la clase base para que la jerarquía termine en una clase sin padre.')
        info.superclassName = undefined
        break
      }
      path.add(parentName)
      parentName = classes.get(parentName)?.superclassName
    }
  }
  for (const statement of program.statements) {
    if (statement.kind !== 'ClassDeclaration' || !statement.superclass) continue
    for (const field of statement.fields) {
      if (findClassField(statement.superclass.name, field.identifier.name) !== undefined) {
        reportError('DUPLICATE_DECLARATION', field.identifier, 'El atributo ' + field.identifier.name + ' ya existe en la clase base.', 'Usa el atributo heredado o elige otro nombre.')
      }
    }
  }
  for (const statement of program.statements) {
    if (statement.kind === 'FunctionDeclaration') registerFunction(statement)
  }
  for (const statement of program.statements) if (statement.kind === 'FunctionDeclaration' || statement.kind === 'ClassDeclaration') visitStatement(statement)
  for (const statement of program.statements) {
    if (statement.kind !== 'ClassDeclaration' || !statement.superclass) continue
    const info = classes.get(statement.name.name)
    const parent = classes.get(statement.superclass.name)
    if (!info || !parent) continue
    for (const method of statement.methods) {
      if (method.name.name === 'inicia') continue
      const childSignature = info.methods.get(method.name.name)
      const parentMethod = findClassMethod(statement.superclass.name, method.name.name)
      if (!childSignature || !parentMethod) continue
      const parentSignature = parentMethod.signature
      const parametersMatch = childSignature.arity === parentSignature.arity &&
        childSignature.parameterTypes.every((type, index) => type === 'unknown' || parentSignature.parameterTypes[index] === 'unknown' || type === parentSignature.parameterTypes[index])
      const returnsMatch = childSignature.returnType === 'unknown' || parentSignature.returnType === 'unknown' ||
        compatibleTypes(parentSignature.returnType, childSignature.returnType)
      if (!parametersMatch || !returnsMatch) {
        reportError('INVALID_INHERITANCE', method.name, 'El método ' + method.name.name + ' debe conservar la firma compatible con la clase base.', 'Usa la misma cantidad y tipos de parámetros y un tipo de retorno compatible.')
      }
    }
  }
  for (const statement of program.statements) if (statement.kind !== 'FunctionDeclaration') visitStatement(statement)

  // Las advertencias de estado final se calculan una vez recorridos todos los ámbitos.
  for (const { identifier, symbol } of declaredVariables) {
    if (symbol.kind !== 'variable') continue
    if (!symbol.defined && !symbol.uninitializedReadReported) {
      reportWarning('UNINITIALIZED_VARIABLE', identifier, `La variable '${identifier.name}' fue declarada, pero no recibió un valor.`, `Inicialízala, por ejemplo: guarda ${identifier.name} = 0;`)
    }
    if (symbol.readCount === 0) {
      reportWarning('UNUSED_VARIABLE', identifier, `La variable '${identifier.name}' fue declarada, pero nunca se utiliza.`, `Usa '${identifier.name}' o elimina su declaración.`)
    }
  }
  for (const { identifier, symbol } of declaredFunctions) {
    if (symbol.readCount === 0) {
      reportWarning('UNUSED_FUNCTION', identifier, 'La tarea ' + identifier.name + ' fue declarada, pero nunca se llama.', 'Llama a la tarea o elimina su declaración.')
    }
  }
  for (const statement of program.statements) {
    if (statement.kind !== 'ClassDeclaration') continue
    const info = classes.get(statement.name.name)
    if (!info) continue
    for (const method of statement.methods) {
      if (method.name.name === 'inicia' || info.usedMethods.has(method.name.name)) continue
      reportWarning('UNUSED_FUNCTION', method.name, 'El método ' + method.name.name + ' de la clase ' + statement.name.name + ' nunca se llama.', 'Llama al método o elimina su declaración.')
    }
  }

  const errors = diagnostics.filter((diagnostic): diagnostic is SemanticError => diagnostic.severity === 'error')
  const warnings = warningsEnabled
    ? diagnostics.filter((diagnostic): diagnostic is SemanticWarning => diagnostic.severity === 'warning')
    : []
  const visibleDiagnostics = diagnostics.filter(diagnostic => diagnostic.severity === 'error' || warningsEnabled)
  const symbols = [...scopes[0].values()].map(({ name, kind, valueType, signatures }) => ({
    name, kind, valueType,
    ...(signatures ? { signatures: signatures.map(signature => signature.arity).sort((left, right) => left - right) } : {}),
  }))

  return { mode, errors, warnings, diagnostics: visibleDiagnostics, symbols, blocked: mode === 'strict' && visibleDiagnostics.length > 0 }
}
