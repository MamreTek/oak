# Oak

MamreTek 企业裸金属资源管理产品原型。React + TypeScript + Ant Design，默认中文。

**产品原型 / 模拟数据：没有真实后端或权限保护，不用于生产。** 不扫描网络、不操作真实服务器、不采集凭据、不接入生产数据。所有状态保存在浏览器内存中，刷新页面会恢复合成种子数据；不同浏览器会话互不共享。

## 本地运行

使用 Node **22.22.1**（最低 22.12）和 npm：

```sh
npm ci --ignore-scripts
npm run dev -- --port 5194 --strictPort
```

打开 `http://127.0.0.1:5194`。默认仅监听本机；这不是生产部署。

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## 体验完整流程

1. **设备发现**：新建任务，选择东区网段与发现方式。任务完成后展开候选设备，确认资产编号、机架和 U 位并入库。
2. **服务器资产**：搜索新入库设备，可查看硬件、模拟监控和生命周期；凭据页只有占位说明。
3. **IP 资源池**：给设备分配同一数据中心内的空闲 IP。每台服务器最多一个业务 IP；冲突会被拒绝。
4. **系统安装**：选择设备、PXE/ISO 和演示镜像，提交任务并查看进度与日志。可勾选模拟失败，再显式提交新任务重试。
5. **操作审计**：查看任务与资源写操作的模拟记录和请求 ID。

页面顶部可切换正常、空数据和服务失败场景；点“重置”清除当前演示操作。界面保留导航和业务按钮，本期不新增菜单、按钮、接口权限。

## 工程与契约

- `src/app`：路由、主题、应用布局。
- `src/features`：总览、IDC、资产、发现、网络、装机、审计。
- `src/shared/api/contracts.ts`：请求相关模型与响应类型。
- `src/shared/api/client.ts`：统一客户端、超时和错误处理。
- `src/shared/api/mock.ts`：隔离的 Request/Response 处理器、合成数据和状态约束。
- [API 契约](docs/api-contract.md)：方法、路径、字段、分页、错误、状态转换和示例。
- [工程规范 1.3 快照](docs/development-conventions.md)、[UI 参考与对比](docs/ui-reference.md)、[本期决定](docs/project-decisions.md)、[验证记录](docs/verification.md)。

当前入口固定注入 Mock transport，所有请求在内存完成。它不是 HTTP 服务器；`oak.mock` 只是 Request 路由标识，不发生外部网络访问。未来后端实现同一契约后，通过显式注入 HTTP transport 接入，并重新完成认证、资源隔离、授权、并发和真实业务验收；当前未提供可误接生产的地址配置。

## 未完成的真实能力

真实数据库和持久化、硬件盘点/扫描、BMC、电源控制、PXE/ISO 执行、凭据保险库、真实遥测/告警通知、权限、持久任务及不可篡改审计均未实现。IDC 层级和地址池当前为种子数据；不提供拓扑编辑。原型通过不等于生产或安全验收通过。

需求按 **REQ-001** 跟踪，完整 PRD 保存在项目外部的 Mamre 工作流记录中：[Issue #1](https://github.com/MamreTek/oak/issues/1)。
