import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Tag,
} from 'antd';
import { useCallback, useState } from 'react';
import { api } from '../../shared/api/client';
import type {
  InstallationParameters,
  InstallationPreview,
  InstallRequest,
  Preflight,
} from '../../shared/api/contracts';
import { errorText, QueryView, timeText, useQuery } from '../../shared/ui';

export function ParameterSummary({ parameters: p }: { parameters: InstallationParameters }) {
  return (
    <Descriptions
      bordered
      size="small"
      column={1}
      items={[
        { key: 'target', label: '目标服务器', children: `${p.serverName} · ${p.serial}` },
        { key: 'hostname', label: '系统主机名', children: p.hostname },
        {
          key: 'image',
          label: '镜像',
          children: `${p.image.name} / ${p.image.version} / ${p.image.architecture}`,
        },
        {
          key: 'template',
          label: '模板版本',
          children: `${p.template.name} / v${p.template.version}`,
        },
        {
          key: 'boot',
          label: '安装与启动',
          children: `${p.method.toUpperCase()} / ${p.template.bootMode.toUpperCase()}`,
        },
        {
          key: 'disk',
          label: '系统磁盘与分区',
          children: `${p.template.rootDisk} / ${p.template.partitionLayout === 'lvm' ? 'LVM（启动分区 + 根逻辑卷）' : '标准分区（启动分区 + 根分区）'}`,
        },
        {
          key: 'address',
          label: '业务网络',
          children: p.address
            ? `${p.address.ip} · 网关 ${p.address.gateway} · ${p.address.cidr}`
            : '未分配 IP',
        },
        { key: 'timezone', label: '系统时区', children: p.template.timezone },
      ]}
    />
  );
}
export function PreflightResults({ report }: { report: Preflight }) {
  return (
    <>
      <Alert
        type={report.passed ? 'success' : 'error'}
        showIcon
        title={report.passed ? 'Mock 规则预检通过' : '预检未通过，请处理阻塞项'}
        description={`检查时间 ${timeText(report.checkedAt)} UTC。通过不代表真实环境可安装，提交时仍重新检查。`}
      />
      <Table
        rowKey="key"
        size="small"
        pagination={false}
        dataSource={report.checks}
        columns={[
          { title: '检查项', dataIndex: 'label', width: 130 },
          {
            title: '结果',
            dataIndex: 'status',
            width: 100,
            render: (status) => (
              <Tag color={status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'orange'}>
                {status === 'pass' ? '通过' : status === 'fail' ? '阻塞' : '未验证'}
              </Tag>
            ),
          },
          { title: '说明', dataIndex: 'message' },
        ]}
      />
    </>
  );
}
export function InstallWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [form] = Form.useForm<InstallRequest>();
  const imageId = Form.useWatch('imageId', form);
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<InstallationPreview>();
  const [input, setInput] = useState<InstallRequest>();
  const [report, setReport] = useState<Preflight>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const resources = useQuery(
    useCallback(
      async () => ({
        servers: (await api.servers({ pageSize: 100 })).items,
        images: (await api.images({ pageSize: 100 })).items,
        templates: (await api.templates({ pageSize: 100 })).items,
      }),
      [],
    ),
  );
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
    <Modal
      title="新建模拟装机任务"
      open
      width={860}
      onCancel={busy ? undefined : onClose}
      closable={!busy}
      mask={{ closable: !busy }}
      footer={
        <Space wrap>
          <Button disabled={busy} onClick={onClose}>
            取消
          </Button>
          {step === 1 && (
            <Button
              disabled={busy}
              onClick={() => {
                setStep(0);
                setReport(undefined);
                setAcknowledged(false);
              }}
            >
              修改参数
            </Button>
          )}
          {step === 0 ? (
            <Button type="primary" loading={busy} onClick={() => form.submit()}>
              预览参数
            </Button>
          ) : (
            <>
              <Button
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const next = await api.preflight(input!);
                    setReport(next);
                    setPreview(next);
                    setInput({ ...input!, expectedIp: next.parameters.address?.ip });
                    setAcknowledged(false);
                  })
                }
              >
                运行预检
              </Button>
              <Button
                type="primary"
                disabled={!report?.passed || !acknowledged || busy}
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    const task = await api.install(input!);
                    onCreated(task.id);
                  })
                }
              >
                确认创建模拟任务
              </Button>
            </>
          )}
        </Space>
      }
    >
      <Steps
        current={step}
        size="small"
        className="provision-steps"
        items={[{ title: '配置参数' }, { title: '预览与预检' }]}
      />
      <Alert
        className="form-note"
        type="warning"
        showIcon
        title="产品原型：不会下载介质、配置 PXE 或写入真实磁盘"
      />
      <QueryView query={resources}>
        {(data) => (
          <>
            <Form
              form={form}
              layout="vertical"
              style={{ display: step === 0 ? 'block' : 'none' }}
              initialValues={{
                imageId: 'ubuntu-24.04',
                templateId: 'tpl-ubuntu-24.04',
                hostname: 'oak-node-01',
                method: 'pxe',
                simulateFailure: false,
              }}
              onValuesChange={() => {
                setReport(undefined);
                setAcknowledged(false);
              }}
              onFinish={(values) =>
                void run(async () => {
                  const result = await api.preview(values);
                  setInput(values);
                  setPreview(result);
                  setReport(undefined);
                  setAcknowledged(false);
                  setStep(1);
                })
              }
            >
              <Form.Item name="serverId" label="目标服务器" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={data.servers.map((server) => ({
                    value: server.id,
                    label: `${server.name} · ${server.serial}`,
                  }))}
                  notFoundContent="请先添加服务器"
                />
              </Form.Item>
              <Form.Item name="imageId" label="系统镜像" rules={[{ required: true }]}>
                <Select
                  onChange={() => form.setFieldValue('templateId', undefined)}
                  options={data.images.map((image) => ({
                    value: image.id,
                    label: `${image.name} · ${image.version}${image.status === 'draft' ? '（草稿，预检将阻塞）' : ''}`,
                  }))}
                  notFoundContent="请先在镜像与模板页面建立记录"
                />
              </Form.Item>
              <Form.Item name="templateId" label="装机模板" rules={[{ required: true }]}>
                <Select
                  options={data.templates
                    .filter((template) => template.imageId === imageId)
                    .map((template) => ({
                      value: template.id,
                      label: `${template.name} · v${template.version}`,
                    }))}
                  notFoundContent="此镜像没有模板，请先新增关联模板"
                />
              </Form.Item>
              <Form.Item
                name="hostname"
                label="系统主机名"
                rules={[
                  { required: true },
                  {
                    pattern: /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/,
                    message: '使用 1–63 位字母、数字或连字符，首尾不能是连字符',
                  },
                ]}
              >
                <Input maxLength={63} />
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
                <Checkbox>模拟镜像校验失败，体验失败与重试</Checkbox>
              </Form.Item>
            </Form>
            {step === 1 && preview && (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <ParameterSummary parameters={preview.parameters} />
                <details>
                  <summary>查看声明式装机计划（不可执行）</summary>
                  <pre className="plan-preview">{preview.plan}</pre>
                </details>
                {report && <PreflightResults report={report} />}
                <Alert
                  type="warning"
                  showIcon
                  title={`覆盖磁盘影响：${preview.parameters.serverName} / ${preview.parameters.template.rootDisk}`}
                  description="真实装机将覆盖目标磁盘。此处仅验证产品流程；磁盘存在性、容量、启动兼容和真实镜像校验均未执行。"
                />
                <Checkbox
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                >
                  我已核对目标与覆盖影响，确认仅创建模拟任务
                </Checkbox>
              </Space>
            )}
          </>
        )}
      </QueryView>
      {error && <Alert className="form-note" role="alert" type="error" showIcon title={error} />}
    </Modal>
  );
}
