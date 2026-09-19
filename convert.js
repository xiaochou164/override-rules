/*
SubStore 订阅转换脚本（基于你提供的版本改造）
新增：
- UserRules：从 GitHub txt 读取自定义 Clash 规则（方案B：每行包含策略）
- Google：谷歌全家桶策略组 + GEOSITE,GOOGLE,Google 分流
- 链式代理（Clash Meta relay）：前置代理 -> Socks5 落地（保留兼容）
- dialer-proxy（mihomo 新版）：在 Socks5 节点上设置 dialer-proxy: 前置代理（新增兼容）
  - AI、Google 分组优先走链式（优先 relay，其次 dialer socks）
  - 通过 arguments 注入 socks5 节点：socks_host / socks_port / socks_user / socks_pass / socks_name
  - 新增开关：dialer / relay（默认都 true）

移除：
- TikTok / EHentai / PikPak / Crypto / Bahamut / Spotify 的分组与规则
*/

const inArg = typeof $arguments !== "undefined" ? $arguments : {};

const loadBalance = parseBool(inArg.loadbalance) || false,
  landing = parseBool(inArg.landing) || false,
  ipv6Enabled = parseBool(inArg.ipv6) || false,
  fullConfig = parseBool(inArg.full) || false,
  keepAliveEnabled = parseBool(inArg.keepalive) || false,
  fakeIPEnabled = parseBool(inArg.fakeip) || false;

// 链式实现方式开关：默认使用 Mihomo/Stash 推荐的 dialer-proxy，关闭已弃用的 relay。
// 如需兼容旧版 Clash Meta，可显式传入 relay=true。
const dialerEnabled = inArg.dialer === undefined ? true : parseBool(inArg.dialer);
const relayEnabledArg = inArg.relay === undefined ? false : parseBool(inArg.relay);

// ---- Socks5 落地参数（Sub-Store arguments 传入）----
// 兼容旧的单节点参数，同时支持 socks_nodes JSON 配置多个落地节点。
const socksHost = (inArg.socks_host || "").trim();
const socksPort = Number(inArg.socks_port || 1080);
const socksUser = (inArg.socks_user || "").trim();
const socksPass = (inArg.socks_pass || "").trim();
const socksName = (inArg.socks_name || "Socks5-落地").trim();

function parseSocksNodes() {
  const raw = String(inArg.socks_nodes || "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const nodes = parsed
          .map((item, index) => ({
            name: String(item.name || `Socks5-落地-${index + 1}`).trim(),
            host: String(item.host || item.server || "").trim(),
            port: Number(item.port || 1080),
            user: String(item.user || item.username || "").trim(),
            pass: String(item.pass || item.password || "").trim(),
          }))
          .filter((item) => item.host);
        if (nodes.length) return nodes;
      }
    } catch {
      // JSON 无效时回退到兼容的单节点参数。
    }
  }
  return socksHost
    ? [{ name: socksName, host: socksHost, port: socksPort, user: socksUser, pass: socksPass }]
    : [];
}

const socksNodes = parseSocksNodes();
const socksNames = socksNodes.map((node) => node.name);

// relay 组名（单落地时保持旧名称，多落地时每个落地一个 relay 组）
const relayGroupName = "链式-落地";

function isDialerEnabled() {
  return dialerEnabled && landing && socksNodes.length > 0;
}

function isRelayEnabled() {
  return relayEnabledArg && landing && socksNodes.length > 0;
}

function buildBaseLists({ landing, lowCost, countryInfo, countryNames }) {
  const countryGroupNames = countryNames || countryInfo
    .filter((item) => item.count > 2)
    .map((item) => item.country + "节点");

  const selector = ["故障转移"];
  if (landing) selector.push("落地节点");
  selector.push(...countryGroupNames);
  if (lowCost) selector.push("低倍率节点");
  selector.push("手动选择", "DIRECT");

  const defaultProxies = ["选择节点", ...countryGroupNames];
  if (lowCost) defaultProxies.push("低倍率节点");
  defaultProxies.push("手动选择", "直连");

  const defaultProxiesDirect = ["直连", ...countryGroupNames, "选择节点", "手动选择"];
  if (lowCost) {
    defaultProxiesDirect.splice(1 + countryGroupNames.length, 0, "低倍率节点");
  }

  const defaultFallback = [];
  if (landing) defaultFallback.push("落地节点");
  defaultFallback.push(...countryGroupNames);
  if (lowCost) defaultFallback.push("低倍率节点");
  defaultFallback.push("手动选择", "DIRECT");

  return {
    defaultProxies,
    defaultProxiesDirect,
    defaultSelector: selector,
    defaultFallback,
    countryGroupNames,
  };
}

