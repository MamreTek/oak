import { Card, Input, Table, Tag } from 'antd';
import { useCallback, useState } from 'react';
import type { AuditEvent, ListQuery } from '../../shared/api/contracts';
import { api } from '../../shared/api/client';
import { EmptyState, PageHeader, QueryView, timeText, useQuery } from '../../shared/ui';

export function Audit() {
  const [query, setQuery] = useState<ListQuery>({ page: 1, pageSize: 10 });
  const events = useQuery(useCallback(() => api.audit(query), [query]));
  return (
    <>
      <PageHeader
        eyebrow="OPERATION HISTORY"
        title="操作审计"
        description="追溯当前演示会话内的模拟操作；不是持久化或防篡改的生产审计。"
      />
      <Card>
        <div className="table-toolbar">
          <Input.Search
            placeholder="搜索动作、目标或请求 ID"
            aria-label="搜索审计事件"
            allowClear
            onSearch={(q) => setQuery({ ...query, q, page: 1 })}
            style={{ width: 360 }}
          />
          <span className="muted small">时间统一显示为 UTC</span>
        </div>
        <QueryView query={events}>
          {(data) => (
            <Table<AuditEvent>
              rowKey="id"
              dataSource={data.items}
              scroll={{ x: 950 }}
              locale={{ emptyText: <EmptyState text="暂无匹配的模拟操作记录。" /> }}
              pagination={{
                current: data.page,
                pageSize: data.pageSize,
                total: data.total,
                showSizeChanger: false,
                onChange: (page) => setQuery({ ...query, page }),
              }}
              columns={[
                { title: '时间（UTC）', dataIndex: 'createdAt', render: timeText },
                { title: '操作', dataIndex: 'action' },
                { title: '目标', dataIndex: 'target' },
                { title: '操作者', dataIndex: 'actor' },
                {
                  title: '结果',
                  dataIndex: 'result',
                  render: (result) => (
                    <Tag color={result === 'success' ? 'green' : 'red'}>
                      {result === 'success' ? '成功' : '失败'}
                    </Tag>
                  ),
                },
                {
                  title: '请求 ID',
                  dataIndex: 'requestId',
                  render: (id) => <span className="mono small">{id}</span>,
                },
              ]}
            />
          )}
        </QueryView>
      </Card>
    </>
  );
}
