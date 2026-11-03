# Oak API 契约 v1.1（原型草案）

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
| GET `/images` | 分页；q 匹配名称/版本；sort=name(默认)/createdAt | `Page<ImageArtifact>` |
| POST `/images` | `ImageInput` | `ImageArtifact`，201；同名同版本唯一，创建后不可变 |
| GET `/templates` | 分页；q 匹配名称/版本；sort=name(默认)/createdAt | `Page<InstallTemplate>` |
| POST `/templates` | `TemplateInput` | `InstallTemplate`，201；关联镜像必须存在，同名同版本唯一，创建后不可变 |
| POST `/installation-previews` | `InstallRequest` | `InstallationPreview`：规范化参数及不可执行的 JSON 计划；不创建任务 |
| POST `/installation-preflights` | `InstallRequest` | `Preflight`：参数、计划、检查时间、逐项结果、passed；规则不通过仍返回 200，不创建任务 |
| POST `/installations` | `InstallRequest` | `Installation`，201；重新检查当前资源，阻塞时 409；不信任浏览器的预检结果 |
| GET `/installations/{id}` | 资源 ID | `Installation`；直接查详情，不依赖当前列表页 |
| POST `/installations/{id}/retry` | `{}` | `Installation`，201；仅失败任务可重试一次，重新预检及比对原参数快照，创建关联新任务 |
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
| ImageInput | `name:string` 1–64；`version:string` 1–32；`family:ubuntu/rocky`；`architecture:x86_64`；`sourceLabel:string` 1–128（介质说明，不进行网络访问）；`checksum:string` 64 位十六进制声明 SHA-256，存为小写；`status:draft/ready`（演示状态） |
| ImageArtifact | ImageInput 加 `id,createdAt:string`；种子 checksum 为合成占位，不代表可下载介质或真实校验结果 |
| TemplateInput | `name:string` 1–64；`version:string` 1–32；`imageId:string`；`bootMode:uefi/bios`；`rootDisk:sda/nvme0n1`；`partitionLayout:lvm/single`；`timezone:UTC/Asia/Shanghai`；名称与版本去空白后忽略大小写判重 |
| InstallTemplate | TemplateInput 加 `id,createdAt:string`；模板只表达产品配置，未渲染成可执行 Kickstart/Autoinstall 文件 |
| InstallRequest | `serverId,imageId,templateId,hostname:string`；主机名 1–63 位字母/数字/连字符，首尾字母或数字，存为小写；`method:pxe/iso`；`simulateFailure?:boolean` 仅 Mock 故障开关；`expectedIp?:string` 1–45 字符，由向导在预检后提交，用于拒绝已审阅地址发生变化的请求 |
| InstallationParameters | `serverId,serverName,serial,hostname:string`；`method:pxe/iso`；`image:ImageArtifact`；`template:InstallTemplate`；`address:{ip,gateway,cidr:string}|null`；预览允许无 IP，创建任务时必须有 IP |
| InstallationPreview | `parameters:InstallationParameters`；`plan:string`（声明式 JSON，含 prototype=true/executable=false，不执行内容） |
| Preflight | InstallationPreview 加 `checkedAt:string`；`passed:boolean`；`checks:{key,label,message:string,status:pass/fail/warning}[]`；warning 不阻塞，fail 阻塞 |
| Installation | `id,serverId,createdAt,image:string`（image 为名称摘要）；`method:pxe/iso`；`status:TaskStatus`；`progress:number`；`logs:string[]`（events 消息摘要）；`simulateFailure:boolean`；`parameters:InstallationParameters`（创建快照）；`stages:InstallationStage[]`；`events:InstallationLog[]`；`failureReason:string|null`；`retryOf:string|null` |
| InstallationStage | `key,label:string`；`status:pending/running/succeeded/failed/skipped`；`startedAt,finishedAt:string|null` |
| InstallationLog | `at,stage,message:string`；`level:info/error`；时间为阶段的模拟 UTC 时间，不代表设备实际回报 |
| TaskStatus | `pending/running/succeeded/failed`；当前 Mock 创建时直接为 running，pending 为契约保留值 |
| AuditEvent | `id,action,target,actor,createdAt,requestId:string`；`result:success/failure`；actor 恒为演示操作员，无身份保证 |
| Dashboard | `total,available,installing,warning,addressesUsed,addressesTotal:number`；`installations:Installation[]`；`alerts:{serverId,name,message:string}[]` |

创建服务器时：资产编号与序列号全局唯一（忽略大小写）；机架必须存在；设备不能越过容量，不能与未退役设备的 U 位重叠。创建默认 ready、off、os=null。发现导入设备默认 2U/128GB，名称、型号和序列号来自该候选，并使用相同服务器校验。

IP 只能绑定同中心设备，已占用地址不能再次分配；已绑定业务 IP 的设备不能再绑定第二个 IP；installing/retired 不允许绑定。装机中禁止回收 IP。回收后可以重新分配。

