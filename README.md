## powerfullz 的覆写规则仓库

此处存放我用于 Mihomo 内核的覆写规则，基于 [mihomo-party-org/override-hub](https://github.com/mihomo-party-org/override-hub) 内的 ACL4SSR 规则修改而来，相较于原规则做出如下改进：

- 集成 [SukkaW/Surge](https://github.com/SukkaW/Surge) 规则集，优化广告拦截、隐私保护及流量分流精度
- 新增 Truth Social 平台专属分流规则
- 移除冗余规则集
- 引入 [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) 完整版 GeoSite/GeoIP 数据库
- 针对 IP 规则添加 `no-resolve` 参数，避免本地 DNS 解析，从根本上防止 DNS 泄露。

### 使用方法

**Mihomo Party**

1. 复制对应文件 raw 直连，如 `https://raw.githubusercontent.com/powerfullz/override-rules/refs/heads/main/yaml/ACL4SSR_Online_Full_WithIcon.yaml`。
2. 打开 Mihomo Party，左侧导航栏打开“覆写”页面，粘贴链接后导入，即可看到对应的覆写脚本/配置。
3. 左侧导航栏打开“订阅管理”，点击需要覆写的订阅右上角的三个点，选择“编辑信息”。
4. 在打开的对话框中最后一项“覆写”，选择刚刚导入的覆写脚本/配置，保存即可。

**Clash Verge Rev**

WIP

**SubStore**

WIP