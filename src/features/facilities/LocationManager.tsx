import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import { api } from '../../shared/api/client';
import type {
  ListQuery,
  LocationKind,
  LocationNode,
  ResourceInputMap,
  ResourceMap,
} from '../../shared/api/contracts';
import {
  EmptyState,
  FormModal,
  PageHeader,
  QueryView,
  useConfirmedAction,
  useQuery,
} from '../../shared/ui';
import { RackOccupancy } from './Facilities';

export const locationLabels: Record<LocationKind, string> = {
  idc: 'IDC',
  building: '楼栋',
  room: '机房',
  rack: '机架',
};
const parentKinds: Partial<Record<LocationKind, LocationKind>> = {
  building: 'idc',
  room: 'building',
  rack: 'room',
};
const parentFields = { idc: null, building: 'idcId', room: 'buildingId', rack: 'roomId' } as const;
type Resource = ResourceMap[LocationKind];
type Fields = {
  name: string;
  city?: string;
  capacity?: number;
  idcId?: string;
  buildingId?: string;
  roomId?: string;
};

function pathText(id: string | null, nodes: LocationNode[]): string {
  if (!id) return '—';
  const node = nodes.find((entry) => entry.id === id);
  if (!node) return '父级不可用';
  return node.parentId ? `${pathText(node.parentId, nodes)} / ${node.name}` : node.name;
}

