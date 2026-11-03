import {
  Alert,
  App as AntApp,
  Button,
  ConfigProvider,
  Drawer,
  Layout,
  Menu,
  Select,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  CloudServerOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  MenuOutlined,
  RadarChartOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { Overview } from '../features/overview/Overview';
import { Inventory } from '../features/inventory/Inventory';
import { Facilities } from '../features/facilities/Facilities';
import { Discovery } from '../features/discovery/Discovery';
import { Network } from '../features/network/Network';
import { Provisioning } from '../features/provisioning/Provisioning';
import { Audit } from '../features/audit/Audit';
import { RefreshContext } from '../shared/ui';
import { mockService } from '../shared/api/mock';
import type { Scenario } from '../shared/api/mock';

const navigation = [
  { key: '/', icon: <AppstoreOutlined />, label: '资源总览' },
  { key: '/facilities', icon: <ApartmentOutlined />, label: 'IDC 资源' },
  { key: '/inventory', icon: <CloudServerOutlined />, label: '服务器资产' },
  { key: '/discovery', icon: <RadarChartOutlined />, label: '设备发现' },
  { key: '/network', icon: <DeploymentUnitOutlined />, label: 'IP 资源池' },
  { key: '/provisioning', icon: <ExperimentOutlined />, label: '系统安装' },
  { key: '/audit', icon: <AuditOutlined />, label: '操作审计' },
];
function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((v) => v + 1);
  const nav = (
    <>
      <Link to="/" className="brand">
        <span className="brand-mark">o</span>
        <div>
          <strong>oak</strong>
          <small>BARE METAL CLOUD</small>
        </div>
      </Link>
      <div className="nav-section">工作空间</div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={navigation}
        onClick={({ key }) => {
          navigate(key);
          setMobile(false);
        }}
      />
      <div className="sidebar-bottom">
        <Tag color="green">PRODUCT PREVIEW</Tag>
        <p>MamreTek 产品实验室</p>
        <span>让基础设施回归有序。</span>
      </div>
    </>
  );
  return (
    <RefreshContext.Provider value={{ revision, refresh }}>
      <Layout className="app-layout">
        <Layout.Sider width={224} className="desktop-sidebar">
          {nav}
        </Layout.Sider>
        <Drawer
          placement="left"
          open={mobile}
          onClose={() => setMobile(false)}
          className="mobile-nav"
          styles={{ body: { background: '#102923', padding: 0 } }}
          size={260}
        >
          {nav}
        </Drawer>
        <Layout className="main-layout">
          <Layout.Header className="topbar">
            <Space>
              <Button
                className="mobile-menu"
                icon={<MenuOutlined />}
                aria-label="打开导航"
                onClick={() => setMobile(true)}
              />
              <span className="breadcrumb">
                MamreTek <span>/</span> Oak <span>/</span>{' '}
                <strong>{navigation.find((n) => n.key === location.pathname)?.label}</strong>
              </span>
            </Space>
            <Space>
              <span className="environment-dot" />
              <span className="muted topbar-label">隔离演示环境</span>
              <span className="avatar">O</span>
            </Space>
          </Layout.Header>
          <Layout.Content className="content">
            <div className="prototype-banner">
              <Space>
                <ExperimentOutlined />
                <strong>产品原型 / 模拟数据</strong>
                <span className="banner-detail">尚无真实后端与权限保护 · 不用于生产</span>
              </Space>
              <div className="demo-controls">
                <Select
                  size="small"
                  aria-label="演示场景"
                  value={scenario}
                  options={[
                    { value: 'normal', label: '正常场景' },
                    { value: 'empty', label: '空数据场景' },
                    { value: 'error', label: '服务失败场景' },
                  ]}
                  onChange={(value) => {
                    mockService.setScenario(value);
                    setScenario(value);
                    refresh();
                  }}
                />
                <Tooltip title="恢复种子数据，清除当前演示操作">
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      mockService.reset();
                      setScenario('normal');
                      refresh();
                    }}
                  >
                    重置
                  </Button>
                </Tooltip>
              </div>
            </div>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/facilities" element={<Facilities />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/discovery" element={<Discovery />} />
              <Route path="/network" element={<Network />} />
              <Route path="/provisioning" element={<Provisioning />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <footer className="app-footer">
              <span>OAK / INFRASTRUCTURE, ORGANIZED.</span>
              <span>© 2026 MamreTek · Prototype 0.1</span>
            </footer>
          </Layout.Content>
        </Layout>
      </Layout>
      <Alert className="screen-reader-note" title="当前为无权限保护的模拟产品原型" />
    </RefreshContext.Provider>
  );
}
export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#217a5c',
          colorInfo: '#217a5c',
          colorBgLayout: '#f4f6f5',
          colorText: '#172f27',
          borderRadius: 8,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Menu: {
            darkItemBg: '#102923',
            darkItemSelectedBg: '#25513f',
            darkItemHoverBg: '#1c3a30',
          },
          Card: { headerFontSize: 15 },
          Table: { headerBg: '#f8faf9' },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
