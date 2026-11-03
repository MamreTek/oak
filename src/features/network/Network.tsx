import { Alert, Breadcrumb, Button, Card, Form, Input, Select, Space, Table, Tag } from 'antd';
import { useCallback, useState } from 'react';
import type { Address, IpPool, IpPoolInput, ListQuery } from '../../shared/api/contracts';
import { api } from '../../shared/api/client';
import {
  EmptyState,
  FormModal,
  PageHeader,
  QueryView,
  useConfirmedAction,
  useQuery,
} from '../../shared/ui';

const purposeName = { 'in-band': '带内', 'out-of-band': '带外', general: '通用' };
export function Network() {
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState<ListQuery>({ page: 1, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [poolSearch, setPoolSearch] = useState('');
  const [purpose, setPurpose] = useState<string>();
  const [create, setCreate] = useState(false);
  const [renaming, setRenaming] = useState<IpPool>();
  const [allocating, setAllocating] = useState<Address>();
  const resources = useQuery(
    useCallback(
      async () => ({
        pools: await api.pools(),
        servers: (await api.servers({ pageSize: 100 })).items,
        facilities: await api.facilities(),
      }),
      [],
    ),
  );
  const addresses = useQuery(
    useCallback(
      async () =>
        selected
          ? api.addresses({ ...query, poolId: selected })
          : { items: [] as Address[], total: 0, page: 1, pageSize: 10 },
      [query, selected],
    ),
  );
  const confirm = useConfirmedAction();
  const pool = resources.data?.pools.find((entry) => entry.id === selected);
  const update = (values: Partial<ListQuery>) =>
    setQuery((previous) => ({ ...previous, ...values, page: values.page ?? 1 }));
  const eligible =
    resources.data?.servers.filter(
      (server) =>
        ['ready', 'maintenance'].includes(server.status) &&
        resources.data?.facilities
          .find((dc) => dc.id === pool?.dataCenterId)
          ?.racks.some((rack) => rack.id === server.rackId),
    ) ?? [];
  return (
    <>
      <PageHeader
        title="IP 资源池"
        description="先管理网段，再进入网段管理 IP。带内、带外和通用用途分别约束设备分配。"
        extra={
          !pool && (
            <Button type="primary" onClick={() => setCreate(true)}>
              新增演示网段
            </Button>
          )
        }
      />
      <Alert
        className="page-note"
        type="info"
        showIcon
        title="仅文档保留地址，无网络操作"
        description="只允许 RFC 5737 保留网段，前缀 /24–/30；每网段最多展示 16 个可分配合成地址。全局拒绝网段重叠，暂不提供 VRF；不会配置 DHCP、路由或真实设备。"
      />
      <QueryView query={resources}>
        {(data) =>
          !pool ? (
            <Card title="网段列表">
              <div className="table-toolbar">
                <Input.Search
                  aria-label="查询网段"
                  placeholder="名称或 CIDR"
                  allowClear
                  onSearch={setPoolSearch}
                  style={{ width: 320 }}
                />
                <Select
                  aria-label="筛选网段用途"
                  placeholder="全部用途"
                  allowClear
                  onChange={setPurpose}
                  style={{ width: 160 }}
                  options={Object.entries(purposeName).map(([value, label]) => ({ value, label }))}
                />
              </div>
              <Table<IpPool>
                rowKey="id"
                size="middle"
                scroll={{ x: 1000 }}
                dataSource={data.pools.filter(
                  (entry) =>
                    `${entry.name} ${entry.cidr}`
                      .toLowerCase()
                      .includes(poolSearch.toLowerCase()) &&
                    (!purpose || entry.purpose === purpose),
                )}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                locale={{ emptyText: <EmptyState text="暂无匹配网段，可新增文档保留网段。" /> }}
                columns={[
                  { title: '网段名称', dataIndex: 'name' },
                  {
                    title: 'CIDR / 网关',
                    render: (_, entry) => (
                      <>
                        <strong className="mono">{entry.cidr}</strong>
                        <div className="muted small">{entry.gateway}</div>
                      </>
                    ),
                  },
                  {
                    title: 'IDC',
                    dataIndex: 'dataCenterId',
                    render: (id) => data.facilities.find((dc) => dc.id === id)?.name ?? id,
                  },
                  {
                    title: '用途',
                    dataIndex: 'purpose',
                    render: (value: IpPool['purpose']) => <Tag>{purposeName[value]}</Tag>,
                  },
                  {
                    title: '占用 / 展开地址',
                    render: (_, entry) => `${entry.allocatedCount} / ${entry.addressCount}`,
                  },
                  {
                    title: '操作',
                    render: (_, entry) => (
                      <Space wrap>
                        <Button
                          type="link"
                          onClick={() => {
                            setSelected(entry.id);
                            setQuery({ page: 1, pageSize: 10 });
                            setSearch('');
                          }}
                        >
                          IP 管理
                        </Button>
                        <Button type="link" onClick={() => setRenaming(entry)}>
                          网段改名
                        </Button>
                        <Button
                          type="link"
                          danger
                          onClick={() =>
                            confirm('删除模拟网段', `${entry.name} · ${entry.cidr}`, () =>
                              api.deletePool(entry.id),
                            )
                          }
                        >
                          删除网段
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          ) : (
            <Card>
              <Breadcrumb
                className="page-note"
                items={[
                  {
                    title: (
                      <Button type="link" onClick={() => setSelected(undefined)}>
                        返回网段列表
                      </Button>
                    ),
                  },
                  { title: `${pool.name} / ${pool.cidr}` },
                ]}
              />
              <h2>网段内 IP 管理</h2>
              <p>
                {purposeName[pool.purpose]} · 网关 {pool.gateway} · 已分配 {pool.allocatedCount} /{' '}
                {pool.addressCount}
              </p>
              <div className="table-toolbar">
                <Input.Search
                  aria-label="搜索 IP 地址"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onSearch={(q) => update({ q })}
                  placeholder="搜索当前网段 IP"
                  allowClear
                  style={{ width: 280 }}
                />
                <Select
                  aria-label="筛选 IP 状态"
                  placeholder="全部分配状态"
                  allowClear
                  onChange={(status) => update({ status })}
                  style={{ width: 180 }}
                  options={[
                    { value: 'free', label: '空闲' },
                    { value: 'allocated', label: '已分配' },
                  ]}
                />
              </div>
              <QueryView query={addresses}>
                {(result) => (
                  <Table<Address>
                    rowKey="id"
                    size="middle"
                    scroll={{ x: 700 }}
                    dataSource={result.items}
                    pagination={{
                      current: result.page,
                      pageSize: result.pageSize,
                      total: result.total,
                      onChange: (page) => update({ page }),
                      showSizeChanger: false,
                    }}
                    columns={[
                      {
                        title: 'IP 地址',
                        dataIndex: 'ip',
                        sorter: true,
                        render: (ip) => <strong className="mono">{ip}</strong>,
                      },
                      {
                        title: '状态',
                        dataIndex: 'serverId',
                        render: (id) => (
                          <Tag color={id ? 'blue' : 'green'}>{id ? '已分配' : '空闲'}</Tag>
                        ),
                      },
                      {
                        title: '设备',
                        dataIndex: 'serverId',
                        render: (id) =>
                          data.servers.find((server) => server.id === id)?.name ?? '—',
                      },
                      {
                        title: '操作',
                        render: (_, address) =>
                          address.serverId ? (
                            <Button
                              type="link"
                              danger
                              onClick={() =>
                                confirm('回收模拟 IP', address.ip, () => api.release(address.id))
                              }
                            >
                              回收
                            </Button>
                          ) : (
                            <Button type="link" onClick={() => setAllocating(address)}>
                              分配 IP
                            </Button>
                          ),
                      },
                    ]}
                    onChange={(pagination, _, sorter) => {
                      const sort = Array.isArray(sorter) ? sorter[0] : sorter;
                      update({
                        page: pagination.current,
                        sort: 'ip',
                        order: sort.order === 'descend' ? 'desc' : 'asc',
                      });
                    }}
                  />
                )}
              </QueryView>
            </Card>
          )
        }
      </QueryView>
      {create && (
        <FormModal<IpPoolInput>
          title="新增演示网段"
          open
          onClose={() => setCreate(false)}
          initialValues={{ purpose: 'general' }}
          onSubmit={async (values) => {
            await api.createPool(values);
            setPoolSearch('');
            setPurpose(undefined);
          }}
        >
          <Form.Item
            name="name"
            label="网段名称"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="dataCenterId" label="所属 IDC" rules={[{ required: true }]}>
            <Select
              options={resources.data?.facilities.map((dc) => ({ value: dc.id, label: dc.name }))}
            />
          </Form.Item>
          <Form.Item name="purpose" label="网段用途" rules={[{ required: true }]}>
            <Select
              options={Object.entries(purposeName).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="cidr" label="文档保留 CIDR" rules={[{ required: true }]}>
            <Input placeholder="203.0.113.0/28" maxLength={32} />
          </Form.Item>
          <Form.Item name="gateway" label="演示网关" rules={[{ required: true }]}>
            <Input placeholder="203.0.113.1" maxLength={15} />
          </Form.Item>
          <p className="muted small">
            CIDR、网关、用途和 IDC 创建后不可修改；需要变化时先建立新网段并按引用约束处理旧记录。
          </p>
        </FormModal>
      )}
      {renaming && (
        <FormModal<{ name: string }>
          title="网段改名"
          open
          onClose={() => setRenaming(undefined)}
          initialValues={{ name: renaming.name }}
          onSubmit={(values) => api.renamePool(renaming.id, values.name)}
        >
          <Form.Item
            name="name"
            label="网段名称"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input maxLength={64} />
          </Form.Item>
        </FormModal>
      )}
      {allocating && (
        <FormModal<{ serverId: string }>
          title={`分配 IP · ${allocating.ip}`}
          open
          onClose={() => setAllocating(undefined)}
          onSubmit={(values) => api.allocate(allocating.id, values.serverId)}
        >
          <Form.Item name="serverId" label="绑定服务器" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={eligible.map((server) => ({
                value: server.id,
                label: `${server.name} · ${server.assetTag}`,
              }))}
            />
          </Form.Item>
          <p className="muted small">
            同
            IDC、状态允许的设备可选；同一设备同用途只能绑定一个地址，冲突会被拒绝。带外地址不满足装机的业务
            IP 条件。
          </p>
        </FormModal>
      )}
    </>
  );
}
