export type ServerStatus = 'ready' | 'installing' | 'maintenance' | 'retired';
export type PowerState = 'on' | 'off';
export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export interface Rack {
  id: string;
  name: string;
  room: string;
  dataCenterId: string;
  capacity: number;
}
export interface Facility {
  id: string;
  name: string;
  city: string;
  racks: Rack[];
}
export interface Server {
  id: string;
  assetTag: string;
  name: string;
  serial: string;
  model: string;
  rackId: string;
  unit: number;
  height: number;
  cpu: string;
  memoryGb: number;
  status: ServerStatus;
  power: PowerState;
  os: string | null;
  cpuUsage: number;
  memoryUsage: number;
  health: 'healthy' | 'warning';
  createdAt: string;
}
export interface ServerInput {
  assetTag: string;
  name: string;
  serial: string;
  model: string;
  rackId: string;
  unit: number;
  height: number;
  memoryGb: number;
}
export interface Address {
  id: string;
  poolId: string;
  ip: string;
  serverId: string | null;
}
export interface IpPool {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  dataCenterId: string;
}
export interface Candidate {
  id: string;
  serial: string;
  model: string;
  name: string;
  importedServerId: string | null;
}
export interface Discovery {
  id: string;
  poolId: string;
  method: 'in-band' | 'out-of-band';
  status: TaskStatus;
  progress: number;
  candidates: Candidate[];
  createdAt: string;
}
export interface Installation {
  id: string;
  serverId: string;
  image: 'ubuntu-24.04' | 'rocky-9';
  method: 'pxe' | 'iso';
  status: TaskStatus;
  progress: number;
  logs: string[];
  simulateFailure: boolean;
  createdAt: string;
}
export interface AuditEvent {
  id: string;
  action: string;
  target: string;
  result: 'success' | 'failure';
  actor: string;
  createdAt: string;
  requestId: string;
}
export interface Dashboard {
  total: number;
  available: number;
  installing: number;
  warning: number;
  addressesUsed: number;
  addressesTotal: number;
  installations: Installation[];
  alerts: { serverId: string; name: string; message: string }[];
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Envelope<T> {
  data: T;
  requestId: string;
}
export interface ErrorEnvelope {
  error: { code: string; message: string; fields?: Record<string, string> };
  requestId: string;
}
export type Transport = (request: Request) => Promise<Response>;
export interface ListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  status?: string;
  dataCenterId?: string;
  poolId?: string;
}
