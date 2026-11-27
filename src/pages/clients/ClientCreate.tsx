import { Create, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Company, TablesInsert } from '@/types/db'

export function ClientCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'clients'>>({ action: 'create' })
  const { selectProps } = useSelect<Company>({
    resource: 'companies',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Company"
          name="company_id"
          rules={[{ required: true, message: 'Choose the company this client books with' }]}
        >
          <Select {...selectProps} placeholder="Company" />
        </Form.Item>
        <Form.Item
          label="Name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: 'Name is required' },
            { max: 200, message: 'Keep it under 200 characters' },
          ]}
        >
          <Input placeholder="Client name" autoFocus />
        </Form.Item>
      </Form>
    </Create>
  )
}
