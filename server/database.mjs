import { pbkdf2Sync, randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { languageExamples } from '../src/core/language/examples.ts'

const SESSION_DAYS = 7
const HASH_ITERATIONS = 210_000
const DEMO_USERS = [
  { id: 'demo-ana', username: 'ana', displayName: 'Ana Torres', password: '1234' },
  { id: 'demo-luis', username: 'luis', displayName: 'Luis Pérez', password: '1234' },
]

function passwordDigest(password, salt) {
  return pbkdf2Sync(password, salt, HASH_ITERATIONS, 32, 'sha256')
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function publicUser(row) {
  return { id: row.id, username: row.username, displayName: row.display_name }
}

function parseProgram(row) {
  const program = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    source: row.source,
    kind: row.kind,
    createdAt: row.created_at,
    summary: JSON.parse(row.summary_json),
  }
  if (row.analysis_json !== null) program.analysis = JSON.parse(row.analysis_json)
  return program
}

function parseActivity(row) {
  const activity = {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    detail: row.detail,
    createdAt: row.created_at,
    sequence: row.sequence,
  }
  if (row.before_source !== null) activity.before = row.before_source
  if (row.after_source !== null) activity.after = row.after_source
  if (row.metadata_json !== null) activity.metadata = JSON.parse(row.metadata_json)
  return activity
}

export function openAnalyzerDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true })
  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      next_activity_sequence INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('manual', 'analysis')),
      created_at TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      analysis_json TEXT
    );
    CREATE INDEX IF NOT EXISTS programs_by_user ON programs(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL,
      before_source TEXT,
      after_source TEXT,
      metadata_json TEXT,
      UNIQUE(user_id, sequence)
    );
    CREATE INDEX IF NOT EXISTS activities_by_user_date ON activities(user_id, created_at DESC, sequence DESC);
    CREATE TABLE IF NOT EXISTS drafts (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS migrated_records (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_kind TEXT NOT NULL CHECK (record_kind IN ('program', 'activity')),
      legacy_id TEXT NOT NULL,
      new_id TEXT NOT NULL,
      PRIMARY KEY(user_id, record_kind, legacy_id)
    );
  `)

  const selectByUsername = db.prepare('SELECT * FROM users WHERE username = ?')
  const insertUser = db.prepare('INSERT INTO users (id, username, display_name, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  const insertSession = db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
  const selectSession = db.prepare(`
    SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `)
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?')
  const selectSequence = db.prepare('SELECT next_activity_sequence FROM users WHERE id = ?')
  const advanceSequence = db.prepare('UPDATE users SET next_activity_sequence = next_activity_sequence + 1 WHERE id = ?')
  const insertActivityRow = db.prepare(`
    INSERT INTO activities (id, user_id, sequence, type, detail, created_at, before_source, after_source, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const selectActivities = db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY created_at DESC, sequence DESC')
  const insertProgram = db.prepare(`
    INSERT INTO programs (id, user_id, title, source, kind, created_at, summary_json, analysis_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const selectPrograms = db.prepare('SELECT * FROM programs WHERE user_id = ? ORDER BY created_at DESC, rowid DESC')
  const selectProgramById = db.prepare('SELECT id FROM programs WHERE id = ?')
  const selectDraft = db.prepare('SELECT source FROM drafts WHERE user_id = ?')
  const upsertDraft = db.prepare(`
    INSERT INTO drafts (user_id, source, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET source = excluded.source, updated_at = excluded.updated_at
  `)
  const selectMigrated = db.prepare('SELECT 1 FROM migrated_records WHERE user_id = ? AND record_kind = ? AND legacy_id = ?')
  const insertMigrated = db.prepare('INSERT INTO migrated_records (user_id, record_kind, legacy_id, new_id) VALUES (?, ?, ?, ?)')
  const codeChangingTypes = new Set([
    'CODE_WRITTEN', 'CODE_DELETED', 'CODE_EDITED', 'CODE_LOADED',
    'CODE_IMPORTED', 'CODE_RESTORED', 'AUTO_FIX_APPLIED',
  ])

  function transaction(action) {
    db.exec('BEGIN IMMEDIATE')
    try {
      const value = action()
      db.exec('COMMIT')
      return value
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  function insertActivity(userId, { type, detail, before, after, metadata, createdAt }) {
    const sequence = selectSequence.get(userId)?.next_activity_sequence
    if (sequence === undefined) throw new Error('Usuario no encontrado para registrar actividad.')
    const activity = {
      id: randomUUID(),
      userId,
      sequence,
      type,
      detail,
      createdAt: createdAt ?? new Date().toISOString(),
    }
    if (before !== undefined) activity.before = before
    if (after !== undefined) activity.after = after
    if (metadata !== undefined) activity.metadata = metadata
    advanceSequence.run(userId)
    insertActivityRow.run(
      activity.id, userId, sequence, type, detail, activity.createdAt,
      before ?? null, after ?? null, metadata === undefined ? null : JSON.stringify(metadata),
    )
    return activity
  }

  function createSession(userId) {
    const token = randomBytes(32).toString('base64url')
    const now = new Date()
    const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    insertSession.run(hashToken(token), userId, now.toISOString(), expires.toISOString())
    return token
  }

  // The seeded accounts are a classroom convenience; registered accounts use the same salted hash.
  for (const demo of DEMO_USERS) {
    if (selectByUsername.get(demo.username)) continue
    const salt = randomBytes(16).toString('hex')
    insertUser.run(
      demo.id, demo.username, demo.displayName, salt,
      passwordDigest(demo.password, Buffer.from(salt, 'hex')).toString('hex'),
      new Date().toISOString(),
    )
  }

  // Keep the classroom catalog in both demo galleries. Stable IDs make this
  // safe to run every time the server starts, including against an old volume.
  for (const demo of DEMO_USERS) {
    const user = selectByUsername.get(demo.username)
    if (!user) continue
    transaction(() => {
      languageExamples.forEach((example, index) => {
        const id = `example-${createHash('sha256').update(`${user.id}:${example.title}`).digest('hex').slice(0, 32)}`
        if (selectProgramById.get(id)) return
        const createdAt = new Date().toISOString()
        const summary = { tokens: 0, lexicalErrors: 0, syntaxErrors: 0, semanticErrors: 0 }
        insertProgram.run(id, user.id, example.title, example.source, 'manual', createdAt, JSON.stringify(summary), null)
        insertActivity(user.id, {
          type: 'CODE_SAVED',
          detail: `Se agregó el ejemplo '${example.title}' a la galería de demostración.`,
          after: example.source,
          metadata: { programId: id, title: example.title, kind: 'manual', example: true, order: index + 1 },
        })
      })
    })
  }

  return {
    close() { db.close() },

    register({ username, displayName, password }) {
      if (selectByUsername.get(username)) return null
      const userId = randomUUID()
      const salt = randomBytes(16).toString('hex')
      const digest = passwordDigest(password, Buffer.from(salt, 'hex')).toString('hex')
      return transaction(() => {
        insertUser.run(userId, username, displayName, salt, digest, new Date().toISOString())
        const token = createSession(userId)
        insertActivity(userId, { type: 'ACCOUNT_CREATED', detail: `Se creó la cuenta @${username}.` })
        insertActivity(userId, { type: 'LOGIN', detail: `Inicio de sesión de @${username}.`, metadata: { username } })
        return { user: { id: userId, username, displayName }, token }
      })
    },

    login(username, password) {
      const row = selectByUsername.get(username)
      const salt = row ? Buffer.from(row.password_salt, 'hex') : Buffer.alloc(16)
      const actual = passwordDigest(password, salt)
      const expected = row ? Buffer.from(row.password_hash, 'hex') : Buffer.alloc(32)
      if (!row || expected.length !== actual.length || !timingSafeEqual(actual, expected)) return null
      return transaction(() => {
        const token = createSession(row.id)
        insertActivity(row.id, { type: 'LOGIN', detail: `Inicio de sesión de @${row.username}.`, metadata: { username: row.username } })
        return { user: publicUser(row), token }
      })
    },

    session(token) {
      if (!token) return null
      const row = selectSession.get(hashToken(token), new Date().toISOString())
      return row ? publicUser(row) : null
    },

    logout(token, user) {
      if (!token || !user) return
      transaction(() => {
        deleteSession.run(hashToken(token))
        insertActivity(user.id, { type: 'LOGOUT', detail: `Cierre de sesión de @${user.username}.`, metadata: { username: user.username } })
      })
    },

    listPrograms(userId) {
      return selectPrograms.all(userId).map(parseProgram)
    },

    saveProgram(userId, { title, source, kind, summary, analysis }) {
      const program = {
        id: randomUUID(),
        userId,
        title: title.trim() || (kind === 'manual' ? 'Código sin título' : `Prueba ${new Date().toLocaleString('es-MX')}`),
        source,
        kind,
        createdAt: new Date().toISOString(),
        summary,
      }
      if (analysis !== undefined) program.analysis = analysis
      const activity = transaction(() => {
        insertProgram.run(
          program.id, userId, program.title, source, kind, program.createdAt,
          JSON.stringify(summary), analysis === undefined ? null : JSON.stringify(analysis),
        )
        if (selectDraft.get(userId) === undefined) upsertDraft.run(userId, source, program.createdAt)
        const savedActivity = insertActivity(userId, {
          type: 'CODE_SAVED',
          detail: kind === 'analysis'
            ? `Se guardó automáticamente '${program.title}' antes de registrar el análisis.`
            : `Se guardó '${program.title}' en la galería personal.`,
          after: source,
          metadata: { programId: program.id, title: program.title, kind },
        })
        if (kind === 'analysis') {
          const metadata = { programId: program.id, title: program.title }
          insertActivity(userId, {
            type: 'LEXICAL_ANALYSIS',
            detail: `${summary.tokens} token(s) y ${summary.lexicalErrors} error(es) léxico(s).`,
            metadata: { ...metadata, tokens: summary.tokens, errors: analysis.lexicalErrors },
          })
          insertActivity(userId, {
            type: 'SYNTAX_ANALYSIS',
            detail: summary.lexicalErrors
              ? 'Análisis sintáctico omitido por un error léxico.'
              : `${summary.syntaxErrors} error(es) sintáctico(s) detectado(s).`,
            metadata: { ...metadata, status: summary.lexicalErrors ? 'omitted' : 'completed', errors: analysis.syntaxErrors },
          })
          insertActivity(userId, {
            type: 'SEMANTIC_ANALYSIS',
            detail: summary.lexicalErrors
              ? 'Análisis semántico omitido por un error léxico.'
              : `${summary.semanticErrors} error(es) semántico(s) detectado(s).`,
            metadata: { ...metadata, status: summary.lexicalErrors ? 'omitted' : 'completed', errors: analysis.semanticErrors },
          })
          insertActivity(userId, {
            type: 'SUGGESTIONS_GENERATED',
            detail: `${analysis.suggestions.length} sugerencia(s) de corrección disponible(s).`,
            metadata: { ...metadata, suggestions: analysis.suggestions },
          })
        }
        return savedActivity
      })
      return { program, activity }
    },

    listActivities(userId) {
      return selectActivities.all(userId).map(parseActivity)
    },

    logActivity(userId, details) {
      return transaction(() => {
        const activity = insertActivity(userId, details)
        if (codeChangingTypes.has(details.type) && typeof details.after === 'string') {
          upsertDraft.run(userId, details.after, activity.createdAt)
        }
        return activity
      })
    },

    draft(userId) {
      return selectDraft.get(userId)?.source ?? null
    },

    saveDraft(userId, source) {
      upsertDraft.run(userId, source, new Date().toISOString())
      return source
    },

    migrate(userId, { programs, activities, draft }) {
      return transaction(() => {
        let importedPrograms = 0
        let importedActivities = 0
        for (const legacy of programs) {
          if (selectMigrated.get(userId, 'program', legacy.id)) continue
          const id = randomUUID()
          insertProgram.run(
            id, userId, legacy.title, legacy.source, legacy.kind,
            legacy.createdAt, JSON.stringify(legacy.summary),
            legacy.analysis === undefined ? null : JSON.stringify(legacy.analysis),
          )
          insertMigrated.run(userId, 'program', legacy.id, id)
          importedPrograms += 1
        }
        const chronological = [...activities].sort((first, second) => {
          if (Number.isInteger(first.sequence) && Number.isInteger(second.sequence)) {
            return first.sequence - second.sequence
          }
          return first.createdAt.localeCompare(second.createdAt)
        })
        for (const legacy of chronological) {
          if (selectMigrated.get(userId, 'activity', legacy.id)) continue
          const metadata = {
            ...(legacy.metadata ?? {}),
            legacyId: legacy.id,
            ...(legacy.sequence === undefined ? {} : { legacySequence: legacy.sequence }),
          }
          const imported = insertActivity(userId, { ...legacy, metadata })
          insertMigrated.run(userId, 'activity', legacy.id, imported.id)
          importedActivities += 1
        }
        if (draft !== undefined && selectDraft.get(userId) === undefined) {
          upsertDraft.run(userId, draft, new Date().toISOString())
        }
        return { importedPrograms, importedActivities }
      })
    },
  }
}
