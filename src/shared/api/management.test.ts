import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApi } from './client';
import { createMockService } from './mock';
import { demoScripts } from './configuration-rules';
import type { CredentialInput, IpPoolInput, ScriptType } from './contracts';

describe('Hierarchy, fictional authentication, scripts and subnets', () => {
  let service: ReturnType<typeof createMockService>;
  let api: ReturnType<typeof createApi>;
  const install = {
    serverId: 'srv-1',
    imageId: 'ubuntu-24.04',
    templateId: 'tpl-ubuntu-24.04',
    hostname: 'demo-node',
    method: 'pxe' as const,
  };
  const subnet: IpPoolInput = {
    name: 'Demo subnet',
    dataCenterId: 'dc-east',
    cidr: '203.0.113.0/28',
    gateway: '203.0.113.1',
    purpose: 'out-of-band',
  };
  const profile: CredentialInput = {
    name: 'Demo OOB',
    method: 'out-of-band',
    protocol: 'redfish',
    usernameAlias: 'demo-bmc',
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    service = createMockService({ latency: 0, taskDuration: 1000 });
    api = createApi(service.transport);
  });
  afterEach(() => vi.useRealTimers());
  it('creates all four levels, preserves legacy projections and prevents invalid or referenced changes', async () => {
    const dc = await api.createLocation({
      kind: 'idc',
      parentId: null,
      name: 'Demo IDC',
      city: '演示城市',
    });
    const building = await api.createLocation({
      kind: 'building',
      parentId: dc.id,
      name: '楼栋甲',
    });
    const room = await api.createLocation({ kind: 'room', parentId: building.id, name: '机房甲' });
    const rack = await api.createLocation({
      kind: 'rack',
      parentId: room.id,
      name: 'R01',
      capacity: 42,
    });
    expect((await api.facilities()).find((entry) => entry.id === dc.id)?.racks[0]).toMatchObject({
      id: rack.id,
      room: '机房甲',
      roomId: room.id,
    });
    const count = (await api.locations()).length;
    await expect(
      api.createLocation({ kind: 'rack', parentId: dc.id, name: 'invalid', capacity: 42 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      api.createLocation({ kind: 'room', parentId: building.id, name: '机房甲' }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await api.locations()).length).toBe(count);
    await api.editLocation(room.id, { name: '机房乙' });
    expect((await api.facilities()).find((entry) => entry.id === dc.id)?.racks[0].room).toBe(
      '机房乙',
    );
    await api.createServer({
      name: 'demo-rack',
      assetTag: 'DEMO-RACK',
      serial: 'DEMO-RACK',
      model: 'Demo',
      rackId: rack.id,
      unit: 10,
      height: 2,
      memoryGb: 64,
    });
    await expect(api.editLocation(rack.id, { name: 'R01', capacity: 5 })).rejects.toMatchObject({
      details: { error: { code: 'RESOURCE_IN_USE' } },
    });
    expect((await api.locations()).find((entry) => entry.id === rack.id)?.capacity).toBe(42);
    await expect(api.deleteLocation(rack.id)).rejects.toMatchObject({ status: 409 });
    await expect(api.deleteLocation(building.id)).rejects.toMatchObject({ status: 409 });
    const empty = await api.createLocation({
      kind: 'idc',
      parentId: null,
      name: 'Empty demo',
      city: '演示',
    });
    await api.deleteLocation(empty.id);
    expect((await api.locations()).some((entry) => entry.id === empty.id)).toBe(false);
  });
  it('stores only fictional metadata, rejects secret fields and keeps discovery snapshots', async () => {
    const created = await api.createCredential(profile);
    expect(created.secretMask).toBe('••••••••');
    expect(Object.keys(created).sort()).toEqual([
      'id',
      'method',
      'name',
      'protocol',
      'secretMask',
      'usernameAlias',
    ]);
    await expect(
      api.createCredential({ ...profile, name: 'Invalid', protocol: 'ssh' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      api.createCredential({ ...profile, name: 'Invalid', usernameAlias: 'real-looking-user' }),
    ).rejects.toMatchObject({ status: 400 });
    const raw = await service.transport(
      new Request('http://oak.mock/api/v1/credential-profiles', {
        method: 'POST',
        body: JSON.stringify({ ...profile, password: 'DEMO-REJECTED' }),
      }),
    );
    expect(raw.status).toBe(400);
    expect(await raw.json()).toMatchObject({ error: { code: 'SECRET_FIELD_FORBIDDEN' } });
    expect(JSON.stringify(await api.credentials())).not.toContain('DEMO-REJECTED');
    const rawDiscovery = await service.transport(
      new Request('http://oak.mock/api/v1/discoveries', {
        method: 'POST',
        body: JSON.stringify({ poolId: 'pool-east', method: 'in-band', password: 'DEMO-REJECTED' }),
      }),
    );
    expect(rawDiscovery.status).toBe(400);
    expect((await api.discoveries()).total).toBe(0);
    await expect(api.discover('pool-east', 'in-band', created.id)).rejects.toMatchObject({
      details: { error: { code: 'AUTH_METHOD_MISMATCH' } },
    });
    const task = await api.discover('pool-east', 'out-of-band', created.id);
    await api.editCredential(created.id, { ...profile, name: 'Renamed demo' });
    expect((await api.discoveries()).items[0].credential).toEqual(task.credential);
    await expect(api.deleteCredential(created.id)).rejects.toMatchObject({ status: 409 });
    const unused = await api.createCredential({ ...profile, name: 'Unused demo' });
    await api.deleteCredential(unused.id);
    expect((await api.credentials()).some((entry) => entry.id === unused.id)).toBe(false);
  });
  it('checks script text without execution and saves immutable new versions', async () => {
    for (const type of ['shell', 'kickstart', 'python'] as ScriptType[])
      expect((await api.checkScript(type, demoScripts[type])).valid).toBe(true);
    expect((await api.checkScript('shell', 'echo demo')).valid).toBe(false);
    expect((await api.checkScript('kickstart', 'lang en_US.UTF-8\n%packages\n@core')).valid).toBe(
      false,
    );
    expect((await api.checkScript('python', ' \tprint("demo")')).valid).toBe(false);
    expect((await api.checkScript('shell', '#!/bin/sh\npassword=DEMO-REJECTED')).valid).toBe(false);
    const first = await api.install(install);
    const original = first.parameters.template;
    const content =
      '#!/usr/bin/env python3\n# DEMO TEXT ONLY\nraise RuntimeError("not executed")\n';
    const next = await api.versionTemplate(original.id, {
      version: '2',
      scriptType: 'python',
      content,
    });
    expect(next).toMatchObject({ content, scriptType: 'python', name: original.name });
    expect((await api.installation(first.id)).parameters.template).toEqual(original);
    expect((await api.templates()).items.find((entry) => entry.id === original.id)).toEqual(
      original,
    );
    await expect(
      api.versionTemplate(original.id, { version: '2', scriptType: 'python', content }),
    ).rejects.toMatchObject({ status: 409 });
    const count = (await api.templates()).total;
    await expect(
      api.versionTemplate(original.id, { version: '3', scriptType: 'shell', content: 'invalid' }),
    ).rejects.toMatchObject({ details: { error: { code: 'SCRIPT_INVALID' } } });
    expect((await api.templates()).total).toBe(count);
    const second = await api.install({ ...install, serverId: 'srv-2', templateId: next.id });
    expect(second.parameters.template.content).toBe(content);
  });
  it('validates canonical non-overlapping documentation subnets and usable gateways', async () => {
    const pool = await api.createPool(subnet);
    expect(pool).toMatchObject({ addressCount: 13, allocatedCount: 0 });
    const list = (await api.addresses({ poolId: pool.id, pageSize: 100 })).items;
    expect(
      list.every((entry) => !['203.0.113.0', '203.0.113.1', '203.0.113.15'].includes(entry.ip)),
    ).toBe(true);
    await expect(
      api.createPool({
        ...subnet,
        name: 'Overlap',
        cidr: '203.0.113.8/29',
        gateway: '203.0.113.9',
      }),
    ).rejects.toMatchObject({ details: { error: { code: 'SUBNET_OVERLAP' } } });
    await expect(api.createPool({ ...subnet, cidr: '203.0.113.1/28' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      api.createPool({ ...subnet, cidr: '10.0.0.0/24', gateway: '10.0.0.1' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      api.createPool({ ...subnet, cidr: '203.0.113.16/28', gateway: '203.0.113.31' }),
    ).rejects.toMatchObject({ details: { error: { code: 'GATEWAY_INVALID' } } });
    expect((await api.pools()).length).toBe(3);
    await api.renamePool(pool.id, 'Renamed subnet');
    expect((await api.pools()).find((entry) => entry.id === pool.id)?.name).toBe('Renamed subnet');
    const small = await api.createPool({
      ...subnet,
      name: 'Small',
      cidr: '203.0.113.16/30',
      gateway: '203.0.113.17',
    });
    expect(small.addressCount).toBe(1);
    await api.deletePool(small.id);
    expect((await api.addresses({ poolId: small.id })).total).toBe(0);
  });
  it('allocates per purpose and requires a business address before installation', async () => {
    const oob = await api.createPool(subnet);
    const address = (await api.addresses({ poolId: oob.id })).items;
    await api.allocate(address[0].id, 'srv-7');
    await expect(api.allocate(address[1].id, 'srv-7')).rejects.toMatchObject({ status: 409 });
    await expect(api.deletePool(oob.id)).rejects.toMatchObject({ status: 409 });
    await expect(api.install({ ...install, serverId: 'srv-7' })).rejects.toMatchObject({
      details: { error: { code: 'IP_REQUIRED' } },
    });
    const business = (await api.addresses({ poolId: 'pool-east', status: 'free' })).items[0];
    await api.allocate(business.id, 'srv-7');
    expect((await api.preflight({ ...install, serverId: 'srv-7' })).parameters.address?.ip).toBe(
      business.ip,
    );
    expect((await api.pools()).find((entry) => entry.id === oob.id)?.allocatedCount).toBe(1);
    await expect(api.lifecycle('srv-7', 'retired')).rejects.toMatchObject({ status: 409 });
    await api.release(address[0].id);
    await api.deletePool(oob.id);
  });
});
