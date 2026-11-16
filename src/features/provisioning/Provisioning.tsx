import { Alert, Button, Card, Drawer, Progress, Space, Steps, Table, Tag } from 'antd';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useContext, useState } from 'react';
import { api } from '../../shared/api/client';
import type { Installation, Preflight } from '../../shared/api/contracts';
import {
  EmptyState,
  errorText,
  PageHeader,
  QueryView,
  RefreshContext,
  StatusTag,
  timeText,
  useQuery,
} from '../../shared/ui';
import { InstallWizard, ParameterSummary, PreflightResults } from './InstallWizard';

function TaskDetail({
  id,
  onClose,
  onSelect,
}: {
  id: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const task = useQuery(
    useCallback(() => api.installation(id), [id]),
    1000,
  );
  const { refresh } = useContext(RefreshContext);
  const [report, setReport] = useState<Preflight>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
      setReport(undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer title="装机任务详情（模拟）" size={880} open onClose={onClose}>
      <QueryView query={task}>
        {(data) => (
          <Space orientation="vertical" size={20} style={{ width: '100%' }}>
            <Space wrap>
              <strong className="mono">{data.id}</strong>
              <StatusTag status={data.status} />
              <span className="muted">{timeText(data.createdAt)} UTC</span>
            </Space>
            {data.retryOf && (
              <Alert
                type="info"
                title={
                  <Space wrap>
                    本次为重试任务
                    <Button type="link" onClick={() => onSelect(data.retryOf!)}>
                      查看原失败任务 {data.retryOf}
                    </Button>
                  </Space>
                }
              />
            )}
            <Progress
              percent={data.progress}
              status={data.status === 'failed' ? 'exception' : undefined}
            />
            <Steps
              orientation="vertical"
              size="small"
              items={data.stages.map((stage) => ({
                title: `${stage.label}${stage.status === 'skipped' ? '（已跳过）' : ''}`,
                status:
                  stage.status === 'failed'
                    ? 'error'
                    : stage.status === 'succeeded'
                      ? 'finish'
                      : stage.status === 'running'
                        ? 'process'
                        : 'wait',
                content: stage.finishedAt
                  ? `${timeText(stage.finishedAt)} UTC`
                  : stage.status === 'skipped'
                    ? '前序阶段失败，未继续执行'
                    : stage.status === 'running'
                      ? '正在模拟执行'
                      : '等待前序阶段',
              }))}
            />
            {data.failureReason && (
              <Alert type="error" showIcon title="失败原因" description={data.failureReason} />
            )}
            <details open>
              <summary>本次任务参数快照</summary>
              <div style={{ marginTop: 12 }}>
                <ParameterSummary parameters={data.parameters} />
              </div>
            </details>
            <Table
              size="small"
              rowKey={(event) => `${event.at}-${event.stage}-${event.message}`}
              pagination={false}
              scroll={{ x: 620 }}
              dataSource={data.events}
              columns={[
                { title: '时间（UTC）', dataIndex: 'at', width: 170, render: timeText },
                {
                  title: '级别',
                  dataIndex: 'level',
                  width: 90,
                  render: (level) => (
                    <Tag color={level === 'error' ? 'red' : 'blue'}>{level.toUpperCase()}</Tag>
                  ),
                },
                { title: '阶段日志', dataIndex: 'message' },
              ]}
            />
            {data.status === 'failed' && (
              <>
                <Alert
                  type="warning"
                  showIcon
                  title="重试将沿用本次参数快照，创建关联的新任务"
                  description="原失败记录保留。先重新预检；地址或配置变化时请新建任务。演示故障开关不会继承。重试仍为模拟，不操作设备。"
                />
                {report && <PreflightResults report={report} />}
                <Space wrap>
                  <Button
                    loading={busy}
                    onClick={() =>
                      void run(async () => {
                        setReport(
                          await api.preflight({
                            serverId: data.serverId,
                            imageId: data.parameters.image.id,
                            templateId: data.parameters.template.id,
                            hostname: data.parameters.hostname,
                            method: data.method,
                          }),
                        );
                      })
                    }
                  >
                    预检重试条件
                  </Button>
                  <Button
                    type="primary"
                    disabled={!report?.passed || busy}
                    loading={busy}
                    onClick={() =>
                      void run(async () => {
                        const next = await api.retry(data.id);
                        refresh();
                        onSelect(next.id);
                      })
                    }
                  >
                    确认创建重试任务
                  </Button>
                </Space>
              </>
            )}
            {error && <Alert type="error" role="alert" title={error} showIcon />}
            <Alert type="info" title="日志与阶段均由 Mock 生成；刷新页面会重置任务。" />
          </Space>
        )}
      </QueryView>
    </Drawer>
  );
}
export function Provisioning() {
  const [create, setCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const { refresh } = useContext(RefreshContext);
  const tasks = useQuery(
    useCallback(() => api.installations({ page }), [page]),
    1000,
  );
  return (
    <>
      <PageHeader
        title="系统安装"
        description="从镜像与模板生成参数计划，经预检后观察分阶段交付与失败恢复。"
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
        description="PXE / ISO 均为演示流程。先建立镜像与模板、为设备分配 IP，再预览与预检；真实硬件和网络服务未验证。"
      />
      <Card>
        <div className="table-toolbar">
          <strong>装机任务</strong>
          <Button style={{ marginLeft: 'auto' }} icon={<ReloadOutlined />} onClick={tasks.reload}>
            刷新
          </Button>
        </div>
        <QueryView query={tasks}>
          {(data) => (
            <Table<Installation>
              size="middle"
              rowKey="id"
              scroll={{ x: 980 }}
              dataSource={data.items}
              pagination={{
                current: page,
                pageSize: 10,
                total: data.total,
                onChange: setPage,
                showSizeChanger: false,
              }}
              locale={{
                emptyText: <EmptyState text="暂无装机任务。新建任务可先预览参数和运行预检。" />,
              }}
              columns={[
                {
                  title: '任务 / 时间（UTC）',
                  dataIndex: 'id',
                  render: (id, task) => (
                    <>
                      <strong className="mono">{id}</strong>
                      <div className="muted small">{timeText(task.createdAt)}</div>
                      {task.retryOf && <Tag>重试 {task.retryOf}</Tag>}
                    </>
                  ),
                },
                {
                  title: '目标服务器',
                  render: (_, task) => (
                    <>
                      {task.parameters.serverName}
                      <div className="muted small">{task.parameters.hostname}</div>
                    </>
                  ),
                },
                {
                  title: '镜像 / 模板',
                  render: (_, task) => (
                    <>
                      {task.image}
                      <div className="muted small">
                        {task.parameters.template.name} · v{task.parameters.template.version}
                      </div>
                    </>
                  ),
                },
                { title: '方式', dataIndex: 'method', render: (method) => method.toUpperCase() },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (status) => <StatusTag status={status} />,
                },
                {
                  title: '进度',
                  dataIndex: 'progress',
                  width: 130,
                  render: (n, task) => (
                    <Progress
                      percent={n}
                      size="small"
                      status={task.status === 'failed' ? 'exception' : undefined}
                    />
                  ),
                },
                {
                  title: '操作',
                  render: (_, task) => (
                    <Button type="link" onClick={() => setSelected(task.id)}>
                      阶段与日志
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryView>
      </Card>
      {create && (
        <InstallWizard
          onClose={() => setCreate(false)}
          onCreated={(id) => {
            setCreate(false);
            setPage(1);
            setSelected(id);
            refresh();
          }}
        />
      )}
      {selected && (
        <TaskDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(undefined)}
          onSelect={setSelected}
        />
      )}
    </>
  );
}
