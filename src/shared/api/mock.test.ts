import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { ApiError, createApi } from './client';
import { createMockService } from './mock';
import type { ServerInput } from './contracts';

describe('Oak API contract and domain flows', () => {
  let service: ReturnType<typeof createMockService>;
  let api: ReturnType<typeof createApi>;
  const valid: ServerInput = {
    name: 'oak-test',
    assetTag: 'OAK-TEST',
    serial: 'DEMO-NEW-001',
    model: 'Demo Server',
    rackId: 'rack-a01',
    unit: 15,
    height: 2,
    memoryGb: 128,
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    service = createMockService({ latency: 0, taskDuration: 1000 });
    api = createApi(service.transport);
  });
  afterEach(() => vi.useRealTimers());
  it('completes discovery, import, IP allocation and simulated installation with audit evidence', async () => {
    const discovery = await api.discover('pool-east', 'out-of-band');
    await expect(
      api.importCandidate(discovery.id, {
        candidateId: discovery.candidates[0].id,
        assetTag: 'OAK-NEW',
        rackId: 'rack-a01',
        unit: 15,
      }),
    ).rejects.toMatchObject({ status: 409 });
    vi.advanceTimersByTime(600);
    expect((await api.discoveries()).items[0]).toMatchObject({
      status: 'succeeded',
      progress: 100,
    });
    const server = await api.importCandidate(discovery.id, {
      candidateId: discovery.candidates[0].id,
      assetTag: 'OAK-NEW',
      rackId: 'rack-a01',
      unit: 15,
    });
    await expect(
      api.importCandidate(discovery.id, {
        candidateId: discovery.candidates[0].id,
        assetTag: 'OAK-NEW-2',
        rackId: 'rack-a01',
        unit: 17,
      }),
    ).rejects.toMatchObject({ details: { error: { code: 'ALREADY_IMPORTED' } } });
    const free = (await api.addresses({ poolId: 'pool-east', status: 'free' })).items[0];
    expect(await api.allocate(free.id, server.id)).toMatchObject({ serverId: server.id });
    const task = await api.install({ serverId: server.id, image: 'ubuntu-24.04', method: 'pxe' });
    expect((await api.server(server.id)).status).toBe('installing');
    await expect(api.release(free.id)).rejects.toMatchObject({ status: 409 });
    await expect(api.power(server.id, 'off')).rejects.toMatchObject({ status: 409 });
    await expect(api.lifecycle(server.id, 'retired')).rejects.toMatchObject({ status: 409 });
    vi.advanceTimersByTime(1100);
    expect((await api.installations()).items.find((t) => t.id === task.id)).toMatchObject({
      status: 'succeeded',
      progress: 100,
    });
    expect(await api.server(server.id)).toMatchObject({
      os: 'Ubuntu 24.04 LTS',
      status: 'ready',
      power: 'on',
    });
    const events = await api.audit({ pageSize: 100 });
    expect(events.items.map((e) => e.action)).toEqual(
      expect.arrayContaining(['发现设备入库', '分配 IP', '提交模拟装机', '模拟装机完成']),
    );
    expect(events.items.every((e) => e.requestId && e.createdAt.endsWith('Z'))).toBe(true);
    await api.release(free.id);
    await api.lifecycle(server.id, 'retired');
    await expect(
      api.install({ serverId: server.id, image: 'rocky-9', method: 'iso' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(api.lifecycle(server.id, 'ready')).rejects.toMatchObject({ status: 409 });
  });
  it('rejects duplicate assets, serials, rack overlap and invalid fields without partial writes', async () => {
    await api.createServer(valid);
    await expect(api.createServer({ ...valid, serial: 'OTHER', unit: 20 })).rejects.toMatchObject({
      status: 409,
      details: { error: { code: 'ASSET_CONFLICT', fields: { assetTag: expect.any(String) } } },
    });
    await expect(api.createServer({ ...valid, assetTag: 'OTHER', unit: 20 })).rejects.toMatchObject(
      { details: { error: { code: 'SERIAL_CONFLICT' } } },
    );
    await expect(
      api.createServer({ ...valid, assetTag: 'OTHER', serial: 'OTHER', unit: 16 }),
    ).rejects.toMatchObject({ details: { error: { code: 'RACK_CONFLICT' } } });
    await expect(
      api.createServer({ ...valid, assetTag: 'OTHER', serial: 'OTHER', unit: 42 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      api.createServer({ ...valid, assetTag: 'BAD SPACE', serial: 'OTHER', unit: 22 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(api.createServer({ ...valid, name: ' ', unit: 22 })).rejects.toMatchObject({
      status: 400,
    });
    expect((await api.servers()).total).toBe(13);
  });
  it('enforces unique IP allocation, data-center affinity, install prerequisites and safe retirement', async () => {
    const east = (await api.addresses({ poolId: 'pool-east', status: 'free' })).items;
    await expect(api.allocate(east[0].id, 'srv-12')).rejects.toMatchObject({
      details: { error: { code: 'DATA_CENTER_MISMATCH' } },
    });
    await expect(
      api.install({ serverId: 'srv-7', image: 'rocky-9', method: 'iso' }),
    ).rejects.toMatchObject({ details: { error: { code: 'IP_REQUIRED' } } });
    await api.allocate(east[0].id, 'srv-7');
    await expect(api.allocate(east[0].id, 'srv-8')).rejects.toMatchObject({
      details: { error: { code: 'IP_CONFLICT' } },
    });
    await expect(api.allocate(east[1].id, 'srv-7')).rejects.toMatchObject({
      details: { error: { code: 'IP_CONFLICT' } },
    });
    await expect(api.lifecycle('srv-7', 'retired')).rejects.toMatchObject({
      details: { error: { code: 'RESOURCE_IN_USE' } },
    });
    await api.release(east[0].id);
    expect((await api.addresses({ poolId: 'pool-east', status: 'free' })).total).toBe(10);
  });
  it('keeps failed installs observable and permits an explicit retry', async () => {
    const task = await api.install({
      serverId: 'srv-1',
      image: 'rocky-9',
      method: 'iso',
      simulateFailure: true,
    });
    vi.advanceTimersByTime(1001);
    const failed = (await api.installations()).items.find((t) => t.id === task.id)!;
    expect(failed.status).toBe('failed');
    expect(failed.logs.join()).toContain('模拟镜像校验失败');
    expect(await api.server('srv-1')).toMatchObject({ status: 'maintenance', os: null });
    await api.install({ serverId: 'srv-1', image: 'rocky-9', method: 'iso' });
    vi.advanceTimersByTime(1001);
    expect(await api.server('srv-1')).toMatchObject({ status: 'ready', os: 'Rocky Linux 9' });
    expect((await api.audit({ pageSize: 100 })).items.some((e) => e.result === 'failure')).toBe(
      true,
    );
  });
  it('supports filtering, sorting, pagination and rejects unsupported query values', async () => {
    const page = await api.servers({ page: 2, pageSize: 5, sort: 'assetTag', order: 'desc' });
    expect(page).toMatchObject({ total: 12, page: 2, pageSize: 5 });
    expect(page.items).toHaveLength(5);
    expect(page.items[0].assetTag).toBe('OAK-0007');
    expect((await api.servers({ q: 'DEMO-SN-00012', dataCenterId: 'dc-west' })).total).toBe(1);
    expect((await api.servers({ status: 'maintenance' })).total).toBe(2);
    expect((await api.servers({ q: 'missing' })).items).toEqual([]);
    await expect(api.servers({ pageSize: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(api.servers({ sort: 'secret' })).rejects.toMatchObject({ status: 400 });
    await expect(api.servers({ status: 'bad' })).rejects.toMatchObject({ status: 400 });
  });
  it('preserves state across service failures, supports empty/reset and returns structured errors', async () => {
    service.setScenario('error');
    await expect(api.createServer(valid)).rejects.toMatchObject({
      status: 500,
      details: { error: { code: 'MOCK_UNAVAILABLE' }, requestId: expect.stringMatching(/^req-/) },
    });
    service.setScenario('normal');
    expect((await api.servers()).total).toBe(12);
    service.setScenario('empty');
    expect((await api.servers()).total).toBe(0);
    expect(await api.facilities()).toEqual([]);
    service.reset();
    expect((await api.servers()).total).toBe(12);
    const response = await service.transport(
      new Request('http://oak.mock/api/v1/servers', { method: 'POST', body: 'not JSON' }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'INVALID_JSON' },
      requestId: expect.any(String),
    });
    expect((await service.transport(new Request('http://oak.mock/invalid'))).status).toBe(404);
    await expect(api.server('missing')).rejects.toBeInstanceOf(ApiError);
  });
});
