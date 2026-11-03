import { Alert, Button, Card, Form, Input, InputNumber, Space, Table, Tag } from 'antd';
import { useCallback, useState } from 'react';
import { api } from '../../shared/api/client';
import type { LocationInput, LocationKind, LocationNode } from '../../shared/api/contracts';
import { FormModal, QueryView, useConfirmedAction, useQuery } from '../../shared/ui';

export const locationLabels: Record<LocationKind, string> = {
  idc: 'IDC',
  building: '楼栋',
  room: '机房',
  rack: '机架',
};
export function LocationManager() {
  const query = useQuery(useCallback(() => api.locations(), []));
  const [editing, setEditing] = useState<{
    kind: LocationKind;
    parentId: string | null;
    node?: LocationNode;
  }>();
  const confirm = useConfirmedAction();
  type Row = LocationNode & { children?: Row[] };
  const tree = (nodes: LocationNode[], parentId: string | null): Row[] =>
    nodes
      .filter((node) => node.parentId === parentId)
      .map((node) => {
        const children = tree(nodes, node.id);
        return { ...node, ...(children.length ? { children } : {}) };
      });
  const childKind: Partial<Record<LocationKind, LocationKind>> = {
    idc: 'building',
    building: 'room',
    room: 'rack',
  };
  return (
    <Card
      className="query-card"
      title="资源层级管理"
      extra={
        <Button type="primary" onClick={() => setEditing({ kind: 'idc', parentId: null })}>
          新增 IDC
        </Button>
      }
    >
      <Alert
        type="info"
        showIcon
        className="page-note"
        title="IDC → 楼栋 → 机房 → 机架"
        description="仅合成位置数据。父级创建后不可移动；有子级、设备或网段引用时不可删除，机架缩容不能挤占已有 U 位。"
      />
      <QueryView query={query}>
        {(nodes) => (
          <Table<Row>
            rowKey="id"
            size="middle"
            scroll={{ x: 820 }}
            pagination={false}
            dataSource={tree(nodes, null)}
            expandable={{ defaultExpandAllRows: true }}
            columns={[
              { title: '名称', dataIndex: 'name', width: 270 },
              {
                title: '类型',
                dataIndex: 'kind',
                render: (kind: LocationKind) => <Tag>{locationLabels[kind]}</Tag>,
              },
              {
                title: '属性',
                render: (_, node) =>
                  node.kind === 'idc'
                    ? node.city
                    : node.kind === 'rack'
                      ? `${node.capacity} U`
                      : '—',
              },
              {
                title: '操作',
                render: (_, node) => (
                  <Space wrap>
                    {childKind[node.kind] && (
                      <Button
                        type="link"
                        onClick={() =>
                          setEditing({ kind: childKind[node.kind]!, parentId: node.id })
                        }
                      >
                        新增{locationLabels[childKind[node.kind]!]}
                      </Button>
                    )}
                    <Button
                      type="link"
                      onClick={() => setEditing({ kind: node.kind, parentId: node.parentId, node })}
                    >
                      编辑位置
                    </Button>
                    <Button
                      type="link"
                      danger
                      onClick={() =>
                        confirm('删除模拟位置', node.name, () => api.deleteLocation(node.id))
                      }
                    >
                      删除位置
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </QueryView>
      {editing && (
        <FormModal<LocationInput>
          title={`${editing.node ? '编辑' : '新增'}${locationLabels[editing.kind]}`}
          open
          onClose={() => setEditing(undefined)}
          initialValues={editing.node ?? { name: '', city: '', capacity: 42 }}
          onSubmit={async (values) => {
            if (editing.node)
              await api.editLocation(editing.node.id, {
                name: values.name,
                city: values.city,
                capacity: values.capacity,
              });
            else
              await api.createLocation({
                ...values,
                kind: editing.kind,
                parentId: editing.parentId,
              });
          }}
        >
          <p>父级：{query.data?.find((node) => node.id === editing.parentId)?.name ?? '根级'}</p>
          <Form.Item
            name="name"
            label="位置名称"
            rules={[{ required: true, whitespace: true, max: 64 }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          {editing.kind === 'idc' && (
            <Form.Item
              name="city"
              label="城市（虚构数据）"
              rules={[{ required: true, whitespace: true, max: 64 }]}
            >
              <Input maxLength={64} />
            </Form.Item>
          )}
          {editing.kind === 'rack' && (
            <Form.Item name="capacity" label="机架容量（U）" rules={[{ required: true }]}>
              <InputNumber min={1} max={42} precision={0} />
            </Form.Item>
          )}
        </FormModal>
      )}
    </Card>
  );
}
