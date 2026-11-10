import type { ActivityLogEntry, LegacyMigrationBatch, SavedProgram } from './AnalyzerRepository'
import { analyzerRepository } from './AnalyzerRepository'

const legacyDatabaseName = 'lxsn-tsmnt-ptprl'

interface LegacyUser {
  id: string
  username: string
}

const requestValue = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('No fue posible leer los datos anteriores.'))
})

async function readLegacyData(username: string): Promise<LegacyMigrationBatch | null> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return null
  const databases = await indexedDB.databases()
  if (!databases.some(database => database.name === legacyDatabaseName)) return null

  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(legacyDatabaseName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No fue posible abrir la base anterior.'))
  })

  try {
    if (!['users', 'programs', 'activities'].every(name => database.objectStoreNames.contains(name))) return null
    const transaction = database.transaction(['users', 'programs', 'activities'], 'readonly')
    const [users, programs, activities] = await Promise.all([
      requestValue(transaction.objectStore('users').getAll() as IDBRequest<LegacyUser[]>),
      requestValue(transaction.objectStore('programs').getAll() as IDBRequest<SavedProgram[]>),
      requestValue(transaction.objectStore('activities').getAll() as IDBRequest<ActivityLogEntry[]>),
    ])
    const legacyUser = users.find(user => user.username === username)
    if (!legacyUser) return null
    let draft: string | undefined
    try {
      draft = localStorage.getItem(`lxsn-tsmnt-ptprl.draft.${legacyUser.id}`) ?? undefined
    } catch {
      // Un bloqueo de localStorage no impide migrar la base IndexedDB anterior.
    }
    return {
      programs: programs.filter(program => program.userId === legacyUser.id),
      activities: activities.filter(activity => activity.userId === legacyUser.id)
        .sort((first, second) => first.createdAt.localeCompare(second.createdAt) || (first.sequence ?? 0) - (second.sequence ?? 0)),
      draft,
    }
  } finally {
    database.close()
  }
}

function chunk<T>(records: T[], maximumCount: number): T[][] {
  const result: T[][] = []
  const maximumBytes = 8 * 1024 * 1024
  const encoder = new TextEncoder()
  let current: T[] = []
  let currentBytes = 0
  for (const record of records) {
    const bytes = encoder.encode(JSON.stringify(record)).length
    if (current.length && (current.length >= maximumCount || currentBytes + bytes > maximumBytes)) {
      result.push(current)
      current = []
      currentBytes = 0
    }
    current.push(record)
    currentBytes += bytes
  }
  if (current.length) result.push(current)
  return result
}

/** Migración idempotente de la base anterior del mismo origen al servidor SQLite. */
export async function migrateLegacyData(username: string): Promise<{ programs: number; activities: number } | null> {
  const legacy = await readLegacyData(username)
  if (!legacy || (!legacy.programs.length && !legacy.activities.length && legacy.draft === undefined)) return null

  let importedPrograms = 0
  let importedActivities = 0
  const programBatches = chunk(legacy.programs, 20)
  const activityBatches = chunk(legacy.activities, 25)
  const batches = Math.max(programBatches.length, activityBatches.length, 1)
  for (let index = 0; index < batches; index += 1) {
    const result = await analyzerRepository.migrate({
      programs: programBatches[index] ?? [],
      activities: activityBatches[index] ?? [],
      ...(index === 0 && legacy.draft !== undefined ? { draft: legacy.draft } : {}),
    })
    importedPrograms += result.importedPrograms
    importedActivities += result.importedActivities
  }
  return { programs: importedPrograms, activities: importedActivities }
}
