import type {
  Address,
  AuditEvent,
  Dashboard,
  Discovery,
  Envelope,
  ErrorEnvelope,
  Facility,
  Installation,
  ImageArtifact,
  ImageInput,
  InstallTemplate,
  TemplateInput,
  InstallRequest,
  InstallationPreview,
  Preflight,
  IpPool,
  ListQuery,
  Page,
  Server,
  ServerInput,
  ServerStatus,
  Transport,
} from './contracts';
import { mockService } from './mock';

export class ApiError extends Error {
  constructor(
    public status: number,
    public details: ErrorEnvelope,
  ) {
    super(details.error.message);
  }
}
export function createApi(transport: Transport) {
  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    query?: ListQuery,
  ): Promise<T> {
    const url = new URL(`/api/v1${path}`, 'http://oak.mock');
    if (query)
      for (const [key, value] of Object.entries(query))
        if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await transport(
        new Request(url, {
          method,
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }),
      );
      const payload: unknown = await response.json();
      if (!response.ok) throw new ApiError(response.status, payload as ErrorEnvelope);
      return (payload as Envelope<T>).data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new Error(
        error instanceof DOMException && error.name === 'AbortError'
          ? '请求超时，请重试'
          : '连接失败，请重试',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    dashboard: () => request<Dashboard>('/dashboard'),
    facilities: () => request<Facility[]>('/facilities'),
    pools: () => request<IpPool[]>('/ip-pools'),
    servers: (query?: ListQuery) => request<Page<Server>>('/servers', 'GET', undefined, query),
    server: (id: string) => request<Server>(`/servers/${id}`),
    createServer: (input: ServerInput) => request<Server>('/servers', 'POST', input),
    power: (id: string, action: 'on' | 'off' | 'reboot') =>
      request<Server>(`/servers/${id}/power`, 'POST', { action }),
    lifecycle: (id: string, status: ServerStatus) =>
      request<Server>(`/servers/${id}/lifecycle`, 'PATCH', { status }),
    discoveries: (query?: ListQuery) =>
      request<Page<Discovery>>('/discoveries', 'GET', undefined, {
        sort: 'createdAt',
        order: 'desc',
        ...query,
      }),
    discover: (poolId: string, method: Discovery['method']) =>
      request<Discovery>('/discoveries', 'POST', { poolId, method }),
    importCandidate: (
      id: string,
      input: { candidateId: string; rackId: string; unit: number; assetTag: string },
    ) => request<Server>(`/discoveries/${id}/import`, 'POST', input),
    addresses: (query?: ListQuery) => request<Page<Address>>('/addresses', 'GET', undefined, query),
    allocate: (addressId: string, serverId: string) =>
      request<Address>('/address-allocations', 'POST', { addressId, serverId }),
    release: (id: string) => request<Address>(`/address-allocations/${id}`, 'DELETE'),
    installations: (query?: ListQuery) =>
      request<Page<Installation>>('/installations', 'GET', undefined, {
        sort: 'createdAt',
        order: 'desc',
        ...query,
      }),
    images: (query?: ListQuery) => request<Page<ImageArtifact>>('/images', 'GET', undefined, query),
    createImage: (input: ImageInput) => request<ImageArtifact>('/images', 'POST', input),
    templates: (query?: ListQuery) =>
      request<Page<InstallTemplate>>('/templates', 'GET', undefined, query),
    createTemplate: (input: TemplateInput) => request<InstallTemplate>('/templates', 'POST', input),
    preview: (input: InstallRequest) =>
      request<InstallationPreview>('/installation-previews', 'POST', input),
    preflight: (input: InstallRequest) =>
      request<Preflight>('/installation-preflights', 'POST', input),
    installation: (id: string) => request<Installation>(`/installations/${id}`),
    install: (input: InstallRequest) => request<Installation>('/installations', 'POST', input),
    retry: (id: string) => request<Installation>(`/installations/${id}/retry`, 'POST', {}),
    audit: (query?: ListQuery) =>
      request<Page<AuditEvent>>('/audit-events', 'GET', undefined, {
        sort: 'createdAt',
        order: 'desc',
        ...query,
      }),
  };
}
// The prototype always uses its isolated Mock. A future backend integrates by
// injecting a transport with an explicitly reviewed base URL; no production URL input exists here.
export const api = createApi(mockService.transport);
