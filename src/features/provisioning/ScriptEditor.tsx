import { Alert, Button, Form, Input, Select, Space } from 'antd';
import { useState } from 'react';
import { api } from '../../shared/api/client';
import { demoScripts } from '../../shared/api/configuration-rules';
import type {
  InstallTemplate,
  ScriptCheck,
  ScriptType,
  TemplateVersionInput,
} from '../../shared/api/contracts';
import { errorText, FormModal } from '../../shared/ui';

export function ScriptFields() {
  const form = Form.useFormInstance();
  const [report, setReport] = useState<ScriptCheck>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Alert
        className="form-note"
        showIcon
        type="warning"
        title="仅编辑虚构脚本文本，禁止输入生产脚本或真实凭据"
        description="文本不会执行或作为 HTML 渲染。检查只覆盖部分结构和常见敏感形式，不代表完整语法、兼容性或安全验证。"
      />
      <Form.Item name="scriptType" label="脚本类型" rules={[{ required: true }]}>
        <Select
          onChange={() => setReport(undefined)}
          options={(['shell', 'kickstart', 'python'] as ScriptType[]).map((value) => ({
            value,
            label: value === 'shell' ? 'Shell' : value === 'kickstart' ? 'Kickstart' : 'Python',
          }))}
        />
      </Form.Item>
      <Form.Item
        name="content"
        label="模板脚本内容"
        rules={[{ required: true, whitespace: true, max: 20000 }]}
      >
        <Input.TextArea
          className="mono"
          rows={12}
          maxLength={20000}
          showCount
          spellCheck={false}
          onChange={() => {
            setReport(undefined);
            setError(undefined);
          }}
        />
      </Form.Item>
      <Space wrap className="form-note">
        <Button
          onClick={() => {
            const type = form.getFieldValue('scriptType') as ScriptType;
            form.setFieldValue('content', demoScripts[type] ?? demoScripts.shell);
            setReport(undefined);
          }}
        >
          替换为虚构示例
        </Button>
        <Button
          loading={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError(undefined);
            try {
              setReport(
                await api.checkScript(
                  form.getFieldValue('scriptType'),
                  form.getFieldValue('content') ?? '',
                ),
              );
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          基础文本检查
        </Button>
      </Space>
      {report && (
        <Alert
          type={report.valid ? 'success' : 'error'}
          showIcon
          title={report.valid ? '基础文本检查通过' : '基础文本检查未通过'}
          description={
            <>
              {report.issues.join('；')}
              <p>{report.limitation}</p>
            </>
          }
        />
      )}
      {error && <Alert role="alert" type="error" title={error} />}
    </>
  );
}
export function ScriptEditor({
  template,
  onClose,
  onSaved,
}: {
  template: InstallTemplate;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <FormModal<TemplateVersionInput>
      title={`编辑脚本并保存新版本 · ${template.name}`}
      open
      onClose={onClose}
      initialValues={{
        version: `${template.version}.1`,
        scriptType: template.scriptType,
        content: template.content,
      }}
      onSubmit={async (input) => {
        await api.versionTemplate(template.id, input);
        onSaved();
      }}
    >
      <Alert type="info" title={`原版本 ${template.version} 保留，历史装机任务快照不会修改。`} />
      <Form.Item
        name="version"
        label="新版本号"
        rules={[{ required: true, whitespace: true, max: 32 }]}
      >
        <Input maxLength={32} />
      </Form.Item>
      <ScriptFields />
    </FormModal>
  );
}
