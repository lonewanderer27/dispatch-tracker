import { Create, useForm } from '@refinedev/antd'
import { Form, Input } from 'antd'
import type { TablesInsert } from '@/types/db'
import { ColorMotifSelect } from '@/shared/color-motif/ColorMotifSelect'
import { DEFAULT_COLOR_MOTIF } from '@/shared/color-motif/colorMotif'

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
