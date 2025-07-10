const http = require('http');

const options = {
  hostname: process.env.HOST || 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const healthCheck = () => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve('OK');
      } else {
        reject(new Error(`Health check failed with status: ${res.statusCode}`));
      }
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
};

// Run health check
healthCheck()
  .then(() => {
    console.log('✅ Health check passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }); 