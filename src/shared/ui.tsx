import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Empty,
  Form,
  Modal,
  Result,
  Skeleton,
  Space,
  Tag,
} from 'antd';
import { Link } from 'react-router-dom';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ServerStatus, TaskStatus } from './api/contracts';
import { ApiError } from './api/client';

export const RefreshContext = createContext({ revision: 0, refresh: () => {} });
export function useQuery<T>(load: () => Promise<T>, poll = 0) {
  const { revision } = useContext(RefreshContext);
  const [epoch, setEpoch] = useState(0);
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: string }>({
    loading: true,
  });
  const reload = useCallback(() => setEpoch((e) => e + 1), []);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    async function run() {
      try {
        const data = await load();
        if (active) setState({ data, loading: false });
      } catch (error) {
        if (active)
          setState((s) => ({
            ...s,
            loading: false,
            error: error instanceof Error ? error.message : '加载失败',
          }));
      }
      if (active && poll)
        timer = setTimeout(() => {
          void run();
        }, poll);
    }
    void run();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load, poll, revision, epoch]);
  return { ...state, reload };
}
export function QueryView<T>({
  query,
  children,
}: {
  query: ReturnType<typeof useQuery<T>>;
  children: (data: T) => ReactNode;
}) {
  if (query.error)
    return (
      <Result
        status="error"
        title="资源加载失败"
        subTitle={query.error}
        extra={<Button onClick={query.reload}>重新加载</Button>}
      />
    );
  if (query.loading || query.data === undefined)
    return (
      <div className="loading-card" role="status" aria-label="资源加载中">
        <Skeleton active paragraph={{ rows: 7 }} />
      </div>
    );
  return <>{children(query.data)}</>;
}
export function PageHeader({
  title,
  description,
  extra,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  extra?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <Breadcrumb items={[{ title: <Link to="/">首页</Link> }, { title }]} />
      <div className="page-heading-main">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {extra && <div className="heading-actions">{extra}</div>}
      </div>
    </section>
  );
}
export const statusText: Record<ServerStatus | TaskStatus, string> = {
  ready: '可用',
  installing: '装机中',
  maintenance: '维护中',
  retired: '已退役',
  pending: '等待中',
  running: '运行中',
  succeeded: '已完成',
  failed: '失败',
};
export function StatusTag({ status }: { status: ServerStatus | TaskStatus }) {
  const color = (
    {
      ready: 'green',
      installing: 'blue',
      maintenance: 'orange',
      retired: 'default',
      pending: 'default',
      running: 'blue',
      succeeded: 'green',
      failed: 'red',
    } as const
  )[status];
  return <Tag color={color}>{statusText[status]}</Tag>;
}
export const timeText = (utc: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(utc));
export const errorText = (error: unknown) =>
  error instanceof ApiError
    ? `${error.message}（${error.details.requestId}）`
    : error instanceof Error
      ? error.message
      : '操作失败，请重试';
export function EmptyState({ text = '暂无资源，可先添加或切回正常场景。' }: { text?: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text} />;
}
export function FormModal<T extends object>({
  title,
  open,
  onClose,
  onSubmit,
  initialValues,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: T) => Promise<unknown>;
  initialValues?: Partial<T>;
  children: ReactNode;
}) {
  const [form] = Form.useForm<T>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const { message } = App.useApp();
  const { refresh } = useContext(RefreshContext);
  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={busy}
      okText="确认"
      cancelText="取消"
      destroyOnHidden
      mask={{ closable: !busy }}
      closable={!busy}
      cancelButtonProps={{ disabled: busy }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        preserve={false}
        onFinish={async (values) => {
          if (busy) return;
          setBusy(true);
          setError(undefined);
          try {
            await onSubmit(values);
            message.success('模拟操作成功');
            refresh();
            onClose();
          } catch (e) {
            setError(errorText(e));
            if (e instanceof ApiError && e.details.error.fields)
              form.setFields(
                Object.entries(e.details.error.fields).map(([name, value]) => ({
                  name,
                  errors: [value],
                })) as Parameters<typeof form.setFields>[0],
              );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Alert
          title="仅操作演示数据，不会连接真实设备。"
          type="info"
          showIcon
          className="form-note"
        />
        {children}
        {error && <Alert title={error} type="error" showIcon role="alert" />}
      </Form>
    </Modal>
  );
}
export function useConfirmedAction() {
  const { modal, message } = App.useApp();
  const { refresh } = useContext(RefreshContext);
  return (title: string, target: string, action: () => Promise<unknown>) =>
    modal.confirm({
      title,
      content: (
        <Space orientation="vertical">
          <strong>{target}</strong>
          <span>仅修改模拟状态。请确认目标与操作。</span>
        </Space>
      ),
      okText: '确认模拟操作',
      cancelText: '取消',
      async onOk() {
        try {
          await action();
          message.success('模拟操作成功');
          refresh();
        } catch (e) {
          message.error(errorText(e));
          throw e;
        }
      },
    });
}
