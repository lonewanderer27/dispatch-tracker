import type { HttpError } from '@refinedev/core'
import { Edit, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { Area, TablesUpdate } from '@/types/db'

export function AreaEdit() {
  const { formProps, saveButtonProps, query } = useForm<Area, HttpError, TablesUpdate<'areas'>>({
    action: 'edit',
  })
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
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Edit>
  )
}
