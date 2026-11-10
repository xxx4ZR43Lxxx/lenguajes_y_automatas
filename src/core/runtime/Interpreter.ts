import type {
  AssignmentNode, BlockNode, ClassDeclarationNode, ExpressionNode, FunctionNode, LambdaExpressionNode, ProgramNode, StatementNode,
} from '../parser/Ast'
import { TokenType } from '../tokens/TokenType'

type SemanticValueType = 'number' | 'integer' | 'decimal' | 'string' | 'boolean' | 'null' | 'list' | 'tuple' | 'dict' | 'set' | 'file' | 'module' | 'ip' | 'range' | 'function' | 'object' | 'unknown'

export interface NumericRange { readonly kind: 'range'; readonly lower: number; readonly upper: number }
interface RuntimeCollection { readonly kind: 'collection'; readonly collectionType: 'list' | 'tuple' | 'set'; readonly items: RuntimeValue[] }
interface RuntimeDictionary { readonly kind: 'dictionary'; readonly entries: Map<string, { key: RuntimeValue; value: RuntimeValue }> }
interface RuntimeIterator { readonly kind: 'iterator'; readonly items: RuntimeValue[]; index: number }
interface RuntimeFile { readonly kind: 'file'; readonly path: string; readonly mode: string; cursor: number; closed: boolean }
interface RuntimeModule { readonly kind: 'module'; readonly name: string }
interface RuntimeCallable {
  readonly kind: 'callable'
  readonly parameters: FunctionNode['parameters']
  readonly parameterTypes: FunctionNode['parameterTypes']
  readonly body: BlockNode | ExpressionNode
  readonly closure: Environment
  readonly supplied: RuntimeValue[]
}
interface RuntimeObject {
  readonly kind: 'instance'
  readonly className: string
  readonly fields: Map<string, { value?: RuntimeValue; constant: boolean; declaredType?: SemanticValueType }>
}
export type RuntimeValue = number | string | boolean | null | NumericRange | RuntimeCollection | RuntimeDictionary | RuntimeIterator | RuntimeFile | RuntimeModule | RuntimeCallable | RuntimeObject
export interface RuntimeDiagnostic {
  code: 'RUNTIME_ERROR' | 'INTEGER_OVERFLOW' | 'TYPE_MISMATCH' | 'ARGUMENT_COUNT_MISMATCH' | 'UNDECLARED_IDENTIFIER' | 'UNINITIALIZED_VARIABLE' | 'LOOP_LIMIT'
  message: string
  line: number
  column: number
}
export interface InterpreterOptions {
  inputValues?: string[]
  inputProvider?: (prompt: string) => string
  maxSteps?: number
}
export interface InterpreterResult {
  outputs: string[]
  diagnostics: RuntimeDiagnostic[]
  globals: Array<{ name: string; type: SemanticValueType; value: RuntimeValue }>
  steps: number
}

class Environment {
  readonly values = new Map<string, { value?: RuntimeValue; constant: boolean; initialized: boolean; declaredType?: SemanticValueType }>()
  constructor(readonly parent?: Environment) {}
  find(name: string): { value?: RuntimeValue; constant: boolean; initialized: boolean; declaredType?: SemanticValueType } | undefined {
    return this.values.get(name) ?? this.parent?.find(name)
  }
  assign(name: string, value: RuntimeValue): boolean {
    if (this.values.has(name)) {
      const current = this.values.get(name)!
      if (current.constant) return false
      current.value = value
      current.initialized = true
      return true
    }
    return this.parent?.assign(name, value) ?? false
  }
}

class ReturnSignal { constructor(readonly value: RuntimeValue) {} }
class BreakSignal {}
class ContinueSignal {}
class LanguageThrowSignal { constructor(readonly message: string) {} }

const typeOf = (value: RuntimeValue): SemanticValueType => {
  if (value === null) return 'null'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'decimal'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (value.kind === 'range') return 'range'
  if (value.kind === 'collection') return value.collectionType
  if (value.kind === 'dictionary') return 'dict'
  if (value.kind === 'file') return 'file'
  if (value.kind === 'module') return 'module'
  return value.kind === 'callable' ? 'function' : 'object'
}
const isRange = (value: RuntimeValue): value is NumericRange => typeof value === 'object' && value !== null && value.kind === 'range'
const isCollection = (value: RuntimeValue): value is RuntimeCollection => typeof value === 'object' && value !== null && value.kind === 'collection'
const isDictionary = (value: RuntimeValue): value is RuntimeDictionary => typeof value === 'object' && value !== null && value.kind === 'dictionary'
const isIterator = (value: RuntimeValue): value is RuntimeIterator => typeof value === 'object' && value !== null && value.kind === 'iterator'
const isFile = (value: RuntimeValue): value is RuntimeFile => typeof value === 'object' && value !== null && value.kind === 'file'
const format = (value: RuntimeValue): string => value === null ? 'nulo' : isRange(value)
  ? '[' + format(value.lower) + ',...,' + format(value.upper) + ']'
  : isCollection(value) ? (value.collectionType === 'tuple' ? '(' + value.items.map(format).join(', ') + ')' : '[' + value.items.map(format).join(', ') + ']')
    : isDictionary(value) ? '{' + [...value.entries.values()].map(entry => format(entry.key) + ': ' + format(entry.value)).join(', ') + '}'
      : isIterator(value) ? '<iterador>'
        : isFile(value) ? '<archivo ' + value.path + '>'
        : typeof value === 'object' && value.kind === 'instance' ? '<' + value.className + '>'
        : typeof value === 'object' ? '<lambda>' : typeof value === 'boolean' ? (value ? 'verdadero' : 'falso') : String(value)
const INT32_MIN = -2_147_483_648
const INT32_MAX = 2_147_483_647

