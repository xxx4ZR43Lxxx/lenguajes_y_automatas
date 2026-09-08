import type { Token } from '../tokens/Token'
import type { LexicalError } from '../errors/LexicalError'
export type LexerEventType = 'CHAR_READ'|'STATE_CHANGED'|'TOKEN_CREATED'|'LEXICAL_ERROR'|'COMMENT_STARTED'|'COMMENT_ENDED'|'COMMENT_SKIPPED'|'EOF_REACHED'
export interface LexerEvent { type: LexerEventType; index: number; line: number; column: number; character?: string; state?: string; token?: Token; error?: LexicalError }
export type LexerListener = (event: LexerEvent) => void
