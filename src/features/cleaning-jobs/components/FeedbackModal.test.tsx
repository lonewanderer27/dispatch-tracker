import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackModal } from '@/features/cleaning-jobs/components/FeedbackModal'
import type { CleaningJobListRow } from '@/types/db'

const useClientFeedbacks = vi.fn()

vi.mock('@/features/cleaning-jobs/hooks', () => ({
  useClientFeedbacks: (...args: unknown[]) => useClientFeedbacks(...args) as unknown,
}))

const job = { id: 'j1', client_name: 'Xavier Ashby' } as CleaningJobListRow

beforeEach(() => {
  useClientFeedbacks.mockReturnValue({ data: [], isLoading: false, error: null })
})

describe('FeedbackModal', () => {
  it('asks for nothing and shows nothing while no job is chosen', () => {
    render(<FeedbackModal job={null} timeZone="UTC" onClose={vi.fn()} />)
    expect(useClientFeedbacks).toHaveBeenCalledWith(undefined)
    expect(screen.queryByText('Feedback')).not.toBeInTheDocument()
  })

  it('lists every feedback with its stars and the date in the chosen time zone', () => {
    useClientFeedbacks.mockReturnValue({
      data: [
        {
          id: 'f2',
          rating: 3,
          feedback: 'Missed the oven',
          created_at: '2026-12-06T10:00:00+00:00',
        },
        { id: 'f1', rating: 5, feedback: null, created_at: '2026-12-05T10:00:00+00:00' },
      ],
      isLoading: false,
      error: null,
    })
    render(<FeedbackModal job={job} timeZone="UTC" onClose={vi.fn()} />)
    expect(useClientFeedbacks).toHaveBeenCalledWith('j1')
    expect(screen.getByText('Feedback for Xavier Ashby')).toBeInTheDocument()
    expect(screen.getByText('Missed the oven')).toBeInTheDocument()
    expect(screen.getByText('No comment')).toBeInTheDocument()
    expect(screen.getByText('Sun 6 Dec 2026, 10:00 AM')).toBeInTheDocument()
    expect(screen.getByText('Sat 5 Dec 2026, 10:00 AM')).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { checked: true }).length).toBeGreaterThan(0)
  })

  it('shows the database error', () => {
    useClientFeedbacks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('denied'),
    })
    render(<FeedbackModal job={job} timeZone="UTC" onClose={vi.fn()} />)
    expect(screen.getByText('denied')).toBeInTheDocument()
  })

  it('calls onClose when the modal is dismissed', async () => {
    const onClose = vi.fn()
    render(<FeedbackModal job={job} timeZone="UTC" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
