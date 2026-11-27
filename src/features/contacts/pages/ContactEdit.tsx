import type { HttpError } from '@refinedev/core'
import { Edit, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Client, Contact, TablesUpdate } from '@/types/db'

export function ContactEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    Contact,
    HttpError,
    TablesUpdate<'contacts'>
  >({ action: 'edit' })
  const { selectProps } = useSelect<Client>({
    resource: 'clients',
    optionLabel: 'name',
    optionValue: 'id',
  })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
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
          <Input />
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
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  )
}
