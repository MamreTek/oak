import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useCallback, useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ListQuery, Server, ServerInput } from '../../shared/api/contracts';
import { api } from '../../shared/api/client';
import {
  EmptyState,
  FormModal,
  PageHeader,
  QueryView,
  RefreshContext,
  StatusTag,
  statusText,
  timeText,
  useConfirmedAction,
  useQuery,
} from '../../shared/ui';

const statusOptions = ['ready', 'installing', 'maintenance', 'retired'].map((value) => ({
  value,
  label: statusText[value as Server['status']],
}));
export function Inventory() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('server');
  const [query, setQuery] = useState<ListQuery>({
    page: 1,
    pageSize: 10,
    sort: 'assetTag',
    order: 'asc',
  });
  const [search, setSearch] = useState('');
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<string>();
  const servers = useQuery(useCallback(() => api.servers(query), [query]));
  const facilities = useQuery(api.facilities);
  const update = (values: Partial<ListQuery>) =>
    setQuery((old) => ({ ...old, ...values, page: values.page ?? 1 }));
  const racks =
    facilities.data?.flatMap((dc) =>
      dc.racks.map((rack) => ({ value: rack.id, label: `${dc.name} / ${rack.name}` })),
    ) ?? [];
  const activeDetail = detail ?? selected;
  return (
    <>
      <PageHeader
        eyebrow="BARE-METAL INVENTORY"
        title="服务器资产"
        description="统一查看硬件、资源位置与生命周期，所有操作仅作用于演示数据。"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreate(true)}>
            添加服务器
          </Button>
        }
      />
      <Card>
        <div className="table-toolbar">
          <Input.Search
            prefix={<SearchOutlined />}
            placeholder="名称、资产编号、序列号或型号"
            aria-label="搜索服务器"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={(q) => update({ q })}
            allowClear
            style={{ width: 320 }}
          />
          <Select
            aria-label="筛选数据中心"
            placeholder="全部数据中心"
            allowClear
            options={facilities.data?.map((dc) => ({ label: dc.name, value: dc.id }))}
            onChange={(dataCenterId) => update({ dataCenterId })}
            style={{ width: 180 }}
          />
          <Select
            aria-label="筛选服务器状态"
            placeholder="全部状态"
            allowClear
            options={statusOptions}
            onChange={(status) => update({ status })}
            style={{ width: 140 }}
          />
          <Button aria-label="刷新服务器" icon={<ReloadOutlined />} onClick={servers.reload} />
        </div>
        <QueryView query={servers}>
          {(data) => (
            <Table<Server>
              rowKey="id"
              scroll={{ x: 1000 }}
              locale={{
                emptyText: <EmptyState text="没有匹配的服务器。调整筛选或添加一台演示设备。" />,
              }}
              dataSource={data.items}
              pagination={{
                current: data.page,
                pageSize: data.pageSize,
                total: data.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                showTotal: (total) => `共 ${total} 台`,
              }}
              onChange={(pagination, _, sorter) => {
                const sort = Array.isArray(sorter) ? sorter[0] : sorter;
                update({
                  page: pagination.current,
                  pageSize: pagination.pageSize,
                  sort: (sort.field as string) || 'assetTag',
                  order: sort.order === 'descend' ? 'desc' : 'asc',
                });
              }}
              columns={[
                {
                  title: '服务器 / 资产编号',
                  dataIndex: 'assetTag',
                  sorter: true,
                  render: (_, s) => (
                    <div>
                      <Button type="link" className="server-link" onClick={() => setDetail(s.id)}>
                        {s.name}
                      </Button>
                      <div className="muted mono small">{s.assetTag}</div>
                    </div>
                  ),
                },
                {
                  title: '型号',
                  dataIndex: 'model',
                  render: (model, s) => (
                    <div>
                      {model}
                      <div className="muted mono small">{s.serial}</div>
                    </div>
                  ),
                },
                {
                  title: '位置',
                  dataIndex: 'rackId',
                  render: (id, s) => (
                    <span>
                      {racks
                        .find((r) => r.value === id)
                        ?.label.split(' / ')
                        .pop()}{' '}
                      · U{s.unit}
                    </span>
                  ),
                },
                { title: '内存', dataIndex: 'memoryGb', sorter: true, render: (n) => `${n} GB` },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (status) => <StatusTag status={status} />,
                },
                {
                  title: '电源',
                  dataIndex: 'power',
                  render: (value) => (
                    <Tag color={value === 'on' ? 'green' : 'default'}>
                      {value === 'on' ? '已开机' : '已关机'}
                    </Tag>
                  ),
                },
                {
                  title: '操作',
                  render: (_, s) => (
                    <Button type="link" onClick={() => setDetail(s.id)}>
                      查看详情
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryView>
      </Card>
      {create && (
        <FormModal<ServerInput>
          title="添加演示服务器"
          open
          onClose={() => setCreate(false)}
          onSubmit={api.createServer}
          initialValues={{ height: 2, unit: 15, memoryGb: 128 }}
        >
          <Form.Item
            name="name"
            label="服务器名称"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input placeholder="例如 oak-east-13" />
          </Form.Item>
          <Form.Item
            name="assetTag"
            label="资产编号"
            rules={[
              {
                required: true,
                pattern: /^[A-Za-z0-9-]{1,32}$/,
                message: '请输入 1–32 位字母、数字或连字符',
              },
            ]}
          >
            <Input placeholder="例如 OAK-0013" />
          </Form.Item>
          <Form.Item
            name="serial"
            label="演示序列号"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input placeholder="只使用合成序列号" />
          </Form.Item>
          <Form.Item
            name="model"
            label="设备型号"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="rackId" label="机架" rules={[{ required: true }]}>
            <Select options={racks} />
          </Form.Item>
          <div className="form-row">
            <Form.Item name="unit" label="起始 U 位" rules={[{ required: true }]}>
              <InputNumber min={1} max={42} precision={0} />
            </Form.Item>
            <Form.Item name="height" label="高度（U）" rules={[{ required: true }]}>
              <InputNumber min={1} max={8} precision={0} />
            </Form.Item>
            <Form.Item name="memoryGb" label="内存（GB）" rules={[{ required: true }]}>
              <InputNumber min={1} max={8192} precision={0} />
            </Form.Item>
          </div>
        </FormModal>
      )}
      {activeDetail && (
        <ServerDetail
          id={activeDetail}
          onClose={() => {
            setDetail(undefined);
            setParams({});
          }}
        />
      )}
    </>
  );
}
function ServerDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery(
    useCallback(() => api.server(id), [id]),
    2000,
  );
  const confirm = useConfirmedAction();
  const { refresh } = useContext(RefreshContext);
  const { message } = App.useApp();
  return (
    <Drawer title="服务器详情 · 模拟资源" open onClose={onClose} size={640}>
      <QueryView query={query}>
        {(server) => (
          <>
            <div className="detail-header">
              <h2>{server.name}</h2>
              <StatusTag status={server.status} />
            </div>
            <p className="mono muted">
              {server.assetTag} / {server.serial}
            </p>
            <Tabs
              items={[
                {
                  key: 'overview',
                  label: '资产信息',
                  children: (
                    <Descriptions
                      column={1}
                      bordered
                      size="small"
                      items={[
                        { key: 'model', label: '型号', children: server.model },
                        { key: 'cpu', label: 'CPU', children: server.cpu },
                        { key: 'memory', label: '内存', children: `${server.memoryGb} GB` },
                        {
                          key: 'rack',
                          label: '机架 / U 位',
                          children: `${server.rackId} / U${server.unit}–${server.unit + server.height - 1}`,
                        },
                        { key: 'os', label: '操作系统', children: server.os ?? '未安装（模拟）' },
                        {
                          key: 'time',
                          label: '入库时间（UTC）',
                          children: timeText(server.createdAt),
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'monitoring',
                  label: '模拟监控',
                  children: (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <span>CPU 使用率（固定合成指标）</span>
                      <Progress percent={server.power === 'on' ? server.cpuUsage : 0} />
                      <span>内存使用率（固定合成指标）</span>
                      <Progress percent={server.power === 'on' ? server.memoryUsage : 0} />
                      <Tag color={server.health === 'healthy' ? 'green' : 'orange'}>
                        {server.health === 'healthy' ? '演示健康' : '模拟内存告警'}
                      </Tag>
                    </Space>
                  ),
                },
                {
                  key: 'credentials',
                  label: '凭据',
                  children: (
                    <div className="credential-placeholder">
                      <h3>凭据管理待接入</h3>
                      <p>带内密码：••••••（占位）</p>
                      <p>带外密码：••••••（占位）</p>
                      <p className="muted">
                        当前不采集、不生成、不保存或回显任何真实密码。真实凭据管理需后端与权限保护。
                      </p>
                    </div>
                  ),
                },
              ]}
            />
            <h3 className="section-title">模拟远程电源</h3>
            <Space wrap>
              {(['on', 'off', 'reboot'] as const).map((action) => (
                <Button
                  key={action}
                  disabled={server.status === 'retired' || server.status === 'installing'}
                  onClick={() =>
                    confirm(
                      `模拟${{ on: '开机', off: '关机', reboot: '重启' }[action]}`,
                      server.name,
                      () => api.power(server.id, action),
                    )
                  }
                >
                  {{ on: '开机', off: '关机', reboot: '重启' }[action]}
                </Button>
              ))}
            </Space>
            <h3 className="section-title">生命周期</h3>
            <Space wrap>
              {(['ready', 'maintenance', 'retired'] as const)
                .filter((status) => status !== server.status)
                .map((status) => (
                  <Button
                    key={status}
                    danger={status === 'retired'}
                    disabled={server.status === 'retired' || server.status === 'installing'}
                    onClick={() =>
                      confirm(`切换为${statusText[status]}`, server.name, async () => {
                        await api.lifecycle(server.id, status);
                        refresh();
                        message.info('状态仅在当前演示会话内保留');
                      })
                    }
                  >
                    {statusText[status]}
                  </Button>
                ))}
            </Space>
            <p className="muted small">退役前需回收 IP；装机中禁止电源和生命周期变更。</p>
          </>
        )}
      </QueryView>
    </Drawer>
  );
}
