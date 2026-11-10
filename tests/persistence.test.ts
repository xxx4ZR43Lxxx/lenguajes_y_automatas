import { reactive } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { analyzerRepository, type AnalysisSnapshot } from '../src/persistence/AnalyzerRepository'

afterEach(() => vi.unstubAllGlobals())

it('serializa snapshots reactivos antes de enviarlos a SQLite', async () => {
  const fetchMock = vi.fn(async (_path: string, _options: RequestInit) => new Response(JSON.stringify({
    program: { id: 'saved', title: 'Prueba', source: 'x' },
  }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)

  const proxiedAnalysis = reactive({
    tokens: [{ lexeme: 'x' }],
    lexicalErrors: [],
    syntaxErrors: [],
    semanticErrors: [],
    suggestions: [],
    ast: { type: 'Program', body: [] },
  }) as unknown as AnalysisSnapshot

  await analyzerRepository.saveAnalysisSnapshot('user-id', 'x', {
    tokens: 1, lexicalErrors: 0, syntaxErrors: 0, semanticErrors: 0,
  }, proxiedAnalysis)

  const [path, options] = fetchMock.mock.calls[0]!
  expect(path).toBe('/api/programs')
  expect(JSON.parse(options.body as string).analysis).toEqual({
    tokens: [{ lexeme: 'x' }],
    lexicalErrors: [],
    syntaxErrors: [],
    semanticErrors: [],
    suggestions: [],
    ast: { type: 'Program', body: [] },
  })
})
