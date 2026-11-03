# Oak 装机原型参考与边界

用户确认的功能参考为云霁科技 [CloudBoot／OSInstall](https://github.com/idcos/Cloudboot) 和 [Cobbler](https://github.com/cobbler/cobbler)。本期独立实现产品交互，不引入其源码、安装模板、驱动、固件、品牌或文案，不声称已兼容其 API 或安装介质。

| 官方依据 | 本期采用的产品概念 | 本期限制 |
| --- | --- | --- |
| [CloudBoot 安装流程](https://idcos.github.io/osinstall-doc/platform/系统安装流程.html) | 配置确定后进入任务，分阶段展示引导、介质、安装和交付结果 | 没有 BootOS/Agent、硬件配置或真实 PXE 服务 |
| [CloudBoot 模块](https://idcos.github.io/osinstall-doc/platform/系统功能模块.html) | 镜像、模板与具体装机任务分别管理 | 镜像仅元数据；模板含配置与独立编写的脚本文本，不执行 |
| [CloudBoot 进度上报](https://idcos.github.io/osinstall-doc/api/日志进度上报接口.html) | 阶段、进度、错误和日志可查询 | 时间日志为查询驱动 Mock，没有设备回调 |
| [Cobbler 模板与安装追踪](https://cobbler.readthedocs.io/en/v3.3.7/user-guide.html#autoinstallation) | 复用模板参数、先预览再创建任务，保留结果 | 未实现其 Distro/Profile/System 继承、Snippet、校验器或协议适配 |

新交互为镜像/模板列表、不可变版本记录、装机两步向导、逐项预检、参数快照、阶段日志与关联重试。声明式计划明确标记不可执行；预检将实际磁盘、架构/启动兼容、网络和真实校验和列为未验证。失败重试只创建新任务，原失败记录保留；地址变化需重新预览，不自动更换原任务参数。

当前模型仅含 Ubuntu/Rocky 系列和 x86_64 演示介质，模板磁盘选项限 sda/nvme0n1。没有建立真实型号、操作系统、固件或驱动兼容矩阵。新增权限仍按本期约定暂缓。

许可证分别核验：[CloudBoot 总仓库](https://github.com/idcos/Cloudboot/blob/master/LICENSE)标注 Apache 2.0；[Server](https://github.com/idcos/osinstall-server/blob/master/LICENSE)、[UI](https://github.com/idcos/osinstall-ui)、[硬件工具](https://github.com/idcos/osinstall-hardware)标注 GPLv3；[Cobbler COPYING](https://github.com/cobbler/cobbler/blob/main/COPYING)为 GPLv2，具体文件可能允许后续版本。参考公开功能不等于取得所有子项目和厂商组件的复制/分发权限；本期没有复制或分发这些材料。
