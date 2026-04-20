const http = require('http');

const BASE = 'http://localhost:3001';
let passed = 0;
let failed = 0;
let authToken = '';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('TrackFlow Test Suite\n');

  process.env.PORT = '3001';
  process.env.TRACKFLOW_DB_PATH = '/tmp/trackflow-test.db';
  try { require('fs').unlinkSync('/tmp/trackflow-test.db'); } catch {}
  require('../src/server');

  await new Promise(r => setTimeout(r, 500));

  // 1. Health check
  console.log('1. Health Check');
  const health = await request('GET', '/health');
  assert(health.status === 200, 'Health endpoint returns 200');
  assert(health.body.status === 'ok', 'Health status is ok');

  // 2. Auth - Login
  console.log('\n2. Authentication');
  const loginBad = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  assert(loginBad.status === 401, 'Bad password returns 401');

  const login = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin' });
  assert(login.status === 200, 'Admin login returns 200');
  assert(login.body.token, 'Login returns token');
  assert(login.body.user.role === 'admin', 'Admin role confirmed');
  authToken = login.body.token;

  // 3. Auth - Protected routes without token
  console.log('\n3. Auth Protection');
  const noAuth = await request('POST', '/api/parcels', { senderName: 'Test' });
  assert(noAuth.status === 401, 'Create parcel without auth returns 401');

  const noAuthScan = await request('POST', '/api/scan', { trackingCode: 'test', status: 'arrived', location: 'test' });
  assert(noAuthScan.status === 401, 'Scan without auth returns 401');

  // 4. Auth - Get me
  console.log('\n4. User Profile');
  const me = await request('GET', '/api/auth/me', null, authToken);
  assert(me.status === 200, 'Get me returns 200');
  assert(me.body.username === 'admin', 'Username is admin');

  // 5. Auth - Create operator user
  console.log('\n5. Create Operator');
  const createOp = await request('POST', '/api/auth/users', {
    username: 'operator1', password: 'op123', role: 'operator', fullName: 'Operateur Test',
  }, authToken);
  assert(createOp.status === 201, 'Create operator returns 201');

  const opLogin = await request('POST', '/api/auth/login', { username: 'operator1', password: 'op123' });
  assert(opLogin.status === 200, 'Operator login succeeds');
  const opToken = opLogin.body.token;

  // 6. Create parcel (admin only)
  console.log('\n6. Create Parcel');
  const createRes = await request('POST', '/api/parcels', {
    senderName: 'Jean Dupont',
    senderPhone: '+33612345678',
    recipientName: 'Marie Kamga',
    recipientPhone: '+237699887766',
    origin: 'Paris',
    destination: 'Douala',
    weightKg: 5.2,
    description: 'Colis test',
  }, authToken);
  assert(createRes.status === 201, 'Create returns 201');
  assert(createRes.body.trackingCode.startsWith('TF-'), 'Tracking code starts with TF-');
  assert(createRes.body.qrCodeDataUrl.startsWith('data:image/png'), 'QR code is PNG data URL');

  const trackingCode = createRes.body.trackingCode;

  // Operator cannot create parcels
  const opCreate = await request('POST', '/api/parcels', {
    senderName: 'Test', recipientName: 'Test', recipientPhone: '+237000000000', origin: 'A', destination: 'B',
  }, opToken);
  assert(opCreate.status === 403, 'Operator cannot create parcels (403)');

  // 7. Create parcel - validation
  console.log('\n7. Validation');
  const badCreate = await request('POST', '/api/parcels', { senderName: 'Test' }, authToken);
  assert(badCreate.status === 400, 'Missing fields returns 400');

  // 8. Get parcel by tracking code (public)
  console.log('\n8. Get Parcel (Public)');
  const getRes = await request('GET', `/api/parcels/${trackingCode}`);
  assert(getRes.status === 200, 'Get parcel returns 200 (no auth needed)');
  assert(getRes.body.tracking_code === trackingCode, 'Tracking code matches');
  assert(getRes.body.status === 'registered', 'Initial status is registered');
  assert(getRes.body.events.length === 1, 'Has one initial event');

  // 9. List parcels (requires auth)
  console.log('\n9. List Parcels');
  const listRes = await request('GET', '/api/parcels', null, authToken);
  assert(listRes.status === 200, 'List returns 200');
  assert(listRes.body.parcels.length >= 1, 'At least one parcel');
  assert(listRes.body.pagination.total >= 1, 'Pagination total >= 1');

  // 10. Scan - update status (operator can scan)
  console.log('\n10. Scan Events');
  const scan1 = await request('POST', '/api/scan', {
    trackingCode, status: 'picked_up', location: 'Bureau Paris Nord', scannedBy: 'Agent X',
  }, opToken);
  assert(scan1.status === 200, 'Operator scan picked_up returns 200');
  assert(scan1.body.currentStatus === 'picked_up', 'Status updated to picked_up');

  const scan2 = await request('POST', '/api/scan', {
    trackingCode, status: 'in_transit', location: 'Aeroport CDG',
  }, authToken);
  assert(scan2.status === 200, 'Scan in_transit returns 200');

  const scan3 = await request('POST', '/api/scan', {
    trackingCode, status: 'arrived', location: 'Douala',
  }, authToken);
  assert(scan3.status === 200, 'Scan arrived returns 200');

  // 11. Verify full tracking (public)
  console.log('\n11. Full Tracking');
  const fullTrack = await request('GET', `/api/parcels/${trackingCode}`);
  assert(fullTrack.body.status === 'arrived', 'Final status is arrived');
  assert(fullTrack.body.events.length === 4, 'Has 4 events (registered + 3 scans)');
  assert(fullTrack.body.sms_notified === 1, 'SMS notification was triggered');

  // 12. Scan validation
  console.log('\n12. Scan Validation');
  const badScan = await request('POST', '/api/scan', {
    trackingCode, status: 'invalid_status', location: 'Test',
  }, authToken);
  assert(badScan.status === 400, 'Invalid status returns 400');

  const notFound = await request('POST', '/api/scan', {
    trackingCode: 'TF-NONEXISTENT', status: 'arrived', location: 'Test',
  }, authToken);
  assert(notFound.status === 404, 'Unknown tracking code returns 404');

  // 13. Batch scan
  console.log('\n13. Batch Scan');
  const batchRes = await request('POST', '/api/scan/batch', {
    scans: [
      { trackingCode, status: 'delivered', location: 'Bureau Douala' },
      { trackingCode: 'TF-INVALID', status: 'arrived', location: 'Test' },
    ],
  }, authToken);
  assert(batchRes.status === 200, 'Batch scan returns 200');
  assert(batchRes.body.results[0].success === true, 'First batch item succeeds');
  assert(batchRes.body.results[1].success === false, 'Second batch item fails (not found)');

  // 14. Not found parcel (public)
  console.log('\n14. Not Found');
  const notFoundParcel = await request('GET', '/api/parcels/TF-NONEXISTENT');
  assert(notFoundParcel.status === 404, 'Unknown parcel returns 404');

  // 15. List users (admin only)
  console.log('\n15. User Management');
  const listUsers = await request('GET', '/api/auth/users', null, authToken);
  assert(listUsers.status === 200, 'List users returns 200');
  assert(listUsers.body.users.length >= 2, 'At least 2 users (admin + operator)');

  const opListUsers = await request('GET', '/api/auth/users', null, opToken);
  assert(opListUsers.status === 403, 'Operator cannot list users (403)');

  // Summary
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}`);

  try { require('fs').unlinkSync('/tmp/trackflow-test.db'); } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
