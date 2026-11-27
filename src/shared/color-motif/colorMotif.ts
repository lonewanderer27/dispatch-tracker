// The colours a company, cleaning type or cleaning status can show on its pill: Ant Design's preset
// tag colours plus 'default' (the neutral grey tag). Preset colours adapt to the light and dark
// themes, so there is no hex value to validate.
//
// This is the only copy of the list in the web code. The database has the only other copy,
// public.color_motifs() (supabase/migrations/0029_color_motifs.sql), and colorMotif.test.ts fails
// when the two differ. The order is the order of the options in ColorMotifSelect.
export const COLOR_MOTIFS = [
  'default',
  'magenta',
  'red',
  'volcano',
  'orange',
  'gold',
  'lime',
  'green',
  'cyan',
  'blue',
  'geekblue',
  'purple',
] as const

export type ColorMotif = (typeof COLOR_MOTIFS)[number]

export const DEFAULT_COLOR_MOTIF: ColorMotif = 'default'

// Names shown next to each swatch in ColorMotifSelect.
export const COLOR_MOTIF_LABELS: Record<ColorMotif, string> = {
  default: 'Grey (default)',
  magenta: 'Magenta',
  red: 'Red',
  volcano: 'Volcano',
  orange: 'Orange',
  gold: 'Gold',
  lime: 'Lime',
  green: 'Green',
  cyan: 'Cyan',
  blue: 'Blue',
  geekblue: 'Geek blue',
  purple: 'Purple',
}

export function isColorMotif(value: unknown): value is ColorMotif {
  return COLOR_MOTIFS.some((motif) => motif === value)
}

// Anything the palette does not know (null, an old or misspelt value) shows as the grey pill.
export function toColorMotif(value: unknown): ColorMotif {
  return isColorMotif(value) ? value : DEFAULT_COLOR_MOTIF
}
