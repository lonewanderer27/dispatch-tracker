import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'

export function CompanyCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'companies'>>({ action: 'create' })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input placeholder="Company name" autoFocus />
        </Form.Item>
      </Form>
    </Create>
  )
}
