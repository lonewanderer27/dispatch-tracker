import { describe, expect, it } from 'vitest'
import { brandTheme } from '@/shared/brand/theme'

describe('brandTheme', () => {
  it('uses berry-600 as the accent and berry-800 for hover and pressed', () => {
    expect(brandTheme.token?.colorPrimary).toBe('#b61f47')
    expect(brandTheme.token?.colorPrimaryHover).toBe('#79112d')
    expect(brandTheme.token?.colorPrimaryActive).toBe('#79112d')
  })

  it('uses the Design System status colours', () => {
    expect(brandTheme.token?.colorSuccess).toBe('#0b6b7a')
    expect(brandTheme.token?.colorWarning).toBe('#8a5a00')
    expect(brandTheme.token?.colorError).toBe('#b3260b')
  })
})
