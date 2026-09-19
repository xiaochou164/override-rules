const http = require('http');
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.WORKBENCH_PORT || 3088);
const ALLOWED_ROOTS = ['ruleset', 'yamls', 'convert.js', 'direct.txt', 'README.md'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8', '.yml': 'text/yaml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.list': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

function relativeSafe(input) {
  const clean = String(input || '').replaceAll('\\', '/').replace(/^\/+/, '');
  const target = path.resolve(ROOT, clean);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) throw new Error('非法路径');
  if (!ALLOWED_ROOTS.some((root) => clean === root || clean.startsWith(root + '/'))) throw new Error('该目录不允许编辑');
  return target;
}
function listFiles(dir = ROOT, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'workbench'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (/\.(js|json|ya?ml|txt|list|md)$/.test(entry.name)) out.push(path.relative(ROOT, full).replaceAll(path.sep, '/'));
  }
  return out.sort((a, b) => a.localeCompare(b));
}
function send(res, status, body, type = 'application/json; charset=utf-8') { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type.startsWith('application/json') ? JSON.stringify(body) : body); }
function parseBody(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', (chunk) => { data += chunk; if (data.length > 2_000_000) reject(new Error('文件超过 2MB')); }); req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('请求格式错误')); } }); req.on('error', reject); }); }
function validate(file, content) {
  const ext = path.extname(file).toLowerCase();
  if (['.yaml', '.yml'].includes(ext)) { YAML.parse(content); return { valid: true, kind: 'yaml' }; }
  if (ext === '.json') { JSON.parse(content); return { valid: true, kind: 'json' }; }
  if (ext === '.js') { new Function(content); return { valid: true, kind: 'javascript' }; }
  return { valid: true, kind: 'text' };
}
function api(res, status, data) { send(res, status, data); }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/files' && req.method === 'GET') return api(res, 200, { files: listFiles() });
    if (url.pathname === '/api/file' && req.method === 'GET') {
      const file = url.searchParams.get('path'); const target = relativeSafe(file);
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return api(res, 404, { error: '文件不存在' });
      const content = fs.readFileSync(target, 'utf8'); return api(res, 200, { path: file, content, size: Buffer.byteLength(content), modified: fs.statSync(target).mtime });
    }
    if (url.pathname === '/api/validate' && req.method === 'POST') {
      const body = await parseBody(req); return api(res, 200, validate(body.path, body.content));
    }
    if (url.pathname === '/api/file' && req.method === 'PUT') {
      const body = await parseBody(req); const target = relativeSafe(body.path);
      if (typeof body.content !== 'string' || body.content.length > 2_000_000) return api(res, 400, { error: '内容无效或超过 2MB' });
      const result = validate(body.path, body.content); fs.writeFileSync(target, body.content, 'utf8');
      return api(res, 200, { saved: true, ...result, modified: fs.statSync(target).mtime });
    }
    if (url.pathname === '/api/create' && req.method === 'POST') {
      const body = await parseBody(req); const file = String(body.path || ''); const target = relativeSafe(file);
      if (!/^ruleset\/[\w.-]+\.(list|txt)$/.test(file)) return api(res, 400, { error: '只能在 ruleset 下创建 .list 或 .txt 文件' });
      if (fs.existsSync(target)) return api(res, 409, { error: '文件已存在' });
      fs.writeFileSync(target, typeof body.content === 'string' ? body.content : '# New rule\n', 'utf8'); return api(res, 201, { created: true, path: file });
    }
    if (url.pathname === '/api/stats' && req.method === 'GET') {
      const files = listFiles(); const rules = files.filter((f) => f.startsWith('ruleset/')); const yamls = files.filter((f) => f.startsWith('yamls/')); const lines = rules.reduce((n, f) => n + fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter((x) => x.trim() && !x.trim().startsWith('#')).length, 0);
      return api(res, 200, { files: files.length, rulesets: rules.length, yamls: yamls.length, rules });
    }
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const staticFile = path.resolve(PUBLIC, '.' + requested);
    if (staticFile !== PUBLIC && staticFile.startsWith(PUBLIC + path.sep) && fs.existsSync(staticFile) && fs.statSync(staticFile).isFile()) return send(res, 200, fs.readFileSync(staticFile), MIME[path.extname(staticFile)] || 'application/octet-stream');
    return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  } catch (error) { return api(res, 400, { error: error.message }); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`Override Workbench running at http://0.0.0.0:${PORT}`));
