import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkle } from '@/shared/brand/Sparkle'

describe('Sparkle', () => {
  it('is a decorative svg that inherits the text colour', () => {
    const { container } = render(<Sparkle />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('fill', 'currentColor')
  })
})
