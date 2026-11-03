# Oak API 契约 v1（原型草案）

本契约用于后续真实后端适配，**不代表接口已经部署**。当前应用通过 `createApi(transport)` 调用 `Request → Response` 的内存 Mock。前端模型见 `src/shared/api/contracts.ts`，处理器见 `src/shared/api/mock.ts`。无外部网络请求或真实设备操作。

## 通用约定

- 前缀 `/api/v1`，JSON，UTF-8；ID 为不透明字符串，不由客户端推导真实资源身份。
- 时间为 UTC ISO 8601，页面显示 UTC。
- 成功响应 `{ "data": T, "requestId": "req-123" }`；创建返回 HTTP 201，其余成功为 200。
- 列表分页：`data: { "items": T[], "total": 12, "page": 1, "pageSize": 10 }`。`page` 默认 1，整数 1–100000；`pageSize` 默认 10，整数 1–100；超出结果页返回空 items，total 仍为匹配总数。
- `order=asc|desc` 默认 asc（前端任务/审计查询显式传 desc）；`sort` 只接受端点表列出的字段。字符串按自然数字顺序比较，数值字段按数值顺序。
- `q` 为大小写不敏感的包含匹配；地址搜索为 IP 文本包含匹配。筛选组合用 AND。
- 错误结构：`{"error":{"code":"IP_CONFLICT","message":"该 IP 已被分配","fields":{"serverId":"可选字段说明"}},"requestId":"req-124"}`。
- HTTP 400 参数/JSON 无效；404 不存在；409 唯一性、资源占用或状态冲突；500 模拟服务失败。客户端保留请求 ID，10 秒超时；不自动重放写操作。
- 本期没有登录、租户或权限能力。真实后端必须实施授权、资源归属和并发控制；不能信任 Mock 或浏览器状态作为保护。

## 端点

| 方法与路径 | 请求 / 查询 | data 类型与行为 |
| --- | --- | --- |
| GET `/dashboard` | 无 | `Dashboard`：总量、可用/装机/告警数、地址占用、最近 4 条任务与模拟告警 |
| GET `/facilities` | 无 | `Facility[]`，内含机架；小型只读种子集合，不分页 |
| GET `/ip-pools` | 无 | `IpPool[]`，小型只读种子集合，不分页 |
| GET `/servers` | 分页；q；status；dataCenterId；sort=assetTag(默认)/name/createdAt/memoryGb | `Page<Server>`；q 匹配名称、资产编号、序列号和型号 |
| POST `/servers` | `ServerInput` | `Server`，201；验证全部字段后原子创建 |
| GET `/servers/{id}` | 资源 ID | `Server`，未知 ID 返回 404 |
| POST `/servers/{id}/power` | `{action:"on"|"off"|"reboot"}` | `Server`；立即切换模拟电源状态并记录审计；installing/retired 返回 409 |
| PATCH `/servers/{id}/lifecycle` | `{status:"ready"|"maintenance"|"retired"}` | `Server`；installing/retired 不可转换；退役需先释放 IP |
| GET `/discoveries` | 分页；sort=createdAt | `Page<Discovery>`，查询时更新模拟进度 |
| POST `/discoveries` | `{poolId:string,method:"in-band"|"out-of-band"}` | `Discovery`，201；只允许现有演示资源池 |
| POST `/discoveries/{id}/import` | `{candidateId:string,assetTag:string,rackId:string,unit:number}` | `Server`，201；完成的发现任务才可导入；同一候选重复导入返回 409 |
| GET `/addresses` | 分页；poolId；q；status=free/allocated；sort=ip(默认) | `Page<Address>`；查询只读 |
| POST `/address-allocations` | `{addressId:string,serverId:string}` | `Address`，201；空闲 IP → 同中心可用/维护设备；每设备仅一个业务 IP |
| DELETE `/address-allocations/{addressId}` | 无请求体 | `Address`；serverId 置 null；空闲地址或装机中资源返回 409 |
| GET `/installations` | 分页；sort=createdAt | `Page<Installation>`，查询时更新模拟进度 |
| POST `/installations` | `{serverId:string,image:"ubuntu-24.04"|"rocky-9",method:"pxe"|"iso",simulateFailure?:boolean}` | `Installation`，201；必须已有 IP，设备为 ready/maintenance；默认不模拟失败 |
| GET `/audit-events` | 分页；q；sort=createdAt | `Page<AuditEvent>`；q 匹配动作、目标、请求 ID |

## 实体、字段与约束

