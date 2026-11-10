import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openAnalyzerDatabase } from './database.mjs'

const COOKIE_NAME = 'analyzer_session'
const MAX_BODY_BYTES = 20 * 1024 * 1024
const MAX_SOURCE_LENGTH = 100_000
const ACTIVITY_TYPES = new Set([
  'ACCOUNT_CREATED', 'LOGIN', 'LOGOUT', 'CODE_WRITTEN', 'CODE_DELETED',
  'CODE_EDITED', 'CODE_RESTORED', 'CODE_EXPORTED', 'CODE_IMPORTED',
  'HISTORY_EXPORTED', 'LEXICAL_ANALYSIS', 'SYNTAX_ANALYSIS',
  'SEMANTIC_ANALYSIS', 'SUGGESTIONS_GENERATED', 'CODE_SAVED',
  'CODE_LOADED', 'AUTO_FIX_APPLIED', 'ANALYSIS_STARTED',
  'ANALYSIS_STEP', 'ANALYSIS_RESET', 'ANALYSIS_PAUSED', 'ANALYSIS_COMPLETED',
])
const AUTH_ACTIVITY_TYPES = new Set(['ACCOUNT_CREATED', 'LOGIN', 'LOGOUT'])
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function assert(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value, label, maximum, { allowEmpty = false } = {}) {
  assert(typeof value === 'string', `${label} debe ser texto.`)
  assert(value.length <= maximum, `${label} supera el límite de ${maximum} caracteres.`)
  assert(allowEmpty || value.trim().length > 0, `${label} es obligatorio.`)
  return value
}

function optionalString(value, label, maximum) {
  if (value === undefined) return undefined
  return requiredString(value, label, maximum, { allowEmpty: true })
}

function usernameValue(value) {
  const username = requiredString(value, 'El usuario', 30).trim().toLowerCase()
  assert(/^[a-z0-9_.-]{3,30}$/.test(username), 'El usuario debe tener de 3 a 30 caracteres: letras, números, _, . o -.')
  return username
}

function summaryValue(value) {
  assert(isObject(value), 'El resumen del análisis es obligatorio.')
  const summary = {}
  for (const field of ['tokens', 'lexicalErrors', 'syntaxErrors', 'semanticErrors']) {
    assert(Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= 1_000_000,
      `El campo ${field} del resumen debe ser un entero no negativo.`)
    summary[field] = value[field]
  }
  return summary
}

function dateValue(value) {
  assert(typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)), 'La fecha del registro es inválida.')
  return value
}

function programValue(value, { legacy = false } = {}) {
  assert(isObject(value), 'El código guardado debe ser un objeto.')
  const program = {
    title: requiredString(value.title, 'El título', 120, { allowEmpty: true }),
    source: requiredString(value.source, 'El código', MAX_SOURCE_LENGTH, { allowEmpty: true }),
    kind: value.kind,
    summary: summaryValue(value.summary),
  }
  assert(program.kind === 'manual' || program.kind === 'analysis', 'El tipo de código debe ser manual o analysis.')
  if (value.analysis !== undefined && value.analysis !== null) {
    assert(isObject(value.analysis), 'El análisis debe ser un objeto.')
    program.analysis = value.analysis
  }
  if (!legacy && program.kind === 'analysis') {
    assert(isObject(program.analysis), 'El resultado del análisis es obligatorio.')
    for (const field of ['lexicalErrors', 'syntaxErrors', 'semanticErrors', 'suggestions']) {
      assert(Array.isArray(program.analysis[field]), `El campo ${field} del análisis debe ser una lista.`)
    }
  }
  if (legacy) {
    program.id = requiredString(value.id, 'El ID anterior', 200)
    program.createdAt = dateValue(value.createdAt)
  }
  return program
}

