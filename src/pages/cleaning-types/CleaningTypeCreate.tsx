import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'

export function CleaningTypeCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'cleaning_types'>>({
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
          <Input placeholder="e.g. Deep" autoFocus />
        </Form.Item>
      </Form>
    </Create>
  )
}
