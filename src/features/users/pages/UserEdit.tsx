import { useState } from 'react'
import { useGetIdentity, useInvalidate, type HttpError } from '@refinedev/core'
import { Edit, useForm, useSelect } from '@refinedev/antd'
import { Form, Input, Select, message } from 'antd'
import { useNavigate } from 'react-router'
import { updateUserProfile } from '@/features/users/api'
import { supabase } from '@/shared/supabase'
import type { Tables, UserRow } from '@/types/db'

interface FormValues {
  display_name: string
  role_id: string
}

export function UserEdit() {
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const { data: identity } = useGetIdentity<{ id: string }>()
  const [saving, setSaving] = useState(false)

  const { formProps, saveButtonProps, query, id } = useForm<UserRow, HttpError, FormValues>({
    action: 'edit',
    resource: 'profiles',
    meta: { select: '*, roles(name)' },
  })
  const { selectProps } = useSelect<Tables<'roles'>>({
    resource: 'roles',
    optionLabel: 'name',
    optionValue: 'id',
  })

  const isSelf = identity?.id === String(id)

  async function onFinish(values: FormValues) {
    if (id === undefined) return
    setSaving(true)
    try {
      await updateUserProfile(supabase, {
        id: String(id),
        displayName: values.display_name,
        roleId: values.role_id,
      })
      await invalidate({ resource: 'profiles', invalidates: ['list', 'detail'] })
      void message.success('User updated')
      void navigate('/users')
    } catch (err) {
      void message.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Edit
      saveButtonProps={{ ...saveButtonProps, loading: saving }}
      isLoading={query?.isLoading ?? false}
      canDelete={false}
    >
      <Form
        {...formProps}
        onFinish={(values: FormValues) => void onFinish(values)}
        layout="vertical"
      >
        <Form.Item
          label="Display name"
          name="display_name"
          rules={[{ max: 100, message: 'Keep it under 100 characters' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Role"
          name="role_id"
          rules={[{ required: true, message: 'Role is required' }]}
          extra={isSelf ? 'You cannot change your own role.' : undefined}
        >
          <Select {...selectProps} disabled={isSelf} />
        </Form.Item>
      </Form>
    </Edit>
  )
}
