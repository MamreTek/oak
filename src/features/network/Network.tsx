import { Button, Card, Col, Form, Input, Row, Select, Statistic, Table, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import type { Address, ListQuery } from '../../shared/api/contracts';
import { api } from '../../shared/api/client';
import {
  EmptyState,
  FormModal,
  PageHeader,
  QueryView,
  useConfirmedAction,
  useQuery,
} from '../../shared/ui';

export function Network() {
  const [query, setQuery] = useState<ListQuery>({ page: 1, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [allocating, setAllocating] = useState<Address>();
  const addresses = useQuery(useCallback(() => api.addresses(query), [query]));
  const resources = useQuery(
    useCallback(
      async () => ({
        pools: await api.pools(),
        servers: (await api.servers({ pageSize: 100 })).items,
        facilities: await api.facilities(),
        addresses: (await api.addresses({ pageSize: 100 })).items,
      }),
      [],
    ),
  );
  const confirm = useConfirmedAction();
  const update = (values: Partial<ListQuery>) =>
    setQuery((old) => ({ ...old, ...values, page: values.page ?? 1 }));
  const pool = resources.data?.pools.find((p) => p.id === allocating?.poolId);
  const eligible =
    resources.data?.servers.filter(
      (s) =>
        ['ready', 'maintenance'].includes(s.status) &&
        resources.data?.facilities
          .find((f) => f.id === pool?.dataCenterId)
          ?.racks.some((r) => r.id === s.rackId) &&
        !resources.data?.addresses.some((a) => a.serverId === s.id),
    ) ?? [];
  return (
    <>
      <PageHeader
        eyebrow="NETWORK RESOURCES"
        title="IP 资源池"
        description="查看演示网段、分配和回收地址，保持设备与网络资源一致。"
      />
      <QueryView query={resources}>
        {(data) => (
          <Row gutter={[16, 16]} className="pool-grid">
            {data.pools.length ? (
              data.pools.map((p) => {
                const list = data.addresses.filter((a) => a.poolId === p.id);
                const used = list.filter((a) => a.serverId).length;
                return (
                  <Col xs={24} md={12} key={p.id}>
                    <Card className="pool-card" title={p.name} extra={<Tag>IPv4 · 演示</Tag>}>
                      <div className="pool-summary">
                        <div>
                          <strong className="pool-cidr mono">{p.cidr}</strong>
                          <p className="muted">网关 {p.gateway} · 文档保留地址</p>
                        </div>
                        <Statistic
                          title="空闲 / 总地址"
                          value={list.length - used}
                          suffix={`/ ${list.length}`}
                        />
                      </div>
                      <div className="address-cells">
                        {list.map((a) => (
                          <span
                            key={a.id}
                            title={`${a.ip} ${a.serverId ? '已分配' : '空闲'}`}
                            className={a.serverId ? 'allocated' : ''}
                          >
                            {a.ip.split('.').pop()}
                          </span>
                        ))}
                      </div>
                      <div className="pool-caption">
                        已分配 {used} · 空闲 {list.length - used} · 本期仅演示 16 个可分配地址
                      </div>
                    </Card>
                  </Col>
                );
              })
            ) : (
              <Col span={24}>
                <Card>
                  <EmptyState />
                </Card>
              </Col>
            )}
          </Row>
        )}
      </QueryView>
      <Card title="地址分配">
        <div className="table-toolbar">
          <Input.Search
            value={search}
            prefix={<SearchOutlined />}
            placeholder="搜索 IP 地址"
            enterButton="查询"
            aria-label="搜索 IP 地址"
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(q) => update({ q })}
            allowClear
            style={{ width: 280 }}
          />
          <Select
            placeholder="全部网段"
            aria-label="筛选 IP 网段"
            allowClear
            style={{ width: 220 }}
            options={resources.data?.pools.map((p) => ({ value: p.id, label: p.cidr }))}
            onChange={(poolId) => update({ poolId })}
          />
          <Select
            placeholder="全部分配状态"
            aria-label="筛选 IP 状态"
            allowClear
            options={[
              { value: 'free', label: '空闲' },
              { value: 'allocated', label: '已分配' },
            ]}
            onChange={(status) => update({ status })}
            style={{ width: 160 }}
          />
        </div>
        <QueryView query={addresses}>
          {(data) => (
            <Table<Address>
              size="middle"
              rowKey="id"
              scroll={{ x: 700 }}
              dataSource={data.items}
              locale={{ emptyText: <EmptyState text="没有匹配的 IP 地址。" /> }}
              pagination={{
                current: data.page,
                pageSize: data.pageSize,
                total: data.total,
                showSizeChanger: false,
                onChange: (page) => update({ page }),
              }}
              columns={[
                {
                  title: 'IP 地址',
                  dataIndex: 'ip',
                  sorter: true,
                  render: (ip) => <strong className="mono">{ip}</strong>,
                },
                {
                  title: '资源池',
                  dataIndex: 'poolId',
                  render: (id) => resources.data?.pools.find((p) => p.id === id)?.name,
                },
                {
                  title: '状态',
                  dataIndex: 'serverId',
                  render: (id) => <Tag color={id ? 'blue' : 'green'}>{id ? '已分配' : '空闲'}</Tag>,
                },
                {
                  title: '绑定设备',
                  dataIndex: 'serverId',
                  render: (id) => resources.data?.servers.find((s) => s.id === id)?.name ?? '—',
                },
                {
                  title: '操作',
                  render: (_, a) =>
                    a.serverId ? (
                      <Button
                        type="link"
                        danger
                        onClick={() =>
                          confirm(
                            '回收模拟 IP',
                            `${a.ip} · ${resources.data?.servers.find((s) => s.id === a.serverId)?.name}`,
                            () => api.release(a.id),
                          )
                        }
                      >
                        回收
                      </Button>
                    ) : (
                      <Button type="link" onClick={() => setAllocating(a)}>
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
              options={eligible.map((s) => ({ value: s.id, label: `${s.name} · ${s.assetTag}` }))}
              notFoundContent="该数据中心没有未绑定 IP 的可用设备"
            />
          </Form.Item>
          <p className="muted small">只显示同一数据中心内尚未绑定业务 IP 的设备。</p>
        </FormModal>
      )}
    </>
  );
}
