import { TokenType } from '../tokens/TokenType'

export const wordTypes: Record<string, TokenType> = {
  guarda: TokenType.KEYWORD_GUARDA,
  fijo: TokenType.KEYWORD_FIJO,
  simera: TokenType.KEYWORD_SIMERA,
  notons: TokenType.KEYWORD_NOTONS,
  recorre: TokenType.KEYWORD_RECORRE,
  chamba: TokenType.KEYWORD_CHAMBA,
  regresa: TokenType.KEYWORD_REGRESA,
  mas: TokenType.PLUS,
  menos: TokenType.MINUS,
  por: TokenType.MULTIPLY,
  entre: TokenType.DIVIDE,
  menor: TokenType.LESS,
  mayor: TokenType.GREATER,
  menor_igual: TokenType.LESS_EQUAL,
  mayor_igual: TokenType.GREATER_EQUAL,
  igual: TokenType.EQUAL,
  and: TokenType.LOGICAL_AND,
  or: TokenType.LOGICAL_OR,
  not: TokenType.LOGICAL_NOT,
  xor: TokenType.LOGICAL_XOR,
  xort: TokenType.LOGICAL_XORT,
  nand: TokenType.LOGICAL_NAND,
  nor: TokenType.LOGICAL_NOR,
  xnor: TokenType.LOGICAL_XNOR,
  impresora: TokenType.PRINT,
  teclado: TokenType.KEYBOARD_INPUT,
  arreglo: TokenType.ARRAY,
  vector: TokenType.VECTOR,
  lista: TokenType.LIST,
  matriz: TokenType.MATRIX,
}

export const delimiterTypes: Record<string, TokenType> = {
  '(': TokenType.LEFT_PAREN,
  ')': TokenType.RIGHT_PAREN,
  '{': TokenType.LEFT_BRACE,
  '}': TokenType.RIGHT_BRACE,
  '[': TokenType.LEFT_BRACKET,
  ']': TokenType.RIGHT_BRACKET,
  ';': TokenType.SEMICOLON,
  ',': TokenType.COMMA,
}

/** Palabras que convierten ¿ en cabecera sintáctica; en otros casos abre una cadena. */
export const statementWords: Record<string, true> = {
  guarda: true,
  fijo: true,
  simera: true,
  recorre: true,
  chamba: true,
}
