import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import { api } from '../../shared/api/client';
import type {
  ImageArtifact,
  ImageInput,
  InstallTemplate,
  TemplateInput,
} from '../../shared/api/contracts';
import { EmptyState, FormModal, PageHeader, QueryView, useQuery } from '../../shared/ui';

export function Artifacts() {
  const [q, setQ] = useState('');
  const [imagePage, setImagePage] = useState(1);
  const [templatePage, setTemplatePage] = useState(1);
  const [create, setCreate] = useState<'image' | 'template'>();
  const [detail, setDetail] = useState<ImageArtifact | InstallTemplate>();
  const images = useQuery(useCallback(() => api.images({ q, page: imagePage }), [q, imagePage]));
  const templates = useQuery(
    useCallback(() => api.templates({ q, page: templatePage }), [q, templatePage]),
  );
  const choices = useQuery(useCallback(() => api.images({ pageSize: 100 }), []));
  const imageName = (id: string) => choices.data?.items.find((item) => item.id === id)?.name ?? id;
  return (
    <>
      <PageHeader
        title="镜像与模板"
        description="维护系统介质记录和版本化装机配置，为任务提供明确的交付参数。"
      />
      <Alert
        className="page-note"
        type="info"
        showIcon
        title="仅保存演示元数据"
        description="不上传或下载镜像，不执行模板。SHA-256 为声明值，未校验真实文件；“就绪”仅表示演示记录可选。记录创建后保持不变，变更配置请创建新版本。"
      />
      <Card>
        <Input.Search
          aria-label="查询镜像与模板"
          placeholder="搜索名称或版本"
          allowClear
          onSearch={(value) => {
            setQ(value.trim());
            setImagePage(1);
            setTemplatePage(1);
          }}
          style={{ maxWidth: 360, marginBottom: 16 }}
        />
        <Tabs
          items={[
            {
              key: 'images',
              label: '系统镜像',
              children: (
                <>
                  <div className="table-toolbar">
                    <strong>镜像列表</strong>
                    <Space style={{ marginLeft: 'auto' }}>
                      <Button icon={<ReloadOutlined />} onClick={images.reload}>
                        刷新
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreate('image')}
                      >
                        新增镜像
                      </Button>
                    </Space>
                  </div>
                  <QueryView query={images}>
                    {(data) => (
                      <Table<ImageArtifact>
                        rowKey="id"
                        size="middle"
                        scroll={{ x: 800 }}
                        dataSource={data.items}
                        pagination={{
                          current: imagePage,
                          total: data.total,
                          pageSize: 10,
                          onChange: setImagePage,
                          showSizeChanger: false,
                        }}
                        locale={{
                          emptyText: <EmptyState text="暂无镜像记录，可新增演示元数据。" />,
                        }}
                        columns={[
                          {
                            title: '名称 / 版本',
                            render: (_, image) => (
                              <>
                                <strong>{image.name}</strong>
                                <div className="muted small">
                                  {image.version} · {image.architecture}
                                </div>
                              </>
                            ),
                          },
                          {
                            title: '系统系列',
                            dataIndex: 'family',
                            render: (family) => (family === 'ubuntu' ? 'Ubuntu' : 'Rocky Linux'),
                          },
                          { title: '介质说明', dataIndex: 'sourceLabel' },
                          {
                            title: '状态',
                            dataIndex: 'status',
                            render: (status) => (
                              <Tag color={status === 'ready' ? 'green' : 'default'}>
                                {status === 'ready' ? '就绪（演示）' : '草稿'}
                              </Tag>
                            ),
                          },
                          {
                            title: '操作',
                            render: (_, image) => (
                              <Button type="link" onClick={() => setDetail(image)}>
                                镜像详情
                              </Button>
                            ),
                          },
                        ]}
                      />
                    )}
                  </QueryView>
                </>
              ),
            },
            {
              key: 'templates',
              label: '装机模板',
              children: (
                <>
                  <div className="table-toolbar">
                    <strong>模板列表</strong>
                    <Space style={{ marginLeft: 'auto' }}>
                      <Button icon={<ReloadOutlined />} onClick={templates.reload}>
                        刷新
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreate('template')}
                      >
                        新增模板
                      </Button>
                    </Space>
                  </div>
                  <QueryView query={templates}>
                    {(data) => (
                      <Table<InstallTemplate>
                        rowKey="id"
                        size="middle"
                        scroll={{ x: 800 }}
                        dataSource={data.items}
                        pagination={{
                          current: templatePage,
                          total: data.total,
                          pageSize: 10,
                          onChange: setTemplatePage,
                          showSizeChanger: false,
                        }}
                        locale={{ emptyText: <EmptyState text="暂无模板，请先建立镜像记录。" /> }}
                        columns={[
                          {
                            title: '模板 / 版本',
                            render: (_, template) => (
                              <>
                                <strong>{template.name}</strong>
                                <div className="muted small">版本 {template.version}</div>
                              </>
                            ),
                          },
                          { title: '关联镜像', dataIndex: 'imageId', render: imageName },
                          {
                            title: '启动模式',
                            dataIndex: 'bootMode',
                            render: (mode) => mode.toUpperCase(),
                          },
                          {
                            title: '磁盘 / 分区',
                            render: (_, template) =>
                              `${template.rootDisk} / ${template.partitionLayout === 'lvm' ? 'LVM' : '标准分区'}`,
                          },
                          {
                            title: '操作',
                            render: (_, template) => (
                              <Button type="link" onClick={() => setDetail(template)}>
                                模板详情
                              </Button>
                            ),
                          },
                        ]}
                      />
                    )}
                  </QueryView>
                </>
              ),
            },
          ]}
        />
      </Card>
      {create === 'image' && (
        <FormModal<ImageInput>
          title="新增演示镜像"
          open
          onClose={() => setCreate(undefined)}
          onSubmit={async (input) => {
            await api.createImage(input);
            setImagePage(1);
          }}
          initialValues={{ family: 'ubuntu', architecture: 'x86_64', status: 'draft' }}
        >
          <Form.Item
            name="name"
            label="镜像名称"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item
            name="version"
            label="镜像版本"
            rules={[{ required: true, whitespace: true, max: 32 }]}
          >
            <Input maxLength={32} />
          </Form.Item>
          <div className="form-row">
            <Form.Item name="family" label="系统系列" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'ubuntu', label: 'Ubuntu' },
                  { value: 'rocky', label: 'Rocky Linux' },
                ]}
              />
            </Form.Item>
            <Form.Item name="architecture" label="介质架构" rules={[{ required: true }]}>
              <Select options={[{ value: 'x86_64', label: 'x86_64（本期）' }]} />
            </Form.Item>
          </div>
          <Form.Item
            name="sourceLabel"
            label="介质说明"
            rules={[{ required: true, whitespace: true, max: 128 }]}
          >
            <Input maxLength={128} placeholder="填写演示来源说明，不接收文件或下载链接" />
          </Form.Item>
          <Form.Item
            name="checksum"
            label="声明 SHA-256"
            rules={[
              { required: true },
              { pattern: /^[a-fA-F0-9]{64}$/, message: '填写 64 位十六进制声明值' },
            ]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="status" label="记录状态" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'draft', label: '草稿' },
                { value: 'ready', label: '就绪（仅演示）' },
              ]}
            />
          </Form.Item>
        </FormModal>
      )}
      {create === 'template' && (
        <FormModal<TemplateInput>
          title="新增装机模板"
          open
          onClose={() => setCreate(undefined)}
          onSubmit={async (input) => {
            await api.createTemplate(input);
            setTemplatePage(1);
          }}
          initialValues={{
            version: '1',
            bootMode: 'uefi',
            rootDisk: 'sda',
            partitionLayout: 'lvm',
            timezone: 'UTC',
          }}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item
            name="version"
            label="模板版本"
            rules={[{ required: true, whitespace: true, max: 32 }]}
          >
            <Input maxLength={32} />
          </Form.Item>
          <Form.Item name="imageId" label="关联镜像" rules={[{ required: true }]}>
            <Select
              options={choices.data?.items.map((image) => ({
                value: image.id,
                label: `${image.name} · ${image.version}`,
              }))}
              notFoundContent="请先新增镜像记录"
            />
          </Form.Item>
          <div className="form-row">
            <Form.Item name="bootMode" label="启动模式" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'uefi', label: 'UEFI' },
                  { value: 'bios', label: 'BIOS' },
                ]}
              />
            </Form.Item>
            <Form.Item name="rootDisk" label="系统磁盘" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'sda', label: 'sda' },
                  { value: 'nvme0n1', label: 'nvme0n1' },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="partitionLayout" label="分区方案" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'lvm', label: 'LVM：启动分区 + 根逻辑卷' },
                { value: 'single', label: '标准分区：启动分区 + 根分区' },
              ]}
            />
          </Form.Item>
          <Form.Item name="timezone" label="系统时区" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'UTC', label: 'UTC' },
                { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
              ]}
            />
          </Form.Item>
        </FormModal>
      )}
      <Drawer
        title={detail && 'checksum' in detail ? '镜像元数据' : '装机模板'}
        open={!!detail}
        onClose={() => setDetail(undefined)}
      >
        {detail && (
          <Descriptions
            column={1}
            bordered
            size="small"
            items={
              'checksum' in detail
                ? [
                    { key: 'name', label: '名称', children: detail.name },
                    { key: 'version', label: '版本', children: detail.version },
                    { key: 'architecture', label: '架构', children: detail.architecture },
                    { key: 'source', label: '介质说明', children: detail.sourceLabel },
                    {
                      key: 'checksum',
                      label: '声明 SHA-256',
                      children: <span className="mono break-text">{detail.checksum}</span>,
                    },
                    {
                      key: 'status',
                      label: '记录状态',
                      children: detail.status === 'ready' ? '就绪（演示）' : '草稿',
                    },
                  ]
                : [
                    { key: 'name', label: '名称', children: detail.name },
                    { key: 'version', label: '版本', children: detail.version },
                    { key: 'image', label: '镜像', children: imageName(detail.imageId) },
                    { key: 'boot', label: '启动模式', children: detail.bootMode.toUpperCase() },
                    { key: 'disk', label: '磁盘', children: detail.rootDisk },
                    {
                      key: 'layout',
                      label: '分区',
                      children: detail.partitionLayout === 'lvm' ? 'LVM' : '标准分区',
                    },
                    { key: 'timezone', label: '时区', children: detail.timezone },
                  ]
            }
          />
        )}
      </Drawer>
    </>
  );
}
