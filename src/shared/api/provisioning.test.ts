import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from './client';
import { createMockService } from './mock';
import type { ImageInput, InstallRequest, TemplateInput } from './contracts';

describe('Provisioning metadata, preflight and retry contracts', () => {
  let service: ReturnType<typeof createMockService>;
  let api: ReturnType<typeof createApi>;
  const input: InstallRequest = {
    serverId: 'srv-1',
    imageId: 'ubuntu-24.04',
    templateId: 'tpl-ubuntu-24.04',
    hostname: 'Oak-Node-01',
    method: 'pxe',
  };
  const image: ImageInput = {
    name: 'Team Linux',
    version: '1',
    family: 'rocky',
    architecture: 'x86_64',
    sourceLabel: '合成介质说明',
    checksum: 'd'.repeat(64),
    status: 'ready',
  };
  const template: TemplateInput = {
    name: 'Team Standard',
    version: '1',
    imageId: 'ubuntu-24.04',
    bootMode: 'uefi',
    rootDisk: 'nvme0n1',
    partitionLayout: 'single',
    timezone: 'Asia/Shanghai',
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    service = createMockService({ latency: 0, taskDuration: 1000 });
    api = createApi(service.transport);
  });
  afterEach(() => vi.useRealTimers());
  it('creates versioned metadata, validates references and rejects partial/conflicting records', async () => {
    const created = await api.createImage(image);
    await expect(
      api.createImage({ ...image, name: image.name.toUpperCase() }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      api.createImage({ ...image, version: '2', checksum: 'bad' }),
    ).rejects.toMatchObject({ status: 400 });
    expect((await api.images()).total).toBe(4);
    const tpl = await api.createTemplate({ ...template, imageId: created.id });
    await expect(api.createTemplate({ ...template, imageId: created.id })).rejects.toMatchObject({
      details: { error: { code: 'TEMPLATE_CONFLICT' } },
    });
    await expect(
      api.createTemplate({ ...template, name: 'Missing', imageId: 'missing' }),
    ).rejects.toMatchObject({ status: 404 });
    expect((await api.templates()).total).toBe(4);
    const request = { ...input, imageId: created.id, templateId: tpl.id };
    const plan = await api.preview(request);
    expect(plan.parameters).toMatchObject({
      hostname: 'oak-node-01',
      image: { id: created.id },
      template: { rootDisk: 'nvme0n1', timezone: 'Asia/Shanghai' },
    });
    expect(JSON.parse(plan.plan)).toMatchObject({ executable: false, prototype: true });
    expect((await api.preflight(request)).passed).toBe(true);
    const task = await api.install(request);
    expect(task.parameters).toEqual(plan.parameters);
    expect((await api.images({ q: 'TEAM', pageSize: 1 })).items[0].id).toBe(created.id);
  });
  it('reports blockers without creating a task and rechecks after an earlier successful preflight', async () => {
    const report = await api.preflight(input);
    expect(report.passed).toBe(true);
    expect(report.checks.find((check) => check.key === 'hardware')?.status).toBe('warning');
    expect((await api.installations()).total).toBe(0);
    expect((await api.server('srv-1')).status).toBe('ready');
    const address = (await api.addresses()).items.find((entry) => entry.serverId === 'srv-1')!;
    await api.release(address.id);
    expect((await api.preflight(input)).passed).toBe(false);
    await expect(api.install(input)).rejects.toMatchObject({
      details: { error: { code: 'IP_REQUIRED' } },
    });
    expect((await api.installations()).total).toBe(0);
    const draft = {
      ...input,
      serverId: 'srv-2',
      imageId: 'ubuntu-draft',
      templateId: 'tpl-ubuntu-draft',
    };
    expect((await api.preflight(draft)).checks.find((check) => check.key === 'image')?.status).toBe(
      'fail',
    );
    await expect(api.install(draft)).rejects.toMatchObject({
      details: { error: { code: 'IMAGE_NOT_READY' } },
    });
    await expect(
      api.install({ ...input, serverId: 'srv-2', templateId: 'tpl-rocky-9' }),
    ).rejects.toMatchObject({ details: { error: { code: 'TEMPLATE_MISMATCH' } } });
    await expect(api.preview({ ...input, hostname: '-bad;command' })).rejects.toMatchObject({
      status: 400,
    });
  });
  it('rejects a submission when a different IP replaced the reviewed address', async () => {
    const report = await api.preflight(input);
    const address = (await api.addresses()).items.find((entry) => entry.serverId === 'srv-1')!;
    await api.release(address.id);
    const other = (
      await api.addresses({ status: 'free', poolId: 'pool-east', pageSize: 100 })
    ).items.find((entry) => entry.id !== address.id)!;
    await api.allocate(other.id, 'srv-1');
    await expect(
      api.install({ ...input, expectedIp: report.parameters.address!.ip }),
    ).rejects.toMatchObject({ details: { error: { code: 'SNAPSHOT_CHANGED' } } });
    expect((await api.installations()).total).toBe(0);
  });
  it('keeps timestamped failure history immutable and creates one linked successful retry', async () => {
    const first = await api.install({ ...input, simulateFailure: true });
    await expect(api.retry(first.id)).rejects.toMatchObject({ status: 409 });
    vi.advanceTimersByTime(601);
    const failed = await api.installation(first.id);
    expect(failed).toMatchObject({ status: 'failed', progress: 60 });
    expect(failed.stages.map((stage) => stage.status)).toEqual([
      'succeeded',
      'succeeded',
      'failed',
      'skipped',
      'skipped',
    ]);
    expect(failed.events.filter((event) => event.level === 'error')).toHaveLength(1);
    expect(failed.events.every((event) => event.at.endsWith('Z'))).toBe(true);
    const retry = await api.retry(first.id);
    expect(retry.id).not.toBe(first.id);
    expect(retry).toMatchObject({
      retryOf: first.id,
      simulateFailure: false,
      parameters: failed.parameters,
    });
    expect(await api.installation(first.id)).toEqual(failed);
    await expect(api.retry(first.id)).rejects.toMatchObject({
      details: { error: { code: 'ALREADY_RETRIED' } },
    });
    vi.advanceTimersByTime(1001);
    const done = await api.installation(retry.id);
    expect(done.status).toBe('succeeded');
    expect(done.stages.every((stage) => stage.status === 'succeeded')).toBe(true);
    expect(await api.installation(first.id)).toEqual(failed);
    expect((await api.installations()).total).toBe(2);
  });
  it('rejects retry after IP changes without silently changing the original plan', async () => {
    const first = await api.install({ ...input, simulateFailure: true });
    vi.advanceTimersByTime(1001);
    const failed = await api.installation(first.id);
    const address = (await api.addresses()).items.find((entry) => entry.serverId === 'srv-1')!;
    await api.release(address.id);
    await expect(api.retry(first.id)).rejects.toMatchObject({
      details: { error: { code: 'IP_REQUIRED' } },
    });
    const other = (
      await api.addresses({ status: 'free', poolId: 'pool-east', pageSize: 100 })
    ).items.find((entry) => entry.id !== address.id)!;
    await api.allocate(other.id, 'srv-1');
    await expect(api.retry(first.id)).rejects.toMatchObject({
      details: { error: { code: 'SNAPSHOT_CHANGED' } },
    });
    expect(await api.installation(first.id)).toEqual(failed);
    expect((await api.installations()).total).toBe(1);
    expect((await api.server('srv-1')).status).toBe('maintenance');
  });
  it('blocks duplicate in-flight tasks and preserves metadata through service failure', async () => {
    await api.install(input);
    await expect(api.install(input)).rejects.toMatchObject({ status: 409 });
    service.setScenario('error');
    await expect(api.createImage(image)).rejects.toMatchObject({ status: 500 });
    service.setScenario('normal');
    expect((await api.images()).total).toBe(3);
    service.setScenario('empty');
    expect((await api.images()).total).toBe(0);
    expect((await api.templates()).total).toBe(0);
    service.reset();
    expect((await api.images()).total).toBe(3);
    expect((await api.installations()).total).toBe(0);
  });
});
