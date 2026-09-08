import type { TokenType } from './TokenType'

/** Token accepted by an explicit final state of the finite automaton. */
export interface Token {
  type: TokenType
  lexeme: string
  value: unknown
  finalState: string
  line: number
  column: number
  startIndex: number
  endIndex: number
}
