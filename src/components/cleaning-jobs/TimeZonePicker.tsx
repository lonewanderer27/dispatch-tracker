import { useMemo } from 'react'
import { Button, Select, Space, Typography } from 'antd'
import { deviceTimeZone, listTimeZones } from '@/features/cleaning-jobs/timeZone'

interface Props {
  value: string
  saving: boolean
  onChange: (timeZone: string) => void
}

/** Lets the user choose the time zone that scheduled dates and feedback dates are shown in. */
export function TimeZonePicker({ value, saving, onChange }: Props) {
  const options = useMemo(() => listTimeZones().map((zone) => ({ label: zone, value: zone })), [])
  const device = deviceTimeZone()

  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Typography.Text>Show times in</Typography.Text>
      <Select
        showSearch
        style={{ minWidth: 280 }}
        value={value}
        options={options}
        loading={saving}
        onChange={onChange}
        data-testid="time-zone-select"
      />
      <Button
        disabled={saving || value === device}
        onClick={() => {
          onChange(device)
        }}
      >
        Use my device time zone ({device})
      </Button>
    </Space>
  )
}
