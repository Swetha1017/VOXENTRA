const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log('       VOXENTRA PLATFORM: COMPREHENSIVE END-TO-END AUDIT        ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assertCheck(name, condition, extraInfo = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS ${passed}] ${name} ${extraInfo ? '-> ' + extraInfo : ''}`);
    } else {
      console.error(`  [FAIL] ${name} ${extraInfo ? '-> ' + extraInfo : ''}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // 1. Health Check
  console.log('--- 1. System Health & Diagnostic Verification ---');
  let res = await request({ hostname: 'localhost', port: 8080, path: '/health', method: 'GET' });
  assertCheck('Backend Service Health Check', res.status === 200 && res.data.status === 'healthy', `service: ${res.data.service}`);

  // 2. Preloaded Official Questions
  console.log('\n--- 2. Pre-loaded Questions Verification ---');
  res = await request({ hostname: 'localhost', port: 8080, path: '/api/polls', method: 'GET' });
  assertCheck('Preloaded Questions Count', res.status === 200 && Array.isArray(res.data) && res.data.length >= 2, `Found ${res.data.length} official polls`);
  const officialPoll = res.data.find(p => p.creator_name === 'Voxentra Official') || res.data[0];
  assertCheck('Official Question Options Structure', officialPoll.options.length >= 4, `Title: "${officialPoll.title}" (${officialPoll.options.length} options)`);
  const activePoll = officialPoll;

  // 3. User Registration
  console.log('\n--- 3. Audience Registration & Duplicate Prevention ---');
  const timestamp = Date.now();
  const testUser = {
    username: `voter_${timestamp}`,
    email: `voter_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, testUser);
  assertCheck('Voter Registration', res.status === 201 && res.data.token, `Registered user: ${testUser.username}`);
  const voterToken = res.data.token;
  const voterId = res.data.user.id;

  // Duplicate Registration
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, testUser);
  assertCheck('Duplicate Registration Prevention (409)', res.status === 409, 'Duplicate email was rejected');

  // 4. Regular User Login
  console.log('\n--- 4. Audience Authentication ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: testUser.email, password: testUser.password });
  assertCheck('Voter Login', res.status === 200 && res.data.token, `Role: ${res.data.user.role}`);

  // 5. Administrator Login
  console.log('\n--- 5. Exclusive Administrator Portal Authentication ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/admin-login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'swetha4110@gmail.com', password: 'segu7624' });
  assertCheck('Admin Credentials Verification', res.status === 200 && res.data.user?.role === 'admin', `Admin: ${res.data.user?.email}`);
  const adminToken = res.data.token;

  // 6. RBAC Guard Verification
  console.log('\n--- 6. Role-Based Access Control (RBAC) Guard ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/analytics',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${voterToken}` }
  });
  assertCheck('Non-Admin Blocked from Admin Endpoints (403)', res.status === 403, 'Regular voter forbidden from admin analytics');

  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/analytics',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assertCheck('Admin Access to Analytics Granted (200)', res.status === 200 && res.data.total_polls !== undefined, `Total Polls: ${res.data.total_polls}, Total Votes: ${res.data.total_votes}`);

  // 7. Atomic Voting & Deduplication
  console.log('\n--- 7. Atomic Voting & One-Vote-Per-User Enforcement ---');
  const targetOptionId = activePoll.options[0].id;
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${activePoll.id}/vote`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${voterToken}`
    }
  }, { option_id: targetOptionId });
  assertCheck('Authenticated Vote Submission', res.status === 200 && res.data.message?.includes('recorded'), `Voted for ${targetOptionId}`);

  // Attempt duplicate vote
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${activePoll.id}/vote`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${voterToken}`
    }
  }, { option_id: targetOptionId });
  assertCheck('Duplicate Vote Prevention (400)', res.status === 400, 'Duplicate vote on same poll rejected');

  // Anonymous vote rejection
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${activePoll.id}/vote`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { option_id: targetOptionId });
  assertCheck('Anonymous Vote Rejection (401)', res.status === 401, 'Anonymous attempt rejected');

  // 8. Poll Reactions
  console.log('\n--- 8. Poll Reactions (Upvote / Downvote) ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${activePoll.id}/reaction`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${voterToken}`
    }
  }, { type: 'upvote' });
  assertCheck('Poll Reaction Recorded', res.status === 200 && res.data.upvotes !== undefined, `Total Upvotes: ${res.data.upvotes}`);

  // 9. Live Commentary Stream
  console.log('\n--- 9. Live Commentary Stream ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/comments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${voterToken}`
    }
  }, { target_id: activePoll.id, content: 'Exciting live poll on Voxentra!' });
  assertCheck('Live Commentary Post', res.status === 201 && (res.data.content || res.data.comment?.content), `Message: "${res.data.content || res.data.comment?.content}"`);

  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/comments?target_id=${activePoll.id}`,
    method: 'GET'
  });
  assertCheck('Live Commentary Retrieval', res.status === 200 && Array.isArray(res.data) && res.data.length >= 1, `Fetched ${res.data.length} comments`);

  // 10. Interactive Mini-Games Score Submission & Leaderboards
  console.log('\n--- 10. Interactive Gaming Arena & Leaderboards ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/games/score',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${voterToken}`
    }
  }, { game_name: 'color_match', score: 180, accuracy: 95.5 });
  assertCheck('Color Match Game Score Submission', res.status === 200 && (res.data.message?.includes('recorded') || res.data.score), 'Score recorded: 180 pts');

  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/games/leaderboard?game=color_match',
    method: 'GET'
  });
  assertCheck('Game-Specific Leaderboard', res.status === 200 && Array.isArray(res.data) && res.data.length >= 1, `Top player: ${res.data[0]?.username} (${res.data[0]?.score} pts)`);

  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/leaderboard',
    method: 'GET'
  });
  assertCheck('Global Community Leaderboard', res.status === 200 && Array.isArray(res.data) && res.data.length >= 1, `Leaderboard count: ${res.data.length}`);

  // 11. Referral Tracking
  console.log('\n--- 11. Social Sharing & Referral Tracking ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/polls/referral/whatsapp',
    method: 'POST'
  });
  assertCheck('Social Referral Click Recorded', res.status === 200 && (res.data.status === 'tracked' || res.data.status === 'ok'), 'Referral logged for platform: whatsapp');

  // 12. Admin Poll Lifecycle Management
  console.log('\n--- 12. Admin Poll Lifecycle Management ---');
  const newPoll = {
    title: `Test Poll ${timestamp}`,
    description: 'Automated lifecycle test poll',
    category: 'Engineering',
    duration_minutes: 60,
    options: ['Option Alpha', 'Option Beta', 'Option Gamma']
  };
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/polls',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, newPoll);
  const createdPollId = res.data.id || res.data.poll?.id;
  assertCheck('Admin Poll Creation', res.status === 201 && createdPollId, `Created poll ID: ${createdPollId}`);

  // Edit poll
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    title: `Updated Poll Title ${timestamp}`,
    description: 'Updated description by admin test',
    category: 'Cloud Computing',
    duration_minutes: 90,
    options: ['Updated Alpha', 'Updated Beta', 'New Gamma Option']
  });
  assertCheck('Admin Edit Poll', res.status === 200 && res.data.title?.includes('Updated Poll Title'), `Updated title: "${res.data.title}"`);

  // Pause poll
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}/pause`,
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assertCheck('Admin Pause Poll', res.status === 200 && (res.data.status === 'paused' || res.data.is_active === false), 'Poll paused');

  // Resume poll
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}/resume`,
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assertCheck('Admin Resume Poll', res.status === 200 && (res.data.status === 'active' || res.data.is_active === true), 'Poll resumed');

  // End poll
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}/end`,
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assertCheck('Admin End Poll', res.status === 200 && (res.data.status === 'ended' || res.data.is_active === false), 'Poll ended');

  // Delete poll
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}/permanent`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assertCheck('Admin Permanent Poll Deletion', res.status === 200, 'Poll purged');

  // 13. Frontend Service Verification
  console.log('\n--- 13. Frontend Dev Server Availability ---');
  res = await request({ hostname: '127.0.0.1', port: 5173, path: '/', method: 'GET' });
  assertCheck('Frontend HTTP 200 OK', res.status === 200 && res.headers['content-type']?.includes('text/html'), 'Vite serving Single Page Application');

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passed} OF ${total} SYSTEM VERIFICATION CHECKS PASSED (100%) `);
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('\n❌ Suite Error:', err);
  process.exit(1);
});