export function interpret(program: ProgramNode, options: InterpreterOptions = {}): InterpreterResult {
  const output: string[] = []
  const diagnostics: RuntimeDiagnostic[] = []
  const globals = new Environment()
  const functions = new Map<string, FunctionNode[]>()
  const classes = new Map<string, ClassDeclarationNode>()
  const memoryFiles = new Map<string, string>()
  const findClassMethod = (
    className: string,
    methodName: string,
    visited = new Set<string>(),
  ): FunctionNode | undefined => {
    if (visited.has(className)) return undefined
    visited.add(className)
    const definition = classes.get(className)
    const ownMethod = definition?.methods.find(method => method.name.name === methodName)
    if (ownMethod) return ownMethod
    return definition?.superclass ? findClassMethod(definition.superclass.name, methodName, visited) : undefined
  }
  const getClassFields = (className: string, visited = new Set<string>()): ClassDeclarationNode['fields'] => {
    if (visited.has(className)) return []
    visited.add(className)
    const definition = classes.get(className)
    if (!definition) return []
    const inheritedFields = definition.superclass
      ? getClassFields(definition.superclass.name, visited)
      : []
    return [...inheritedFields, ...definition.fields]
  }
  const inputValues = [...(options.inputValues ?? [])]
  let steps = 0
  const maxSteps = options.maxSteps ?? 20_000
  let stopped = false

  const fail = (node: { start: { line: number; column: number } }, code: RuntimeDiagnostic['code'], message: string): never => {
    throw { diagnostic: { code, message, line: node.start.line, column: node.start.column } satisfies RuntimeDiagnostic }
  }
  const tick = (node: { start: { line: number; column: number } }): void => {
    steps += 1
    if (steps > maxSteps) fail(node, 'LOOP_LIMIT', `Se alcanzó el límite de ${maxSteps} pasos; posible ciclo infinito.`)
  }
  const checkedNumber = (value: number, node: { start: { line: number; column: number } }): number => {
    if (!Number.isFinite(value) || (Number.isInteger(value) && (value < INT32_MIN || value > INT32_MAX))) {
      fail(node, 'INTEGER_OVERFLOW', `Overflow: el resultado '${String(value)}' excede el rango numérico int32.`)
    }
    return value as number
  }
  const range = (lower: number, upper: number, node: { start: { line: number; column: number } }): NumericRange => {
    checkedNumber(lower, node); checkedNumber(upper, node)
    return { kind: 'range', lower: Math.min(lower, upper), upper: Math.max(lower, upper) }
  }
  const expectNumber = (value: RuntimeValue, node: { start: { line: number; column: number } }): number => {
    if (typeof value !== 'number') fail(node, 'TYPE_MISMATCH', `Se esperaba number y se recibió ${typeOf(value)}.`)
    return value as number
  }
  const truthy = (value: RuntimeValue): boolean => {
    if (value === null || value === false || value === 0 || value === '') return false
    if (isCollection(value)) return value.items.length > 0
    if (isDictionary(value)) return value.entries.size > 0
    return true
  }
  const sequenceItems = (value: RuntimeValue, node: { start: { line: number; column: number } }): RuntimeValue[] => {
    if (isCollection(value)) return value.items
    if (isDictionary(value)) return [...value.entries.values()].map(entry => entry.key)
    if (isIterator(value)) {
      const remaining = value.items.slice(value.index)
      value.index = value.items.length
      return remaining
    }
    if (typeof value === 'string') return [...value]
    if (isRange(value)) {
      const length = Math.min(value.upper - value.lower + 1, 20_000)
      return Array.from({ length }, (_, index) => value.lower + index)
    }
    return fail(node, 'TYPE_MISMATCH', 'Se esperaba una lista, tupla, conjunto, texto o rango iterable.')
  }
  const equalValues = (left: RuntimeValue, right: RuntimeValue): boolean => {
    if (isCollection(left) && isCollection(right)) return left.items.length === right.items.length && left.items.every((item, index) => equalValues(item, right.items[index]))
    return left === right
  }
  const applyNumeric = (operator: TokenType, a: number, b: number, node: ExpressionNode): number => {
    if (operator === TokenType.DIVIDE || operator === TokenType.DOT_DIVIDE) {
      if (b === 0) fail(node, 'RUNTIME_ERROR', 'División entre cero.')
      return checkedNumber(a / b, node)
    }
    if (operator === TokenType.PLUS) return checkedNumber(a + b, node)
    if (operator === TokenType.MINUS) return checkedNumber(a - b, node)
    if (operator === TokenType.MULTIPLY) return checkedNumber(a * b, node)
    if (operator === TokenType.FLOOR_DIVIDE) {
      if (b === 0) fail(node, 'RUNTIME_ERROR', 'División entre cero.')
      return checkedNumber(Math.floor(a / b), node)
    }
    if (operator === TokenType.MODULO) {
      if (b === 0) fail(node, 'RUNTIME_ERROR', 'Módulo entre cero.')
      return checkedNumber(a % b, node)
    }
    if (operator === TokenType.POWER) return checkedNumber(a ** b, node)
    return fail(node, 'RUNTIME_ERROR', `Operador aritmético no implementado: ${operator}.`)
  }
  const applyRangeNumeric = (operator: TokenType, left: RuntimeValue, right: RuntimeValue, node: ExpressionNode): RuntimeValue => {
    if (!isRange(left) && !isRange(right)) return applyNumeric(operator, expectNumber(left, node), expectNumber(right, node), node)
    const leftBounds = isRange(left) ? [left.lower, left.upper] : [expectNumber(left, node), expectNumber(left, node)]
    const rightBounds = isRange(right) ? [right.lower, right.upper] : [expectNumber(right, node), expectNumber(right, node)]
    if ((operator === TokenType.DIVIDE || operator === TokenType.DOT_DIVIDE) && rightBounds[0] <= 0 && rightBounds[1] >= 0) {
      fail(node, 'RUNTIME_ERROR', 'No se puede dividir entre un rango que contiene cero.')
    }
    const values = [
      applyNumeric(operator, leftBounds[0], rightBounds[0], node),
      applyNumeric(operator, leftBounds[0], rightBounds[1], node),
      applyNumeric(operator, leftBounds[1], rightBounds[0], node),
      applyNumeric(operator, leftBounds[1], rightBounds[1], node),
    ]
    return range(Math.min(...values), Math.max(...values), node)
  }
  const lookup = (environment: Environment, name: string, node: ExpressionNode): RuntimeValue => {
    const entry = environment.find(name)
    if (!entry) return fail(node, 'UNDECLARED_IDENTIFIER', `La variable '${name}' no está declarada.`)
    if (!entry.initialized || entry.value === undefined) return fail(node, 'UNINITIALIZED_VARIABLE', `La variable '${name}' se usa antes de recibir un valor.`)
    return entry.value
  }

  const evaluate = (expression: ExpressionNode, environment: Environment): RuntimeValue => {
    tick(expression)
    switch (expression.kind) {
      case 'Identifier': return lookup(environment, expression.name, expression)
      case 'Literal': return expression.value as RuntimeValue
      case 'CollectionLiteral': {
        if (expression.collectionType === 'dict') {
          const entries = new Map<string, { key: RuntimeValue; value: RuntimeValue }>()
          for (const entry of expression.entries ?? []) {
            const key = evaluate(entry.key, environment)
            entries.set(format(key), { key, value: evaluate(entry.value, environment) })
          }
          return { kind: 'dictionary', entries }
        }
        const items = expression.items.map(item => evaluate(item, environment))
        return { kind: 'collection', collectionType: expression.collectionType, items: expression.collectionType === 'set'
          ? items.filter((item, index) => items.findIndex(other => equalValues(item, other)) === index)
          : items }
      }
      case 'ListComprehension': {
        const values = sequenceItems(evaluate(expression.iterable, environment), expression)
        const items: RuntimeValue[] = []
        for (const value of values) {
          const local = new Environment(environment)
          local.values.set(expression.identifier.name, { value, constant: true, initialized: true })
          if (!expression.condition || truthy(evaluate(expression.condition, local))) items.push(evaluate(expression.element, local))
        }
        return { kind: 'collection', collectionType: 'list', items }
      }
      case 'RangeLiteral': {
        const lower = expectNumber(evaluate(expression.lower, environment), expression)
        const upper = expectNumber(evaluate(expression.upper, environment), expression)
        return range(lower, upper, expression)
      }
      case 'LambdaExpression':
        return {
          kind: 'callable', parameters: expression.parameters, parameterTypes: expression.parameterTypes,
          body: expression.body, closure: environment, supplied: [],
        }
      case 'NewExpression': {
        const definition = classes.get(expression.className)
        if (!definition) return fail(expression, 'RUNTIME_ERROR', 'La clase ' + expression.className + ' no está declarada.')
        const instance: RuntimeObject = { kind: 'instance', className: expression.className, fields: new Map() }
        const fields = getClassFields(expression.className)
        for (const field of fields) {
          instance.fields.set(field.identifier.name, {
            value: undefined, constant: field.declarationKind === 'fijo', declaredType: field.declaredType,
          })
        }
        const fieldEnvironment = new Environment(environment)
        fieldEnvironment.values.set('este', { value: instance, constant: true, initialized: true, declaredType: 'object' })
        for (const field of fields) {
          if (!field.initializer) continue
          const value = evaluate(field.initializer, fieldEnvironment)
          const target = instance.fields.get(field.identifier.name)!
          if (target.declaredType && target.declaredType !== typeOf(value) && !(target.declaredType === 'decimal' && typeOf(value) === 'integer')) {
            fail(field.identifier, 'TYPE_MISMATCH', 'El campo ' + field.identifier.name + ' recibe ' + typeOf(value) + ', pero declara ' + target.declaredType + '.')
          }
          target.value = value
        }
        const initializer = findClassMethod(expression.className, 'inicia')
        if (initializer) {
          const bound = new Environment(globals)
          bound.values.set('este', { value: instance, constant: true, initialized: true, declaredType: 'object' })
          invokeCallable({
            kind: 'callable', parameters: initializer.parameters, parameterTypes: initializer.parameterTypes,
            body: initializer.body, closure: bound, supplied: [],
          }, expression.arguments.map(argument => evaluate(argument, environment)), expression)
        } else if (expression.arguments.length) {
          return fail(expression, 'ARGUMENT_COUNT_MISMATCH', 'La clase ' + expression.className + ' no tiene un inicializador con parámetros.')
        }
        return instance
      }
      case 'MemberExpression': {
        const object = evaluate(expression.object, environment)
        if (object === null || typeof object !== 'object' || object.kind !== 'instance') return fail(expression, 'TYPE_MISMATCH', 'Solo se pueden consultar atributos de una instancia de clase.')
        const field = object.fields.get(expression.property.name)
        if (field) {
          if (field.value === undefined) return fail(expression, 'UNINITIALIZED_VARIABLE', 'El campo ' + expression.property.name + ' todavía no tiene valor.')
          return field.value
        }
        const method = findClassMethod(object.className, expression.property.name)
        if (!method) return fail(expression, 'RUNTIME_ERROR', 'El miembro ' + expression.property.name + ' no existe en ' + object.className + '.')
        const bound = new Environment(globals)
        bound.values.set('este', { value: object, constant: true, initialized: true, declaredType: 'object' })
        return {
          kind: 'callable', parameters: method.parameters, parameterTypes: method.parameterTypes,
          body: method.body, closure: bound, supplied: [],
        }
      }
      case 'IndexExpression': {
        const object = evaluate(expression.object, environment)
        const indexValue = evaluate(expression.index, environment)
        if (isDictionary(object)) {
          const entry = object.entries.get(format(indexValue))
          if (!entry) return fail(expression, 'RUNTIME_ERROR', 'La clave ' + format(indexValue) + ' no existe en el diccionario.')
          return entry.value
        }
        const index = Math.trunc(expectNumber(indexValue, expression))
        const values = sequenceItems(object, expression)
        const normalizedIndex = index < 0 ? values.length + index : index
        if (normalizedIndex < 0 || normalizedIndex >= values.length) return fail(expression, 'RUNTIME_ERROR', 'El índice está fuera del rango de la colección.')
        return values[normalizedIndex]
      }
      case 'ErrorExpression': return fail(expression, 'RUNTIME_ERROR', 'No se puede ejecutar una expresión sintáctica inválida.')
      case 'UnaryExpression': {
        const value = evaluate(expression.operand, environment)
        if ([TokenType.LOGICAL_NOT, TokenType.LOGICAL_NOT_SYM, TokenType.LOGICAL_NOT_SYMBOL].includes(expression.operator.type)) {
          return !truthy(value)
        }
        if (expression.operator.type === TokenType.MINUS) {
          if (isRange(value)) return range(-value.upper, -value.lower, expression)
          return checkedNumber(-expectNumber(value, expression), expression)
        }
        if (expression.operator.type === TokenType.PLUS) return value
        return fail(expression, 'RUNTIME_ERROR', `Operador unario no implementado: ${expression.operator.lexeme}.`)
      }
      case 'UpdateExpression': {
        const oldValue = lookup(environment, expression.argument.name, expression)
        if (typeof oldValue !== 'number') return fail(expression, 'TYPE_MISMATCH', '++ y -- solo aceptan variables numéricas.')
        const value = checkedNumber(oldValue + (expression.operator.lexeme.includes('--') ? -1 : 1), expression)
        if (!environment.assign(expression.argument.name, value)) return fail(expression, 'RUNTIME_ERROR', `No se pudo actualizar '${expression.argument.name}'.`)
        return expression.prefix ? value : oldValue
      }
      case 'BinaryExpression': {
        const left = evaluate(expression.left, environment)
        const right = evaluate(expression.right, environment)
        const type = expression.operator.type
        if (type === TokenType.KEYWORD_EN || type === TokenType.KEYWORD_NO_EN) {
          const found = isDictionary(right)
            ? right.entries.has(format(left))
            : sequenceItems(right, expression).some(item => equalValues(item, left))
          return type === TokenType.KEYWORD_EN ? found : !found
        }
        if (type === TokenType.PLUS || type === TokenType.MINUS || type === TokenType.MULTIPLY || type === TokenType.DIVIDE || type === TokenType.FLOOR_DIVIDE || type === TokenType.MODULO || type === TokenType.POWER || type === TokenType.DOT_DIVIDE) {
          if (type === TokenType.PLUS && typeof left === 'string' && typeof right === 'string') return left + right
          if (type === TokenType.PLUS && isCollection(left) && isCollection(right) && left.collectionType === right.collectionType && left.collectionType !== 'set') {
            return { kind: 'collection', collectionType: left.collectionType, items: [...left.items, ...right.items] }
          }
          if (type === TokenType.MULTIPLY && isCollection(left) && typeof right === 'number' && left.collectionType !== 'set') {
            return { kind: 'collection', collectionType: left.collectionType, items: Array.from({ length: Math.max(0, Math.trunc(right)) }, () => left.items).flat() }
          }
          if (type === TokenType.MULTIPLY && typeof left === 'number' && isCollection(right) && right.collectionType !== 'set') {
            return { kind: 'collection', collectionType: right.collectionType, items: Array.from({ length: Math.max(0, Math.trunc(left)) }, () => right.items).flat() }
          }
          if ((typeof left !== 'number' && !isRange(left)) || (typeof right !== 'number' && !isRange(right))) {
            return fail(expression, 'TYPE_MISMATCH', `No se puede aplicar '${expression.operator.lexeme}' a ${typeOf(left)} y ${typeOf(right)}.`)
          }
          return applyRangeNumeric(type, left, right, expression)
        }
        if (type === TokenType.LOGICAL_AND || type === TokenType.LOGICAL_AND_SYM || type === TokenType.LOGICAL_NAND || type === TokenType.LOGICAL_NOR || type === TokenType.LOGICAL_OR || type === TokenType.LOGICAL_OR_SYM || type === TokenType.LOGICAL_XOR || type === TokenType.LOGICAL_XORT || type === TokenType.LOGICAL_XNOR) {
          if (typeof left !== 'boolean' || typeof right !== 'boolean') return fail(expression, 'TYPE_MISMATCH', 'Los operadores lógicos requieren dos booleanos.')
          if (type === TokenType.LOGICAL_AND || type === TokenType.LOGICAL_AND_SYM) return left && right
          if (type === TokenType.LOGICAL_OR || type === TokenType.LOGICAL_OR_SYM) return left || right
          if (type === TokenType.LOGICAL_NAND) return !(left && right)
          if (type === TokenType.LOGICAL_NOR) return !(left || right)
          if (type === TokenType.LOGICAL_XNOR) return left === right
          return left !== right
        }
        const a = isRange(left) ? NaN : left
        const b = isRange(right) ? NaN : right
        if (typeof a === 'number' && typeof b === 'number') {
          if (type === TokenType.LESS || expression.operator.lexeme === '(-)') return a < b
          if (type === TokenType.GREATER || expression.operator.lexeme === '(+)') return a > b
          if (type === TokenType.LESS_EQUAL || expression.operator.lexeme === '=(-)') return a <= b
          if (type === TokenType.GREATER_EQUAL || expression.operator.lexeme === '=(+)') return a >= b
          if (type === TokenType.EQUAL || type === TokenType.DOUBLE_EQUAL || expression.operator.lexeme === '==>') return a === b
          if (type === TokenType.NOT_EQUAL) return a !== b
        }
        if (type === TokenType.EQUAL || type === TokenType.DOUBLE_EQUAL || expression.operator.lexeme === '==>') return left === right
        if (type === TokenType.NOT_EQUAL) return left !== right
        return fail(expression, 'RUNTIME_ERROR', `Comparación no implementada: ${expression.operator.lexeme}.`)
      }
      case 'CallExpression': {
        const args = expression.arguments.map(argument => evaluate(argument, environment))
        const name = expression.callee.toLowerCase()
        const numeric = (index: number): number => expectNumber(args[index], expression)
        const mathNames: Record<string, string> = {
          seno: 'sin', sin: 'sin', coseno: 'cos', cos: 'cos', tangente: 'tan', tan: 'tan',
          logaritmo: 'log', log: 'log', raiz_cuadrada: 'sqrt', sqrt: 'sqrt', valor_absoluto: 'abs', abs: 'abs',
        }
        const mathName = mathNames[name]
        if (mathName === 'sin') return checkedNumber(Math.sin(numeric(0)), expression)
        if (mathName === 'cos') return checkedNumber(Math.cos(numeric(0)), expression)
        if (mathName === 'tan') return checkedNumber(Math.tan(numeric(0)), expression)
        if (mathName === 'log') return checkedNumber(Math.log(numeric(0)), expression)
        if (mathName === 'sqrt') return checkedNumber(Math.sqrt(numeric(0)), expression)
        if (mathName === 'abs') return checkedNumber(Math.abs(numeric(0)), expression)
        if (name === 'potencia' || name === 'pow') return applyNumeric(TokenType.POWER, numeric(0), numeric(1), expression)
        if (['mas', '+', 'menos', '-', 'por', '*', 'entre', '/', 'entre_entero', 'modulo', '%', '**', './'].includes(name)) {
          const operator = name === 'mas' || name === '+' ? TokenType.PLUS : name === 'menos' || name === '-' ? TokenType.MINUS : name === 'por' || name === '*' ? TokenType.MULTIPLY : name === 'entre' || name === '/' ? TokenType.DIVIDE : name === 'entre_entero' ? TokenType.FLOOR_DIVIDE : name === 'modulo' || name === '%' ? TokenType.MODULO : name === '**' ? TokenType.POWER : TokenType.DOT_DIVIDE
          if (operator === TokenType.PLUS && typeof args[0] === 'string' && typeof args[1] === 'string') return args[0] + args[1]
          return applyRangeNumeric(operator, args[0], args[1], expression)
        }
        if (name === 'a_entero' || name === 'a_real' || name === 'a_texto' || name === 'a_booleano') {
          if (name === 'a_texto') return format(args[0])
          if (name === 'a_booleano') return truthy(args[0])
          const parsed = typeof args[0] === 'number' ? args[0] : typeof args[0] === 'boolean' ? Number(args[0]) : Number(String(args[0]))
          if (!Number.isFinite(parsed)) return fail(expression, 'TYPE_MISMATCH', 'No se puede convertir el valor a número.')
          return checkedNumber(name === 'a_entero' ? Math.trunc(parsed) : parsed, expression)
        }
        if (name === 'lista' || name === 'tupla' || name === 'conjunto') {
          const source = args.length ? args[0] : { kind: 'collection', collectionType: 'list', items: [] } as RuntimeCollection
          const items = sequenceItems(source, expression)
          return { kind: 'collection', collectionType: name === 'lista' ? 'list' : name === 'tupla' ? 'tuple' : 'set', items: name === 'conjunto' ? items.filter((item, index) => items.findIndex(other => equalValues(item, other)) === index) : [...items] }
        }
        if (name === 'diccionario') {
          if (args.length && isDictionary(args[0])) return { kind: 'dictionary', entries: new Map(args[0].entries) }
          const entries = new Map<string, { key: RuntimeValue; value: RuntimeValue }>()
          if (args.length) for (const pair of sequenceItems(args[0], expression)) {
            const values = sequenceItems(pair, expression)
            if (values.length !== 2) return fail(expression, 'TYPE_MISMATCH', 'Cada entrada de diccionario debe tener dos valores: clave y dato.')
            entries.set(format(values[0]), { key: values[0], value: values[1] })
          }
          return { kind: 'dictionary', entries }
        }
        if (name === 'longitud') {
          const value = args[0]
          if (typeof value === 'string') return value.length
          if (isCollection(value)) return value.items.length
          if (isDictionary(value)) return value.entries.size
          if (isRange(value)) return value.upper - value.lower + 1
          return fail(expression, 'TYPE_MISMATCH', 'longitud requiere texto, colección, diccionario o rango.')
        }
        if (name === 'secuencia') {
          const start = args.length > 1 ? numeric(0) : 0
          const stop = args.length > 1 ? numeric(1) : numeric(0)
          const step = args.length > 2 ? numeric(2) : 1
          if (step === 0) return fail(expression, 'RUNTIME_ERROR', 'El paso de secuencia no puede ser cero.')
          const items: number[] = []
          for (let current = start; step > 0 ? current < stop : current > stop; current += step) {
            if (items.length >= 20_000) return fail(expression, 'LOOP_LIMIT', 'La secuencia supera el límite de 20000 elementos.')
            items.push(checkedNumber(current, expression))
          }
          return { kind: 'collection', collectionType: 'list', items }
        }
        if (['sumatoria', 'maximo', 'minimo'].includes(name)) {
          const items = sequenceItems(args[0], expression).map(item => expectNumber(item, expression))
          if (name === 'sumatoria') return checkedNumber(items.reduce((sum, item) => sum + item, 0), expression)
          if (!items.length) return fail(expression, 'RUNTIME_ERROR', name + ' requiere al menos un elemento.')
          return name === 'maximo' ? Math.max(...items) : Math.min(...items)
        }
        if (name === 'ordenar' || name === 'al_reves') {
          const items = [...sequenceItems(args[0], expression)]
          return { kind: 'collection', collectionType: 'list', items: name === 'al_reves' ? items.reverse() : items.sort((left, right) => typeof left === 'number' && typeof right === 'number' ? left - right : format(left).localeCompare(format(right))) }
        }
        if (name === 'redondear') {
          const digits = args.length > 1 ? numeric(1) : 0
          const factor = 10 ** digits
          return checkedNumber(Math.round(numeric(0) * factor) / factor, expression)
        }
        if (name === 'todos' || name === 'alguno') {
          const results = sequenceItems(args[0], expression).map(truthy)
          return name === 'todos' ? results.every(Boolean) : results.some(Boolean)
        }
        if (name === 'enumerar') {
          const start = args.length > 1 ? numeric(1) : 0
          return { kind: 'collection', collectionType: 'list', items: sequenceItems(args[0], expression).map((item, index) => ({ kind: 'collection', collectionType: 'tuple', items: [start + index, item] })) }
        }
        if (name === 'emparejar') {
          const sources = args.map(value => sequenceItems(value, expression))
          const length = Math.min(...sources.map(source => source.length))
          return { kind: 'collection', collectionType: 'list', items: Array.from({ length }, (_, index) => ({ kind: 'collection', collectionType: 'tuple', items: sources.map(source => source[index]) })) }
        }
        if (name === 'transformar' || name === 'filtrar') {
          const callback = args[0]
          if (typeof callback !== 'object' || callback === null || callback.kind !== 'callable') return fail(expression, 'TYPE_MISMATCH', name + ' espera una lambda como primer argumento.')
          const values = sequenceItems(args[1], expression)
          const results = values.map(value => invokeCallable(callback, [value], expression))
          return { kind: 'collection', collectionType: 'list', items: name === 'transformar' ? results : values.filter((_, index) => truthy(results[index])) }
        }
        if (name === 'tipo_de') return typeOf(args[0])
        if (name === 'es_instancia_de') {
          const expected = String(args[1]).toLowerCase()
          const aliases: Record<string, string> = { entero: 'integer', real: 'decimal', texto: 'string', booleano: 'boolean', lista: 'list', tupla: 'tuple', conjunto: 'set', diccionario: 'dict', rango: 'range' }
          const actual = typeOf(args[0])
          return actual === (aliases[expected] ?? expected) || (expected === 'real' && actual === 'integer')
        }
        if (name === 'es_subclase_de') {
          const child = String(args[0])
          const parent = String(args[1])
          const inherits = (className: string, expected: string, visited = new Set<string>()): boolean => {
            if (visited.has(className)) return false
            visited.add(className)
            const base = classes.get(className)?.superclass?.name
            return base === expected || (base ? inherits(base, expected, visited) : false)
          }
          return classes.has(child) && classes.has(parent) && inherits(child, parent)
        }
        if (name === 'iterador_de') return { kind: 'iterator', items: sequenceItems(args[0], expression), index: 0 }
        if (name === 'siguiente') {
          if (!isIterator(args[0])) return fail(expression, 'TYPE_MISMATCH', 'siguiente requiere un iterador creado con iterador_de.')
          if (args[0].index >= args[0].items.length) return fail(expression, 'RUNTIME_ERROR', 'El iterador ya no contiene más valores.')
          return args[0].items[args[0].index++]
        }
        if (name === 'formatear') return args.length > 1 ? format(args[0]).replace('{}', format(args[1])) : format(args[0])
        if (name === 'representar') return format(args[0])
        if (name === 'cociente_y_resto') {
          const divisor = numeric(1)
          if (divisor === 0) return fail(expression, 'RUNTIME_ERROR', 'División entre cero.')
          return { kind: 'collection', collectionType: 'tuple', items: [Math.trunc(numeric(0) / divisor), numeric(0) % divisor] }
        }
        if (name === 'abrir') {
          if (typeof args[0] !== 'string') return fail(expression, 'TYPE_MISMATCH', 'abrir requiere la ruta del archivo como texto.')
          const path = args[0]
          const mode = args.length > 1 ? String(args[1]) : 'r'
          if (!['r', 'w', 'a', 'r+', 'w+', 'a+'].includes(mode)) return fail(expression, 'RUNTIME_ERROR', 'Modo de archivo no compatible: ' + mode + '.')
          if (!memoryFiles.has(path) && mode.startsWith('r')) return fail(expression, 'RUNTIME_ERROR', 'El archivo en memoria no existe: ' + path + '.')
          if (mode.startsWith('w')) memoryFiles.set(path, '')
          if (!memoryFiles.has(path)) memoryFiles.set(path, '')
          return { kind: 'file', path, mode, cursor: mode.startsWith('a') ? memoryFiles.get(path)!.length : 0, closed: false }
        }
        if (['chismea', 'atrapa', 'pregunta', 'damedatos'].includes(name)) {
          if (inputValues.length) return inputValues.shift()!
          return options.inputProvider?.(args.map(format).join(' ')) ?? ''
        }
        if (expression.receiver) {
          const receiver = evaluate(expression.receiver, environment)
          if (isFile(receiver)) {
            if (receiver.closed) return fail(expression, 'RUNTIME_ERROR', 'El archivo ya está cerrado.')
            const content = memoryFiles.get(receiver.path) ?? ''
            if (expression.callee === 'leer') {
              const count = args.length ? Math.max(0, Math.trunc(numeric(0))) : content.length - receiver.cursor
              const text = content.slice(receiver.cursor, receiver.cursor + count)
              receiver.cursor += text.length
              return text
            }
            if (expression.callee === 'leer_linea') {
              const nextNewline = content.indexOf('\n', receiver.cursor)
              const end = nextNewline < 0 ? content.length : nextNewline + 1
              const text = content.slice(receiver.cursor, end)
              receiver.cursor = end
              return text
            }
            if (expression.callee === 'escribir') {
              if (receiver.mode.startsWith('r') && !receiver.mode.includes('+')) return fail(expression, 'RUNTIME_ERROR', 'El archivo se abrió en modo de solo lectura.')
              const text = format(args[0])
              const before = content.slice(0, receiver.cursor)
              const after = content.slice(receiver.cursor + text.length)
              memoryFiles.set(receiver.path, before + text + after)
              receiver.cursor += text.length
              return text.length
            }
            if (expression.callee === 'cerrar') { receiver.closed = true; return null }
          }
          if (receiver === null || typeof receiver !== 'object' || receiver.kind !== 'instance') return fail(expression, 'TYPE_MISMATCH', 'El receptor de un método debe ser una instancia.')
          const method = findClassMethod(receiver.className, expression.callee)
          if (!method) return fail(expression, 'RUNTIME_ERROR', 'No existe el método ' + expression.callee + ' en ' + receiver.className + '.')
          const bound = new Environment(globals)
          bound.values.set('este', { value: receiver, constant: true, initialized: true, declaredType: 'object' })
          return invokeCallable({
            kind: 'callable', parameters: method.parameters, parameterTypes: method.parameterTypes,
            body: method.body, closure: bound, supplied: [],
          }, args, expression)
        }
        const candidates = functions.get(expression.callee) ?? []
        const callable = candidates.find(candidate => candidate.parameters.length === args.length)
          ?? (candidates.filter(candidate => candidate.parameters.length > args.length).length === 1
            ? candidates.find(candidate => candidate.parameters.length > args.length)
            : undefined)
        if (callable) return invokeCallable({
          kind: 'callable', parameters: callable.parameters, parameterTypes: callable.parameterTypes,
          body: callable.body, closure: globals, supplied: [],
        }, args, expression)
        const entry = environment.find(expression.callee)
        if (entry?.initialized && entry.value && typeof entry.value === 'object' && entry.value.kind === 'callable') {
          return invokeCallable(entry.value, args, expression)
        }
        return fail(expression, 'ARGUMENT_COUNT_MISMATCH', 'No hay tarea o lambda ' + expression.callee + ' que acepte ' + args.length + ' argumento(s).')
      }
    }
  }

  const assign = (assignment: AssignmentNode, environment: Environment, value: RuntimeValue): void => {
    if (assignment.target.kind === 'IndexExpression') {
      const object = evaluate(assignment.target.object, environment)
      const indexValue = evaluate(assignment.target.index, environment)
      if (isDictionary(object)) {
        const key = format(indexValue)
        object.entries.set(key, { key: indexValue, value })
        return
      }
      if (!isCollection(object) || object.collectionType !== 'list') return fail(assignment.target, 'TYPE_MISMATCH', 'Solo se pueden asignar índices de una lista o un diccionario.')
      const index = Math.trunc(expectNumber(indexValue, assignment.target))
      const normalizedIndex = index < 0 ? object.items.length + index : index
      if (normalizedIndex < 0 || normalizedIndex >= object.items.length) return fail(assignment.target, 'RUNTIME_ERROR', 'El índice está fuera del rango de la lista.')
      object.items[normalizedIndex] = value
      return
    }
    if (assignment.target.kind === 'MemberExpression') {
      const object = evaluate(assignment.target.object, environment)
      if (object === null || typeof object !== 'object' || object.kind !== 'instance') return fail(assignment.target, 'TYPE_MISMATCH', 'El destino de un atributo debe ser una instancia de clase.')
      const field = object.fields.get(assignment.target.property.name)
      if (!field) return fail(assignment.target, 'RUNTIME_ERROR', 'El atributo ' + assignment.target.property.name + ' no existe en ' + object.className + '.')
      if (field.constant) return fail(assignment.target, 'RUNTIME_ERROR', 'No se puede reasignar el atributo fijo ' + assignment.target.property.name + '.')
      if (field.declaredType && field.declaredType !== typeOf(value) && !(field.declaredType === 'decimal' && typeOf(value) === 'integer')) {
        return fail(assignment.target, 'TYPE_MISMATCH', 'El atributo ' + assignment.target.property.name + ' es ' + field.declaredType + ', pero recibe ' + typeOf(value) + '.')
      }
      field.value = value
      return
    }
    const target = environment.find(assignment.target.name)
    if (!target) return fail(assignment.target, 'UNDECLARED_IDENTIFIER', `No existe una variable '${assignment.target.name}'.`)
    if (target.constant) fail(assignment.target, 'RUNTIME_ERROR', `No se puede modificar la constante '${assignment.target.name}'.`)
    if (assignment.compoundOperator) {
      if (!target.initialized || target.value === undefined) fail(assignment.target, 'UNINITIALIZED_VARIABLE', `La variable '${assignment.target.name}' debe tener valor antes de usar una asignación compuesta.`)
      const previous = target.value!
      const operator = assignment.compoundOperator.type === TokenType.PLUS_ASSIGN ? TokenType.PLUS
        : assignment.compoundOperator.type === TokenType.MINUS_ASSIGN ? TokenType.MINUS
          : assignment.compoundOperator.type === TokenType.MULTIPLY_ASSIGN ? TokenType.MULTIPLY : TokenType.DIVIDE
      if (operator === TokenType.PLUS && typeof previous === 'string' && typeof value === 'string') value = previous + value
      else if (operator === TokenType.PLUS && isCollection(previous) && isCollection(value) && previous.collectionType === value.collectionType && previous.collectionType !== 'set') value = { kind: 'collection', collectionType: previous.collectionType, items: [...previous.items, ...value.items] }
      else if ((typeof previous === 'number' || isRange(previous)) && (typeof value === 'number' || isRange(value))) value = applyRangeNumeric(operator, previous, value, assignment as unknown as ExpressionNode)
      else fail(assignment.target, 'TYPE_MISMATCH', 'Los operandos de la asignación compuesta no son compatibles.')
    }
    if (target.declaredType && target.declaredType !== typeOf(value) && !(target.declaredType === 'decimal' && typeOf(value) === 'integer')) {
      fail(assignment.target, 'TYPE_MISMATCH', `La variable '${assignment.target.name}' es ${target.declaredType}, pero recibe ${typeOf(value)}.`)
    }
    environment.assign(assignment.target.name, value)
  }
  const executeBlock = (block: BlockNode, parent: Environment, createsScope = true): void => {
    const environment = createsScope ? new Environment(parent) : parent
    for (const statement of block.statements) {
      if (stopped) break
      executeStatement(statement, environment)
    }
  }

  function invokeCallable(callable: RuntimeCallable, args: RuntimeValue[], node: ExpressionNode): RuntimeValue {
    const combined = [...callable.supplied, ...args]
    if (combined.length > callable.parameters.length) {
      return fail(node, 'ARGUMENT_COUNT_MISMATCH', 'La función espera ' + callable.parameters.length + ' argumento(s), pero recibió ' + combined.length + '.')
    }
    if (combined.length < callable.parameters.length) return { ...callable, supplied: combined }
    const local = new Environment(callable.closure)
    callable.parameters.forEach((parameter, index) => {
      const value = combined[index]
      const expected = callable.parameterTypes[parameter.name]
      if (expected && expected !== typeOf(value) && !(expected === 'decimal' && typeOf(value) === 'integer')) {
        fail(node, 'TYPE_MISMATCH', 'El argumento ' + parameter.name + ' debe ser ' + expected + ', se recibió ' + typeOf(value) + '.')
      }
      local.values.set(parameter.name, { value, constant: false, initialized: true, declaredType: expected })
    })
    if (callable.body.kind !== 'Block') return evaluate(callable.body, local)
    try { executeBlock(callable.body, local, false) } catch (signal) {
      if (signal instanceof ReturnSignal) return signal.value
      throw signal
    }
    return 0
  }
  const executeParallel = (assignments: AssignmentNode[], environment: Environment): void => {
    const values = assignments.map(assignment => evaluate(assignment.value, environment))
    const targets = assignments.map((assignment, index) => {
      if (assignment.target.kind !== 'Identifier') return fail(assignment.target, 'RUNTIME_ERROR', 'El destino de par debe ser una variable.')
      const target = environment.find(assignment.target.name)
      if (!target) return fail(assignment.target, 'UNDECLARED_IDENTIFIER', `No existe una variable '${assignment.target.name}'.`)
      if (target.constant) fail(assignment.target, 'RUNTIME_ERROR', `No se puede modificar la constante '${assignment.target.name}'.`)
      if (target.declaredType && target.declaredType !== typeOf(values[index]) && !(target.declaredType === 'decimal' && typeOf(values[index]) === 'integer')) {
        fail(assignment.target, 'TYPE_MISMATCH', `La variable '${assignment.target.name}' es ${target.declaredType}, pero recibe ${typeOf(values[index])}.`)
      }
      return target
    })
    assignments.forEach((_, index) => {
      targets[index].value = values[index]
      targets[index].initialized = true
    })
  }
  const executeStatement = (statement: StatementNode, environment: Environment): void => {
    tick(statement)
    switch (statement.kind) {
      case 'VarDeclaration': {
        const value = statement.initializer ? evaluate(statement.initializer, environment) : undefined
        const declaredType = statement.declaredType
        if (value !== undefined && declaredType && declaredType !== typeOf(value) && !(declaredType === 'decimal' && typeOf(value) === 'integer')) {
          fail(statement.identifier, 'TYPE_MISMATCH', `La variable '${statement.identifier.name}' es ${declaredType}, pero recibe ${typeOf(value)}.`)
        }
        environment.values.set(statement.identifier.name, { value, constant: statement.declarationKind === 'fijo', initialized: statement.initializer !== undefined, declaredType })
        return
      }
      case 'AssignmentStatement': assign(statement, environment, evaluate(statement.value, environment)); return
      case 'ParallelStatement': executeParallel(statement.assignments, environment); return
      case 'IfStatement': {
        const condition = evaluate(statement.condition, environment)
        executeBlock(truthy(condition) ? statement.consequent : statement.alternate ?? { kind: 'Block', statements: [], start: statement.start, end: statement.end }, environment)
        return
      }
      case 'ForStatement': {
        const loop = new Environment(environment)
        if (statement.initialization.kind === 'VarDeclaration') executeStatement(statement.initialization, loop)
        else assign(statement.initialization, loop, evaluate(statement.initialization.value, loop))
        let condition = evaluate(statement.condition, loop)
        while (truthy(condition)) {
          tick(statement)
          try { executeBlock(statement.body, loop) } catch (signal) {
            if (signal instanceof BreakSignal) break
            if (!(signal instanceof ContinueSignal)) throw signal
          }
          if (statement.update.kind === 'AssignmentStatement') assign(statement.update, loop, evaluate(statement.update.value, loop))
          else evaluate(statement.update, loop)
          condition = evaluate(statement.condition, loop)
        }
        return
      }
      case 'WhileStatement': {
        let condition = evaluate(statement.condition, environment)
        while (truthy(condition)) {
          tick(statement)
          try { executeBlock(statement.body, environment) } catch (signal) {
            if (signal instanceof BreakSignal) break
            if (!(signal instanceof ContinueSignal)) throw signal
          }
          condition = evaluate(statement.condition, environment)
        }
        return
      }
      case 'ForEachStatement': {
        const values = sequenceItems(evaluate(statement.iterable, environment), statement)
        const loop = new Environment(environment)
        loop.values.set(statement.identifier.name, { value: null, constant: false, initialized: true })
        for (const value of values) {
          tick(statement)
          loop.values.get(statement.identifier.name)!.value = value
          try { executeBlock(statement.body, loop) } catch (signal) {
            if (signal instanceof BreakSignal) break
            if (!(signal instanceof ContinueSignal)) throw signal
          }
        }
        return
      }
      case 'BreakStatement': throw new BreakSignal()
      case 'ContinueStatement': throw new ContinueSignal()
      case 'PassStatement': return
      case 'AssertStatement': {
        if (!truthy(evaluate(statement.condition, environment))) {
          const message = statement.message ? format(evaluate(statement.message, environment)) : 'La afirmación falló.'
          fail(statement, 'RUNTIME_ERROR', message)
        }
        return
      }
      case 'TryStatement': {
        let pending: unknown
        try {
          executeBlock(statement.body, environment)
        } catch (error) {
          const catchable = error instanceof LanguageThrowSignal
            ? error.message
            : (error as { diagnostic?: RuntimeDiagnostic })?.diagnostic?.message
          if (catchable !== undefined && statement.catches.length) {
            const clause = statement.catches[0]
            const caught = new Environment(environment)
            if (clause.identifier) caught.values.set(clause.identifier.name, { value: catchable, constant: true, initialized: true, declaredType: 'string' })
            try { executeBlock(clause.body, caught, false) } catch (handlerError) { pending = handlerError }
          } else pending = error
        }
        if (statement.finalizer) {
          try { executeBlock(statement.finalizer, environment) } catch (finalizerError) { pending = finalizerError }
        }
        if (pending !== undefined) throw pending
        return
      }
      case 'ThrowStatement': throw new LanguageThrowSignal(format(evaluate(statement.value, environment)))
      case 'MatchStatement': {
        const value = evaluate(statement.value, environment)
        const selected = statement.cases.find(clause => !clause.pattern || equalValues(value, evaluate(clause.pattern, environment)))
        if (selected) executeBlock(selected.body, environment)
        return
      }
      case 'WithStatement': {
        const resource = evaluate(statement.resource, environment)
        if (!isFile(resource)) return fail(statement, 'TYPE_MISMATCH', 'con solo acepta archivos abiertos con abrir().')
        const local = new Environment(environment)
        local.values.set(statement.identifier.name, { value: resource, constant: true, initialized: true, declaredType: 'file' })
        try { executeBlock(statement.body, local, false) } finally { resource.closed = true }
        return
      }
      case 'FunctionDeclaration': return
      case 'ClassDeclaration': return
      case 'ImportStatement': {
        if (!['matematicas', 'colecciones', 'iteracion', 'archivos'].includes(statement.moduleName)) {
          fail(statement, 'RUNTIME_ERROR', 'No existe el módulo integrado ' + statement.moduleName + '.')
        }
        environment.values.set(statement.alias, { value: { kind: 'module', name: statement.moduleName }, constant: true, initialized: true, declaredType: 'module' })
        return
      }
      case 'ReturnStatement': throw new ReturnSignal(evaluate(statement.value, environment))
      case 'OutputStatement': output.push(statement.arguments.map(argument => format(evaluate(argument, environment))).join(' ')); return
      case 'InputStatement': { evaluate(statement.call, environment); return }
      case 'ExpressionStatement': { evaluate(statement.expression, environment); return }
    }
  }

  for (const statement of program.statements) {
    if (statement.kind === 'ClassDeclaration') classes.set(statement.name.name, statement)
    if (statement.kind === 'FunctionDeclaration') {
      const overloads = functions.get(statement.name.name) ?? []
      overloads.push(statement)
      functions.set(statement.name.name, overloads)
    }
  }
  for (const statement of program.statements) {
    if (statement.kind === 'FunctionDeclaration' || statement.kind === 'ClassDeclaration') continue
    try { executeStatement(statement, globals) } catch (error) {
      const diagnostic = (error as { diagnostic?: RuntimeDiagnostic }).diagnostic
      if (diagnostic) diagnostics.push(diagnostic)
      else diagnostics.push({ code: 'RUNTIME_ERROR', message: error instanceof Error ? error.message : 'Error durante la ejecución.', line: statement.start.line, column: statement.start.column })
      stopped = true
    }
  }
  return {
    outputs: output,
    diagnostics,
    globals: [...globals.values].flatMap(([name, entry]) => entry.initialized && entry.value !== undefined
      ? [{ name, type: typeOf(entry.value), value: entry.value }]
      : []),
    steps,
  }
}
