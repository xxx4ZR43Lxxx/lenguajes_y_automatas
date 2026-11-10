import { describe, expect, it } from 'vitest'
import { describeSourceChange } from '../src/core/history/sourceChange'

describe('Historial de cambios del código', () => {
  it('registra exactamente una inserción y su posición', () => {
    expect(describeSourceChange('abc', 'aXbc')).toMatchObject({
      type: 'CODE_WRITTEN', metadata: { position: 1, line: 1, column: 2, added: 'X', removed: '' },
    })
  })

  it('distingue borrar de reemplazar aunque cambie la longitud', () => {
    expect(describeSourceChange('hola', 'ho')).toMatchObject({
      type: 'CODE_DELETED', metadata: { position: 2, removed: 'la', added: '' },
    })
    expect(describeSourceChange('hola', 'holanda')).toMatchObject({
      type: 'CODE_WRITTEN', metadata: { position: 4, added: 'nda', removed: '' },
    })
    expect(describeSourceChange('uno', 'doscientos')).toMatchObject({
      type: 'CODE_EDITED', metadata: { removed: 'uno', added: 'doscientos' },
    })
  })

  it('mantiene coordenadas correctas en líneas posteriores', () => {
    expect(describeSourceChange('a\nb', 'a\nXb')?.metadata).toMatchObject({ position: 2, line: 2, column: 1 })
    expect(describeSourceChange('igual', 'igual')).toBeNull()
  })
})
