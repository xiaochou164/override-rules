## powerfullz 的覆写规则仓库

此处存放我用于 Mihomo/Substore 的覆写规则，以 [mihomo-party-org/override-hub](https://github.com/mihomo-party-org/override-hub) 内的 ACL4SSR 规则为灵感，几乎完全重新编写，具有以下优点：

- 集成 [SukkaW/Surge](https://github.com/SukkaW/Surge) 和 [Cats-Team/AdRules](https://github.com/Cats-Team/AdRules) 规则集，优化广告拦截、隐私保护及流量分流精度
- 新增 Truth Social、E-Hentai、TikTok、加密货币等实用分流规则
- 移除冗余规则集
- 引入 [Loyalsoldier/v2ray-rules-dat](https://github.com/Loyalsoldier/v2ray-rules-dat) 完整版 GeoSite/GeoIP 数据库
- 针对 IP 规则添加 `no-resolve` 参数，避免本地 DNS 解析，提升上网速度，无 DNS 泄露
- JS 格式覆写现已实现节点国家动态识别与分组，自动为实际存在的各国家/地区节点生成对应代理组，节点变动时分组自动变化，省心省力。例如：你的订阅没有韩国的节点，则最终生成的配置中「韩国节点」这个代理组就不会出现。

谨此声明：本覆写规则为本人自用，现特此公开分享于公共平台。在未有回馈意见的情况下，自然优先满足个人需求及修正自己发现的问题。如有高见，欢迎 PR。

### 使用方法

**Mihomo Party**

1. 推荐直接使用 JS 动态覆写：`https://raw.githubusercontent.com/powerfullz/override-rules/refs/heads/main/convert.js`
2. 若需要特定参数（例如链式 + 完整配置）：在链接后加 `#landing=true&full=true`。
3. 打开 Mihomo Party → 左侧「覆写」→ 粘贴上述链接导入。
4. 打开「订阅管理」→ 目标订阅右上角三个点 → 「编辑信息」→ 选择该覆写脚本 → 保存。
5. 若客户端不支持 JS，可改用 `yaml/` 目录下对应静态完整配置。

需要注意，Mihomo Party 在默认设置下还会接管 DNS 和 SNI（域名嗅探），需要手动在设置中关闭「控制 DNS 设置」和「控制域名嗅探」两个选项。

**SubStore**

参考[最速 Substore 订阅管理指南](https://blog.l3zc.com/2025/03/clash-subscription-convert/)。

2025/06/17 更新：新增 JavaScript 格式覆写，支持传入参数，更易于维护，已经成为首选方式。例如，有链式代理需求，使用如下覆写脚本链接即可：

```
https://raw.githubusercontent.com/powerfullz/override-rules/refs/heads/main/convert.js#landing=true
```

传入多个参数时，用`&`分隔，例如`landing=true&loadbalance=true`。

目前支持的参数：

- `loadbalance`: 启用负载均衡 (默认false)
- `landing`: 启用落地节点功能 (默认false)
- `ipv6`: 启用 IPv6 支持 (默认false)
- `full`：生成完整配置（默认false，用于纯内核启动）
- `keepalive`: 启用 TCP Keep Alive（默认 false）[^fn2]

[^fn2]: 无特殊需求不要启用，否则会造成[移动设备异常耗电问题](https://github.com/vernesong/OpenClash/issues/2614)。

**Clash Verge 系**

直接复制粘贴到覆写规则（无法自动更新）。

### 关于各 Mihomo 客户端覆盖 GeoIP/GeoSite 下载地址的说明

这覆写规则大量引用了 Loyalsoldier/v2ray-rules-dat，大多数 Mihomo 客户端都会覆写 GeoIP/GeoSite 数据库资源链接，为了获得更好的分流体验，建议手动修改客户端内的覆写设置。以 Mihomo Party 为例，点击侧栏中的「外部资源」，分别将资源链接替换为以下值：

| 项目           | 链接                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| GeoIP 数据库   | `https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat`   |
| GeoSite 数据库 | `https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat` |
| MMDB 数据库    | `https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/Country.mmdb`          |
| ASN 数据库     | `https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-ASN.mmdb`     |

### 关于部分特殊代理组的说明

**静态资源**：这代理组包含所有常见静态资源 CDN 域名、对象存储域名。大部分网站的静态资源（如图片、视频、音频、字体、JS、CSS）都有独立域名、不设置风控措施、不设置鉴权，这些静态资源可以使用 IP 不一定干净（例如 IDC 类 IP）、但是带宽更大、延时更低、而且有和大部分主流 CDN（如 Cloudflare、Akamai、Fastly、EdgeCast）在 IXP 有互联的网络出口。一般就实践经验来看，在正常上网中这部分域名产生的流量占据约 70% 左右。如果你在使用商业性质的远端策略服务提供商、且该服务上提供了低倍率节点，你可以将这部分域名分流至低倍率节点以节省流量。[^fn1]

[^fn1]: 来源：[我有特别的 Surge 配置和使用技巧](https://blog.skk.moe/post/i-have-my-unique-surge-setup/)

**搜狗输入**：这代理组默认放行，作用是避免搜狗输入法将你输入的每一个字符自动收集并通过`get.sogou.com/q`等域名回传。隐私担忧者可以将其设置为`REJECT`，开启后会影响搜狗输入法账号同步、词库更新、问题反馈，但语音输入等其他功能可以正常使用。

**Play 商店修复**：这代理组用于修复国行设备因使用`services.googleapis.cn`域名导致的 Google Play 下载应用时的「等待中…」问题，如果使用默认的「全球直连」问题依旧，则将其切换到「节点选择」即可。使用「全球直连」代理组时，Play 商店会从国内的 CDN 下载内容。详见：[「Google Play 商店的国内 CDN：从密码学入门到分流策略优化」](https://blog.l3zc.com/2025/03/chinese-cdn-used-by-playstore/)。

**Steam 修复**： 这代理组用于让 Steam 客户端调用国内 CDN 及 P2P 网络下载，节省大量流量。如果需要代理 Steam 所有的下载请求，将其设置为「节点选择」即可。

### 关于链式代理的说明

若有链式代理需求，直接在 JS 链接后加 `landing=true` 参数即可（例如：`convert.js#landing=true`）。这样会新增「落地节点」和「前置代理」两个代理组，其中「落地节点」会自动匹配名称包含「家宽」「家庭」「商宽」「落地」「Starlink/星链」等关键词的节点，其他诸如「香港节点」等国家分组会自动剔除这些落地节点。需要被链式代理的落地节点请在你的订阅里为该节点配置 `dialer-proxy: "前置代理"`，示例：

```yaml
proxies:
  - name: '香港 HGC NAT 商宽落地'
    type: ss
    server: example.com
    port: 6666
    cipher: aes-256-gcm
    password: goodpassword
    dialer-proxy: "前置代理"
```

### 关于自动生成的 YAML 格式覆写

除了直接引用 `convert.js` 动态覆写，你也可以使用仓库中预先生成好的 32 份「参数组合产物」——它们都放在 `yaml/` 目录里，由 GitHub Actions 在每次推送后自动重新生成、覆盖。适用于：

- 想直接拿一份静态完整配置（尤其是需要 `full=true` 纯内核启动）
- 某些不支持 JS 覆写的客户端 / 转换服务
- 只想快速对比不同参数组合输出差异

文件命名规则：

```
config_lb-{0|1}_landing-{0|1}_ipv6-{0|1}_full-{0|1}_keepalive-{0|1}.yaml
```

对应含义（数字 1 表示开启，0 表示关闭）：

- lb：`loadbalance` 负载均衡
- landing：链式代理（落地节点/前置代理）
- ipv6：启用 IPv6
- full：输出完整内核配置字段（端口、dns、sniffer 等全部写出）
- keepalive：启用 TCP Keep Alive

示例（开启 full，其余关闭）：

```
https://raw.githubusercontent.com/powerfullz/override-rules/refs/heads/main/yaml/config_lb-0_landing-0_ipv6-0_full-1_keepalive-0.yaml
```

如果你只是想要“动态识别国家 + 传参”的灵活性，还是推荐直接引用：

```
https://raw.githubusercontent.com/powerfullz/override-rules/refs/heads/main/convert.js#full=true&ipv6=true
```

注意事项：

- `yaml/` 目录内容是自动产物，不要手动改；改了也会被下次 CI 覆盖。
- CI 只是套用一份假的 `fake_proxies.json` 节点名来生成结构，你真实订阅的节点列表是由客户端再合并的；这些 YAML 里不会内置真实节点。
- 想减少体积自己构建：本地运行 `npm install && npm run generate`，输出就在 `yaml/`。

挑选策略：

- 需要直接当主配置启动：选 `full=1`
- 需要链式代理：选 `landing=1`
- 你有大量多国节点、希望自动测试省心：`loadbalance=0`（仍然是 url-test），或根据需求打开
- 想节省一点延迟（避免 keep-alive 争议）：保留 `keepalive=0`

如果未来参数扩展，会同步更新命名规则并继续由 CI 覆盖生成。
