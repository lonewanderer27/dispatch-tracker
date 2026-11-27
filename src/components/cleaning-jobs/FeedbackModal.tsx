import { Alert, List, Modal, Rate, Typography } from 'antd'
import { useClientFeedbacks } from '@/features/cleaning-jobs/hooks'
import { formatSchedule } from '@/features/cleaning-jobs/timeZone'
import type { CleaningJobListRow } from '@/types/db'

interface Props {
  job: CleaningJobListRow | null
  timeZone: string
  onClose: () => void
}

/**
 * Every feedback of one job, newest first, opened from the Feedback column. The request is made
 * only while the modal is open, and reopening the same job reads the cache.
 */
export function FeedbackModal({ job, timeZone, onClose }: Props) {
  const { data, isLoading, error } = useClientFeedbacks(job?.id)

  return (
    <Modal
      open={job !== null}
      title={job ? `Feedback for ${job.client_name}` : 'Feedback'}
      footer={null}
      onCancel={onClose}
    >
      {error && <Alert type="error" showIcon message={error.message} />}
      <List
        loading={isLoading}
        dataSource={data ?? []}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={<Rate disabled value={item.rating} />}
              description={
                <>
                  <div>
                    {item.feedback ?? (
                      <Typography.Text type="secondary">No comment</Typography.Text>
                    )}
                  </div>
                  <Typography.Text type="secondary">
                    {formatSchedule(item.created_at, timeZone)}
                  </Typography.Text>
                </>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