const ruleProviders = {
  UserRules: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://raw.githubusercontent.com/xiaochou164/clash_rule/refs/heads/main/add_rule.txt",
    path: "./ruleset/UserRules.txt",
  },
  ADBlock: {
    type: "http",
    behavior: "domain",
    format: "text",
    interval: 86400,
    url: "https://adrules.top/adrules_domainset.txt",
    path: "./ruleset/ADBlock.txt",
  },
  AutoDirect: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://raw.githubusercontent.com/xiaochou164/override-rules/refs/heads/main/direct.txt",
    path: "./ruleset/AutoDirect.txt",
  },
  WalletBank: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://raw.githubusercontent.com/xiaochou164/override-rules/refs/heads/main/ruleset/WalletBank.list",
    path: "./ruleset/WalletBank.list",
  },
  TruthSocial: {
    url: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/TruthSocial.list",
    path: "./ruleset/TruthSocial.list",
    behavior: "classical",
    interval: 86400,
    format: "text",
    type: "http",
  },
  SogouInput: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://ruleset.skk.moe/Clash/non_ip/sogouinput.txt",
    path: "./ruleset/SogouInput.txt",
  },
  StaticResources: {
    type: "http",
    behavior: "domain",
    format: "text",
    interval: 86400,
    url: "https://ruleset.skk.moe/Clash/domainset/cdn.txt",
    path: "./ruleset/StaticResources.txt",
  },
  CDNResources: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://ruleset.skk.moe/Clash/non_ip/cdn.txt",
    path: "./ruleset/CDNResources.txt",
  },
  AI: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://ruleset.skk.moe/Clash/non_ip/ai.txt",
    path: "./ruleset/AI.txt",
  },
  SteamFix: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/SteamFix.list",
    path: "./ruleset/SteamFix.list",
  },
  GoogleFCM: {
    type: "http",
    behavior: "classical",
    interval: 86400,
    format: "text",
    path: "./ruleset/FirebaseCloudMessaging.list",
    url: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/FirebaseCloudMessaging.list",
  },
  AdditionalFilter: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalFilter.list",
    path: "./ruleset/AdditionalFilter.list",
  },
  AdditionalCDNResources: {
    type: "http",
    behavior: "classical",
    format: "text",
    interval: 86400,
    url: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/ruleset/AdditionalCDNResources.list",
    path: "./ruleset/AdditionalCDNResources.list",
  },
};

const rules = [
  // IPv6 始终直连，避免代理故障影响公网 IPv6 访问
  "IP-CIDR6,::/0,DIRECT,no-resolve",

  // 最高优先：你的自定义规则（你写的是“每行带策略”，但这里仍按你原注释保留）
  "RULE-SET,UserRules,选择节点",
  "IP-CIDR,172.245.228.215/32,DIRECT,no-resolve",
  "DOMAIN-SUFFIX,anyrouter.top,选择节点",
  "RULE-SET,WalletBank,钱包/银行",

  "RULE-SET,ADBlock,广告拦截",
  "RULE-SET,AdditionalFilter,广告拦截",
  "RULE-SET,SogouInput,搜狗输入法",
  "RULE-SET,TruthSocial,Truth Social",
  "RULE-SET,StaticResources,静态资源",
  "RULE-SET,CDNResources,静态资源",
  "RULE-SET,AdditionalCDNResources,静态资源",
  "RULE-SET,AutoDirect,直连",

  "RULE-SET,AI,AI",

  "RULE-SET,SteamFix,直连",
  "RULE-SET,GoogleFCM,直连",

  "GEOSITE,GOOGLE-PLAY@CN,直连",

  // 谷歌全家桶（如果你希望 YouTube 也算 Google，就放在 YouTube 之前）
  "GEOSITE,GOOGLE,Google",

  "GEOSITE,TELEGRAM,Telegram",
  "GEOSITE,YOUTUBE,YouTube",
  "GEOSITE,TWITTER,X",
  "GEOSITE,NETFLIX,Netflix",

  "GEOSITE,BILIBILI,Bilibili",
  "GEOSITE,MICROSOFT@CN,直连",
  "GEOSITE,GFW,选择节点",
  "GEOSITE,CN,直连",
  "GEOSITE,PRIVATE,直连",
  "GEOIP,NETFLIX,Netflix,no-resolve",
  "GEOIP,TELEGRAM,Telegram,no-resolve",
  "GEOIP,CN,直连",
  "GEOIP,PRIVATE,直连",
  "DST-PORT,22,SSH(22端口)",
  "MATCH,选择节点",
];

