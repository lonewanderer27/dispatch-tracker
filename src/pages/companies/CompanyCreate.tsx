import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'
import { ColorMotifSelect } from '@/components/color-motif/ColorMotifSelect'
import { DEFAULT_COLOR_MOTIF } from '@/features/color-motif/colorMotif'

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
        <Form.Item
          label="Color"
          name="color_motif"
          initialValue={DEFAULT_COLOR_MOTIF}
          rules={[{ required: true, message: 'Color is required' }]}
        >
          <ColorMotifSelect />
        </Form.Item>
      </Form>
    </Create>
  )
}
