import type { LexicalErrorType } from './LexicalErrorType'
export interface LexicalError { type: LexicalErrorType; message: string; lexeme: string; line: number; column: number; startIndex: number; endIndex: number }
