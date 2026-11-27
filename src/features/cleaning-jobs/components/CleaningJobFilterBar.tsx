import { useId, useState } from 'react'
import { useList } from '@refinedev/core'
import dayjs from 'dayjs'
import { CloseOutlined, FilterOutlined } from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Form,
  Input,
  Rate,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import {
  DATE_RANGE_LABELS,
  EMPTY_FILTERS,
  type CleaningJobFilters,
  type DateRangeKey,
} from '@/features/cleaning-jobs/api'
import {
  buildFilterChips,
  countPanelFilters,
  ratingLabel,
} from '@/features/cleaning-jobs/filterChips'
import type { Cleaner, CleaningType, Client, Company } from '@/types/db'

interface Props {
  value: CleaningJobFilters
  onChange: (filters: CleaningJobFilters) => void
}

interface Option {
  value: string
  label: string
}

/** One multi-select in the "Filters" panel. `key` builds the input id. */
interface IdFilter {
  key: string
  field: 'cleanerIds' | 'companyIds' | 'clientIds' | 'cleaningTypeIds'
  label: string
  placeholder: string
  options: Option[]
}

const DATE_FORMAT = 'YYYY-MM-DD'
const DATE_RANGE_OPTIONS = (Object.keys(DATE_RANGE_LABELS) as DateRangeKey[]).map((key) => ({
  value: key,
  label: DATE_RANGE_LABELS[key],
}))

const RATING_OPTIONS = [5, 4, 3, 2, 1, 0].map((n) => ({
  value: n,
  title: ratingLabel(n),
  label: (
    <Space size={4}>
      <Rate disabled count={5} value={n} style={{ fontSize: 12 }} />
      <span>{ratingLabel(n)}</span>
    </Space>
  ),
}))

