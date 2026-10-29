import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { FRVTUBERS_URL, KOKORI_SRC, mascotAvailable } from '@/lib/frvtubers'

describe('FRVTUBERS_URL', () => {
  it('vaut exactement l\'URL du site partenaire', () => {
    expect(FRVTUBERS_URL).toBe('https://frvtubers.com')
  })
})

describe('mascotAvailable', () => {
  it('renvoie false sans fichier puis true une fois kokori.png déposé', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kokori-'))
    try {
      expect(KOKORI_SRC).toBe('/kokori.png')
      expect(mascotAvailable(dir)).toBe(false)
      fs.writeFileSync(path.join(dir, 'kokori.png'), '')
      expect(mascotAvailable(dir)).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
