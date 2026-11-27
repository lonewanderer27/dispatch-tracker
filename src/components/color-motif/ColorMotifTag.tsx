import type { ReactNode } from 'react'
import { Tag } from 'antd'
import { toColorMotif } from '@/features/color-motif/colorMotif'

interface Props {
  // The row's color_motif. An unknown or missing value shows the grey default pill.
  motif: string | null | undefined
  // The pill text. Colour is never the only signal, so the text is required.
  children: ReactNode
}

export function ColorMotifTag({ motif, children }: Props) {
  return <Tag color={toColorMotif(motif)}>{children}</Tag>
}
