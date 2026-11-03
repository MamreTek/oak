import type {
  Address,
  AuditEvent,
  Candidate,
  Dashboard,
  Discovery,
  Facility,
  Installation,
  IpPool,
  Server,
  ServerInput,
  ServerStatus,
  Transport,
} from './contracts';

export type Scenario = 'normal' | 'empty' | 'error';
class DomainError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
const fail = (
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): never => {
  throw new DomainError(status, code, message, fields);
};
const timestamp = () => new Date().toISOString();
const required = (value: unknown, key: string, max = 64): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    return fail(400, 'VALIDATION_ERROR', '请检查输入字段', { [key]: `必填，最多 ${max} 个字符` });
  return value.trim();
};
const integer = (value: unknown, key: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    return fail(400, 'VALIDATION_ERROR', '请检查数值范围', {
      [key]: `请输入 ${min}–${max} 的整数`,
    });
  return value;
};
const choice = <T extends string>(value: unknown, key: string, options: readonly T[]): T => {
  if (!options.includes(value as T))
    return fail(400, 'VALIDATION_ERROR', '不支持的选项', { [key]: `仅支持 ${options.join(', ')}` });
  return value as T;
};

export function createMockService(options: { latency?: number; taskDuration?: number } = {}) {
  const latency = options.latency ?? 180;
  const taskDuration = options.taskDuration ?? 3600;
  let scenario: Scenario = 'normal';
  let sequence = 100;
  let facilities: Facility[] = [];
  let pools: IpPool[] = [];
  let servers: Server[] = [];
  let addresses: Address[] = [];
  let discoveries: Discovery[] = [];
  let installations: Installation[] = [];
  let events: AuditEvent[] = [];
  const id = (prefix: string) => `${prefix}-${++sequence}`;
  const audit = (
    action: string,
    target: string,
    requestId: string,
    result: 'success' | 'failure' = 'success',
  ) =>
    events.unshift({
      id: id('evt'),
      action,
      target,
      result,
      actor: '演示操作员',
      createdAt: timestamp(),
      requestId,
    });
  function reset(next: Scenario = 'normal') {
    scenario = next;
    sequence = 100;
    discoveries = [];
    installations = [];
    events = [];
    facilities =
      next === 'empty'
        ? []
        : [
            {
              id: 'dc-east',
              name: '东区演示中心',
              city: '杭州',
              racks: [
                {
                  id: 'rack-a01',
                  name: 'A01',
                  room: '一号机房',
                  dataCenterId: 'dc-east',
                  capacity: 42,
                },
                {
                  id: 'rack-a02',
                  name: 'A02',
                  room: '一号机房',
                  dataCenterId: 'dc-east',
                  capacity: 42,
                },
              ],
            },
            {
              id: 'dc-west',
              name: '西区演示中心',
              city: '成都',
              racks: [
                {
                  id: 'rack-b01',
                  name: 'B01',
                  room: '二号机房',
                  dataCenterId: 'dc-west',
                  capacity: 42,
                },
              ],
            },
          ];
    pools =
      next === 'empty'
        ? []
        : [
            {
              id: 'pool-east',
              name: '东区业务网络',
              cidr: '192.0.2.0/24',
              gateway: '192.0.2.1',
              dataCenterId: 'dc-east',
            },
            {
              id: 'pool-west',
              name: '西区业务网络',
              cidr: '198.51.100.0/24',
              gateway: '198.51.100.1',
              dataCenterId: 'dc-west',
            },
          ];
    servers =
      next === 'empty'
        ? []
        : Array.from({ length: 12 }, (_, n) => ({
            id: `srv-${n + 1}`,
            assetTag: `OAK-${String(n + 1).padStart(4, '0')}`,
            name: `oak-${n < 8 ? 'east' : 'west'}-${String(n + 1).padStart(2, '0')}`,
            serial: `DEMO-SN-${String(n + 1).padStart(5, '0')}`,
            model: ['Dell PowerEdge R750', 'Lenovo ThinkSystem SR650', 'HPE ProLiant DL380'][n % 3],
            rackId: n < 4 ? 'rack-a01' : n < 8 ? 'rack-a02' : 'rack-b01',
            unit: (n % 4) * 3 + 1,
            height: 2,
            cpu: '2 × 24 核（模拟）',
            memoryGb: n % 2 ? 256 : 128,
            status: n === 3 || n === 9 ? 'maintenance' : 'ready',
            power: n === 3 || n === 9 ? 'off' : 'on',
            os: n % 3 ? 'Ubuntu 24.04 LTS' : null,
            cpuUsage: 12 + n * 4,
            memoryUsage: 30 + n * 3,
            health: n === 5 ? 'warning' : 'healthy',
            createdAt: '2026-11-01T08:00:00.000Z',
          }));
    addresses = pools.flatMap((pool, p) =>
      Array.from({ length: 16 }, (_, i) => ({
        id: `ip-${p}-${i}`,
        poolId: pool.id,
        ip: `${p ? '198.51.100' : '192.0.2'}.${10 + i}`,
        serverId: i < (p ? 3 : 6) ? `srv-${p ? i + 9 : i + 1}` : null,
      })),
    );
    if (next !== 'empty') audit('演示环境初始化', '合成资源数据', 'seed');
  }
  const racks = () => facilities.flatMap((f) => f.racks);
  const getServer = (serverId: string) =>
    servers.find((s) => s.id === serverId) ?? fail(404, 'NOT_FOUND', '服务器不存在');
  function validateServer(body: Record<string, unknown>): ServerInput {
    const result: ServerInput = {
      assetTag: required(body.assetTag, 'assetTag', 32),
      name: required(body.name, 'name'),
      serial: required(body.serial, 'serial'),
      model: required(body.model, 'model'),
      rackId: required(body.rackId, 'rackId'),
      unit: integer(body.unit, 'unit', 1, 42),
      height: integer(body.height, 'height', 1, 8),
      memoryGb: integer(body.memoryGb, 'memoryGb', 1, 8192),
    };
    if (!/^[A-Za-z0-9-]+$/.test(result.assetTag))
      fail(400, 'VALIDATION_ERROR', '资产编号只允许字母、数字和连字符', { assetTag: '格式不正确' });
    const rack =
      racks().find((r) => r.id === result.rackId) ??
      fail(400, 'VALIDATION_ERROR', '机架不存在', { rackId: '请选择现有机架' });
    if (result.unit + result.height - 1 > rack.capacity)
      fail(400, 'VALIDATION_ERROR', '设备超出机架容量', { unit: '剩余 U 位不足' });
    if (servers.some((s) => s.assetTag.toLowerCase() === result.assetTag.toLowerCase()))
      fail(409, 'ASSET_CONFLICT', '资产编号已存在', { assetTag: '资产编号已存在' });
    if (servers.some((s) => s.serial.toLowerCase() === result.serial.toLowerCase()))
      fail(409, 'SERIAL_CONFLICT', '序列号已存在', { serial: '序列号已存在' });
    if (
      servers.some(
        (s) =>
          s.rackId === rack.id &&
          s.status !== 'retired' &&
          result.unit <= s.unit + s.height - 1 &&
          result.unit + result.height - 1 >= s.unit,
      )
    )
      fail(409, 'RACK_CONFLICT', '目标 U 位已被占用', { unit: '与现有设备重叠' });
    return result;
  }
  function addServer(input: ServerInput): Server {
    const server: Server = {
      ...input,
      id: id('srv'),
      status: 'ready',
      power: 'off',
      os: null,
      cpu: '待硬件盘点（模拟）',
      cpuUsage: 0,
      memoryUsage: 0,
      health: 'healthy',
      createdAt: timestamp(),
    };
    servers.unshift(server);
    return server;
  }
  function advance(requestId: string) {
    for (const task of discoveries) {
      const progress = Math.min(
        100,
        Math.floor(((Date.now() - Date.parse(task.createdAt)) / (taskDuration / 2)) * 100),
      );
      task.progress = progress;
      task.status = progress >= 100 ? 'succeeded' : 'running';
    }
    for (const task of installations.filter(
      (t) => t.status === 'running' || t.status === 'pending',
    )) {
      task.progress = Math.min(
        100,
        Math.floor(((Date.now() - Date.parse(task.createdAt)) / taskDuration) * 100),
      );
      task.logs = [
        '任务已创建（模拟）',
        ...(task.progress >= 20 ? ['检查资源与 IP 绑定完成'] : []),
        ...(task.progress >= 50 ? [`加载 ${task.method.toUpperCase()} 演示镜像`] : []),
      ];
      if (task.progress >= 100) {
        task.status = task.simulateFailure ? 'failed' : 'succeeded';
        task.logs.push(
          task.simulateFailure
            ? '模拟镜像校验失败；未安装真实系统'
            : '模拟装机完成；未操作真实设备',
        );
        const server = getServer(task.serverId);
        server.status = task.simulateFailure ? 'maintenance' : 'ready';
        if (!task.simulateFailure) {
          server.os = task.image === 'ubuntu-24.04' ? 'Ubuntu 24.04 LTS' : 'Rocky Linux 9';
          server.power = 'on';
        }
        audit(
          task.simulateFailure ? '模拟装机失败' : '模拟装机完成',
          server.name,
          requestId,
          task.simulateFailure ? 'failure' : 'success',
        );
      } else task.status = 'running';
    }
  }
  function paginate<T extends object>(
    items: T[],
    params: URLSearchParams,
    allowedSort: (keyof T & string)[],
    defaultSort: keyof T & string,
  ) {
    const page = Number(params.get('page') ?? 1);
    const pageSize = Number(params.get('pageSize') ?? 10);
    integer(page, 'page', 1, 100000);
    integer(pageSize, 'pageSize', 1, 100);
    const sort = params.get('sort') ?? defaultSort;
    if (!allowedSort.includes(sort as keyof T & string))
      fail(400, 'VALIDATION_ERROR', '不支持的排序字段');
    const order = choice(params.get('order') ?? 'asc', 'order', ['asc', 'desc']);
    const sorted = [...items].sort(
      (a, b) =>
        String(a[sort as keyof T] ?? '').localeCompare(String(b[sort as keyof T] ?? ''), 'zh-CN', {
          numeric: true,
        }) * (order === 'desc' ? -1 : 1),
    );
    return {
      items: sorted.slice((page - 1) * pageSize, page * pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  }
  const transport: Transport = async (request) => {
    if (latency)
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, latency);
        request.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });
    if (request.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const requestId = id('req');
    try {
      if (scenario === 'error')
        fail(500, 'MOCK_UNAVAILABLE', '模拟服务暂不可用，请恢复正常场景后重试');
      advance(requestId);
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const method = request.method;
      const params = url.searchParams;
      if (!url.pathname.startsWith('/api/v1/')) fail(404, 'NOT_FOUND', '接口不存在');
      let body: Record<string, unknown> = {};
      if (method === 'POST' || method === 'PATCH') {
        try {
          const parsed: unknown = await request.json();
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
          body = parsed as Record<string, unknown>;
        } catch {
          fail(400, 'INVALID_JSON', '请求体必须是 JSON 对象');
        }
      }
      let data: unknown;
      let status = 200;
      if (method === 'GET' && path === '/facilities') data = facilities;
      else if (method === 'GET' && path === '/ip-pools') data = pools;
      else if (method === 'GET' && path === '/dashboard') {
        data = {
          total: servers.length,
          available: servers.filter((s) => s.status === 'ready').length,
          installing: servers.filter((s) => s.status === 'installing').length,
          warning: servers.filter((s) => s.health === 'warning' && s.status !== 'retired').length,
          addressesUsed: addresses.filter((a) => a.serverId).length,
          addressesTotal: addresses.length,
          installations: installations.slice(0, 4),
          alerts: servers
            .filter((s) => s.health === 'warning' && s.status !== 'retired')
            .map((s) => ({ serverId: s.id, name: s.name, message: '内存纠错次数偏高 · 模拟告警' })),
        } satisfies Dashboard;
      } else if (method === 'GET' && path === '/servers') {
        const q = (params.get('q') ?? '').toLowerCase();
        const dc = params.get('dataCenterId');
        const statusFilter = params.get('status');
        if (statusFilter)
          choice(statusFilter, 'status', ['ready', 'installing', 'maintenance', 'retired']);
        data = paginate(
          servers.filter(
            (s) =>
              `${s.name} ${s.assetTag} ${s.serial} ${s.model}`.toLowerCase().includes(q) &&
              (!statusFilter || s.status === statusFilter) &&
              (!dc || racks().find((r) => r.id === s.rackId)?.dataCenterId === dc),
          ),
          params,
          ['name', 'assetTag', 'createdAt', 'memoryGb'],
          'assetTag',
        );
      } else if (method === 'POST' && path === '/servers') {
        data = addServer(validateServer(body));
        audit('创建服务器', (data as Server).name, requestId);
        status = 201;
      } else if (method === 'GET' && /^\/servers\/[^/]+$/.test(path))
        data = getServer(path.split('/')[2]);
      else if (method === 'POST' && /^\/servers\/[^/]+\/power$/.test(path)) {
        const server = getServer(path.split('/')[2]);
        const action = choice(body.action, 'action', ['on', 'off', 'reboot']);
        if (server.status === 'retired' || server.status === 'installing')
          fail(409, 'STATE_CONFLICT', '退役或装机中的服务器不能操作电源');
        server.power = action === 'off' ? 'off' : 'on';
        data = server;
        audit(`模拟电源 ${action}`, server.name, requestId);
      } else if (method === 'PATCH' && /^\/servers\/[^/]+\/lifecycle$/.test(path)) {
        const server = getServer(path.split('/')[2]);
        const next = choice<ServerStatus>(body.status, 'status', [
          'ready',
          'maintenance',
          'retired',
        ]);
        if (server.status === 'installing' || server.status === 'retired')
          fail(409, 'STATE_CONFLICT', '装机中或已退役的服务器不能切换生命周期');
        if (next === 'retired' && addresses.some((a) => a.serverId === server.id))
          fail(409, 'RESOURCE_IN_USE', '请先回收该服务器的 IP 地址再退役');
        server.status = next;
        if (next === 'retired') server.power = 'off';
        data = server;
        audit(`生命周期变更 ${next}`, server.name, requestId);
      } else if (method === 'GET' && path === '/discoveries')
        data = paginate(discoveries, params, ['createdAt'], 'createdAt');
      else if (method === 'POST' && path === '/discoveries') {
        const poolId = required(body.poolId, 'poolId');
        if (!pools.some((p) => p.id === poolId)) fail(400, 'VALIDATION_ERROR', '请选择演示网段');
        const scanMethod = choice(body.method, 'method', ['in-band', 'out-of-band']);
        const discoveryId = id('scan');
        const candidates: Candidate[] = [1, 2].map((n) => ({
          id: `${discoveryId}-c${n}`,
          serial: `DEMO-${discoveryId}-${n}`,
          model: n === 1 ? 'Dell PowerEdge R750' : 'HPE ProLiant DL380',
          name: `discovered-${discoveryId}-${n}`,
          importedServerId: null,
        }));
        const task: Discovery = {
          id: discoveryId,
          poolId,
          method: scanMethod,
          status: 'running',
          progress: 0,
          candidates,
          createdAt: timestamp(),
        };
        discoveries.unshift(task);
        data = task;
        audit('启动模拟发现', discoveryId, requestId);
        status = 201;
      } else if (method === 'POST' && /^\/discoveries\/[^/]+\/import$/.test(path)) {
        const task =
          discoveries.find((t) => t.id === path.split('/')[2]) ??
          fail(404, 'NOT_FOUND', '发现任务不存在');
        if (task.status !== 'succeeded') fail(409, 'STATE_CONFLICT', '请等待发现任务完成');
        const candidate =
          task.candidates.find((c) => c.id === body.candidateId) ??
          fail(404, 'NOT_FOUND', '候选设备不存在');
        if (candidate.importedServerId) fail(409, 'ALREADY_IMPORTED', '此设备已入库');
        const server = addServer(
          validateServer({
            ...body,
            name: candidate.name,
            serial: candidate.serial,
            model: candidate.model,
            memoryGb: 128,
            height: 2,
          }),
        );
        candidate.importedServerId = server.id;
        data = server;
        audit('发现设备入库', server.name, requestId);
        status = 201;
      } else if (method === 'GET' && path === '/addresses') {
        const q = params.get('q') ?? '';
        const statusFilter = params.get('status');
        if (statusFilter) choice(statusFilter, 'status', ['free', 'allocated']);
        data = paginate(
          addresses.filter(
            (a) =>
              (!params.get('poolId') || a.poolId === params.get('poolId')) &&
              a.ip.includes(q) &&
              (!statusFilter || (statusFilter === 'free' ? !a.serverId : !!a.serverId)),
          ),
          params,
          ['ip'],
          'ip',
        );
      } else if (method === 'POST' && path === '/address-allocations') {
        const address =
          addresses.find((a) => a.id === body.addressId) ?? fail(404, 'NOT_FOUND', '地址不存在');
        const server = getServer(required(body.serverId, 'serverId'));
        if (address.serverId) fail(409, 'IP_CONFLICT', '该 IP 已被分配');
        if (server.status === 'retired' || server.status === 'installing')
          fail(409, 'STATE_CONFLICT', '该服务器当前无法绑定地址');
        const pool = pools.find((p) => p.id === address.poolId);
        const rack = racks().find((r) => r.id === server.rackId);
        if (pool?.dataCenterId !== rack?.dataCenterId)
          fail(409, 'DATA_CENTER_MISMATCH', '服务器与 IP 资源池必须属于同一数据中心');
        if (addresses.some((a) => a.serverId === server.id))
          fail(409, 'IP_CONFLICT', '本原型每台服务器仅绑定一个业务 IP');
        address.serverId = server.id;
        data = address;
        audit('分配 IP', `${address.ip} → ${server.name}`, requestId);
        status = 201;
      } else if (method === 'DELETE' && /^\/address-allocations\/[^/]+$/.test(path)) {
        const address =
          addresses.find((a) => a.id === path.split('/')[2]) ??
          fail(404, 'NOT_FOUND', '地址不存在');
        const serverId = address.serverId ?? fail(409, 'STATE_CONFLICT', '地址已空闲');
        if (getServer(serverId).status === 'installing')
          fail(409, 'RESOURCE_IN_USE', '装机中不能回收 IP');
        address.serverId = null;
        data = address;
        audit('回收 IP', address.ip, requestId);
      } else if (method === 'GET' && path === '/installations')
        data = paginate(installations, params, ['createdAt'], 'createdAt');
      else if (method === 'POST' && path === '/installations') {
        const server = getServer(required(body.serverId, 'serverId'));
        const image = choice(body.image, 'image', ['ubuntu-24.04', 'rocky-9']);
        const installMethod = choice(body.method, 'method', ['pxe', 'iso']);
        if (body.simulateFailure !== undefined && typeof body.simulateFailure !== 'boolean')
          fail(400, 'VALIDATION_ERROR', 'simulateFailure 必须为布尔值');
        if (server.status !== 'ready' && server.status !== 'maintenance')
          fail(409, 'STATE_CONFLICT', '该服务器不允许装机');
        if (!addresses.some((a) => a.serverId === server.id))
          fail(409, 'IP_REQUIRED', '请先为该服务器分配 IP');
        const task: Installation = {
          id: id('install'),
          serverId: server.id,
          image,
          method: installMethod,
          simulateFailure: body.simulateFailure === true,
          status: 'running',
          progress: 0,
          createdAt: timestamp(),
          logs: ['任务已创建（模拟）'],
        };
        server.status = 'installing';
        installations.unshift(task);
        data = task;
        audit('提交模拟装机', server.name, requestId);
        status = 201;
      } else if (method === 'GET' && path === '/audit-events') {
        const q = (params.get('q') ?? '').toLowerCase();
        data = paginate(
          events.filter((e) => `${e.action} ${e.target} ${e.requestId}`.toLowerCase().includes(q)),
          params,
          ['createdAt'],
          'createdAt',
        );
      } else fail(404, 'NOT_FOUND', '接口不存在');
      return Response.json({ data, requestId }, { status });
    } catch (error) {
      const e =
        error instanceof DomainError
          ? error
          : new DomainError(500, 'INTERNAL_ERROR', '模拟服务内部错误');
      return Response.json(
        {
          error: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) },
          requestId,
        },
        { status: e.status },
      );
    }
  };
  reset();
  return {
    transport,
    reset,
    setScenario: (next: Scenario) => {
      if (next === 'empty' || scenario === 'empty') reset(next);
      else scenario = next;
    },
    getScenario: () => scenario,
  };
}

export const mockService = createMockService();
