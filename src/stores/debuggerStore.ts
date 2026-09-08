import { defineStore } from 'pinia'
import type { Token } from '../core/tokens/Token'
import type { LexicalError } from '../core/errors/LexicalError'
import type { Comment } from '../core/comments/Comment'
import type { LexerEvent } from '../core/events/LexerEvent'
import type { ProgramNode } from '../core/parser/Ast'
import type { SyntaxError } from '../core/parser/SyntaxError'
export const useDebuggerStore = defineStore('debugger', {
  state: () => ({ sourceCode: '¿ guarda edad = 20;\n¿ simera ( edad mayor 17 ) {\n  ¿ guarda mensaje = ¿Es mayor?;\n}\n¿ chamba sumar(a, b) {\n  regresa mas(a, b);\n}', tokens: [] as Token[], errors: [] as LexicalError[], syntaxErrors: [] as SyntaxError[], ast: null as ProgramNode | null, comments: [] as Comment[], currentIndex: 0, currentLine: 1, currentColumn: 1, currentCharacter: null as string|null, currentState: 'START', isRunning: false, isPaused: false, executionMode: 'full' as 'full'|'step', events: [] as LexerEvent[] }),
  actions: { clear() { this.tokens=[]; this.errors=[]; this.syntaxErrors=[]; this.ast=null; this.comments=[]; this.events=[]; this.currentIndex=0; this.currentLine=1; this.currentColumn=1; this.currentCharacter=null; this.currentState='START'; this.isRunning=false; this.isPaused=false } }
})