const snifferConfig = {
  sniff: {
    TLS: { ports: [443, 8443] },
    HTTP: { ports: [80, 8080, 8880] },
    QUIC: { ports: [443, 8443] },
  },
  "override-destination": false,
  enable: true,
  "force-dns-mapping": true,
  "skip-domain": ["Mijia Cloud", "dlg.io.mi.com", "+.push.apple.com"],
};

const secureDnsCommon = {
  enable: true,
  ipv6: ipv6Enabled,
  "prefer-h3": true,
  "default-nameserver": ["223.5.5.5", "119.29.29.29"],
  // 国内域名走国内 DoH，避免 system/明文 DNS 泄露。
  nameserver: ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"],
  // 国外域名使用加密 DNS；Mihomo 会按规则选择并通过代理访问。
  fallback: ["https://1.1.1.1/dns-query", "https://dns.google/dns-query"],
  "fallback-filter": {
    geoip: true,
    "geoip-code": "CN",
    geosite: ["gfw"],
  },
  "nameserver-policy": {
    "geosite:cn": ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"],
    "geosite:geolocation-!cn": ["https://1.1.1.1/dns-query", "https://dns.google/dns-query"],
  },
  "proxy-server-nameserver": ["223.5.5.5", "119.29.29.29"],
  "respect-rules": true,
  "direct-nameserver": ["https://doh.pub/dns-query", "https://dns.alidns.com/dns-query"],
  "direct-nameserver-follow-policy": true,
};

const dnsConfig = {
  ...secureDnsCommon,
  "enhanced-mode": "redir-host",
};

const dnsConfig2 = {
  ...secureDnsCommon,
  "enhanced-mode": "fake-ip",
  "fake-ip-range": "198.18.0.1/16",
  "fake-ip-filter": [
    "geosite:private",
    "geosite:connectivity-check",
    "geosite:cn",
    "Mijia Cloud",
    "dig.io.mi.com",
    "localhost.ptlogin2.qq.com",
    "*.icloud.com",
    "*.stun.*.*",
    "*.stun.*.*.*",
  ],
  "default-nameserver": ["119.29.29.29", "223.5.5.5"],
  nameserver: ["system", "223.5.5.5", "119.29.29.29", "180.184.1.1"],
  fallback: [
    "quic://dns0.eu",
    "https://dns.cloudflare.com/dns-query",
    "https://dns.sb/dns-query",
    "tcp://208.67.222.222",
    "tcp://8.26.56.2",
  ],
  "proxy-server-nameserver": ["quic://223.5.5.5", "tls://dot.pub"],
};

const geoxURL = {
  geoip: "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geoip.dat",
  geosite: "https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/geosite.dat",
  mmdb: "https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/Country.mmdb",
  asn: "https://cdn.jsdelivr.net/gh/Loyalsoldier/geoip@release/GeoLite2-ASN.mmdb",
};

