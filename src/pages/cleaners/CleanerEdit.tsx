import type { HttpError } from '@refinedev/core'
import { Edit, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { Cleaner, TablesUpdate } from '@/types/db'

export function CleanerEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    Cleaner,
    HttpError,
    TablesUpdate<'cleaners'>
  >({ action: 'edit' })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="First name"
          name="first_name"
          rules={[
            { required: true, whitespace: true, message: 'First name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Middle name"
          name="middle_name"
          normalize={(value: string | undefined) => (value?.trim() ? value.trim() : null)}
          rules={[{ max: 100, message: 'Keep it under 100 characters' }]}
        >
          <Input placeholder="Optional" />
        </Form.Item>
        <Form.Item
          label="Last name"
          name="last_name"
          rules={[
            { required: true, whitespace: true, message: 'Last name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  )
}
