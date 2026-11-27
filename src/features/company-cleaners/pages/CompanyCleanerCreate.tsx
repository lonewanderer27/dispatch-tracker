import { useCreateMany } from '@refinedev/core'
import { Create, useSelect } from '@refinedev/antd'
import { Form, Select } from 'antd'
import { useNavigate } from 'react-router'
import type { Cleaner, Company } from '@/types/db'

interface FormValues {
  cleaner_id: string
  company_ids: string[]
}

export function CompanyCleanerCreate() {
  const [form] = Form.useForm<FormValues>()
  const navigate = useNavigate()
  const { mutate: createLinks, mutation } = useCreateMany()
  const { selectProps: cleanerSelectProps } = useSelect<Cleaner>({
    resource: 'cleaners',
    optionLabel: (cleaner) => `${cleaner.first_name} ${cleaner.last_name}`,
    optionValue: 'id',
    sorters: [{ field: 'last_name', order: 'asc' }],
    // The label is built from two columns, so Refine has no single field to search. Match either name.
    onSearch: (value) =>
      value
        ? [
            {
              operator: 'or',
              value: [
                { field: 'first_name', operator: 'contains', value },
                { field: 'middle_name', operator: 'contains', value },
                { field: 'last_name', operator: 'contains', value },
              ],
            },
          ]
        : [],
  })
  const { selectProps: companySelectProps } = useSelect<Company>({
    resource: 'companies',
    optionLabel: 'name',
    optionValue: 'id',
  })

  return (
    <Create
      saveButtonProps={{
        onClick: () => {
          form.submit()
        },
        loading: mutation.isPending,
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={({ cleaner_id, company_ids }) => {
          createLinks(
            {
              resource: 'company_cleaners',
              values: company_ids.map((company_id) => ({ cleaner_id, company_id })),
            },
            {
              onSuccess: () => {
                void navigate('/company-cleaners')
              },
            },
          )
        }}
      >
        <Form.Item
          label="Cleaner"
          name="cleaner_id"
          rules={[{ required: true, message: 'Choose the cleaner' }]}
        >
          <Select {...cleanerSelectProps} placeholder="Cleaner" />
        </Form.Item>
        <Form.Item
          label="Companies"
          name="company_ids"
          rules={[{ required: true, message: 'Choose at least one company' }]}
        >
          <Select {...companySelectProps} mode="multiple" placeholder="Companies" />
        </Form.Item>
      </Form>
    </Create>
  )
}
