import { beforeEach, describe, expect, it } from 'vitest';
import { createApi } from './client';
import { createMockService } from './mock';

describe('Four independent resource collections', () => {
  let service: ReturnType<typeof createMockService>;
  let api: ReturnType<typeof createApi>;
  beforeEach(() => {
    service = createMockService({ latency: 0 });
    api = createApi(service.transport);
  });
  it('keeps existing IDs and reflects dedicated resource edits in inventory projections', async () => {
    const seed = await api.resource('rack', 'rack-a01');
    expect(seed).toEqual({ id: 'rack-a01', name: 'A01', roomId: 'room-dc-east', capacity: 42 });
    expect((await api.servers()).items.find((entry) => entry.id === 'srv-1')?.rackId).toBe(seed.id);
    await api.editResource('room', seed.roomId, { name: 'Renamed room' });
    expect((await api.facilities())[0].racks[0]).toMatchObject({
      id: seed.id,
      room: 'Renamed room',
    });
    await api.editLocation(seed.id, { name: 'Legacy rename' });
    expect((await api.resource('rack', seed.id)).name).toBe('Legacy rename');
    await expect(api.resource('room', seed.id)).rejects.toMatchObject({ status: 404 });
  });
  it('creates typed parents, filters and paginates each resource separately', async () => {
    const dc = await api.createResource('idc', { name: 'Demo North', city: 'Demo City' });
    const b1 = await api.createResource('building', { name: 'Building 1', idcId: dc.id });
    const b2 = await api.createResource('building', { name: 'Building 2', idcId: dc.id });
    const room = await api.createResource('room', { name: 'Room', buildingId: b1.id });
    const rack = await api.createResource('rack', { name: 'Rack', roomId: room.id, capacity: 20 });
    expect(Object.keys(b1).sort()).toEqual(['id', 'idcId', 'name']);
    const page = await api.resources('building', {
      idcId: dc.id,
      page: 2,
      pageSize: 1,
      sort: 'name',
    });
    expect(page).toEqual({ items: [b2], total: 2, page: 2, pageSize: 1 });
    expect((await api.resources('building', { idcId: dc.id, q: 'BUILDING 1' })).items).toEqual([
      b1,
    ]);
    expect((await api.resources('room', { buildingId: b2.id })).total).toBe(0);
    expect((await api.resources('rack', { roomId: room.id })).items).toEqual([rack]);
    await expect(api.resources('rack', { pageSize: 101 })).rejects.toMatchObject({ status: 400 });
    await expect(api.resources('idc', { sort: 'city' })).rejects.toMatchObject({ status: 400 });
  });
  it('rejects invalid parents, duplicate siblings and parent moves without partial changes', async () => {
    const before = await api.resources('building');
    await expect(
      api.createResource('building', { name: 'Wrong', idcId: 'rack-a01' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      api.createResource('building', { name: 'Missing', idcId: 'missing' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      api.createResource('building', { name: '演示楼栋', idcId: 'dc-east' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await api.resources('building')).toEqual(before);
    const raw = await service.transport(
      new Request('http://oak.mock/api/v1/buildings/building-dc-east', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Moved', idcId: 'dc-west' }),
      }),
    );
    expect(raw.status).toBe(400);
    const nullCapacity = await service.transport(
      new Request('http://oak.mock/api/v1/racks/rack-a01', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'A01', capacity: null }),
      }),
    );
    expect(nullCapacity.status).toBe(400);
    expect(await api.resource('building', 'building-dc-east')).toMatchObject({
      name: '演示楼栋',
      idcId: 'dc-east',
    });
    await api.createResource('room', { name: 'Case demo', buildingId: 'building-dc-east' });
    await expect(
      api.createResource('room', { name: 'CASE DEMO', buildingId: 'building-dc-east' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await api.createResource('room', { name: 'CASE DEMO', buildingId: 'building-dc-west' }),
    ).toMatchObject({ buildingId: 'building-dc-west' });
  });
  it('protects dependencies and occupied capacity, but allows deletion from leaf to root', async () => {
    for (const [kind, id] of [
      ['idc', 'dc-east'],
      ['building', 'building-dc-east'],
      ['room', 'room-dc-east'],
      ['rack', 'rack-a01'],
    ] as const)
      await expect(api.deleteResource(kind, id)).rejects.toMatchObject({ status: 409 });
    await expect(
      api.editResource('rack', 'rack-a01', { name: 'A01', capacity: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await api.resource('rack', 'rack-a01')).capacity).toBe(42);
    const dc = await api.createResource('idc', { name: 'Empty IDC', city: 'Demo' });
    const building = await api.createResource('building', { name: 'B', idcId: dc.id });
    const room = await api.createResource('room', { name: 'R', buildingId: building.id });
    const rack = await api.createResource('rack', { name: 'Rack', roomId: room.id, capacity: 1 });
    for (const [kind, id] of [
      ['rack', rack.id],
      ['room', room.id],
      ['building', building.id],
      ['idc', dc.id],
    ] as const)
      expect((await api.deleteResource(kind, id)).id).toBe(id);
    expect((await api.locations()).some((node) => node.id === dc.id)).toBe(false);
    await expect(api.resource('idc', dc.id)).rejects.toMatchObject({ status: 404 });
  });
});
