import type { ReactNode } from 'react'
import { Tag, type TagProps } from 'antd'
import { toColorMotif } from '@/shared/color-motif/colorMotif'

interface Props extends Pick<TagProps, 'closable' | 'onClose'> {
  // The row's color_motif. An unknown or missing value shows the grey default pill.
  motif: string | null | undefined
  // The pill text. Colour is never the only signal, so the text is required.
  children: ReactNode
}

export function ColorMotifTag({ motif, children, ...tagProps }: Props) {
  return (
    <Tag {...tagProps} color={toColorMotif(motif)}>
      {children}
    </Tag>
  )
}
