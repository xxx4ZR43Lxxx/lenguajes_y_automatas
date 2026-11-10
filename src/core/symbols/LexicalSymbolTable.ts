import type { Token } from '../tokens/Token'
import { TokenType } from '../tokens/TokenType'

export interface LexicalSymbolOccurrence {
  line: number
  column: number
  startIndex: number
  endIndex: number
}

/** Identificador descubierto por el lexer y todas sus apariciones en el código. */
export interface LexicalSymbol {
  name: string
  tokenType: TokenType
  occurrences: LexicalSymbolOccurrence[]
}

export type LexicalSymbolTable = LexicalSymbol[]

export const isIdentifierTokenType = (type: TokenType): boolean =>
  type === TokenType.IDENTIFIER ||
  type === TokenType.DOLLAR_VARIABLE ||
  type === TokenType.BRACKETED_VARIABLE

export function buildLexicalSymbolTable(tokens: Token[]): LexicalSymbolTable {
  const symbols = new Map<string, LexicalSymbol>()
  for (const token of tokens) {
    if (!isIdentifierTokenType(token.type)) continue
    const key = `${token.type}\u0000${token.lexeme}`
    let symbol = symbols.get(key)
    if (!symbol) {
      symbol = { name: token.lexeme, tokenType: token.type, occurrences: [] }
      symbols.set(key, symbol)
    }
    symbol.occurrences.push({
      line: token.line,
      column: token.column,
      startIndex: token.startIndex,
      endIndex: token.endIndex,
    })
  }
  return [...symbols.values()]
}
