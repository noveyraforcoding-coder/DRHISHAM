// ============================================================
// سيرفر تطوير محلي بسيط (بدون Vercel CLI)
// يستخدم للتطوير والمعاينة المحلية فقط
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env.local
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  console.warn('⚠️  No .env.local found');
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const API_DIR = path.join(__dirname, 'api');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS for API
  if (pathname.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }
  }

  // API Routes
  if (pathname.startsWith('/api/')) {
    const apiName = pathname.replace('/api/', '').replace(/\/$/, '');
    const apiFile = path.join(API_DIR, `${apiName}.js`);

    if (!fs.existsSync(apiFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'API not found' }));
    }

    try {
      // Parse body for POST
      let body = '';
      if (req.method === 'POST') {
        body = await new Promise((resolve) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => resolve(data));
        });
      }

      // Create mock req/res
      const mockReq = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: parsedUrl.query,
        body: body ? JSON.parse(body) : {}
      };

      const mockRes = {
        statusCode: 200,
        headers: {},
        setHeader(key, value) { this.headers[key] = value; },
        status(code) { this.statusCode = code; return this; },
        json(data) {
          res.writeHead(this.statusCode, {
            ...this.headers,
            'Content-Type': 'application/json; charset=utf-8'
          });
          res.end(JSON.stringify(data));
        },
        end() { res.end(); }
      };

      // Clear require cache for hot reload
      delete require.cache[require.resolve(apiFile)];
      // Also clear db.js cache
      const dbFile = path.join(API_DIR, '_lib', 'db.js');
      delete require.cache[require.resolve(dbFile)];

      const handler = require(apiFile);
      await handler(mockReq, mockRes);

    } catch (err) {
      console.error(`❌ API Error [${apiName}]:`, err.message);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // Static Files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  
  // Add .html extension if no extension
  if (!path.extname(filePath)) {
    filePath += '.html';
  }

  const fullPath = path.join(PUBLIC_DIR, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(fullPath);

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } else {
      // Try index.html fallback
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔════════════════════════════════════════════════════╗');
  console.log('  ║  🎓 نظام حضور وغياب الطلاب - د. هشام هاشم       ║');
  console.log('  ║  كلية العلوم - جامعة طنطا - مقرر الحرارة         ║');
  console.log('  ╚════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  📱 صفحة الطالب:    http://localhost:${PORT}/`);
  console.log(`  🔐 لوحة التحكم:    http://localhost:${PORT}/admin`);
  console.log('');
  console.log('  ✅ السيرفر يعمل بنجاح!');
  console.log('');
});
