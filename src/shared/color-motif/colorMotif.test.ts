import { describe, expect, it } from 'vitest'
import {
  COLOR_MOTIF_LABELS,
  COLOR_MOTIFS,
  DEFAULT_COLOR_MOTIF,
  isColorMotif,
  toColorMotif,
} from '@/shared/color-motif/colorMotif'

// Every migration's text, keyed by path. Vite reads them at test time, so no Node types are needed.
const migrations = import.meta.glob<string>('/supabase/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// The palette as the database defines it: the array in the newest migration that (re)defines
// public.color_motifs(). Migration file names sort in apply order (NNNN_name.sql).
function databasePalette(): string[] {
  const definitions = Object.keys(migrations)
    .sort()
    .map((path) => migrations[path] ?? '')
    .filter((sql) => /create (or replace )?function public\.color_motifs\(\)/.test(sql))
  const newest = definitions.at(-1) ?? ''
  const array = /array\[([^\]]*)\]::text\[\]/.exec(newest)?.[1] ?? ''
  return [...array.matchAll(/'([^']*)'/g)].map((match) => match[1] ?? '')
}

describe('COLOR_MOTIFS', () => {
  it('matches public.color_motifs() in the newest migration that defines it, in order', () => {
    expect(databasePalette()).toEqual([...COLOR_MOTIFS])
  })

  it('is the Ant Design preset tag palette with the grey default first', () => {
    expect(COLOR_MOTIFS[0]).toBe(DEFAULT_COLOR_MOTIF)
    expect(new Set(COLOR_MOTIFS).size).toBe(12)
  })

  it('has a label for every colour', () => {
    expect(Object.keys(COLOR_MOTIF_LABELS)).toEqual([...COLOR_MOTIFS])
    expect(COLOR_MOTIF_LABELS.geekblue).toBe('Geek blue')
    expect(COLOR_MOTIF_LABELS.default).toBe('Grey (default)')
  })
})

describe('isColorMotif', () => {
  it('accepts every palette value', () => {
    for (const motif of COLOR_MOTIFS) expect(isColorMotif(motif)).toBe(true)
  })

  it('rejects anything else', () => {
    for (const value of ['pink', 'Blue', '#ff0000', '', null, undefined, 3]) {
      expect(isColorMotif(value)).toBe(false)
    }
  })
})

describe('toColorMotif', () => {
  it('keeps a palette value', () => {
    expect(toColorMotif('geekblue')).toBe('geekblue')
  })

  it('falls back to the grey default for an unknown value', () => {
    expect(toColorMotif('pink')).toBe('default')
    expect(toColorMotif(null)).toBe('default')
    expect(toColorMotif(undefined)).toBe('default')
  })
})
