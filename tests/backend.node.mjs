import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { openAnalyzerDatabase } from '../server/database.mjs'
import { createAnalyzerServer } from '../server/index.mjs'

async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), 'analyzer-backend-'))
  const databasePath = join(folder, 'analizador.sqlite')
  const distDir = join(folder, 'dist')
  mkdirSync(distDir)
  writeFileSync(join(distDir, 'index.html'), '<h1>Analizador</h1>')
  const server = createAnalyzerServer({ databasePath, distDir })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    await new Promise(resolve => server.close(resolve))
    rmSync(folder, { recursive: true, force: true })
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  async function request(path, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return {
      status: response.status,
      body: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text(),
      cookie: response.headers.get('set-cookie')?.split(';')[0],
    }
  }
  return { databasePath, origin, request }
}

test('registra usuarios, autentica con cookie y conserva contraseñas con hash', async t => {
  const { databasePath, request } = await fixture(t)
  const created = await request('/api/register', {
    method: 'POST',
    body: { username: 'MARTA', displayName: 'Marta López', password: 'segura-123' },
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.user.username, 'marta')
  assert.match(created.cookie, /^analyzer_session=/)
  assert.equal((await request('/api/session', { cookie: created.cookie })).body.user.id, created.body.user.id)
  assert.equal((await request('/api/register', {
    method: 'POST', body: { username: 'marta', displayName: 'Otra', password: 'segura-123' },
  })).status, 409)

  const sql = new DatabaseSync(databasePath)
  const stored = sql.prepare('SELECT password_salt, password_hash FROM users WHERE username = ?').get('marta')
  assert.notEqual(stored.password_hash, 'segura-123')
  assert.equal(stored.password_salt.length, 32)
  sql.close()

  assert.equal((await request('/api/login', { method: 'POST', body: { username: 'marta', password: 'incorrecta' } })).status, 401)
  assert.equal((await request('/api/logout', { method: 'POST', cookie: created.cookie })).status, 200)
  assert.equal((await request('/api/session', { cookie: created.cookie })).body.user, null)
  const login = await request('/api/login', { method: 'POST', body: { username: 'marta', password: 'segura-123' } })
  assert.equal(login.status, 200)
  const types = (await request('/api/activities', { cookie: login.cookie })).body.activities.map(entry => entry.type)
  assert.deepEqual(types, ['LOGIN', 'LOGOUT', 'LOGIN', 'ACCOUNT_CREATED'])
})

test('galería, borrador y bitácora quedan aislados por cuenta', async t => {
  const { request } = await fixture(t)
  const ana = await request('/api/login', { method: 'POST', body: { username: 'ana', password: '1234' } })
  const luis = await request('/api/login', { method: 'POST', body: { username: 'luis', password: '1234' } })
  const summary = { tokens: 3, lexicalErrors: 0, syntaxErrors: 0, semanticErrors: 0 }
  const snapshot = {
    tokens: [{ type: 'WORD', lexeme: 'hola' }],
    lexicalErrors: [], syntaxErrors: [], semanticErrors: [], suggestions: [],
    ast: { kind: 'Program' },
  }
  const saved = await request('/api/programs', {
    method: 'POST', cookie: ana.cookie,
    body: { userId: 'demo-luis', title: 'Prueba', source: 'hola', kind: 'analysis', summary, analysis: snapshot },
  })
  assert.equal(saved.status, 201)
  assert.equal(saved.body.program.userId, 'demo-ana')
  assert.deepEqual(saved.body.program.analysis, snapshot)
  assert.equal(saved.body.activity.type, 'CODE_SAVED')
  assert.equal(saved.body.activity.metadata.programId, saved.body.program.id)
  assert.equal(saved.body.activity.after, 'hola')
  const analysisTypes = (await request('/api/activities', { cookie: ana.cookie })).body.activities.map(entry => entry.type)
  assert.deepEqual(analysisTypes.slice(0, 5), [
    'SUGGESTIONS_GENERATED', 'SEMANTIC_ANALYSIS', 'SYNTAX_ANALYSIS', 'LEXICAL_ANALYSIS', 'CODE_SAVED',
  ])
  const edit = await request('/api/activities', {
    method: 'POST', cookie: ana.cookie,
    body: { userId: 'demo-luis', type: 'CODE_EDITED', detail: 'Se escribió hola.', before: '', after: 'hola', metadata: { lines: [1] } },
  })
  assert.equal(edit.status, 201)
  assert.equal(edit.body.activity.userId, 'demo-ana')
  assert.equal((await request('/api/draft', { cookie: ana.cookie })).body.source, 'hola')
  assert.equal((await request('/api/draft', { cookie: luis.cookie })).body.source, null)
  const luisPrograms = (await request('/api/programs', { cookie: luis.cookie })).body.programs
  assert.equal(luisPrograms.some(program => program.id === saved.body.program.id), false)
  const luisActivities = (await request('/api/activities', { cookie: luis.cookie })).body.activities
  assert.equal(luisActivities.some(activity => activity.id === edit.body.activity.id), false)
  assert.equal((await request('/api/programs')).status, 401)
  assert.equal((await request('/api/activities', {
    method: 'POST', cookie: ana.cookie, body: { type: 'LOGIN', detail: 'falso' },
  })).status, 400)
})

test('migra lotes anteriores una sola vez y preserva fechas y orden', async t => {
  const { request } = await fixture(t)
  const session = await request('/api/register', {
    method: 'POST', body: { username: 'migrado', displayName: 'Migrado', password: 'segura-123' },
  })
  const payload = {
    programs: [{ id: 'old-program', userId: 'otro', title: 'Antiguo', source: 'a=1', kind: 'manual',
      createdAt: '2026-09-10T00:00:00.000Z', summary: { tokens: 1, lexicalErrors: 0, syntaxErrors: 0, semanticErrors: 0 } }],
    activities: [
      { id: 'old-two', userId: 'otro', type: 'CODE_EDITED', detail: 'Segunda edición', after: 'a=1',
        sequence: 2, createdAt: '2026-09-10T00:01:00.000Z' },
      { id: 'old-one', userId: 'otro', type: 'CODE_WRITTEN', detail: 'Primera edición', after: 'a',
        sequence: 1, createdAt: '2026-09-10T00:00:00.000Z' },
    ],
    draft: 'a=1',
  }
  const first = await request('/api/migrate', { method: 'POST', cookie: session.cookie, body: payload })
  assert.equal(first.status, 200)
  assert.deepEqual(first.body, { importedPrograms: 1, importedActivities: 2 })
  const second = await request('/api/migrate', { method: 'POST', cookie: session.cookie, body: payload })
  assert.deepEqual(second.body, { importedPrograms: 0, importedActivities: 0 })
  const activities = (await request('/api/activities', { cookie: session.cookie })).body.activities
  assert.equal(activities[0].type, 'LOGIN')
  const imported = activities.filter(activity => activity.metadata?.legacyId)
  assert.equal(imported[0].detail, 'Segunda edición')
  assert.equal(imported[1].detail, 'Primera edición')
  assert.equal(imported[0].createdAt, '2026-09-10T00:01:00.000Z')
  assert.equal(imported[0].metadata.legacyId, 'old-two')
  assert.equal((await request('/api/programs', { cookie: session.cookie })).body.programs[0].createdAt, '2026-09-10T00:00:00.000Z')
  assert.equal((await request('/api/draft', { cookie: session.cookie })).body.source, 'a=1')
})

test('los datos y la sesión sobreviven al reiniciar el proceso', t => {
  const folder = mkdtempSync(join(tmpdir(), 'analyzer-restart-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const databasePath = join(folder, 'analizador.sqlite')
  const first = openAnalyzerDatabase(databasePath)
  const created = first.register({ username: 'persistente', displayName: 'Persistente', password: 'segura-123' })
  first.logActivity(created.user.id, { type: 'CODE_WRITTEN', detail: 'Código escrito.', after: 'guarda x = 1;' })
  first.saveProgram(created.user.id, {
    title: 'Ejemplo', source: 'guarda x = 1;', kind: 'manual',
    summary: { tokens: 4, lexicalErrors: 0, syntaxErrors: 0, semanticErrors: 0 },
  })
  first.close()

  const second = openAnalyzerDatabase(databasePath)
  assert.equal(second.session(created.token)?.username, 'persistente')
  assert.equal(second.draft(created.user.id), 'guarda x = 1;')
  assert.equal(second.listPrograms(created.user.id)[0].title, 'Ejemplo')
  assert.equal(second.listActivities(created.user.id).find(activity => activity.type === 'CODE_WRITTEN')?.after, 'guarda x = 1;')
  second.close()
})