function activityValue(value, { legacy = false } = {}) {
  assert(isObject(value), 'La actividad debe ser un objeto.')
  const type = requiredString(value.type, 'El tipo de actividad', 60)
  assert(ACTIVITY_TYPES.has(type), 'El tipo de actividad no está permitido.')
  if (!legacy) assert(!AUTH_ACTIVITY_TYPES.has(type), 'Los eventos de autenticación se registran en el servidor.')
  const activity = {
    type,
    detail: requiredString(value.detail, 'El detalle', 2_000),
  }
  const before = optionalString(value.before, 'El código anterior', MAX_SOURCE_LENGTH)
  const after = optionalString(value.after, 'El código nuevo', MAX_SOURCE_LENGTH)
  if (before !== undefined) activity.before = before
  if (after !== undefined) activity.after = after
  if (value.metadata !== undefined && value.metadata !== null) {
    assert(isObject(value.metadata), 'Los metadatos deben ser un objeto.')
    activity.metadata = value.metadata
  }
  if (legacy) {
    activity.id = requiredString(value.id, 'El ID anterior', 200)
    activity.createdAt = dateValue(value.createdAt)
    if (value.sequence !== undefined) {
      assert(Number.isInteger(value.sequence) && value.sequence > 0, 'La secuencia anterior es inválida.')
      activity.sequence = value.sequence
    }
  }
  return activity
}

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(body)
}

async function readJson(req) {
  assert(req.headers['content-type']?.toLowerCase().startsWith('application/json'), 'Se requiere Content-Type: application/json.', 415)
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    assert(bytes <= MAX_BODY_BYTES, 'La solicitud supera el límite de 20 MiB.', 413)
    chunks.push(chunk)
  }
  let value
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'El cuerpo de la solicitud no contiene JSON válido.')
  }
  assert(isObject(value), 'El cuerpo de la solicitud debe ser un objeto JSON.')
  return value
}

function sessionCookie(req) {
  const raw = req.headers.cookie ?? ''
  for (const pair of raw.split(';')) {
    const [name, ...parts] = pair.trim().split('=')
    if (name === COOKIE_NAME) return parts.join('=')
  }
  return null
}

function cookieHeader(token, req) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${req.socket.encrypted ? '; Secure' : ''}`
}

function clearCookieHeader(req) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${req.socket.encrypted ? '; Secure' : ''}`
}

async function serveStatic(req, res, pathname, distDir) {
  assert(req.method === 'GET' || req.method === 'HEAD', 'Método no permitido.', 405)
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    throw new HttpError(400, 'Ruta inválida.')
  }
  const candidate = resolve(distDir, `.${decoded === '/' ? '/index.html' : decoded}`)
  const rel = relative(distDir, candidate)
  assert(rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(rel), 'Ruta inválida.', 403)
  let path = candidate
  let info = await stat(path).catch(() => null)
  if (!info?.isFile() && req.headers.accept?.includes('text/html')) {
    path = resolve(distDir, 'index.html')
    info = await stat(path).catch(() => null)
  }
  if (!info?.isFile()) throw new HttpError(404, 'Recurso no encontrado. Ejecuta npm run build para generar la interfaz.')
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': info.size,
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') { res.end(); return }
  createReadStream(path).pipe(res)
}

