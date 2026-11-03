import { configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app/App';
import { api } from '../../shared/api/client';
import { mockService } from '../../shared/api/mock';

describe('Provisioning screens', () => {
  beforeEach(() => {
    // Concurrent Ant Design/jsdom suites may take longer than the default 1s
    // to render a completed Mock request. Keep all behavioral assertions.
    configure({ asyncUtilTimeout: 5000 });
    mockService.reset();
    window.history.replaceState({}, '', '/provisioning');
  });
  it('requires preflight and acknowledgment, invalidates review on edits, and retries a failed attempt', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /新建装机任务/ }));
    const wizard = await screen.findByRole('dialog');
    await user.click(await within(wizard).findByLabelText('目标服务器'));
    await user.click(
      await screen.findByText('oak-east-01 · DEMO-SN-00001', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await user.click(within(wizard).getByLabelText('模拟镜像校验失败，体验失败与重试'));
    await user.click(within(wizard).getByRole('button', { name: '预览参数' }));
    const submit = await within(wizard).findByRole('button', { name: '确认创建模拟任务' });
    expect(submit).toBeDisabled();
    expect(await within(wizard).findByText('系统磁盘与分区')).toBeInTheDocument();
    await user.click(within(wizard).getByRole('button', { name: '运行预检' }));
    await within(wizard).findByText('Mock 规则预检通过');
    expect(submit).toBeDisabled();
    await user.click(within(wizard).getByLabelText('我已核对目标与覆盖影响，确认仅创建模拟任务'));
    expect(submit).toBeEnabled();
    await user.click(within(wizard).getByRole('button', { name: '修改参数' }));
    await user.clear(within(wizard).getByLabelText('系统主机名'));
    await user.type(within(wizard).getByLabelText('系统主机名'), 'oak-reviewed');
    await user.click(within(wizard).getByRole('button', { name: '预览参数' }));
    await waitFor(() =>
      expect(within(wizard).queryByText('Mock 规则预检通过')).not.toBeInTheDocument(),
    );
    expect(await within(wizard).findByRole('button', { name: '确认创建模拟任务' })).toBeDisabled();
    await user.click(within(wizard).getByRole('button', { name: '运行预检' }));
    await within(wizard).findByText('Mock 规则预检通过');
    await user.click(within(wizard).getByLabelText('我已核对目标与覆盖影响，确认仅创建模拟任务'));
    await user.click(within(wizard).getByRole('button', { name: '确认创建模拟任务' }));
    await waitFor(() => expect(wizard).not.toBeInTheDocument());
    const detail = await screen.findByRole('dialog');
    expect(await within(detail).findByText('oak-reviewed')).toBeInTheDocument();
    await within(detail).findByText('失败原因', {}, { timeout: 8000 });
    expect(within(detail).getByText('系统安装（已跳过）')).toBeInTheDocument();
    await user.click(within(detail).getByRole('button', { name: '预检重试条件' }));
    await within(detail).findByText('Mock 规则预检通过');
    await user.click(within(detail).getByRole('button', { name: '确认创建重试任务' }));
    await screen.findByText('本次为重试任务');
    await waitFor(
      async () => {
        const tasks = (await api.installations()).items;
        expect(tasks).toHaveLength(2);
        expect(tasks[0]).toMatchObject({
          status: 'succeeded',
          retryOf: tasks[1].id,
          parameters: { hostname: 'oak-reviewed' },
        });
        expect(tasks[1].status).toBe('failed');
      },
      { timeout: 8000 },
    );
  }, 60000);
  it('shows a missing-IP blocker and does not create a task', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /新建装机任务/ }));
    const wizard = await screen.findByRole('dialog');
    await user.click(await within(wizard).findByLabelText('目标服务器'));
    await user.click(
      await screen.findByText('oak-east-07 · DEMO-SN-00007', {
        selector: '.ant-select-item-option-content',
      }),
    );
    await user.click(within(wizard).getByRole('button', { name: '预览参数' }));
    await user.click(await within(wizard).findByRole('button', { name: '运行预检' }));
    expect(await within(wizard).findByText('预检未通过，请处理阻塞项')).toBeInTheDocument();
    expect(within(wizard).getByRole('button', { name: '确认创建模拟任务' })).toBeDisabled();
    expect((await api.installations()).total).toBe(0);
  }, 15000);
  it('creates image metadata and makes it available for a versioned template', async () => {
    window.history.replaceState({}, '', '/images');
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /新增镜像/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('镜像名称'), 'Team Linux');
    await user.type(within(dialog).getByLabelText('镜像版本'), '1');
    await user.type(within(dialog).getByLabelText('介质说明'), 'Demo media');
    await user.type(within(dialog).getByLabelText('声明 SHA-256'), 'd'.repeat(64));
    await user.click(within(dialog).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await screen.findByText('Team Linux')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: '装机模板' }));
    await user.click(screen.getByRole('button', { name: /新增模板/ }));
    const template = await screen.findByRole('dialog');
    await user.type(within(template).getByLabelText('模板名称'), 'Team Standard');
    await user.click(within(template).getByLabelText('关联镜像'));
    await user.click(
      await screen.findByText('Team Linux · 1', { selector: '.ant-select-item-option-content' }),
    );
    await user.click(within(template).getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(template).not.toBeInTheDocument());
    expect(await screen.findByText('Team Standard')).toBeInTheDocument();
    const created = (await api.images({ q: 'Team Linux' })).items[0];
    expect((await api.templates({ q: 'Team Standard' })).items[0].imageId).toBe(created.id);
  }, 30000);
});
