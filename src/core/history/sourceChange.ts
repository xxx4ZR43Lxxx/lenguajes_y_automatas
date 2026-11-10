export interface SourceChange {
  type: 'CODE_WRITTEN' | 'CODE_DELETED' | 'CODE_EDITED'
  detail: string
  metadata: {
    position: number
    line: number
    column: number
    added: string
    removed: string
    beforeLength: number
    afterLength: number
  }
}

/** Devuelve el fragmento mínimo sustituido por una acción del editor. */
export function describeSourceChange(before: string, after: string): SourceChange | null {
  if (before === after) return null

  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  ) suffix += 1

  const removed = before.slice(prefix, before.length - suffix)
  const added = after.slice(prefix, after.length - suffix)
  const preceding = before.slice(0, prefix)
  const line = preceding.split('\n').length
  const column = preceding.length - preceding.lastIndexOf('\n')
  const type: SourceChange['type'] = removed.length === 0
    ? 'CODE_WRITTEN'
    : added.length === 0
      ? 'CODE_DELETED'
      : 'CODE_EDITED'
  const detail = type === 'CODE_WRITTEN'
    ? `Se escribieron ${added.length} carácter(es) en L${line}:C${column}.`
    : type === 'CODE_DELETED'
      ? `Se borraron ${removed.length} carácter(es) en L${line}:C${column}.`
      : `Se reemplazaron ${removed.length} carácter(es) por ${added.length} en L${line}:C${column}.`

  return {
    type,
    detail,
    metadata: { position: prefix, line, column, added, removed, beforeLength: before.length, afterLength: after.length },
  }
}
