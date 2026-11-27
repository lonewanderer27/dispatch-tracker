import type { HttpError } from '@refinedev/core'
import { Edit, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { Company, TablesUpdate } from '@/types/db'
import { ColorMotifSelect } from '@/shared/color-motif/ColorMotifSelect'

export function CompanyEdit() {
  const { formProps, saveButtonProps, query } = useForm<
    Company,
    HttpError,
    TablesUpdate<'companies'>
  >({ action: 'edit' })
  const isLoading = query?.isLoading ?? false

  return (
    <Edit saveButtonProps={saveButtonProps} isLoading={isLoading}>
      <Form {...formProps} layout="vertical">
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
        <Form.Item
          label="Color"
          name="color_motif"
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
    </Edit>
  )
}
