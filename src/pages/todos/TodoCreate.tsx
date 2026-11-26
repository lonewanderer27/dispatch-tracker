import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'

export function TodoCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'todos'>>({ action: 'create' })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Title"
          name="title"
          rules={[
            { required: true, message: 'Title is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input placeholder="What needs doing?" autoFocus />
        </Form.Item>
      </Form>
    </Create>
  )
}
