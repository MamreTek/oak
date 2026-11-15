import { App, Button } from 'antd';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { RefreshContext, useConfirmedAction } from './ui';

it('keeps a rejected confirmation open, displays the error and permits a successful retry', async () => {
  const action = vi.fn().mockRejectedValueOnce(new Error('合成引用冲突')).mockResolvedValueOnce({});
  const refresh = vi.fn();
  function Harness() {
    const confirm = useConfirmedAction();
    return <Button onClick={() => void confirm('删除模拟资源', 'Demo resource', action)}>Delete demo</Button>;
  }
  const user = userEvent.setup();
  render(<App><RefreshContext.Provider value={{ revision: 0, refresh }}><Harness /></RefreshContext.Provider></App>);
  await user.click(screen.getByRole('button', { name: 'Delete demo' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: '确认模拟操作' }));
  expect(await screen.findByText('合成引用冲突')).toBeInTheDocument();
  expect(dialog).toBeInTheDocument();
  expect(action).toHaveBeenCalledTimes(1);
  expect(refresh).not.toHaveBeenCalled();
  await waitFor(() => expect(within(dialog).getByRole('button', { name: '确认模拟操作' })).toBeEnabled());
  await user.click(within(dialog).getByRole('button', { name: '确认模拟操作' }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(action).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledTimes(1);
}, 15000);
