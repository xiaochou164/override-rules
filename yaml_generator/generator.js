/**
 * YAML 生成器
 * 使用 fake_proxies.json 中的假代理列表，载入 convert.js，
 * 组合不同参数调用其 main(config) 生成 Clash/Stash 配置，并输出为 YAML 文件。
 * 
 * 支持的布尔参数（与 convert.js 内保持一致）：
 *  - loadbalance
 *  - landing
 *  - ipv6
 *  - full
 *  - keepalive
 * 
 * 默认生成所有 2^5 = 32 种组合，文件命名格式：
 *   config_lb-{0|1}_landing-{0|1}_ipv6-{0|1}_full-{0|1}_keepalive-{0|1}.yaml
 * 
 * 可通过环境变量 LIMIT_COMBOS（整数）限制生成前 N 个组合。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const YAML = require('yaml');

// 路径常量
const BASE_DIR = path.resolve(__dirname, '..');
const GENERATOR_DIR = __dirname;
const CONVERT_FILE = path.join(BASE_DIR, 'convert.js');
const FAKE_PROXIES_FILE = path.join(GENERATOR_DIR, 'fake_proxies.json');
// 统一使用 plural 目录名，便于与 README / CI 对齐
const OUTPUT_DIR = path.join(BASE_DIR, 'yamls');

// 读取 fake proxies
function loadFakeConfig() {
    const raw = fs.readFileSync(FAKE_PROXIES_FILE, 'utf-8');
    const json = JSON.parse(raw);
    if (!json.proxies || !Array.isArray(json.proxies)) {
        throw new Error('fake_proxies.json 缺少 proxies 数组');
    }
    return json; // 直接作为基础 config 传入 main
}

// 使用 yaml 库序列化
function toYAML(obj) {
    return YAML.stringify(obj, { indent: 2, simpleKeys: false });
}

// 生成参数组合
function generateArgCombos() {
    const flags = ['loadbalance', 'landing', 'ipv6', 'full', 'keepalive'];
    const combos = [];
    for (let mask = 0; mask < (1 << flags.length); mask++) {
        const combo = {};
        flags.forEach((flag, i) => {
            combo[flag] = Boolean(mask & (1 << i));
        });
        combos.push(combo);
    }
    return combos;
}

// 执行 convert.js 并调用 main
function runConvert(baseConfig, args) {
    const code = fs.readFileSync(CONVERT_FILE, 'utf-8');
    const sandbox = {
        $arguments: { ...args },
        console,
        // 为安全不提供 require / module
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'convert.js' });
    if (typeof sandbox.main !== 'function') {
        throw new Error('convert.js 未暴露 main 函数 (未在顶层定义?)');
    }
    // 深拷贝基础配置，避免污染
    const configCopy = JSON.parse(JSON.stringify(baseConfig));
    return sandbox.main(configCopy);
}

function fileNameFromArgs(args) {
    return `config_lb-${+args.loadbalance}_landing-${+args.landing}_ipv6-${+args.ipv6}_full-${+args.full}_keepalive-${+args.keepalive}.yaml`;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
    const baseConfig = loadFakeConfig();
    ensureDir(OUTPUT_DIR);
    // 清理旧文件，避免残留无效组合
    for (const f of fs.readdirSync(OUTPUT_DIR)) {
        if (/^config_lb-\d_landing-\d_ipv6-\d_full-\d_keepalive-\d\.yaml$/.test(f)) {
            try { fs.unlinkSync(path.join(OUTPUT_DIR, f)); } catch (_) {}
        }
    }
    const combos = generateArgCombos();
    const limit = process.env.LIMIT_COMBOS ? parseInt(process.env.LIMIT_COMBOS, 10) : combos.length;
    let count = 0;
    for (const args of combos) {
        if (count >= limit) break;
    const config = runConvert(baseConfig, args);
    // 输出前移除假 proxies 列表
    delete config.proxies;
        const yaml = toYAML(config);
        const filePath = path.join(OUTPUT_DIR, fileNameFromArgs(args));
        fs.writeFileSync(filePath, yaml + '\n', 'utf-8');
        console.log(`[生成] ${path.relative(process.cwd(), filePath)}`);
        count++;
    }
    console.log(`完成：输出 ${count} 个 YAML 文件到 ${path.relative(process.cwd(), OUTPUT_DIR)}`);
}

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error('生成失败:', e);
        process.exit(1);
    }
}
