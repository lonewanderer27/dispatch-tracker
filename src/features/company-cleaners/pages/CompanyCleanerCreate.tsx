import { Create, useForm, useSelect } from '@refinedev/antd'
import { Form, Select } from 'antd'
import type { Cleaner, Company, TablesInsert } from '@/types/db'

export function CompanyCleanerCreate() {
  const { formProps, saveButtonProps } = useForm<TablesInsert<'company_cleaners'>>({
    action: 'create',
  })
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
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Cleaner"
          name="cleaner_id"
          rules={[{ required: true, message: 'Choose the cleaner' }]}
        >
          <Select {...cleanerSelectProps} placeholder="Cleaner" />
        </Form.Item>
        <Form.Item
          label="Company"
          name="company_id"
          rules={[{ required: true, message: 'Choose the company this cleaner works for' }]}
        >
          <Select {...companySelectProps} placeholder="Company" />
        </Form.Item>
      </Form>
    </Create>
  )
}
