import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'

export function AreaCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'areas'>>({
    action: 'create',
  })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input placeholder="e.g. Kitchen" autoFocus />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} placeholder="Optional" />
        </Form.Item>
      </Form>
    </Create>
  )
}
