import type { LexicalError } from '../core/errors/LexicalError'
import type { ProgramNode } from '../core/parser/Ast'
import type { SemanticError } from '../core/semantic/SemanticError'
import type { SemanticWarning } from '../core/semantic/SemanticError'
import type { SemanticMode } from '../core/semantic/SemanticAnalyzer'
import type { CorrectionSuggestion } from '../core/suggestions/CorrectionSuggestion'
import type { Token } from '../core/tokens/Token'
import type { LexicalSymbol } from '../core/symbols/LexicalSymbolTable'
import type { SemanticSymbol } from '../core/semantic/SemanticAnalyzer'

export interface AuthenticatedUser {
  id: string
  username: string
  displayName: string
}

export interface AnalysisSummary {
  tokens: number
  lexicalErrors: number
  syntaxErrors: number
  semanticErrors: number
}

export interface AnalysisSnapshot {
  tokens: Token[]
  lexicalSymbols: LexicalSymbol[]
  semanticSymbols: SemanticSymbol[]
  lexicalErrors: LexicalError[]
  syntaxErrors: Array<{
    kind: string
    message: string
    suggestion: string
    expected: string
    line: number
    column: number
    startIndex: number
    endIndex: number
  }>
  semanticErrors: SemanticError[]
  semanticWarnings?: SemanticWarning[]
  semanticMode?: SemanticMode
  warningsEnabled?: boolean
  semanticBlocked?: boolean
  suggestions: CorrectionSuggestion[]
  ast: ProgramNode | null
}

export interface SavedProgram {
  id: string
  userId: string
  title: string
  source: string
  kind: 'manual' | 'analysis'
  createdAt: string
  summary: AnalysisSummary
  analysis?: AnalysisSnapshot
}

export type ActivityType =
  | 'ACCOUNT_CREATED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'CODE_WRITTEN'
  | 'CODE_DELETED'
  | 'CODE_EDITED'
  | 'CODE_RESTORED'
  | 'CODE_EXPORTED'
  | 'CODE_IMPORTED'
  | 'HISTORY_EXPORTED'
  | 'LEXICAL_ANALYSIS'
  | 'SYNTAX_ANALYSIS'
  | 'SEMANTIC_ANALYSIS'
  | 'SUGGESTIONS_GENERATED'
  | 'CODE_SAVED'
  | 'CODE_LOADED'
  | 'AUTO_FIX_APPLIED'
  | 'ANALYSIS_STARTED'
  | 'ANALYSIS_STEP'
  | 'ANALYSIS_RESET'
  | 'ANALYSIS_PAUSED'
  | 'ANALYSIS_COMPLETED'

export interface ActivityLogEntry {
  id: string
  userId: string
  type: ActivityType
  detail: string
  createdAt: string
  sequence?: number
  before?: string
  after?: string
  metadata?: Record<string, unknown>
}

export interface ActivityDetails {
  before?: string
  after?: string
  metadata?: Record<string, unknown>
}

export interface LegacyMigrationBatch {
  programs: SavedProgram[]
  activities: ActivityLogEntry[]
  draft?: string
}

export interface MigrationResult {
  importedPrograms: number
  importedActivities: number
}

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

/** Todas las escrituras llegan al servidor; JSON elimina proxies reactivos de Vue. */
async function request<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Verifica que Docker esté en ejecución.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('El servidor devolvió una respuesta no válida.')
  }
  if (!response.ok) {
    const error = payload as { error?: unknown }
    throw new ApiRequestError(
      typeof error?.error === 'string' ? error.error : `Error del servidor (${response.status}).`,
      response.status,
    )
  }
  return payload as T
}

export const analyzerRepository = {
  async initialize(): Promise<void> {
    await request<{ ok: boolean }>('/api/health')
  },

  async register(username: string, displayName: string, password: string): Promise<AuthenticatedUser> {
    const result = await request<{ user: AuthenticatedUser }>('/api/register', 'POST', {
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
      password,
    })
    return result.user
  },

  async login(username: string, password: string): Promise<AuthenticatedUser | null> {
    try {
      const result = await request<{ user: AuthenticatedUser }>('/api/login', 'POST', {
        username: username.trim().toLowerCase(),
        password,
      })
      return result.user
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) return null
      throw error
    }
  },

  async currentUser(): Promise<AuthenticatedUser | null> {
    const result = await request<{ user: AuthenticatedUser | null }>('/api/session')
    return result.user
  },

  async logout(): Promise<void> {
    await request('/api/logout', 'POST')
  },

  async saveProgram(
    _userId: string,
    title: string,
    source: string,
    kind: SavedProgram['kind'],
    summary: AnalysisSummary,
    analysis?: AnalysisSnapshot,
  ): Promise<SavedProgram> {
    const result = await request<{ program: SavedProgram }>('/api/programs', 'POST', {
      title, source, kind, summary, analysis,
    })
    return result.program
  },

  async saveAnalysisSnapshot(userId: string, source: string, summary: AnalysisSummary, analysis: AnalysisSnapshot): Promise<SavedProgram> {
    return this.saveProgram(userId, '', source, 'analysis', summary, analysis)
  },

  async listPrograms(_userId: string): Promise<SavedProgram[]> {
    const result = await request<{ programs: SavedProgram[] }>('/api/programs')
    return result.programs
  },

  async log(_userId: string, type: ActivityType, detail: string, details: ActivityDetails = {}): Promise<ActivityLogEntry> {
    const result = await request<{ activity: ActivityLogEntry }>('/api/activities', 'POST', {
      type, detail, ...details,
    })
    return result.activity
  },

  async listActivities(_userId: string): Promise<ActivityLogEntry[]> {
    const result = await request<{ activities: ActivityLogEntry[] }>('/api/activities')
    return result.activities
  },

  async loadDraft(): Promise<string | null> {
    const result = await request<{ source: string | null }>('/api/draft')
    return result.source
  },

  async saveDraft(source: string): Promise<void> {
    await request('/api/draft', 'PUT', { source })
  },

  async migrate(batch: LegacyMigrationBatch): Promise<MigrationResult> {
    return request<MigrationResult>('/api/migrate', 'POST', batch)
  },
}
