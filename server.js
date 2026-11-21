/**
 * WAREHOUSE UNIT LOADING - NODE.JS HTTP & HTTPS SERVER
 * Provides localhost and local network hosting.
 * HTTPS (Port 3443) enables camera & scanner permissions on mobile phones and PCs.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

// Generate or load self-signed SSL certificates for camera HTTPS access
async function getSslCredentials() {
  const certPath = path.join(ROOT_DIR, 'cert.pem');
  const keyPath = path.join(ROOT_DIR, 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  console.log('Generating local SSL certificate for camera access...');
  const ips = getLocalIpAddresses();
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: ips[0] || 'localhost' }],
    {
      days: 365,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            ...ips.map(ip => ({ type: 7, ip: ip }))
          ]
        }
      ]
    }
  );

  fs.writeFileSync(certPath, pems.cert);
  fs.writeFileSync(keyPath, pems.private);

  return {
    key: pems.private,
    cert: pems.cert
  };
}

// Common Request Handler
function handleRequest(req, res) {
  let parsedUrl = req.url.split('?')[0];

  if (parsedUrl === '/' || parsedUrl === '') {
    parsedUrl = '/index.html';
  }

  const safePath = path.normalize(parsedUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + safePath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

async function startServers() {
  // 1. Start HTTP Server (Used by local machines and Render / Cloud hosts)
  const httpServer = http.createServer(handleRequest);
  httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`🚀 Warehouse System running on port ${HTTP_PORT}`);
  });

  // Render automatically terminates SSL at the edge, so skip local HTTPS on cloud
  if (process.env.RENDER || process.env.NODE_ENV === 'production') {
    printBanner(false);
    return;
  }

  // 2. Start local HTTPS Server for direct local device testing
  try {
    const sslCreds = await getSslCredentials();
    const httpsServer = https.createServer(sslCreds, handleRequest);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      printBanner(true);
    });
  } catch (err) {
    console.warn('Could not launch HTTPS server, running on HTTP only:', err.message);
    printBanner(false);
  }
}

function printBanner(httpsEnabled) {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0] || 'localhost';

  console.log('\n================================================================');
  console.log('📦 Receive Materials & Store in Warehouse - Unit Loading Ready');
  console.log('================================================================');
  console.log(`💻 Local Computer (HTTP):   http://localhost:${HTTP_PORT}`);
  if (httpsEnabled) {
    console.log(`💻 Local Computer (HTTPS):  https://localhost:${HTTPS_PORT}`);
    console.log('----------------------------------------------------------------');
    console.log(`📱 Phone / Tablet on Wi-Fi (Camera Enabled HTTPS):`);
    console.log(`   👉 https://${primaryIp}:${HTTPS_PORT}`);
  }
  console.log('================================================================\n');
}

startServers();