const countriesMeta = {
  香港: {
    pattern: "(?i)香港|港|HK|hk|Hong Kong|HongKong|hongkong|🇭🇰",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png",
  },
  澳门: {
    pattern: "(?i)澳门|MO|Macau|🇲🇴",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Macao.png",
  },
  台湾: {
    pattern: "(?i)台|新北|彰化|TW|Taiwan|🇹🇼",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Taiwan.png",
  },
  新加坡: {
    pattern: "(?i)新加坡|坡|狮城|SG|Singapore|🇸🇬",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png",
  },
  日本: {
    pattern: "(?i)日本|川日|东京|大阪|泉日|埼玉|沪日|深日|JP|Japan|🇯🇵",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png",
  },
  韩国: {
    pattern: "(?i)KR|Korea|KOR|首尔|韩|韓|🇰🇷",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Korea.png",
  },
  美国: {
    pattern: "(?i)美国|美|US|United States|🇺🇸",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png",
  },
  加拿大: {
    pattern: "(?i)加拿大|Canada|CA|🇨🇦",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Canada.png",
  },
  英国: {
    pattern: "(?i)英国|United Kingdom|UK|伦敦|London|🇬🇧",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_Kingdom.png",
  },
  澳大利亚: {
    pattern: "(?i)澳洲|澳大利亚|AU|Australia|🇦🇺",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Australia.png",
  },
  德国: {
    pattern: "(?i)德国|德|DE|Germany|🇩🇪",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Germany.png",
  },
  法国: {
    pattern: "(?i)法国|法|FR|France|🇫🇷",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/France.png",
  },
  俄罗斯: {
    pattern: "(?i)俄罗斯|俄|RU|Russia|🇷🇺",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Russia.png",
  },
  泰国: {
    pattern: "(?i)泰国|泰|TH|Thailand|🇹🇭",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Thailand.png",
  },
  印度: {
    pattern: "(?i)印度|IN|India|🇮🇳",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/India.png",
  },
  马来西亚: {
    pattern: "(?i)马来西亚|马来|MY|Malaysia|🇲🇾",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Malaysia.png",
  },
};

function parseBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
}

// 节点去重与重名修复：
// 1. 完全相同的节点（除 name 外）只保留一份；
// 2. 不同入口但订阅给了相同 name 时，追加 #2/#3，避免 Clash/Mihomo
//    把多个节点视为同一个代理；
// 3. 保留不同入口，不因重名误删真实节点。
function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .filter((key) => key !== "name")
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeAndDeduplicateProxies(proxies) {
  const result = [];
  const fingerprints = new Set();
  const usedNames = new Set();
  const nameCounts = new Map();

  for (const [index, original] of (proxies || []).entries()) {
    if (!original || typeof original !== "object") continue;

    const proxy = { ...original };
    // 订阅可能携带指向外部策略组的 dialer-proxy；若当前转换未启用
    // landing/dialer，就移除悬空引用，否则 Mihomo 会拒绝整份配置。
    if (proxy["dialer-proxy"] && !isDialerEnabled()) {
      delete proxy["dialer-proxy"];
    }

    const fingerprint = stableSerialize(proxy);
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);

    const baseName = String(proxy.name || `节点-${index + 1}`).trim() || `节点-${index + 1}`;
    let count = (nameCounts.get(baseName) || 0) + 1;
    let name = count === 1 ? baseName : `${baseName} #${count}`;
    while (usedNames.has(name)) {
      count += 1;
      name = `${baseName} #${count}`;
    }
    nameCounts.set(baseName, count);
    usedNames.add(name);
    proxy.name = name;
    result.push(proxy);
  }

  return result;
}

function hasLowCost(config) {
  const proxies = config["proxies"] || [];
  const lowCostRegex = new RegExp(/0\.[0-5]|低倍率|省流|大流量|实验性/, "i");
  for (const proxy of proxies) {
    if (lowCostRegex.test(proxy.name)) return true;
  }
  return false;
}

function parseCountries(config) {
  const proxies = config.proxies || [];
  const ispRegex = /家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地/i;

  const countryCounts = Object.create(null);

  const compiledRegex = {};
  for (const [country, meta] of Object.entries(countriesMeta)) {
    compiledRegex[country] = new RegExp(meta.pattern.replace(/^\(\?i\)/, ""), "i");
  }

  for (const proxy of proxies) {
    const name = proxy.name || "";
    if (ispRegex.test(name)) continue;

    for (const [country, regex] of Object.entries(compiledRegex)) {
      if (regex.test(name)) {
        countryCounts[country] = (countryCounts[country] || 0) + 1;
        break;
      }
    }
  }

  const result = [];
  for (const [country, count] of Object.entries(countryCounts)) {
    result.push({ country, count });
  }
  return result;
}

