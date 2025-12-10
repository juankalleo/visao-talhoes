// Test script para verificar o endpoint
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/sentinel2/ndvi-visual/15/16398/10919.png',
  method: 'GET',
  timeout: 15000
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Content-Type: ${res.headers['content-type']}`);
  let dataSize = 0;
  res.on('data', (chunk) => {
    dataSize += chunk.length;
  });
  res.on('end', () => {
    console.log(`Total size: ${dataSize} bytes`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Request timeout');
  req.destroy();
  process.exit(1);
});

req.end();
