import http from 'http';

async function testEndpoint(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'GET',
      timeout: 15000
    };

    const req = http.request(options, (res) => {
      let size = 0;
      res.on('data', (chunk) => { size += chunk.length; });
      res.on('end', () => {
        console.log(`✅ ${path}: ${res.statusCode} (${size} bytes)`);
        resolve(size);
      });
    });

    req.on('error', (err) => {
      console.error(`❌ ${path}: ${err.message}`);
      reject(err);
    });

    req.setTimeout(15000, () => {
      console.error(`⏱️ ${path}: Timeout`);
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function main() {
  console.log('Testing all endpoints...\n');
  
  const endpoints = [
    '/api/sentinel2/ndvi-visual/15/16398/10919.png',
    '/api/sentinel2/ndmi-visual/15/16398/10919.png',
    '/api/sentinel2/ndbi-visual/15/16398/10919.png'
  ];

  for (const ep of endpoints) {
    try {
      await testEndpoint(ep);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Failed: ${ep}`);
    }
  }

  console.log('\n✅ All tests complete!');
  process.exit(0);
}

setTimeout(() => {
  main().catch(() => process.exit(1));
}, 10000);