function buildCountryProxyGroups(countryList) {
  const countryProxyGroups = [];

  for (const country of countryList) {
    if (countriesMeta[country]) {
      const groupName = `${country}节点`;
      const pattern = countriesMeta[country].pattern;

      const groupConfig = {
        name: groupName,
        icon: countriesMeta[country].icon,
        "include-all": true,
        filter: pattern,
        "exclude-filter": landing
          ? "(?i)家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地"
          : "",
        type: loadBalance ? "load-balance" : "url-test",
      };

      if (!loadBalance) {
        Object.assign(groupConfig, {
          url: "https://cp.cloudflare.com/generate_204",
          interval: 60,
          tolerance: 20,
          lazy: false,
        });
      }

      countryProxyGroups.push(groupConfig);
    }
  }

  return countryProxyGroups;
}

function materializeCountryGroups(groups, proxyNames) {
  for (const group of groups) {
    const filter = String(group.filter || "").replace(/^\(\?i\)/, "");
    const exclude = String(group["exclude-filter"] || "").replace(/^\(\?i\)/, "");
    let matcher;
    let excludeMatcher;
    try {
      matcher = filter ? new RegExp(filter, "i") : null;
      excludeMatcher = exclude ? new RegExp(exclude, "i") : null;
    } catch {
      continue;
    }
    group.proxies = proxyNames.filter((name) => matcher?.test(name) && !excludeMatcher?.test(name));
    delete group["include-all"];
    delete group.filter;
    delete group["exclude-filter"];
  }
  return groups.filter((group) => Array.isArray(group.proxies) && group.proxies.length > 0);
}

