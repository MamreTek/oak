import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { mockService } from '../shared/api/mock';
import { api } from '../shared/api/client';

describe('prototype interactions', () => {
  beforeEach(() => {
    mockService.reset();
    window.history.replaceState({}, '', '/');
  });
  it('labels the prototype, navigates to inventory, validates and creates an asset', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('产品原型 / 模拟数据')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '资源加载中' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'cloud-server 服务器资产' }));
    await screen.findByRole('heading', { name: '服务器资产' });
    await user.click(screen.getByRole('button', { name: /添加服务器/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0));
    await user.click(within(dialog).getByLabelText('服务器名称'));
    await user.paste('oak-ui-test');
    await user.click(within(dialog).getByLabelText('资产编号'));
    await user.paste('OAK-UI-TEST');
    await user.click(within(dialog).getByLabelText('演示序列号'));
    await user.paste('DEMO-UI-TEST');
    await user.click(within(dialog).getByLabelText('设备型号'));
    await user.paste('Demo Server');
    await user.click(within(dialog).getByLabelText('机架'));
    await user.click(await screen.findByText('东区演示中心 / A01'));
    await user.click(within(dialog).getByRole('button', { name: '确 认' }));
    // Ant Design restores focus after the leave animation. Wait for the actual
    // dialog node to unmount, not merely for its role to become inaccessible.
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect((await api.servers({ q: 'oak-ui-test' })).total).toBe(1);
    const search = screen.getByRole('searchbox', { name: '搜索服务器' });
    await user.click(search);
    await user.paste('oak-ui-test');
    expect(search).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(search).toHaveValue('oak-ui-test');
    expect(
      await screen.findByRole('button', { name: 'oak-ui-test' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  }, 30000);
  it('recovers from a service error and displays empty data through the shared adapter', async () => {
    const user = userEvent.setup();
    render(<App />);
    const scenario = screen.getByRole('combobox', { name: '演示场景' });
    await user.click(scenario);
    await user.click(
      await screen.findByText('服务失败场景', { selector: '.ant-select-item-option-content' }),
    );
    await screen.findByText('资源加载失败');
    await user.click(scenario);
    await user.click(
      await screen.findByText('空数据场景', { selector: '.ant-select-item-option-content' }),
    );
    await screen.findByText('当前没有模拟告警。');
    await user.click(screen.getByRole('button', { name: /重置/ }));
    expect(await screen.findByText('oak-east-06')).toBeInTheDocument();
  }, 10000);
  it('opens the mobile navigation drawer and follows a destination', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '打开导航' }));
    const drawer = await screen.findByRole('dialog');
    await user.click(within(drawer).getByRole('menuitem', { name: 'audit 操作审计' }));
    expect(await screen.findByRole('heading', { name: '操作审计' })).toBeInTheDocument();
  }, 10000);
});
