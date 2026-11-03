import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Select,
  Space,
  Table,
  Progress,
  Drawer,
  Timeline,
} from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import type { Installation } from '../../shared/api/contracts';
import { api } from '../../shared/api/client';
import {
  EmptyState,
  FormModal,
  PageHeader,
  QueryView,
  StatusTag,
  timeText,
  useQuery,
} from '../../shared/ui';

type InstallInput = {
  serverId: string;
  image: Installation['image'];
  method: Installation['method'];
  simulateFailure?: boolean;
};
export function Provisioning() {
  const [create, setCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const tasks = useQuery(
    useCallback(() => api.installations({ page }), [page]),
    1000,
  );
  const resources = useQuery(
    useCallback(
      async () => ({
        servers: (await api.servers({ pageSize: 100 })).items,
        addresses: (await api.addresses({ pageSize: 100 })).items,
      }),
      [],
    ),
  );
  const eligible =
    resources.data?.servers.filter(
      (s) =>
        ['ready', 'maintenance'].includes(s.status) &&
        resources.data?.addresses.some((a) => a.serverId === s.id),
    ) ?? [];
  const task = tasks.data?.items.find((t) => t.id === selected);
  return (
    <>
      <PageHeader
        eyebrow="OS PROVISIONING"
        title="系统安装"
        description="选择目标、方式与镜像，观察一次可追溯的模拟系统交付。"
        extra={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setCreate(true)}>
            新建装机任务
          </Button>
        }
      />
      <Alert
        className="page-note"
        type="warning"
        showIcon
        title="模拟装机，不会写入任何真实磁盘"
        description="PXE / ISO 均为演示流程；未执行真实引导、镜像下载或系统安装。目标设备需先分配 IP。"
      />
      <Card>
        <QueryView query={tasks}>
          {(data) => (
            <Table<Installation>
              size="middle"
              rowKey="id"
              scroll={{ x: 900 }}
              dataSource={data.items}
              pagination={{
                current: page,
                pageSize: 10,
                total: data.total,
                onChange: setPage,
                showSizeChanger: false,
              }}
              locale={{
                emptyText: <EmptyState text="还没有装机任务。先分配 IP，再创建一次模拟安装。" />,
              }}
              columns={[
                {
                  title: '任务 / 时间（UTC）',
                  dataIndex: 'id',
                  render: (id, t) => (
                    <div>
                      <strong className="mono">{id}</strong>
                      <div className="muted small">{timeText(t.createdAt)}</div>
                    </div>
                  ),
                },
                {
                  title: '目标服务器',
                  dataIndex: 'serverId',
                  render: (id) => resources.data?.servers.find((s) => s.id === id)?.name ?? id,
                },
                { title: '镜像', dataIndex: 'image' },
                { title: '方式', dataIndex: 'method', render: (method) => method.toUpperCase() },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (status) => <StatusTag status={status} />,
                },
                {
                  title: '进度',
                  dataIndex: 'progress',
                  width: 150,
                  render: (n, t) => (
                    <Progress
                      percent={n}
                      size="small"
                      status={t.status === 'failed' ? 'exception' : undefined}
                    />
                  ),
                },
                {
                  title: '操作',
                  render: (_, t) => (
                    <Button type="link" onClick={() => setSelected(t.id)}>
                      任务日志
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryView>
      </Card>
      {create && (
        <FormModal<InstallInput>
          title="新建模拟装机任务"
          open
          onClose={() => setCreate(false)}
          onSubmit={async (values) => {
            await api.install(values);
            setPage(1);
          }}
          initialValues={{ image: 'ubuntu-24.04', method: 'pxe', simulateFailure: false }}
        >
          <Form.Item name="serverId" label="目标服务器" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={eligible.map((s) => ({
                value: s.id,
                label: `${s.name} · ${resources.data?.addresses.find((a) => a.serverId === s.id)?.ip}`,
              }))}
              notFoundContent="暂无符合条件的服务器，请先分配 IP"
            />
          </Form.Item>
          <Form.Item name="image" label="系统镜像" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS（演示）' },
                { value: 'rocky-9', label: 'Rocky Linux 9（演示）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="method" label="安装方式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'pxe', label: 'PXE 网络安装（模拟）' },
                { value: 'iso', label: 'ISO 挂载（模拟）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="simulateFailure" valuePropName="checked">
            <Checkbox>模拟镜像校验失败，验证错误处理</Checkbox>
          </Form.Item>
          <p className="muted small">
            提交后目标进入“装机中”；完成或失败后自动更新状态。原型不保留刷新前的数据。
          </p>
        </FormModal>
      )}
      <Drawer title="模拟任务日志" open={!!selected} onClose={() => setSelected(undefined)}>
        {task ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <strong className="mono">{task.id}</strong>
            <StatusTag status={task.status} />
            <Progress
              percent={task.progress}
              status={task.status === 'failed' ? 'exception' : undefined}
            />
            <Timeline
              items={task.logs.map((log) => ({
                content: log,
                color: task.status === 'failed' && log.includes('失败') ? 'red' : 'green',
              }))}
            />
            <Alert type="info" title="以上均为 Mock 生成的演示日志" />
          </Space>
        ) : (
          <EmptyState text="任务不在当前列表页。请返回该任务所在页面。" />
        )}
      </Drawer>
    </>
  );
}
