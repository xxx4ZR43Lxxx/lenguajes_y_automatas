export type SemanticErrorCode =
  | 'DUPLICATE_DECLARATION'
  | 'UNDECLARED_IDENTIFIER'
  | 'IMMUTABLE_ASSIGNMENT'
  | 'UNKNOWN_FUNCTION'
  | 'UNKNOWN_CLASS'
  | 'INVALID_INHERITANCE'
  | 'ARGUMENT_COUNT_MISMATCH'
  | 'AMBIGUOUS_FUNCTION_OVERLOAD'
  | 'TYPE_MISMATCH'
  | 'INVALID_LOGICAL_OPERAND'
  | 'NON_BOOLEAN_CONDITION'
  | 'INTEGER_OVERFLOW'
  | 'PARALLEL_TARGET_DUPLICATE'
  | 'INVALID_CONTROL_FLOW'

export type SemanticWarningCode =
  | 'UNINITIALIZED_VARIABLE'
  | 'UNUSED_VARIABLE'
  | 'UNUSED_FUNCTION'
  | 'UNREACHABLE_CODE'

interface SemanticDiagnosticBase {
  code: SemanticErrorCode | SemanticWarningCode
  message: string
  suggestion: string
  line: number
  column: number
  startIndex: number
  endIndex: number
}

export interface SemanticError extends SemanticDiagnosticBase {
  severity: 'error'
  code: SemanticErrorCode
}

export interface SemanticWarning extends SemanticDiagnosticBase {
  severity: 'warning'
  code: SemanticWarningCode
}

export type SemanticDiagnostic = SemanticError | SemanticWarning

