import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../app/App';
import { api } from '../shared/api/client';
import { mockService } from '../shared/api/mock';

describe('Resource management screens', () => {
  beforeEach(() => {
    configure({ asyncUtilTimeout: 5000 });
    mockService.reset();
  });
  it('uses four independent menus to create, edit, inspect and delete resources', async () => {
    window.history.replaceState({}, '', '/facilities');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'IDC管理' });
    expect(window.location.pathname).toBe('/idcs');
    await waitFor(() => expect(screen.getByRole('button', { name: '新增 IDC' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '新增 IDC' }));
    async function save(label: string, name: string, parent?: [string, string], city?: string) {
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByLabelText(`${label}名称`));
      await user.clear(within(dialog).getByLabelText(`${label}名称`));
      await user.paste(name);
      if (city) {
        await user.click(within(dialog).getByLabelText('城市（虚构数据）'));
        await user.paste(city);
      }
      if (parent) {
        await user.click(within(dialog).getByLabelText(`所属${parent[0]}`));
        await user.click(
          await screen.findByText(parent[1], { selector: '.ant-select-item-option-content' }),
        );
      }
      await user.click(within(dialog).getByRole('button', { name: '确 认' }));
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
    }
    await save('IDC', 'Demo IDC', undefined, 'Demo City');
    for (const [label, name, parentLabel, path] of [
      ['楼栋', 'Demo Building', 'IDC', 'Demo IDC'],
      ['机房', 'Demo Room', '楼栋', 'Demo IDC / Demo Building'],
      ['机架', 'Demo Rack', '机房', 'Demo IDC / Demo Building / Demo Room'],
    ]) {
      await user.click(screen.getByRole('menuitem', { name: `apartment ${label}管理` }));
      await screen.findByRole('heading', { name: `${label}管理` });
      await waitFor(() =>
        expect(screen.getByRole('button', { name: `新增${label}` })).toBeEnabled(),
      );
      await user.click(screen.getByRole('button', { name: `新增${label}` }));
      await save(label, name, [parentLabel, path]);
      await screen.findByRole('row', { name: new RegExp(name) });
    }
    let row = await screen.findByRole('row', { name: /Demo Rack/ });
    await user.click(within(row).getByRole('button', { name: '编辑' }));
    await save('机架', 'Demo Rack Edited');
    row = await screen.findByRole('row', { name: /Demo Rack Edited/ });
    await user.click(within(row).getByRole('button', { name: '详情' }));
    const detail = await screen.findByRole('dialog');
    expect(
      within(detail).getByText('Demo IDC / Demo Building / Demo Room / Demo Rack Edited'),
    ).toBeInTheDocument();
    expect(await within(detail).findByText('0 台设备 · 0 / 42 U')).toBeInTheDocument();
    await user.click(within(detail).getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(detail).not.toBeInTheDocument());
    const dc = (await api.facilities()).find((entry) => entry.name === 'Demo IDC')!;
    expect(dc.racks[0]).toMatchObject({ name: 'Demo Rack Edited', room: 'Demo Room' });
    await user.click(within(row).getByRole('button', { name: '删除' }));
    const deletion = await screen.findByRole('dialog');
    await user.click(within(deletion).getByRole('button', { name: '确认模拟操作' }));
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Demo Rack Edited/ })).not.toBeInTheDocument(),
    );
  }, 90000);
  it('explains missing parents and recovers a resource page from service failure', async () => {
    mockService.reset('empty');
    window.history.replaceState({}, '', '/buildings');
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText('请先在IDC管理中创建父级资源。')).toBeInTheDocument();
    expect(screen.getByText('暂无楼栋，可新增资源或调整查询条件。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增楼栋' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: '演示场景' }));
    await user.click(
      await screen.findByText('服务失败场景', { selector: '.ant-select-item-option-content' }),
    );
    await screen.findByText('资源加载失败');
    await user.click(screen.getByRole('combobox', { name: '演示场景' }));
    await user.click(
      await screen.findByText('正常场景', { selector: '.ant-select-item-option-content' }),
    );
    expect(await screen.findByRole('row', { name: /building-dc-east/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新增楼栋' })).toBeEnabled();
  }, 30000);
  it('creates a subnet and allocates an out-of-band address at the second level', async () => {
    window.history.replaceState({}, '', '/network');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '新增演示网段' }));
    const dialog = await screen.findByRole('dialog');
    for (const [label, text] of [
      ['网段名称', 'Demo OOB subnet'],
      ['文档保留 CIDR', '203.0.113.0/28'],
      ['演示网关', '203.0.113.1'],
    ]) {
      await user.click(within(dialog).getByLabelText(label));
      await user.paste(text);
    }
    await user.click(within(dialog).getByLabelText('所属 IDC'));
    await user.click(
      await screen.findByText('东区演示中心', { selector: '.ant-select-item-option-content' }),
    );
    await user.click(within(dialog).getByLabelText('网段用途'));
    await user.click(
      await screen.findByText('带外', { selector: '.ant-select-item-option-content' }),
    );
    await user.click(within(dialog).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    const poolRow = await screen.findByRole('row', { name: /Demo OOB subnet/ });
    await user.click(within(poolRow).getByRole('button', { name: 'IP 管理' }));
    expect(await screen.findByRole('heading', { name: '网段内 IP 管理' })).toBeInTheDocument();
    const addressRow = await screen.findByRole('row', { name: /203\.0\.113\.2\s/ });
    await user.click(within(addressRow).getByRole('button', { name: '分配 IP' }));
    const allocation = await screen.findByRole('dialog');
    await user.click(within(allocation).getByLabelText('绑定服务器'));
    await user.click(
      await screen.findByText('oak-east-01 · OAK-0001', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await user.click(within(allocation).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(allocation).not.toBeInTheDocument());
    expect(
      await screen.findByRole('row', { name: /203\.0\.113\.2 已分配 oak-east-01/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '返回网段列表' }));
    expect(
      await screen.findByRole('row', { name: /Demo OOB subnet.*1 \/ 13/ }),
    ).toBeInTheDocument();
  }, 60000);
  it('edits and checks script text while preserving the original template version', async () => {
    window.history.replaceState({}, '', '/images');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('tab', { name: '装机模板' }));
    const row = await screen.findByRole('row', { name: /Ubuntu 24.04 LTS 标准配置/ });
    await user.click(within(row).getByRole('button', { name: '编辑脚本' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('脚本类型'));
    await user.click(
      await screen.findByText('Kickstart', { selector: '.ant-select-item-option-content' }),
    );
    await user.click(within(dialog).getByRole('button', { name: '替换为虚构示例' }));
    expect((within(dialog).getByLabelText('模板脚本内容') as HTMLTextAreaElement).value).toContain(
      'rootpw --lock',
    );
    await user.click(within(dialog).getByRole('button', { name: '基础文本检查' }));
    await within(dialog).findByText('基础文本检查通过');
    await user.click(within(dialog).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    const versions = (await api.templates({ pageSize: 100 })).items.filter(
      (entry) => entry.name === 'Ubuntu 24.04 LTS 标准配置',
    );
    expect(versions.find((entry) => entry.version === '1.1')?.scriptType).toBe('kickstart');
    expect(versions.find((entry) => entry.version === '1')?.scriptType).toBe('shell');
  }, 45000);
  it('creates a masked profile and selects it for a matching discovery method', async () => {
    window.history.replaceState({}, '', '/discovery');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: '认证配置' }));
    await user.click(screen.getByRole('button', { name: '新增虚构认证配置' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('input[type="password"]')).toBeNull();
    await user.click(within(dialog).getByLabelText('配置名称'));
    await user.paste('Demo SSH profile');
    await user.click(within(dialog).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(
      await screen.findByRole('row', { name: /Demo SSH profile.*••••••••/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /新建发现任务/ }));
    const task = await screen.findByRole('dialog');
    await user.click(within(task).getByLabelText('演示网段'));
    await user.click(
      await screen.findByText('东区业务网络 · 192.0.2.0/24', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await user.click(within(task).getByLabelText('发现方式'));
    await user.click(
      await screen.findByText('带内发现（模拟）', { selector: '.ant-select-item-option-content' }),
    );
    await user.click(within(task).getByLabelText('虚构认证配置'));
    await user.click(
      await screen.findByText('Demo SSH profile · SSH', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await user.click(within(task).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(task).not.toBeInTheDocument());
    expect((await api.discoveries()).items[0].credential.name).toBe('Demo SSH profile');
  }, 60000);
});
