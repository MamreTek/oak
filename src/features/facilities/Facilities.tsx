import { Card, Col, Row, Tag, Tooltip } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { api } from '../../shared/api/client';
import { EmptyState, PageHeader, QueryView, useQuery } from '../../shared/ui';
import { useCallback } from 'react';
import { LocationManager } from './LocationManager';

export function Facilities() {
  const query = useQuery(
    useCallback(
      async () => ({
        facilities: await api.facilities(),
        servers: (await api.servers({ pageSize: 100 })).items,
      }),
      [],
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow="DATA CENTER RESOURCES"
        title="IDC 资源"
        description="管理 IDC、楼栋、机房与机架，并查看设备 U 位占用。所有内容为演示数据。"
      />
      <LocationManager />
      <QueryView query={query}>
        {({ facilities, servers }) =>
          facilities.length ? (
            <Row gutter={[20, 20]}>
              {facilities.map((dc) => (
                <Col xs={24} xl={12} key={dc.id}>
                  <Card
                    title={
                      <span>
                        <DatabaseOutlined /> {dc.name}
                      </span>
                    }
                    extra={<Tag>{dc.city} · 演示</Tag>}
                  >
                    <div className="rack-grid">
                      {dc.racks.map((rack) => {
                        const members = servers.filter(
                          (s) => s.rackId === rack.id && s.status !== 'retired',
                        );
                        const used = members.reduce((total, s) => total + s.height, 0);
                        return (
                          <div className="rack-card" key={rack.id}>
                            <div className="rack-title">
                              <strong>{rack.name}</strong>
                              <span>{rack.room}</span>
                            </div>
                            <div className="rack-units">
                              {Array.from(
                                { length: rack.capacity },
                                (_, i) => rack.capacity - i,
                              ).map((u) => {
                                const server = members.find(
                                  (s) => u >= s.unit && u < s.unit + s.height,
                                );
                                return (
                                  <Tooltip
                                    title={
                                      server
                                        ? `${server.name} · U${server.unit}–${server.unit + server.height - 1}`
                                        : `U${u} · 空闲`
                                    }
                                    key={u}
                                  >
                                    <div className={`rack-unit ${server ? 'occupied' : ''}`}>
                                      <span>{String(u).padStart(2, '0')}</span>
                                      <i />
                                      {server && u === server.unit + server.height - 1 && (
                                        <b>{server.assetTag}</b>
                                      )}
                                    </div>
                                  </Tooltip>
                                );
                              })}
                            </div>
                            <div className="rack-caption">
                              {members.length} 台设备 · {used} / {rack.capacity} U
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Card>
              <EmptyState />
            </Card>
          )
        }
      </QueryView>
    </>
  );
}