function buildProxyGroups({
  countryList,
  countryProxyGroups,
  lowCost,
  defaultProxies,
  defaultProxiesDirect,
  defaultSelector,
  defaultFallback,
}) {
  const hasTW = countryList.includes("台湾");
  const hasHK = countryList.includes("香港");
  const hasUS = countryList.includes("美国");

  // 前置代理只保留按地区生成的策略组，不把订阅中的每个具体节点直接展开。
  // 这样在客户端里选择“前置代理”时，仍可进入地区组选择节点，但列表保持简洁。
  const frontProxySelector = countryList.length ? countryList.map((country) => `${country}节点`) : ["手动选择", "DIRECT"];

  const relayEnabled = isRelayEnabled();
  const dialerOn = isDialerEnabled();

  // AI/Google：优先链式落地节点；多个 Socks5 落地时由 fallback 自动择优。
  const relayNames = socksNames.map((name, index) => socksNames.length === 1 ? relayGroupName : `${relayGroupName}-${index + 1}`);
  const proxiesPreferChain = relayEnabled
    ? [...relayNames, ...defaultProxies]
    : dialerOn
      ? [...socksNames, ...defaultProxies]
      : defaultProxies;

  // AI 分组默认使用美国节点，不包含香港节点。
  // 这里同时过滤嵌套的国家策略组，避免香港节点通过同名策略组间接进入 AI。
  const aiExcludedGroups = new Set([
    "美国节点",
    "香港节点",
    "选择节点",
    "手动选择",
    "直连",
    "DIRECT",
  ]);
  const aiProxies = [
    ...(hasUS ? ["美国节点"] : []),
    ...proxiesPreferChain.filter((name) => !aiExcludedGroups.has(name)),
  ];
  const aiAutoProxies = aiProxies.length ? aiProxies : ["故障转移"];

  // Google：自动组保留链式/落地优先级，但排除香港及需要人工选择的策略组和直连。
  const googleAutoExcludedGroups = new Set(["香港节点", "选择节点", "手动选择", "直连", "DIRECT"]);
  const googleAutoProxies = proxiesPreferChain.filter((name) => !googleAutoExcludedGroups.has(name));
  if (!googleAutoProxies.length) googleAutoProxies.push("故障转移");

  // Telegram：顶层保持 select，自动能力下沉到两个专用子组。
  // 地区优先级用于 TG自动；不存在的地区会自动过滤，其余已生成地区随后补入。
  const telegramPriority = ["香港节点", "日本节点", "新加坡节点", "台湾节点", "美国节点"];
  const availableCountryGroups = countryList.map((country) => `${country}节点`);
  const telegramCountryGroups = [
    ...telegramPriority.filter((name) => availableCountryGroups.includes(name)),
    ...availableCountryGroups.filter((name) => !telegramPriority.includes(name)),
  ];
  const telegramAutoProxies = telegramCountryGroups.length
    ? [...telegramCountryGroups, "故障转移"]
    : ["故障转移"];
  const telegramLowLatencyProxies = telegramCountryGroups.length
    ? telegramCountryGroups
    : ["故障转移"];

  return [
    {
      name: "选择节点",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
      type: "select",
      proxies: defaultSelector,
    },
    {
      name: "手动选择",
      icon: "https://cdn.jsdelivr.net/gh/shindgewongxj/WHATSINStash@master/icon/select.png",
      "include-all": true,
      type: "select",
    },

    // landing 模式：第一跳（前置代理）与机场落地分组（你原本的逻辑保留）
    landing
      ? {
          name: "前置代理",
          icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Route.png",
          type: "select",
          "include-all": true,
          filter: "(?i)^(新加坡 B1|US-Balancer.*|TW-X1.*)$",
          "exclude-filter": "(?i)落地|链式|前置",
        }
      : null,
    landing
      ? {
          name: "落地节点",
          icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Airport.png",
          type: "select",
          "include-all": true,
          filter: "(?i)家宽|家庭|家庭宽带|商宽|商业宽带|星链|Starlink|落地",
        }
      : null,

    // 兼容：每个落地节点单独生成 relay 组，避免多个落地被错误串成多跳链路。
    ...(relayEnabled
      ? socksNames.map((name, index) => ({
          name: socksNames.length === 1 ? relayGroupName : `${relayGroupName}-${index + 1}`,
          icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Route.png",
          type: "relay",
          proxies: ["前置代理", name],
        }))
      : []),
    {
      name: "故障转移",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Bypass.png",
      type: "fallback",
      url: "https://cp.cloudflare.com/generate_204",
      proxies: defaultFallback,
      interval: 180,
      tolerance: 20,
      lazy: false,
    },
    {
      name: "静态资源",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Cloudflare.png",
      type: "select",
      proxies: defaultProxies,
    },
    {
      name: "AutoDirect",
      icon: "https://cdn.jsdelivr.net/gh/xiaochou164/override-rules@master/icons/AutoDirect.png",
      type: "select",
      proxies: ["直连"],
    },
    {
      name: "钱包/银行",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Direct.png",
      type: "select",
      proxies: ["直连", "选择节点", "手动选择"],
    },

    // AI：顶层保留手动选择，AI自动负责稳定优先的故障转移。
    {
      name: "AI自动",
      icon: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/icons/chatgpt.png",
      type: "fallback",
      url: "https://cp.cloudflare.com/generate_204",
      interval: 60,
      tolerance: 20,
      lazy: false,
      proxies: aiAutoProxies,
    },
    {
      name: "AI",
      icon: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/icons/chatgpt.png",
      type: "select",
      proxies: ["AI自动", ...aiProxies, "手动选择"],
    },

    // Google：顶层保留手动选择，Google自动负责链式/地区出口的自动容灾。
    {
      name: "Google自动",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google.png",
      type: "fallback",
      url: "https://cp.cloudflare.com/generate_204",
      interval: 60,
      tolerance: 20,
      lazy: false,
      proxies: googleAutoProxies,
    },
    {
      name: "Google",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google.png",
      type: "select",
      proxies: ["Google自动", ...proxiesPreferChain],
    },

    {
      name: "TG自动",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png",
      type: "fallback",
      proxies: telegramAutoProxies,
      url: "https://api.telegram.org",
      interval: 60,
      tolerance: 20,
      lazy: false,
    },
    {
      name: "TG低延迟",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png",
      type: "url-test",
      proxies: telegramLowLatencyProxies,
      url: "https://api.telegram.org",
      interval: 60,
      tolerance: 50,
      lazy: false,
    },
    {
      name: "Telegram",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Telegram.png",
      type: "select",
      proxies: ["TG自动", "TG低延迟", ...defaultProxies],
    },
    {
      name: "YouTube",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/YouTube.png",
      type: "select",
      proxies: defaultProxies,
    },
    {
      name: "X",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Twitter.png",
      type: "select",
      proxies: defaultProxies,
    },
    {
      name: "Bilibili",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/bilibili.png",
      type: "select",
      proxies: hasTW && hasHK ? ["直连", "台湾节点", "香港节点"] : defaultProxiesDirect,
    },
    {
      name: "Netflix",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Netflix.png",
      type: "select",
      proxies: defaultProxies,
    },
    {
      name: "Truth Social",
      icon: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/icons/TruthSocial.png",
      type: "select",
      proxies: hasUS ? ["美国节点", "选择节点", "手动选择"] : defaultProxies,
    },
    {
      name: "SSH(22端口)",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Server.png",
      type: "select",
      proxies: ["直连", "故障转移", ...availableCountryGroups, "手动选择", "选择节点"],
    },
    {
      name: "搜狗输入法",
      icon: "https://cdn.jsdelivr.net/gh/powerfullz/override-rules@master/icons/Sougou.png",
      type: "select",
      proxies: ["直连", "REJECT"],
    },
    {
      name: "直连",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Direct.png",
      type: "select",
      proxies: ["DIRECT", "选择节点"],
    },
    {
      name: "广告拦截",
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AdBlack.png",
      type: "select",
      proxies: ["REJECT", "直连"],
    },
    lowCost
      ? {
          name: "低倍率节点",
          icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Lab.png",
          type: "url-test",
          url: "https://cp.cloudflare.com/generate_204",
          "include-all": true,
          filter: "(?i)0\\.[0-5]|低倍率|省流|大流量|实验性",
        }
      : null,
    ...countryProxyGroups,
  ].filter(Boolean);
}

