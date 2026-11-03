import { Alert, Button, Card, Form, Input, InputNumber, Progress, Select, Table, Tag } from 'antd';
import { RadarChartOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import type { Candidate, Discovery as DiscoveryTask } from '../../shared/api/contracts';
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

export function Discovery() {
  const [create, setCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState<{ task: DiscoveryTask; candidate: Candidate }>();
  const tasks = useQuery(
    useCallback(() => api.discoveries({ page }), [page]),
    1000,
  );
  const resources = useQuery(
    useCallback(
      async () => ({
        pools: await api.pools(),
        facilities: await api.facilities(),
        servers: (await api.servers({ pageSize: 100 })).items,
      }),
      [],
    ),
  );
  const selectedPool = resources.data?.pools.find((p) => p.id === importing?.task.poolId);
  const racks =
    resources.data?.facilities
      .filter((f) => f.id === selectedPool?.dataCenterId)
      .flatMap((f) => f.racks) ?? [];
  const nextUnit =
    Array.from({ length: 41 }, (_, i) => i + 1).find(
      (u) =>
        !resources.data?.servers.some(
          (s) =>
            s.rackId === racks[0]?.id &&
            s.status !== 'retired' &&
            u <= s.unit + s.height - 1 &&
            u + 1 >= s.unit,
        ),
    ) ?? 1;
  return (
    <>
      <PageHeader
        eyebrow="DEVICE DISCOVERY"
        title="设备发现"
        description="模拟带内 / 带外发现，确认位置后将新设备纳入资产清单。"
        extra={
          <Button type="primary" icon={<RadarChartOutlined />} onClick={() => setCreate(true)}>
            新建发现任务
          </Button>
        }
      />
      <Alert
        className="page-note"
        type="info"
        showIcon
        title="隔离发现演示"
        description="仅使用文档保留网段生成合成设备，不进行网络扫描，也不连接 BMC。发现结果需确认入库。"
      />
      <Card>
        <QueryView query={tasks}>
          {(data) => (
            <Table<DiscoveryTask>
              size="middle"
              rowKey="id"
              dataSource={data.items}
              scroll={{ x: 750 }}
              locale={{ emptyText: <EmptyState text="还没有发现任务。选择一个演示网段开始。" /> }}
              pagination={{
                current: page,
                pageSize: 10,
                total: data.total,
                onChange: setPage,
                showSizeChanger: false,
              }}
              columns={[
                {
                  title: '发现任务',
                  dataIndex: 'id',
                  render: (id, t) => (
                    <div>
                      <strong className="mono">{id}</strong>
                      <div className="muted small">{timeText(t.createdAt)} UTC</div>
                    </div>
                  ),
                },
                {
                  title: '目标网段',
                  dataIndex: 'poolId',
                  render: (id) => resources.data?.pools.find((p) => p.id === id)?.cidr ?? id,
                },
                {
                  title: '方式',
                  dataIndex: 'method',
                  render: (method) => (method === 'in-band' ? '带内发现' : '带外发现'),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (status) => <StatusTag status={status} />,
                },
                {
                  title: '进度',
                  dataIndex: 'progress',
                  width: 180,
                  render: (progress) => <Progress percent={progress} size="small" />,
                },
              ]}
              expandable={{
                defaultExpandAllRows: true,
                expandedRowRender: (task) =>
                  task.status !== 'succeeded' ? (
                    <p className="muted">模拟发现进行中，完成后显示候选设备。</p>
                  ) : (
                    <Table<Candidate>
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={task.candidates}
                      columns={[
                        { title: '候选设备', dataIndex: 'name' },
                        { title: '型号', dataIndex: 'model' },
                        { title: '演示序列号', dataIndex: 'serial' },
                        {
                          title: '操作',
                          render: (_, candidate) =>
                            candidate.importedServerId ? (
                              <Tag color="green">已入库</Tag>
                            ) : (
                              <Button type="link" onClick={() => setImporting({ task, candidate })}>
                                确认入库
                              </Button>
                            ),
                        },
                      ]}
                    />
                  ),
              }}
            />
          )}
        </QueryView>
      </Card>
      {create && (
        <FormModal<{ poolId: string; method: DiscoveryTask['method'] }>
          title="新建模拟发现任务"
          open
          onClose={() => setCreate(false)}
          onSubmit={async (values) => {
            await api.discover(values.poolId, values.method);
            setPage(1);
          }}
          initialValues={{ method: 'out-of-band' }}
        >
          <Form.Item name="poolId" label="演示网段" rules={[{ required: true }]}>
            <Select
              options={resources.data?.pools.map((p) => ({
                value: p.id,
                label: `${p.name} · ${p.cidr}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="method" label="发现方式" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'in-band', label: '带内发现（模拟）' },
                { value: 'out-of-band', label: '带外发现（模拟 BMC）' },
              ]}
            />
          </Form.Item>
        </FormModal>
      )}
      {importing && (
        <FormModal<{ assetTag: string; rackId: string; unit: number }>
          title={`确认入库 · ${importing.candidate.model}`}
          open
          onClose={() => setImporting(undefined)}
          onSubmit={(values) =>
            api.importCandidate(importing.task.id, {
              ...values,
              candidateId: importing.candidate.id,
            })
          }
          initialValues={{
            assetTag: `OAK-${importing.candidate.id.toUpperCase()}`,
            rackId: racks[0]?.id,
            unit: nextUnit,
          }}
        >
          <p className="mono">{importing.candidate.serial}</p>
          <Form.Item
            name="assetTag"
            label="资产编号"
            rules={[
              {
                required: true,
                pattern: /^[A-Za-z0-9-]{1,32}$/,
                message: '仅限 1–32 位字母、数字和连字符',
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="rackId" label="目标机架" rules={[{ required: true }]}>
            <Select options={racks.map((r) => ({ value: r.id, label: `${r.room} / ${r.name}` }))} />
          </Form.Item>
          <Form.Item name="unit" label="起始 U 位（设备占 2U）" rules={[{ required: true }]}>
            <InputNumber min={1} max={41} precision={0} />
          </Form.Item>
        </FormModal>
      )}
    </>
  );
}