export function createAnalyzerServer({ databasePath, distDir } = {}) {
  const resolvedDatabasePath = resolve(databasePath ?? process.env.DATABASE_PATH ?? process.env.ANALYZER_DB_PATH ?? 'data/analizador.sqlite')
  const resolvedDistDir = resolve(distDir ?? fileURLToPath(new URL('../dist', import.meta.url)))
  const database = openAnalyzerDatabase(resolvedDatabasePath)
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const path = url.pathname
      if (path === '/api/health' && req.method === 'GET') {
        json(res, 200, { ok: true, storage: 'sqlite' })
        return
      }
      if (path === '/api/session' && req.method === 'GET') {
        json(res, 200, { user: database.session(sessionCookie(req)) })
        return
      }
      if (path === '/api/register' && req.method === 'POST') {
        const body = await readJson(req)
        const username = usernameValue(body.username)
        const displayName = requiredString(body.displayName, 'El nombre visible', 80).trim()
        const password = requiredString(body.password, 'La contraseña', 128)
        assert(password.length >= 8, 'La contraseña debe tener al menos 8 caracteres.')
        const result = database.register({ username, displayName, password })
        assert(result, 'Ese nombre de usuario ya está registrado.', 409)
        json(res, 201, { user: result.user }, { 'Set-Cookie': cookieHeader(result.token, req) })
        return
      }
      if (path === '/api/login' && req.method === 'POST') {
        const body = await readJson(req)
        const username = usernameValue(body.username)
        const password = requiredString(body.password, 'La contraseña', 128)
        const result = database.login(username, password)
        assert(result, 'Usuario o contraseña incorrectos.', 401)
        json(res, 200, { user: result.user }, { 'Set-Cookie': cookieHeader(result.token, req) })
        return
      }
      if (path === '/api/logout' && req.method === 'POST') {
        const token = sessionCookie(req)
        const user = database.session(token)
        database.logout(token, user)
        json(res, 200, { ok: true }, { 'Set-Cookie': clearCookieHeader(req) })
        return
      }
      if (path.startsWith('/api/')) {
        const token = sessionCookie(req)
        const user = database.session(token)
        assert(user, 'Inicia sesión para continuar.', 401)

        if (path === '/api/programs' && req.method === 'GET') {
          json(res, 200, { programs: database.listPrograms(user.id) })
          return
        }
        if (path === '/api/programs' && req.method === 'POST') {
          const program = programValue(await readJson(req))
          json(res, 201, database.saveProgram(user.id, program))
          return
        }
        if (path === '/api/activities' && req.method === 'GET') {
          json(res, 200, { activities: database.listActivities(user.id) })
          return
        }
        if (path === '/api/activities' && req.method === 'POST') {
          const activity = activityValue(await readJson(req))
          json(res, 201, { activity: database.logActivity(user.id, activity) })
          return
        }
        if (path === '/api/draft' && req.method === 'GET') {
          json(res, 200, { source: database.draft(user.id) })
          return
        }
        if (path === '/api/draft' && req.method === 'PUT') {
          const body = await readJson(req)
          const source = requiredString(body.source, 'El código', MAX_SOURCE_LENGTH, { allowEmpty: true })
          json(res, 200, { source: database.saveDraft(user.id, source) })
          return
        }
        if (path === '/api/migrate' && req.method === 'POST') {
          const body = await readJson(req)
          assert(Array.isArray(body.programs) && body.programs.length <= 100, 'Envía hasta 100 programas por lote.')
          assert(Array.isArray(body.activities) && body.activities.length <= 500, 'Envía hasta 500 actividades por lote.')
          const programs = body.programs.map(value => programValue(value, { legacy: true }))
          const activities = body.activities.map(value => activityValue(value, { legacy: true }))
          const draft = optionalString(body.draft, 'El borrador', MAX_SOURCE_LENGTH)
          json(res, 200, database.migrate(user.id, { programs, activities, draft }))
          return
        }
        throw new HttpError(404, 'Ruta de API no encontrada.')
      }
      await serveStatic(req, res, path, resolvedDistDir)
    } catch (error) {
      if (res.headersSent) { res.destroy(error); return }
      if (error instanceof HttpError) {
        json(res, error.status, { error: error.message })
      } else {
        console.error('Error del servidor:', error)
        json(res, 500, { error: 'Ocurrió un error interno del servidor.' })
      }
    }
  })
  server.on('close', () => database.close())
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un puerto válido.')
  createAnalyzerServer().listen(port, '0.0.0.0', () => {
    console.log(`Analizador disponible en http://0.0.0.0:${port}`)
  })
}
