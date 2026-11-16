import { Alert, Button, Card, Col, Progress, Row, Space, Statistic, Tag } from 'antd';
import { ArrowRightOutlined, DatabaseOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useCallback } from 'react';
import { api } from '../../shared/api/client';
import { EmptyState, PageHeader, QueryView, StatusTag, useQuery } from '../../shared/ui';

export function Overview() {
  const query = useQuery(api.dashboard, 5000);
  const facilities = useQuery(
    useCallback(async () => {
      const [list, inventory] = await Promise.all([
        api.facilities(),
        api.servers({ pageSize: 100 }),
      ]);
      return list.map((dc) => ({
        ...dc,
        capacity: dc.racks.reduce((sum, rack) => sum + rack.capacity, 0),
        usedUnits: inventory.items
          .filter(
            (server) =>
              server.status !== 'retired' && dc.racks.some((rack) => rack.id === server.rackId),
          )
          .reduce((sum, server) => sum + server.height, 0),
      }));
    }, []),
  );
  return (
    <>
      <PageHeader
        eyebrow="INFRASTRUCTURE OVERVIEW"
        title="资源总览"
        description="查看服务器状态、IDC 容量、网络资源和装机任务。"
        extra={
          <Link to="/discovery">
            <Button type="primary" icon={<DeploymentUnitOutlined />}>
              发现新设备
            </Button>
          </Link>
        }
      />
      <QueryView query={query}>
        {(data) => (
          <>
            <Row gutter={[16, 16]} className="metric-grid">
              {[
                {
                  title: '服务器总数',
                  value: data.total,
                  note: '覆盖全部演示数据中心',
                },
                {
                  title: '可用服务器',
                  value: data.available,
                  note: '完成网络分配后可装机',
                },
                {
                  title: '装机进行中',
                  value: data.installing,
                  note: '任务进度自动更新',
                },
                {
                  title: '需关注设备',
                  value: data.warning,
                  note: '模拟告警 · 无真实通知',
                },
              ].map((item) => (
                <Col xs={12} xl={6} key={item.title}>
                  <Card className="metric-card">
                    <Statistic title={item.title} value={item.value} />
                    <div className="metric-note">{item.note}</div>
                  </Card>
                </Col>
              ))}
            </Row>
            <Row gutter={[20, 20]}>
              <Col xs={24} xl={15}>
                <Card
                  title="资源分布"
                  extra={
                    <Link to="/facilities">
                      查看 IDC 资源 <ArrowRightOutlined />
                    </Link>
                  }
                >
                  <QueryView query={facilities}>
                    {(list) =>
                      list.length ? (
                        <div className="facility-overview">
                          {list.map((dc) => (
                            <div className="facility-line" key={dc.id}>
                              <div className="dc-symbol">
                                <DatabaseOutlined />
                              </div>
                              <div className="facility-info">
                                <strong>{dc.name}</strong>
                                <span>
                                  {dc.city} · {dc.racks.length} 个机架 · {dc.usedUnits}/
                                  {dc.capacity} U
                                </span>
                                <Progress
                                  size="small"
                                  percent={Math.round((dc.usedUnits / dc.capacity) * 100)}
                                  showInfo={false}
                                />
                              </div>
                              <Tag color="green">演示可用</Tag>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState />
                      )
                    }
                  </QueryView>
                  <div className="resource-footer">
                    <span>IP 地址使用率</span>
                    <strong>
                      {data.addressesUsed} / {data.addressesTotal}
                    </strong>
                    <Progress
                      percent={
                        data.addressesTotal
                          ? Math.round((data.addressesUsed / data.addressesTotal) * 100)
                          : 0
                      }
                      showInfo={false}
                    />
                  </div>
                </Card>
              </Col>
              <Col xs={24} xl={9}>
                <Card title="交付工作流" className="workflow-card">
                  <div className="workflow-intro">设备发现、网络分配与系统交付。</div>
                  {[
                    ['01', '发现与入库', '识别带内 / 带外演示设备', '/discovery'],
                    ['02', '分配网络资源', '绑定地址，检查资源冲突', '/network'],
                    ['03', '模拟系统安装', '选择镜像并跟踪任务', '/provisioning'],
                  ].map(([n, title, subtitle, url]) => (
                    <Link className="workflow-step" to={url} key={n}>
                      <span className="step-number">{n}</span>
                      <span>
                        <strong>{title}</strong>
                        <small>{subtitle}</small>
                      </span>
                      <ArrowRightOutlined />
                    </Link>
                  ))}
                </Card>
              </Col>
              <Col xs={24} xl={15}>
                <Card
                  title="最近装机任务"
                  extra={
                    <Link to="/provisioning">
                      全部任务 <ArrowRightOutlined />
                    </Link>
                  }
                >
                  {data.installations.length ? (
                    data.installations.map((task) => (
                      <div className="task-line" key={task.id}>
                        <span className="mono">{task.id}</span>
                        <span>{task.image}</span>
                        <StatusTag status={task.status} />
                        <Progress
                          size="small"
                          percent={task.progress}
                          status={task.status === 'failed' ? 'exception' : undefined}
                        />
                      </div>
                    ))
                  ) : (
                    <EmptyState text="还没有装机任务。完成网络分配后，开始第一次模拟交付。" />
                  )}
                </Card>
              </Col>
              <Col xs={24} xl={9}>
                <Card title="资源健康提醒">
                  {data.alerts.length ? (
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      {data.alerts.map((alert) => (
                        <Alert
                          key={alert.serverId}
                          title={
                            <Link to={`/inventory?server=${alert.serverId}`}>{alert.name}</Link>
                          }
                          description={alert.message}
                          type="warning"
                          showIcon
                        />
                      ))}
                    </Space>
                  ) : (
                    <EmptyState text="当前没有模拟告警。" />
                  )}
                  <p className="muted small">健康指标为固定合成数据，不连接真实监控系统。</p>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </QueryView>
    </>
  );
}
