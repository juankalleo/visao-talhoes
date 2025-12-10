// Teste de requisição HTTP
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/sentinel2/ndvi-visual/15/16398/10919.png',
  method: 'GET',
  timeout: 15000
};

console.log('[TEST] Starting request to /api/sentinel2/ndvi-visual/15/16398/10919.png');

const req = http.request(options, (res) => {
  console.log(`[TEST] Got response: ${res.statusCode}`);
  let size = 0;
  res.on('data', (chunk) => {
    size += chunk.length;
    console.log(`[TEST] Received chunk: ${chunk.length} bytes (total: ${size})`);
  });
  res.on('end', () => {
    console.log(`[TEST] Response complete: ${size} bytes total`);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('[TEST] Request error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('[TEST] Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();
console.log('[TEST] Request sent');
