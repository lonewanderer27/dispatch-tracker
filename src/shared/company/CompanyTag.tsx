import type { TagProps } from 'antd'
import { ColorMotifTag } from '@/shared/color-motif/ColorMotifTag'

interface Props extends Pick<TagProps, 'closable' | 'onClose'> {
  // A company with its pill colour. Select `companies(name, color_motif)` to get this shape. A
  // missing company shows an "Unknown" grey pill.
  company: { name: string; color_motif?: string | null } | null | undefined
}

/** The company's name as a pill in the company's colour. Use it wherever a company is listed. */
export function CompanyTag({ company, ...tagProps }: Props) {
  return (
    <ColorMotifTag motif={company?.color_motif} {...tagProps}>
      {company?.name ?? 'Unknown'}
    </ColorMotifTag>
  )
}
