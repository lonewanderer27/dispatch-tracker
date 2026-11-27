import type { HttpError } from '@refinedev/core'
import { Edit, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { CleaningStatus, TablesUpdate } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'

export function CleaningStatusEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    CleaningStatus,
    HttpError,
    TablesUpdate<'cleaning_statuses'>
  >({ action: 'edit' })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Color"
          name="color_motif"
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
    </Edit>
  )
}