| 实体 | 字段 |
| --- | --- |
| Facility | `id,name,city:string`；`racks:Rack[]` |
| Rack | `id,name,room,dataCenterId:string`；`capacity:number`（种子为 42U） |
| ServerInput | `name,serial,model,rackId:string`：去首尾空格，必填，1–64 字符；`assetTag:string`：1–32 字符，仅字母/数字/连字符；`unit:number`：整数 1–42；`height:number`：整数 1–8；`memoryGb:number`：整数 1–8192 |
| Server | ServerInput 加 `id,cpu,createdAt:string`；`status:ready/installing/maintenance/retired`；`power:on/off`；`os:string|null`；`cpuUsage,memoryUsage:number`（合成 0–100 指标）；`health:healthy/warning` |
| IpPool | `id,name,cidr,gateway,dataCenterId:string`；地址为文档保留 IPv4 网段，种子每池仅展示 16 个业务地址，不代表完整 /24 容量 |
| Address | `id,poolId,ip:string`；`serverId:string|null`；分配 ID 使用 addressId，回收后资源地址 ID 不变 |
| Candidate | `id,serial,model,name:string`；`importedServerId:string|null` |
| Discovery | `id,poolId,createdAt:string`；`method:in-band/out-of-band`；`status:TaskStatus`；`progress:number`（0–100）；`candidates:Candidate[]` |
| Installation | `id,serverId,createdAt:string`；`image:ubuntu-24.04/rocky-9`；`method:pxe/iso`；`status:TaskStatus`；`progress:number`（0–100）；`logs:string[]`；`simulateFailure:boolean`（仅 Mock 测试控制） |
| TaskStatus | `pending/running/succeeded/failed`；当前 Mock 创建时直接为 running，pending 为契约保留值 |
| AuditEvent | `id,action,target,actor,createdAt,requestId:string`；`result:success/failure`；actor 恒为演示操作员，无身份保证 |
| Dashboard | `total,available,installing,warning,addressesUsed,addressesTotal:number`；`installations:Installation[]`；`alerts:{serverId,name,message:string}[]` |

创建服务器时：资产编号与序列号全局唯一（忽略大小写）；机架必须存在；设备不能越过容量，不能与未退役设备的 U 位重叠。创建默认 ready、off、os=null。发现导入设备默认 2U/128GB，名称、型号和序列号来自该候选，并使用相同服务器校验。

IP 只能绑定同中心设备，已占用地址不能再次分配；已绑定业务 IP 的设备不能再绑定第二个 IP；installing/retired 不允许绑定。装机中禁止回收 IP。回收后可以重新分配。

## 状态与失败恢复

- 生命周期：ready ↔ maintenance；二者可在无 IP 时 → retired（终态）。installing 由装机任务控制，不能通过生命周期接口直接设置。
- 装机：ready/maintenance → installing；成功后 ready、power=on、os 更新；失败后 maintenance，保留原 os，日志明确失败。一次装机失败后可显式创建新任务重试；原失败任务不改写。
- Mock 发现约 1.8 秒完成，装机约 3.6 秒完成；任一后续 API 请求会根据创建时间推进任务。页面定时查询使状态可见。没有后台执行器或持久化；刷新会清空任务。
- 电源操作立即修改模拟状态，reboot 最终为 on；不会执行 BMC 或真实重启。
- 预期业务错误在校验后返回，资源写入前完成全部约束检查；服务失败场景不创建资源。成功写操作和装机终态生成审计，装机失败记 failure。
- 顶部场景工具属于演示适配层，不是业务 API。empty 重建为空数据；normal 从 empty 恢复种子数据，error 保留业务状态但全部请求返回 500；reset 显式恢复种子数据。

常用错误码：`VALIDATION_ERROR`、`INVALID_JSON`、`NOT_FOUND`、`ASSET_CONFLICT`、`SERIAL_CONFLICT`、`RACK_CONFLICT`、`STATE_CONFLICT`、`RESOURCE_IN_USE`、`ALREADY_IMPORTED`、`IP_CONFLICT`、`DATA_CENTER_MISMATCH`、`IP_REQUIRED`、`MOCK_UNAVAILABLE`。

## 请求与响应示例

```http
POST /api/v1/installations
Content-Type: application/json

{"serverId":"srv-1","image":"ubuntu-24.04","method":"pxe","simulateFailure":false}
```

```json
{
  "data": {
    "id": "install-123",
    "serverId": "srv-1",
    "image": "ubuntu-24.04",
    "method": "pxe",
    "status": "running",
    "progress": 0,
    "logs": ["任务已创建（模拟）"],
    "simulateFailure": false,
    "createdAt": "2026-11-03T10:00:00.000Z"
  },
  "requestId": "req-122"
}
```

```json
{
  "error": { "code": "IP_REQUIRED", "message": "请先为该服务器分配 IP" },
  "requestId": "req-124"
}
```

## 后端接入清单

实现同样端点、JSON 类型和 HTTP 状态；复用行为测试/样例验证契约。把服务端认证、资源隔离、权限、事务和唯一索引、持久任务/超时、审计、凭据保险库及真实设备适配作为必需工作。Mock 的合成监控、simulateFailure 和演示场景不构成正式接口安全设计。只有用户明确授权接入真实后端后，才将 `createApi` 的 transport 替换为经验证的同源 HTTP 适配器；浏览器页面不接收任意生产 URL。
