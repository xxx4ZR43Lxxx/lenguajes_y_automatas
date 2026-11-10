import { defineStore } from 'pinia'
import type { Token } from '../core/tokens/Token'
import type { LexicalError } from '../core/errors/LexicalError'
import type { Comment } from '../core/comments/Comment'
import type { LexerEvent } from '../core/events/LexerEvent'
import type { ProgramNode } from '../core/parser/Ast'
import type { SyntaxError } from '../core/parser/SyntaxError'
import type { SemanticError } from '../core/semantic/SemanticError'
import type { SemanticWarning } from '../core/semantic/SemanticError'
import type { SemanticSymbol } from '../core/semantic/SemanticAnalyzer'
import type { LexicalSymbol } from '../core/symbols/LexicalSymbolTable'
export const useDebuggerStore = defineStore('debugger', {
  state: () => ({ sourceCode: 'guarda edad = 20;\nsi (edad (+) 17) {\n  impresora(...Es mayor...);\n} sino {\n  impresora(...Es menor...);\n}\ntarea sumar(a, b) {\n  resultado mas(a, b);\n}', tokens: [] as Token[], symbolTable: [] as LexicalSymbol[], errors: [] as LexicalError[], syntaxErrors: [] as SyntaxError[], semanticErrors: [] as SemanticError[], semanticWarnings: [] as SemanticWarning[], semanticSymbols: [] as SemanticSymbol[], ast: null as ProgramNode | null, comments: [] as Comment[], currentIndex: 0, currentLine: 1, currentColumn: 1, currentCharacter: null as string|null, currentState: 'START', isRunning: false, isPaused: false, executionMode: 'full' as 'full'|'step', events: [] as LexerEvent[] }),
  actions: { clear() { this.tokens=[]; this.symbolTable=[]; this.errors=[]; this.syntaxErrors=[]; this.semanticErrors=[]; this.semanticWarnings=[]; this.semanticSymbols=[]; this.ast=null; this.comments=[]; this.events=[]; this.currentIndex=0; this.currentLine=1; this.currentColumn=1; this.currentCharacter=null; this.currentState='START'; this.isRunning=false; this.isPaused=false } }
})
