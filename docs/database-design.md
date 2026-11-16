# Oak 四类资源表设计草案

**当前没有真实后端或数据库。本次未执行建表、迁移或数据导入。** 下列四张独立表是后续后端适配的逻辑设计；原型分别使用 `idcs`、`buildings`、`rooms`、`rackRecords` 四个内存集合，刷新恢复合成种子数据。数据库引擎、DDL 和事务实现仍需后端确定。

## 四张独立表

| 表          | 字段          | 类型草案    | 约束与含义                                       |
| ----------- | ------------- | ----------- | ------------------------------------------------ |
| `idcs`      | `id`          | varchar(64) | 主键，不透明 ID                                  |
| `idcs`      | `name`        | varchar(64) | 非空，去首尾空白后 1–64 字符，全局忽略大小写唯一 |
| `idcs`      | `city`        | varchar(64) | 非空，去首尾空白后 1–64 字符                     |
| `buildings` | `id`          | varchar(64) | 主键                                             |
| `buildings` | `idc_id`      | varchar(64) | 非空外键 → `idcs.id`，删除 RESTRICT              |
| `buildings` | `name`        | varchar(64) | 非空，1–64 字符，同 IDC 忽略大小写唯一           |
| `rooms`     | `id`          | varchar(64) | 主键                                             |
| `rooms`     | `building_id` | varchar(64) | 非空外键 → `buildings.id`，删除 RESTRICT         |
| `rooms`     | `name`        | varchar(64) | 非空，1–64 字符，同楼栋忽略大小写唯一            |
| `racks`     | `id`          | varchar(64) | 主键，保留既有设备引用的 ID                      |
| `racks`     | `room_id`     | varchar(64) | 非空外键 → `rooms.id`，删除 RESTRICT             |
| `racks`     | `name`        | varchar(64) | 非空，1–64 字符，同机房忽略大小写唯一            |
| `racks`     | `capacity`    | smallint    | 非空，整数 1–42 U                                |

关系为 `idcs 1 → N buildings 1 → N rooms 1 → N racks`。数据库采用 snake_case 外键名，JSON DTO 分别用 `idcId`、`buildingId`、`roomId`。API 通过四类路径与 DTO 明确资源类型，不复用一个 `kind/parentId` 存储表。

唯一约束建议表达为 `idcs(normalized_name)`、`buildings(idc_id, normalized_name)`、`rooms(building_id, normalized_name)`、`racks(room_id, normalized_name)`。`normalized_name` 是去首尾空白及大小写统一后的逻辑键，是否使用表达式索引、生成列或数据库排序规则由真实后端选择，需与前端/服务端校验一致。父键列也用于列表筛选。不同父级可有同名子资源。

## 完整性与事务

- 创建必须引用正确类型且存在的直接父级，不支持跳层或孤儿；本期编辑仅改名称、IDC 城市或机架容量，父级不能移动。
- 删除有子级的 IDC/楼栋/机房返回 409。网段对 IDC、设备对机架的引用也必须以外键 RESTRICT 或同等事务约束保护；退役设备仍引用机架，因此仍阻止删除。不得用级联删除丢失历史。
- 容量缩减前检查所有未退役设备：`unit + height - 1 <= capacity`。这是跨记录约束，不能仅靠单行 CHECK；真实后端须在事务中锁定相关机架/设备并与资产新增、U 位调整协调，避免并发越界。Mock 单次请求先验证后写入，不代表数据库并发保护已经实现。
- 四个集合的改名或增删同步派生旧 `locations` 与 `facilities` 响应，种子 `dc-east`、`rack-a01` 等 ID 不变，资产/发现/IP/装机仍使用原引用。两个旧响应是兼容投影，不是额外规范表；旧写端点经相同校验更新四个集合。
- 当前没有持久化数据要迁移。未来接入数据库时再设计迁移、回滚、真实认证/授权与审计；本设计不提供可直接用于生产的 DDL。

## 菜单与契约

| 独立菜单 | 页面         | REST 资源           | Mock 集合     | 表草案      |
| -------- | ------------ | ------------------- | ------------- | ----------- |
| IDC管理  | `/idcs`      | `/api/v1/idcs`      | `idcs`        | `idcs`      |
| 楼栋管理 | `/buildings` | `/api/v1/buildings` | `buildings`   | `buildings` |
| 机房管理 | `/rooms`     | `/api/v1/rooms`     | `rooms`       | `rooms`     |
| 机架管理 | `/racks`     | `/api/v1/racks`     | `rackRecords` | `racks`     |

各页独立列表、查询、分页、表单、详情和确认删除；机架详情保留 U 位视图。完整请求、响应及错误见 [API 契约](api-contract.md)。