export function LocationManager({ kind }: { kind: LocationKind }) {
  const label = locationLabels[kind];
  const parentKind = parentKinds[kind];
  const parentField = parentFields[kind];
  const [query, setQuery] = useState<ListQuery>({
    page: 1,
    pageSize: 10,
    sort: 'name',
    order: 'asc',
  });
  const [filters] = Form.useForm<ListQuery>();
  const [editing, setEditing] = useState<{ resource?: Resource }>();
  const [detailId, setDetailId] = useState<string>();
  const confirm = useConfirmedAction();
  const resources = useQuery(
    useCallback(
      async () => ({
        page: await api.resources(kind, query),
        nodes: await api.locations(),
      }),
      [kind, query],
    ),
  );
  const nodes = resources.data?.nodes ?? [];
  const parentOptions = nodes
    .filter((node) => node.kind === parentKind)
    .map((node) => ({
      value: node.id,
      label: pathText(node.id, nodes),
    }));
  const detail = nodes.find((node) => node.id === detailId && node.kind === kind);
  const update = (values: Partial<ListQuery>) =>
    setQuery((old) => ({ ...old, ...values, page: values.page ?? 1 }));
  const resetFilters = () => {
    filters.resetFields();
    setQuery({ page: 1, pageSize: query.pageSize, sort: 'name', order: 'asc' });
  };
  return (
    <>
      <PageHeader
        title={`${label}管理`}
        description={
          kind === 'idc'
            ? '管理数据中心及城市，楼栋、机房、机架分别在各自菜单维护。'
            : `独立维护${label}及其所属${locationLabels[parentKind!]}，父级创建后不可移动。`
        }
      />
      <Card className="query-card">
        <Form
          name={`${kind}Query`}
          form={filters}
          layout="inline"
          className="query-form"
          aria-label={`${label}查询条件`}
          onFinish={(values) => update(values)}
        >
          <Form.Item name="q" label="名称">
            <Input
              type="search"
              aria-label={`搜索${label}`}
              placeholder={`输入${label}名称`}
              allowClear
            />
          </Form.Item>
          {parentField && (
            <Form.Item name={parentField} label={`所属${locationLabels[parentKind!]}`}>
              <Select
                aria-label={`筛选所属${locationLabels[parentKind!]}`}
                placeholder="全部父级"
                allowClear
                showSearch
                optionFilterProp="label"
                options={parentOptions}
              />
            </Form.Item>
          )}
          <Form.Item className="query-actions">
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button onClick={resetFilters}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card
        title={`${label}列表`}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              aria-label={`刷新${label}列表`}
              onClick={resources.reload}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              aria-label={`新增${kind === 'idc' ? ' IDC' : label}`}
              disabled={
                resources.loading || !!resources.error || (!!parentKind && !parentOptions.length)
              }
              onClick={() => setEditing({})}
            >
              新增{kind === 'idc' ? ' IDC' : label}
            </Button>
          </Space>
        }
      >
        {parentKind && !resources.loading && !resources.error && !parentOptions.length && (
          <Alert
            className="page-note"
            type="info"
            showIcon
            title={`请先在${locationLabels[parentKind]}管理中创建父级资源。`}
          />
        )}
        <QueryView query={resources}>
          {({ page, nodes: currentNodes }) => (
            <Table<Resource>
              rowKey="id"
              size="middle"
              scroll={{ x: 850 }}
              dataSource={page.items}
              locale={{
                emptyText: <EmptyState text={`暂无${label}，可新增资源或调整查询条件。`} />,
              }}
              pagination={{
                current: page.page,
                pageSize: page.pageSize,
                total: page.total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              onChange={(pagination, _, sorter) => {
                const sort = Array.isArray(sorter) ? sorter[0] : sorter;
                update({
                  page: pagination.current,
                  pageSize: pagination.pageSize,
                  sort: 'name',
                  order: sort.order === 'descend' ? 'desc' : 'asc',
                });
              }}
              columns={[
                {
                  title: `${label}名称`,
                  dataIndex: 'name',
                  sorter: true,
                  sortOrder: query.order === 'desc' ? 'descend' : 'ascend',
                  render: (name: string, entry) => (
                    <Button type="link" onClick={() => setDetailId(entry.id)}>
                      {name}
                    </Button>
                  ),
                },
                ...(kind === 'idc'
                  ? [
                      {
                        title: '城市',
                        render: (_: unknown, entry: Resource) =>
                          'city' in entry ? entry.city : '—',
                      },
                    ]
                  : [
                      {
                        title: '所属路径',
                        render: (_: unknown, entry: Resource) =>
                          pathText(
                            currentNodes.find((node) => node.id === entry.id)?.parentId ?? null,
                            currentNodes,
                          ),
                      },
                    ]),
                ...(kind === 'rack'
                  ? [
                      {
                        title: '容量',
                        render: (_: unknown, entry: Resource) =>
                          'capacity' in entry ? `${entry.capacity} U` : '—',
                      },
                    ]
                  : []),
                { title: '资源 ID', dataIndex: 'id' },
                {
                  title: '操作',
                  render: (_, entry) => (
                    <Space>
                      <Button type="link" onClick={() => setDetailId(entry.id)}>
                        详情
                      </Button>
                      <Button type="link" onClick={() => setEditing({ resource: entry })}>
                        编辑
                      </Button>
                      <Button
                        type="link"
                        danger
                        onClick={() =>
                          confirm(`删除模拟${label}`, entry.name, () =>
                            api.deleteResource(kind, entry.id),
                          )
                        }
                      >
                        删除
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          )}
        </QueryView>
      </Card>
      {editing && (
        <FormModal<Fields>
          title={`${editing.resource ? '编辑' : '新增'}${label}`}
          open
          onClose={() => setEditing(undefined)}
          initialValues={editing.resource ?? { name: '', city: '', capacity: 42 }}
          onSubmit={async (values) => {
            if (editing.resource) await api.editResource(kind, editing.resource.id, values);
            else await api.createResource(kind, values as ResourceInputMap[LocationKind]);
          }}
        >
          <Form.Item
            name="name"
            label={`${label}名称`}
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          {parentField &&
            (editing.resource ? (
              <p>
                所属{locationLabels[parentKind!]}：
                {pathText(
                  nodes.find((node) => node.id === editing.resource?.id)?.parentId ?? null,
                  nodes,
                )}
                （不可修改）
              </p>
            ) : (
              <Form.Item
                name={parentField}
                label={`所属${locationLabels[parentKind!]}`}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  aria-label={`所属${locationLabels[parentKind!]}`}
                  optionFilterProp="label"
                  placeholder="选择父级资源"
                  options={parentOptions}
                />
              </Form.Item>
            ))}
          {kind === 'idc' && (
            <Form.Item
              name="city"
              label="城市（虚构数据）"
              rules={[{ required: true, whitespace: true, max: 64 }]}
            >
              <Input maxLength={64} />
            </Form.Item>
          )}
          {kind === 'rack' && (
            <Form.Item name="capacity" label="机架容量（U）" rules={[{ required: true }]}>
              <InputNumber min={1} max={42} precision={0} />
            </Form.Item>
          )}
        </FormModal>
      )}
      <Drawer
        title={`${label}详情`}
        open={!!detailId}
        onClose={() => setDetailId(undefined)}
        size={760}
        destroyOnHidden
      >
        {resources.error ? (
          <Alert type="error" title="详情暂不可用，请关闭后重试列表。" />
        ) : detail ? (
          <>
            <Descriptions
              column={1}
              bordered
              items={[
                { key: 'name', label: `${label}名称`, children: detail.name },
                { key: 'id', label: '资源 ID', children: detail.id },
                { key: 'path', label: '完整位置', children: pathText(detail.id, nodes) },
                ...(kind === 'idc' ? [{ key: 'city', label: '城市', children: detail.city }] : []),
                ...(kind === 'rack'
                  ? [{ key: 'capacity', label: '机架容量', children: `${detail.capacity} U` }]
                  : []),
              ]}
            />
            {kind === 'rack' && <RackOccupancy rackId={detail.id} />}
          </>
        ) : (
          <EmptyState text="资源已不存在，请关闭后刷新列表。" />
        )}
      </Drawer>
    </>
  );
}
