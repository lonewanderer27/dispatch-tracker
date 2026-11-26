import type { HttpError } from '@refinedev/core'
import { Edit, useForm } from '@refinedev/antd'
import { Form, Input, Switch } from 'antd'
import type { Todo, TablesUpdate } from '@/types/db'

export function TodoEdit() {
  const { formProps, saveButtonProps, query } = useForm<Todo, HttpError, TablesUpdate<'todos'>>({
    action: 'edit',
  })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Title"
          name="title"
          rules={[
            { required: true, message: 'Title is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Done" name="done" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Edit>
  )
}
