import { Alert, Button, Card, Form, Input, Select, Space, Table } from 'antd';
import { useCallback, useState } from 'react';
import { api } from '../../shared/api/client';
import type { CredentialInput, CredentialProfile } from '../../shared/api/contracts';
import { FormModal, QueryView, useConfirmedAction, useQuery } from '../../shared/ui';

function CredentialFields() {
  const form = Form.useFormInstance<CredentialInput>();
  const method = Form.useWatch('method', form);
  return (
    <>
      <Form.Item
        name="name"
        label="配置名称"
        rules={[{ required: true, whitespace: true, max: 64 }]}
      >
        <Input maxLength={64} />
      </Form.Item>
      <Form.Item name="method" label="认证方式" rules={[{ required: true }]}>
        <Select
          onChange={(value) => form.setFieldValue('protocol', value === 'in-band' ? 'ssh' : 'ipmi')}
          options={[
            { value: 'in-band', label: '带内' },
            { value: 'out-of-band', label: '带外' },
          ]}
        />
      </Form.Item>
      <Form.Item name="protocol" label="协议（模拟）" rules={[{ required: true }]}>
        <Select
          options={(method === 'in-band' ? ['ssh'] : ['ipmi', 'redfish']).map((value) => ({
            value,
            label: value.toUpperCase(),
          }))}
        />
      </Form.Item>
      <Form.Item
        name="usernameAlias"
        label="虚构用户名别名"
        rules={[
          {
            required: true,
            pattern: /^demo-[a-zA-Z0-9-]+$/,
            max: 32,
            message: '使用 demo- 开头的虚构别名，最多 32 字符',
          },
        ]}
      >
        <Input maxLength={32} />
      </Form.Item>
      <p>秘密占位：••••••••（固定显示，无实际密码，不可显示或设置）</p>
    </>
  );
}
export function CredentialManager() {
  const query = useQuery(useCallback(() => api.credentials(), []));
  const [editing, setEditing] = useState<CredentialProfile | 'new'>();
  const confirm = useConfirmedAction();
  return (
    <Card
      className="query-card"
      title="发现认证配置"
      extra={
        <Button type="primary" onClick={() => setEditing('new')}>
          新增虚构认证配置
        </Button>
      }
    >
      <Alert
        className="page-note"
        type="warning"
        showIcon
        title="不要输入真实用户名、密码、令牌或生产信息"
        description="本页只管理 demo- 别名、协议和固定掩码，没有密码字段。不会连接 SSH/BMC，也不保存秘密。历史任务保留配置元数据快照。"
      />
      <QueryView query={query}>
        {(profiles) => (
          <Table<CredentialProfile>
            rowKey="id"
            size="middle"
            dataSource={profiles}
            scroll={{ x: 800 }}
            columns={[
              { title: '名称', dataIndex: 'name' },
              {
                title: '方式',
                dataIndex: 'method',
                render: (method) => (method === 'in-band' ? '带内' : '带外'),
              },
              {
                title: '协议',
                dataIndex: 'protocol',
                render: (protocol) => protocol.toUpperCase(),
              },
              { title: '虚构别名', dataIndex: 'usernameAlias' },
              { title: '秘密占位', dataIndex: 'secretMask' },
              {
                title: '操作',
                render: (_, profile) => (
                  <Space>
                    <Button type="link" onClick={() => setEditing(profile)}>
                      编辑配置
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() =>
                        confirm('删除虚构认证配置', profile.name, () =>
                          api.deleteCredential(profile.id),
                        )
                      }
                    >
                      删除配置
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </QueryView>
      {editing && (
        <FormModal<CredentialInput>
          title={editing === 'new' ? '新增虚构认证配置' : '编辑虚构认证配置'}
          open
          onClose={() => setEditing(undefined)}
          initialValues={
            editing === 'new'
              ? { method: 'in-band', protocol: 'ssh', usernameAlias: 'demo-operator' }
              : {
                  name: editing.name,
                  method: editing.method,
                  protocol: editing.protocol,
                  usernameAlias: editing.usernameAlias,
                }
          }
          onSubmit={(values) =>
            editing === 'new'
              ? api.createCredential(values)
              : api.editCredential(editing.id, values)
          }
        >
          <CredentialFields />
        </FormModal>
      )}
    </Card>
  );
}
