import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TimeZonePicker } from '@/components/cleaning-jobs/TimeZonePicker'
import { deviceTimeZone } from '@/features/cleaning-jobs/timeZone'

const device = deviceTimeZone()
const other = device === 'UTC' ? 'Australia/Sydney' : 'UTC'

describe('TimeZonePicker', () => {
  it('shows the chosen zone and names the device zone on the button', () => {
    render(<TimeZonePicker value={other} saving={false} onChange={vi.fn()} />)
    expect(screen.getByText('Show times in')).toBeInTheDocument()
    expect(screen.getByText(other)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Use my device time zone (${device})` }),
    ).toBeEnabled()
  })

  it('switches to the device zone when the button is pressed', async () => {
    const onChange = vi.fn()
    render(<TimeZonePicker value={other} saving={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /use my device time zone/i }))
    expect(onChange).toHaveBeenCalledWith(device)
  })

  it('disables the button when the device zone is already chosen', () => {
    render(<TimeZonePicker value={device} saving={false} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /use my device time zone/i })).toBeDisabled()
  })

  it('disables the button while saving', () => {
    render(<TimeZonePicker value={other} saving onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /use my device time zone/i })).toBeDisabled()
  })
})
