import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'

export function CleanerCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'cleaners'>>({ action: 'create' })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="First name"
          name="first_name"
          rules={[
            { required: true, whitespace: true, message: 'First name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input placeholder="First name" autoFocus />
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
          <Input placeholder="Last name" />
        </Form.Item>
      </Form>
    </Create>
  )
}