function main(config) {
  // 只保留节点，但先去除完全重复项并修复重复名称。
  // 不直接复用上游订阅的 proxy-groups/rules，由本脚本统一生成。
  config = { proxies: normalizeAndDeduplicateProxies(config.proxies) };

  // 注入 SOCKS5 落地节点（兼容单节点参数，并支持 socks_nodes 多节点）
  for (const socksNode of socksNodes) {
    config.proxies = config.proxies || [];
    const exists = config.proxies.some((p) => p && p.name === socksNode.name);
    if (exists) continue;

    const node = {
      name: socksNode.name,
      type: "socks5",
      server: socksNode.host,
      port: socksNode.port,
      udp: true,
    };

    // 表示“连接落地 Socks5 的这一步，通过前置代理去拨号建立连接”。
    if (isDialerEnabled()) node["dialer-proxy"] = "前置代理";
    if (socksNode.user) node.username = socksNode.user;
    if (socksNode.pass) node.password = socksNode.pass;
    config.proxies.push(node);
  }

  const countryInfo = parseCountries(config);
  const lowCost = hasLowCost(config);

  const initialLists = buildBaseLists({ landing, lowCost, countryInfo });
  const initialCountryList = initialLists.countryGroupNames;

  let countryProxyGroups = materializeCountryGroups(
    buildCountryProxyGroups(initialCountryList.map((n) => n.replace(/节点$/, ""))),
    config.proxies.map((proxy) => proxy.name),
  );
  const usableCountryNames = countryProxyGroups.map((group) => group.name);
  const { defaultProxies, defaultProxiesDirect, defaultSelector, defaultFallback } =
    buildBaseLists({ landing, lowCost, countryInfo, countryNames: usableCountryNames });

  const proxyGroups = buildProxyGroups({
    countryList: usableCountryNames.map((n) => n.replace(/节点$/, "")),
    countryProxyGroups,
    lowCost,
    defaultProxies,
    defaultProxiesDirect,
    defaultSelector,
    defaultFallback,
  });

  const globalProxies = proxyGroups.map((item) => item.name);

  proxyGroups.push({
    name: "GLOBAL",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Global.png",
    "include-all": true,
    type: "select",
    proxies: globalProxies,
  });

  if (fullConfig)
    Object.assign(config, {
      "mixed-port": 7890,
      "redir-port": 7892,
      "tproxy-port": 7893,
      "routing-mark": 7894,
      "allow-lan": true,
      ipv6: ipv6Enabled,
      mode: "rule",
      "unified-delay": true,
      "tcp-concurrent": true,
      "find-process-mode": "off",
      "log-level": "info",
      "geodata-loader": "standard",
      "external-controller": ":9999",
      "disable-keep-alive": !keepAliveEnabled,
      profile: { "store-selected": true },
    });

  Object.assign(config, {
    "proxy-groups": proxyGroups,
    "rule-providers": ruleProviders,
    rules: rules,
    sniffer: snifferConfig,
    dns: fakeIPEnabled ? dnsConfig2 : dnsConfig,
    ipv6: ipv6Enabled,
    "geodata-mode": true,
    "geox-url": geoxURL,
  });

  return config;
}
