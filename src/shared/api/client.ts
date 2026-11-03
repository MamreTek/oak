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
  LocationInput,
  LocationNode,
  CredentialInput,
  CredentialProfile,
  IpPoolInput,
  ScriptCheck,
  ScriptType,
  TemplateVersionInput,
  ResourceMap,
  ResourceInputMap,
  LocationKind,
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
    // Independent resources; /locations remains a compatibility projection.
    resources: <K extends LocationKind>(kind: K, query?: ListQuery) =>
      request<Page<ResourceMap[K]>>(`/${resourcePaths[kind]}`, 'GET', undefined, query),
    resource: <K extends LocationKind>(kind: K, id: string) =>
      request<ResourceMap[K]>(`/${resourcePaths[kind]}/${id}`),
    createResource: <K extends LocationKind>(kind: K, input: ResourceInputMap[K]) =>
      request<ResourceMap[K]>(`/${resourcePaths[kind]}`, 'POST', input),
    editResource: <K extends LocationKind>(
      kind: K,
      id: string,
      input: { name: string; city?: string; capacity?: number },
    ) => request<ResourceMap[K]>(`/${resourcePaths[kind]}/${id}`, 'PATCH', input),
    deleteResource: <K extends LocationKind>(kind: K, id: string) =>
      request<ResourceMap[K]>(`/${resourcePaths[kind]}/${id}`, 'DELETE'),
    locations: () => request<LocationNode[]>('/locations'),
    createLocation: (input: LocationInput) => request<LocationNode>('/locations', 'POST', input),
    editLocation: (id: string, input: { name: string; city?: string; capacity?: number }) =>
      request<LocationNode>(`/locations/${id}`, 'PATCH', input),
    deleteLocation: (id: string) => request<LocationNode>(`/locations/${id}`, 'DELETE'),
    credentials: () => request<CredentialProfile[]>('/credential-profiles'),
    createCredential: (input: CredentialInput) =>
      request<CredentialProfile>('/credential-profiles', 'POST', input),
    editCredential: (id: string, input: CredentialInput) =>
      request<CredentialProfile>(`/credential-profiles/${id}`, 'PATCH', input),
    deleteCredential: (id: string) =>
      request<CredentialProfile>(`/credential-profiles/${id}`, 'DELETE'),
    createPool: (input: IpPoolInput) => request<IpPool>('/ip-pools', 'POST', input),
    renamePool: (id: string, name: string) => request<IpPool>(`/ip-pools/${id}`, 'PATCH', { name }),
    deletePool: (id: string) => request<IpPool>(`/ip-pools/${id}`, 'DELETE'),
    checkScript: (scriptType: ScriptType, content: string) =>
      request<ScriptCheck>('/template-validations', 'POST', { scriptType, content }),
    versionTemplate: (id: string, input: TemplateVersionInput) =>
      request<InstallTemplate>(`/templates/${id}/versions`, 'POST', input),
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
    discover: (poolId: string, method: Discovery['method'], credentialProfileId?: string) =>
      request<Discovery>('/discoveries', 'POST', { poolId, method, credentialProfileId }),
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
export const resourcePaths: Record<LocationKind, string> = {
  idc: 'idcs',
  building: 'buildings',
  room: 'rooms',
  rack: 'racks',
};
// The prototype always uses its isolated Mock. A future backend integrates by
// injecting a transport with an explicitly reviewed base URL; no production URL input exists here.
export const api = createApi(mockService.transport);
