import { Select } from 'antd'
import {
  COLOR_MOTIF_LABELS,
  COLOR_MOTIFS,
  toColorMotif,
  type ColorMotif,
} from '@/features/color-motif/colorMotif'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'

// Form.Item passes id, value and onChange; the id ties the select to the item's "Color" label.
interface Props {
  id?: string
  value?: string | null
  onChange?: (value: ColorMotif) => void
}

// Each option is the pill itself, so the admin sees the colour and its name together.
const OPTIONS = COLOR_MOTIFS.map((motif) => ({
  value: motif,
  label: <ColorMotifTag motif={motif}>{COLOR_MOTIF_LABELS[motif]}</ColorMotifTag>,
}))

export function ColorMotifSelect({ id, value, onChange }: Props) {
  return (
    <Select<ColorMotif>
      id={id}
      // Before the record loads the value is undefined; show nothing rather than a guess.
      value={value === undefined ? undefined : toColorMotif(value)}
      onChange={onChange}
      options={OPTIONS}
      // Twelve options: render them all (no virtual list), so every pill is in the page at once.
      virtual={false}
      style={{ maxWidth: 240 }}
    />
  )
}
