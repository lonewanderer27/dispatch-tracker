import type { HttpError } from '@refinedev/core'
import { Edit, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select } from 'antd'
import type { Client, Company, TablesUpdate } from '@/types/db'

export function ClientEdit() {
  const { formProps, saveButtonProps, query } = useForm<Client, HttpError, TablesUpdate<'clients'>>(
    { action: 'edit' },
  )
  const { selectProps } = useSelect<Company>({
    resource: 'companies',
    optionLabel: 'name',
    optionValue: 'id',
  })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
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
          <Input />
        </Form.Item>
      </Form>
    </Edit>
  )
}
