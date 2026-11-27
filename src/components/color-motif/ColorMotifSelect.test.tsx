import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { describe, expect, it, vi } from 'vitest'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
import { ColorMotifTag } from '@/components/color-motif/ColorMotifTag'
import { COLOR_MOTIF_LABELS, COLOR_MOTIFS } from '@/features/color-motif/colorMotif'

// The open dropdown (antd renders it in a portal on document.body).
function dropdown() {
  const element = document.querySelector<HTMLElement>(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
  )
  if (!element) throw new Error('the dropdown is not open')
  return element
}

// The same wiring the Create and Edit pages use: a Form.Item labelled "Color".
function renderInForm(value: string | undefined, onChange = vi.fn()) {
  render(
    <Form>
      <Form.Item label="Color" htmlFor="color">
        <ColorMotifSelect id="color" value={value} onChange={onChange} />
      </Form.Item>
    </Form>,
  )
  return onChange
}

describe('ColorMotifTag', () => {
  it('shows its text in the colour it is given', () => {
    render(<ColorMotifTag motif="geekblue">The Tidy Team</ColorMotifTag>)
    expect(screen.getByText('The Tidy Team')).toHaveClass('ant-tag', 'ant-tag-geekblue')
  })

  it('shows an unknown or missing colour as the grey default', () => {
    render(
      <>
        <ColorMotifTag motif="pink">Unknown</ColorMotifTag>
        <ColorMotifTag motif={null}>Missing</ColorMotifTag>
      </>,
    )
    expect(screen.getByText('Unknown')).toHaveClass('ant-tag-default')
    expect(screen.getByText('Missing')).toHaveClass('ant-tag-default')
  })
})

describe('ColorMotifSelect', () => {
  it('is named Color and shows the chosen colour as a pill', () => {
    renderInForm('blue')
    expect(screen.getByRole('combobox', { name: 'Color' })).toBeInTheDocument()
    expect(screen.getByText('Blue')).toHaveClass('ant-tag-blue')
  })

  it('offers every palette colour as a pill with its name, in palette order', async () => {
    renderInForm('default')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    const pills = Array.from(dropdown().querySelectorAll('.ant-select-item-option .ant-tag'))
    expect(pills.map((pill) => pill.textContent)).toEqual(
      COLOR_MOTIFS.map((motif) => COLOR_MOTIF_LABELS[motif]),
    )
    pills.forEach((pill, index) => {
      expect(pill).toHaveClass(`ant-tag-${COLOR_MOTIFS[index] ?? ''}`)
    })
  })

  it('reports the colour the user picks', async () => {
    const onChange = renderInForm('default')
    await userEvent.click(screen.getByRole('combobox', { name: 'Color' }))
    await userEvent.click(within(dropdown()).getByText('Geek blue'))
    expect(onChange).toHaveBeenCalledWith('geekblue', expect.anything())
  })

  it('shows a stored value the palette does not know as the grey default', () => {
    renderInForm('pink')
    expect(screen.getByText('Grey (default)')).toHaveClass('ant-tag-default')
  })
})
