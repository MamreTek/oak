import {
  Alert,
  App as AntApp,
  Avatar,
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
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
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
  const [collapsed, setCollapsed] = useState(false);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((v) => v + 1);
  const brand = (
    <Link to="/" className="brand">
      <CloudServerOutlined className="brand-icon" />
      <strong>Oak</strong>
    </Link>
  );
  const menu = (
    <Menu
      theme="light"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={navigation}
      onClick={({ key }) => {
        navigate(key);
        setMobile(false);
      }}
    />
  );
  return (
    <RefreshContext.Provider value={{ revision, refresh }}>
      <Layout className={`app-layout ${collapsed ? 'nav-collapsed' : ''}`}>
        <Layout.Header className="topbar">
          <div className="topbar-left">
            <Button
              type="text"
              className="mobile-menu"
              icon={<MenuOutlined />}
              aria-label="打开导航"
              onClick={() => setMobile(true)}
            />
            {brand}
            <Button
              type="text"
              className="desktop-collapse"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
              onClick={() => setCollapsed((value) => !value)}
            />
            <span className="product-name">裸金属资源管理</span>
          </div>
          <Space size={12}>
            <Tag color="blue">产品原型</Tag>
            <span className="topbar-label">模拟环境</span>
            <Avatar size="small">O</Avatar>
          </Space>
        </Layout.Header>
        <Layout className="workspace-layout">
          <Layout.Sider
            width={208}
            collapsedWidth={64}
            collapsed={collapsed}
            theme="light"
            trigger={null}
            className="desktop-sidebar"
          >
            {menu}
            {!collapsed && <div className="sidebar-bottom">MamreTek · Oak</div>}
          </Layout.Sider>
          <Drawer
            placement="left"
            open={mobile}
            onClose={() => setMobile(false)}
            className="mobile-nav"
            styles={{ body: { padding: 0 } }}
            size={256}
          >
            <div className="drawer-brand">{brand}</div>
            {menu}
          </Drawer>
          <Layout className="main-layout">
            <Layout.Content className="content">
              <div className="prototype-banner">
                <Alert
                  type="info"
                  showIcon
                  title={
                    <Space wrap size={8}>
                      <strong>产品原型 / 模拟数据</strong>
                      <span>尚无真实后端与权限保护 · 不用于生产</span>
                    </Space>
                  }
                />
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
              <footer className="app-footer">© 2026 MamreTek · Oak 产品原型</footer>
            </Layout.Content>
          </Layout>
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
      componentSize="middle"
      theme={{
        token: {
          colorPrimary: '#1890ff',
          colorInfo: '#1890ff',
          colorBgLayout: '#f5f5f5',
          colorText: 'rgba(0,0,0,0.88)',
          fontSize: 14,
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Layout: { headerBg: '#fff', siderBg: '#fff' },
          Menu: { itemBorderRadius: 4, itemHeight: 40 },
          Card: { headerFontSize: 16 },
          Table: { headerBg: '#fafafa', cellPaddingBlockMD: 8 },
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