/** Select options sorted by label. */
function toOptions<T extends { id: string }>(rows: T[], label: (row: T) => string): Option[] {
  return rows
    .map((row) => ({ value: row.id, label: label(row) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function toLookup(options: Option[]): Map<string, string> {
  return new Map(options.map((option) => [option.value, option.label]))
}

/** Date range, feedback search, the "Filters" panel and the removable chips of active filters. */
export function CleaningJobFilterBar({ value, onChange }: Props) {
  const ids = useId()
  const [panelOpen, setPanelOpen] = useState(false)
  // One option list per filter, loaded once (no paging) and searched in the browser.
  const { result: cleanerRows } = useList<Cleaner>({
    resource: 'cleaners',
    pagination: { mode: 'off' },
  })
  const { result: companyRows } = useList<Company>({
    resource: 'companies',
    pagination: { mode: 'off' },
  })
  const { result: clientRows } = useList<Client>({
    resource: 'clients',
    pagination: { mode: 'off' },
  })
  const { result: typeRows } = useList<CleaningType>({
    resource: 'cleaning_types',
    pagination: { mode: 'off' },
  })
  const cleaners = toOptions(cleanerRows.data, (c) =>
    [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' '),
  )
  const companies = toOptions(companyRows.data, (c) => c.name)
  const clients = toOptions(clientRows.data, (c) => c.name)
  const cleaningTypes = toOptions(typeRows.data, (c) => c.name)

  const chips = buildFilterChips(value, {
    cleaners: toLookup(cleaners),
    companies: toLookup(companies),
    clients: toLookup(clients),
    cleaningTypes: toLookup(cleaningTypes),
  })
  const panelCount = countPanelFilters(value)
  const panelId = `${ids}-panel`
  const dateLabelId = `${ids}-date`

  const idFilters: IdFilter[] = [
    {
      key: 'cleaner',
      field: 'cleanerIds',
      label: 'Cleaner',
      placeholder: 'Any cleaner',
      options: cleaners,
    },
    {
      key: 'company',
      field: 'companyIds',
      label: 'Company',
      placeholder: 'Any company',
      options: companies,
    },
    {
      key: 'client',
      field: 'clientIds',
      label: 'Client',
      placeholder: 'Any client',
      options: clients,
    },
    {
      key: 'cleaning-type',
      field: 'cleaningTypeIds',
      label: 'Cleaning type',
      placeholder: 'Any cleaning type',
      options: cleaningTypes,
    },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      <Flex wrap gap="small" align="center">
        <Typography.Text type="secondary" id={dateLabelId}>
          Scheduled
        </Typography.Text>
        <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
          <Segmented<DateRangeKey>
            aria-labelledby={dateLabelId}
            value={value.dateRange}
            options={DATE_RANGE_OPTIONS}
            onChange={(dateRange) => {
              onChange({ ...value, dateRange, dateFrom: null, dateTo: null })
            }}
          />
        </div>
        {value.dateRange === 'custom' && (
          <DatePicker.RangePicker
            aria-label="Custom scheduled date range"
            allowEmpty={[true, true]}
            placeholder={['From date', 'To date']}
            value={[
              value.dateFrom ? dayjs(value.dateFrom) : null,
              value.dateTo ? dayjs(value.dateTo) : null,
            ]}
            onChange={(dates) => {
              onChange({
                ...value,
                dateFrom: dates?.[0]?.format(DATE_FORMAT) ?? null,
                dateTo: dates?.[1]?.format(DATE_FORMAT) ?? null,
              })
            }}
          />
        )}
        <Input.Search
          aria-label="Search feedback"
          allowClear
          placeholder="Search feedback, press Enter"
          style={{ width: 280, maxWidth: '100%' }}
          defaultValue={value.feedbackSearch}
          key={value.feedbackSearch === '' ? 'empty' : 'set'}
          onSearch={(feedbackSearch) => {
            onChange({ ...value, feedbackSearch })
          }}
        />
        <Badge count={panelCount} size="small">
          <Button
            icon={<FilterOutlined />}
            aria-expanded={panelOpen}
            aria-controls={panelId}
            type={panelOpen ? 'primary' : 'default'}
            onClick={() => {
              setPanelOpen(!panelOpen)
            }}
          >
            {panelOpen ? 'Hide filters' : 'Filters'}
          </Button>
        </Badge>
      </Flex>
      {panelOpen && (
        <Card size="small" id={panelId} style={{ marginTop: 12 }}>
          <Form layout="vertical" component={false}>
            <Row gutter={[16, 0]}>
              {idFilters.map(({ key, field, label, placeholder, options }) => (
                <Col xs={24} sm={12} lg={8} key={key}>
                  <Form.Item label={label} htmlFor={`${ids}-${key}`} style={{ marginBottom: 8 }}>
                    <Select
                      id={`${ids}-${key}`}
                      mode="multiple"
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      maxTagCount="responsive"
                      placeholder={placeholder}
                      options={options}
                      value={value[field]}
                      onChange={(selectedIds: string[]) => {
                        onChange({ ...value, [field]: selectedIds })
                      }}
                    />
                  </Form.Item>
                </Col>
              ))}
              <Col xs={24} sm={12} lg={8}>
                <Form.Item label="Rating" htmlFor={`${ids}-rating`} style={{ marginBottom: 8 }}>
                  <Select
                    id={`${ids}-rating`}
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    optionLabelProp="title"
                    placeholder="Any rating"
                    options={RATING_OPTIONS}
                    value={value.ratings}
                    onChange={(ratings: number[]) => {
                      onChange({ ...value, ratings })
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Typography.Text type="secondary">
              Several values in one filter match any of them. Different filters must all match.
            </Typography.Text>
          </Form>
        </Card>
      )}
      {chips.length > 0 && (
        <Flex
          wrap
          gap={6}
          align="center"
          style={{ marginTop: 12 }}
          role="group"
          aria-label="Active filters"
        >
          <Typography.Text type="secondary">Active filters:</Typography.Text>
          {chips.map((chip) => (
            <Tag key={chip.key} style={{ marginInlineEnd: 0, paddingInlineEnd: 0 }}>
              {chip.label}
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label={`Remove ${chip.label}`}
                onClick={() => {
                  onChange(chip.next)
                }}
              />
            </Tag>
          ))}
          <Button
            type="link"
            size="small"
            onClick={() => {
              onChange(EMPTY_FILTERS)
            }}
          >
            Clear all
          </Button>
        </Flex>
      )}
    </div>
  )
}