## 状态与失败恢复

- 生命周期：ready ↔ maintenance；二者可在无 IP 时 → retired（终态）。installing 由装机任务控制，不能通过生命周期接口直接设置。
- 装机：ready/maintenance → installing；成功后 ready、power=on、os 更新；失败后 maintenance，保留原 os，日志明确失败。一次装机失败后可显式创建新任务重试；原失败任务不改写。
- Mock 发现约 1.8 秒完成，正常装机约 3.6 秒完成；阶段为资源预检、准备引导、镜像准备、系统安装、交付检查，每阶段占模拟总时长 20%。故障演示在镜像准备结束（60%，约 2.16 秒）失败，后续阶段 skipped，进度保留 60%。任一后续 API 请求根据创建时间推进任务；没有后台执行器或持久化，刷新重置。
- 预检验证目标 ready/maintenance、已绑定 IP、镜像 ready、模板关联镜像一致。硬件、磁盘存在性/容量、架构/启动兼容、网络引导和真实 SHA-256 均为未验证 warning，不声称生产可安装。已知资源的业务阻塞以检查项返回；无效字段返回 400，未知 ID 返回 404。
- 提交再次检查当前状态，不依赖之前的 passed。向导每次预检后更新参数展示、清除覆盖确认，并附带 expectedIp；地址与声明值不一致时返回 SNAPSHOT_CHANGED，要求重新预览。直接 API 调用未传 expectedIp 时以当前资源为准。失败重试以原任务参数重新预检；地址等参数快照变化返回 SNAPSHOT_CHANGED，要求新建任务。原任务的状态、参数、阶段和日志不改变，新任务 retryOf 指向原 ID；同一失败任务再次重试返回 ALREADY_RETRIED。演示故障开关不继承。此接口未使用通用幂等键；后续真实后端需实现持久并发控制。
- 电源操作立即修改模拟状态，reboot 最终为 on；不会执行 BMC 或真实重启。
- 预期业务错误在校验后返回，资源写入前完成全部约束检查；服务失败场景不创建资源。成功写操作和装机终态生成审计，装机失败记 failure。
- 顶部场景工具属于演示适配层，不是业务 API。empty 重建为空数据；normal 从 empty 恢复种子数据，error 保留业务状态但全部请求返回 500；reset 显式恢复种子数据。

常用错误码：`VALIDATION_ERROR`、`INVALID_JSON`、`NOT_FOUND`、`ASSET_CONFLICT`、`SERIAL_CONFLICT`、`RACK_CONFLICT`、`STATE_CONFLICT`、`RESOURCE_IN_USE`、`ALREADY_IMPORTED`、`IP_CONFLICT`、`DATA_CENTER_MISMATCH`、`IP_REQUIRED`、`MOCK_UNAVAILABLE`、`IMAGE_CONFLICT`、`TEMPLATE_CONFLICT`、`IMAGE_NOT_READY`、`TEMPLATE_MISMATCH`、`SNAPSHOT_CHANGED`、`ALREADY_RETRIED`。

v1.1 草案变更：POST installations 的固定 image 枚举改为 imageId/templateId/hostname；旧请求缺少必填字段返回 400。所有现有前端调用与测试同步迁移，尚无已部署的真实后端。列表中的 image 保留名称摘要；详情使用 parameters 快照。选择器本期读取前 100 条资源，列表本身支持分页；更大规模选择器需后续远端查询。

## 请求与响应示例

```http
POST /api/v1/installations
Content-Type: application/json

{"serverId":"srv-1","imageId":"ubuntu-24.04","templateId":"tpl-ubuntu-24.04","hostname":"oak-node-01","method":"pxe","simulateFailure":false}
```

```json
{
  "data": {
    "id": "install-123",
    "serverId": "srv-1",
    "image": "Ubuntu 24.04 LTS",
    "method": "pxe",
    "status": "running",
    "progress": 0,
    "logs": ["资源预检开始（模拟）"],
    "simulateFailure": false,
    "createdAt": "2026-11-03T10:00:00.000Z",
    "retryOf": null,
    "failureReason": null
  },
  "requestId": "req-122"
}
```

上例为摘要，完整响应另包含 parameters、stages、events；字段定义及行为以本页表格和 TypeScript 契约为准。

```json
{
  "error": { "code": "IP_REQUIRED", "message": "请先为该服务器分配 IP" },
  "requestId": "req-124"
}
```

## 后端接入清单

实现同样端点、JSON 类型和 HTTP 状态；复用行为测试/样例验证契约。把服务端认证、资源隔离、权限、事务和唯一索引、持久任务/超时、审计、凭据保险库及真实设备适配作为必需工作。Mock 的合成监控、simulateFailure 和演示场景不构成正式接口安全设计。只有用户明确授权接入真实后端后，才将 `createApi` 的 transport 替换为经验证的同源 HTTP 适配器；浏览器页面不接收任意生产 URL。
