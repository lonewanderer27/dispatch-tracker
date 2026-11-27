import { Create, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Client, TablesInsert } from '@/types/db'

export function ContactCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'contacts'>>({ action: 'create' })
  const { selectProps } = useSelect<Client>({
    resource: 'clients',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Client"
          name="client_id"
          rules={[{ required: true, message: 'Choose the client this contact belongs to' }]}
        >
          <Select {...selectProps} placeholder="Client" />
        </Form.Item>
        <Form.Item
          label="First name"
          name="first_name"
          rules={[
            { required: true, whitespace: true, message: 'First name is required' },
            { max: 100, message: 'Keep it under 100 characters' },
          ]}
        >
          <Input autoFocus />
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
        <Form.Item
          label="Contact number"
          name="contact_no"
          rules={[{ required: true, whitespace: true, message: 'Contact number is required' }]}
        >
          <Input placeholder="As entered, e.g. +61 400 000 000" />
        </Form.Item>
      </Form>
    </Create>
  )
}
