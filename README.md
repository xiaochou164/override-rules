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

**SubStore**

参考[最速 Substore 订阅管理指南](https://blog.l3zc.com/2025/03/clash-subscription-convert/)。

**Clash Verge 系**

直接复制粘贴到覆写规则（无法自动更新）。

### 关于部分特殊代理组的说明

**静态资源**：这代理组包含所有常见静态资源 CDN 域名、对象存储域名。如果你的机场提供按低倍率结算流量消耗的节点，可使用这个代理组将这部分流量分流到这些节点。

**搜狗输入**：这代理组默认放行，作用是避免搜狗输入法将你输入的每一个字符自动收集并通过`get.sogou.com/q`等域名回传。隐私担忧者可以将其设置为`REJECT`，开启后会影响搜狗输入法账号同步、词库更新、问题反馈，但语音输入等其他功能可以正常使用。

**Play商店修复**：这代理组用于修复 Google Play 下载应用时的「等待中…」问题，如果使用默认的「全球直连」问题依旧，则将其切换到「节点选择」即可。

