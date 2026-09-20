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
  const adminUserObj = res.data.user;

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

  // 12. Admin Poll Lifecycle Management & Duration Constraints (25m - 2h / 120m)
  console.log('\n--- 12. Admin Poll Lifecycle Management & Duration Constraints ---');

  // Test duration < 25 min rejected
  let invalidPoll = {
    title: `Invalid Short Poll ${timestamp}`,
    category: 'Engineering',
    duration_minutes: 15, // < 25 min
    options: ['Opt A', 'Opt B']
  };
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/polls',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, invalidPoll);
  assertCheck('Reject Poll Duration < 25 min (400)', res.status === 400, res.data.error);

  // Test duration > 120 min rejected
  invalidPoll.duration_minutes = 150; // > 120 min (2h)
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/polls',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, invalidPoll);
  assertCheck('Reject Poll Duration > 2 Hours (400)', res.status === 400, res.data.error);

  // Valid poll creation with minimum allowed duration (25 min)
  const newPoll = {
    title: `Test Poll ${timestamp}`,
    description: 'Automated lifecycle test poll',
    category: 'Engineering',
    duration_minutes: 25,
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
  assertCheck('Admin Poll Creation with 25m Min Duration', res.status === 201 && createdPollId, `Created poll ID: ${createdPollId}`);

  // Test edit poll duration rejected if < 25 min
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Invalid Duration Edit ${timestamp}`,
    duration_minutes: 10,
    options: ['A', 'B']
  });
  assertCheck('Reject Edit Duration < 25 min (400)', res.status === 400, res.data.error);

  // Test edit poll duration rejected if > 120 min
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${createdPollId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Invalid Duration Edit ${timestamp}`,
    duration_minutes: 200,
    options: ['A', 'B']
  });
  assertCheck('Reject Edit Duration > 2 Hours (400)', res.status === 400, res.data.error);

  // Edit poll with maximum allowed duration (120 min = 2 hrs)
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
    description: 'Updated description by admin test with 2 hour duration',
    category: 'Cloud Computing',
    duration_minutes: 120,
    options: ['Updated Alpha', 'Updated Beta', 'New Gamma Option']
  });
  assertCheck('Admin Edit Poll with 2 Hour Max Duration', res.status === 200 && res.data.title?.includes('Updated Poll Title'), `Updated duration: ${res.data.duration_minutes}m (2 hours)`);

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

  // 13. Zero-Vote Option Immutability Guard Verification
  console.log('\n--- 13. Zero-Vote Option Immutability Guard Verification ---');
  const guardPollReq = {
    title: `Immutability Test Poll ${timestamp}`,
    category: 'Engineering',
    duration_minutes: 45,
    options: ['Choice 1', 'Choice 2', 'Choice 3']
  };
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/polls',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, guardPollReq);
  const guardPollId = res.data.id || res.data.poll?.id;
  assertCheck('Admin Creates Poll for Immutability Testing', res.status === 201 && guardPollId, `Poll ID: ${guardPollId}`);

  // While total_votes === 0, options can be freely modified
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${guardPollId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Immutability Test Poll ${timestamp}`,
    duration_minutes: 45,
    options: ['Choice 1 Modified', 'Choice 2 Modified', 'Choice 3 Modified', 'Choice 4 Added']
  });
  assertCheck('Options Successfully Modified When 0 Votes Cast (200)', res.status === 200 && res.data.options?.length === 4, '4 modified options saved');
  const guardOptions = res.data.options;

  // Register a distinct voter and cast a ballot
  const voter2 = {
    username: `voter2_${timestamp}`,
    email: `voter2_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, voter2);
  const voter2Token = res.data.token;

  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${guardPollId}/vote`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${voter2Token}` }
  }, { option_id: guardOptions[0].id });
  assertCheck('Ballot Cast on Poll (Total Votes = 1)', res.status === 200, 'Vote recorded');

  // Now attempt to modify options after vote cast -> MUST BE REJECTED WITH 400
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${guardPollId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Attempted Option Edit Post-Vote ${timestamp}`,
    duration_minutes: 45,
    options: ['Tampered Choice A', 'Tampered Choice B']
  });
  assertCheck('Zero-Vote Guard Rejects Option Modification After Ballot Cast (400)', res.status === 400 && res.data.error?.includes('Answer options cannot be modified'), res.data.error);

  // Safe updates to title and duration without altering options must succeed
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${guardPollId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Allowed Title Update Post-Vote ${timestamp}`,
    duration_minutes: 60
  });
  assertCheck('Title & Duration Update Allowed While Options Preserved (200)', res.status === 200 && res.data.title?.includes('Allowed Title Update'), `New duration: ${res.data.duration_minutes}m`);

  // 14. Escalation Override Workflow (<25m or >120m)
  console.log('\n--- 14. Admin Escalation Override Workflow ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/polls',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Flash Executive Poll ${timestamp}`,
    category: 'General',
    duration_minutes: 10, // < 25m
    options: ['Yes', 'No'],
    escalation_code: 'VOXENTRA_OVERRIDE_AUTH',
    escalation_reason: 'Emergency executive decision vote authorized by director'
  });
  const escalatedPollId = res.data.id || res.data.poll?.id;
  assertCheck('Escalation Override Allows 10m Flash Poll (201)', res.status === 201 && escalatedPollId, `Escalated Poll ID: ${escalatedPollId}, Duration: 10m`);

  // 15. Multi-Selection Voting & Result Visibility Privacy Shield
  console.log('\n--- 15. Multi-Selection Voting & Result Visibility ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/admin/polls',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: `Multi-Choice Tech Stack ${timestamp}`,
    category: 'Web Development',
    duration_minutes: 60,
    selection_type: 'multiple',
    max_selections: 2,
    result_visibility: 'after_vote',
    options: ['Go', 'TypeScript', 'Rust', 'Python']
  });
  const multiPollId = res.data.id || res.data.poll?.id;
  const multiOptions = res.data.options || res.data.poll?.options;
  assertCheck('Admin Creates Multi-Selection Poll with after_vote Privacy (201)', res.status === 201 && multiPollId, `Selection: multiple (max 2), Visibility: after_vote`);

  // Fetch poll before voting -> results must be shielded
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${multiPollId}`,
    method: 'GET'
  });
  assertCheck('Results Privacy Shield Active Before Voting', res.status === 200 && res.data.poll?.results_hidden === true && res.data.poll?.options[0].votes === 0, `Shield message: "${res.data.poll?.results_reveal_condition}"`);

  // Register voter 3 and vote with 2 selections
  const voter3 = {
    username: `voter3_${timestamp}`,
    email: `voter3_${timestamp}@example.com`,
    password: 'SecurePassword2026!'
  };
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, voter3);
  const voter3Token = res.data.token;

  // Attempt voting for 3 options when max is 2 -> reject
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${multiPollId}/vote`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${voter3Token}` }
  }, { option_ids: [multiOptions[0].id, multiOptions[1].id, multiOptions[2].id] });
  assertCheck('Reject Multi-Vote Exceeding Max Selections (400)', res.status === 400, res.data.error);

  // Cast valid vote with 2 selections
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${multiPollId}/vote`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${voter3Token}` }
  }, { option_ids: [multiOptions[0].id, multiOptions[1].id] });
  assertCheck('Cast Valid Multi-Selection Ballot (2 choices)', res.status === 200, res.data.message);

  // Fetch poll as authenticated voter 3 -> results must now be revealed!
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/polls/${multiPollId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${voter3Token}` }
  });
  assertCheck('Results Revealed to Voter Post-Ballot', res.status === 200 && res.data.poll?.results_hidden === false && res.data.has_voted === true, `Results revealed, total votes: ${res.data.poll?.total_votes}`);

  // 16. Administrative Audit Trail Retrieval
  console.log('\n--- 16. Administrative Audit Trail Verification ---');
  res = await request({
    hostname: 'localhost',
    port: 8080,
    path: `/api/admin/polls/${guardPollId}/audit-logs`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assertCheck('Fetch Poll Administrative Audit Trail', res.status === 200 && Array.isArray(res.data.audit_logs) && res.data.audit_logs.length >= 2, `Retrieved ${res.data.audit_logs.length} audit records`);
  const durLog = res.data.audit_logs.find(l => l.action?.toLowerCase().includes('duration') || l.action?.toLowerCase().includes('update'));
  assertCheck('Audit Log Contains Action and Old/New Values', !!durLog && (durLog.admin_name || durLog.admin_email), `Action: ${durLog?.action}, Old: "${durLog?.old_value || durLog?.old_duration}", New: "${durLog?.new_value || durLog?.new_duration}"`);

  // 17. Frontend Service Verification
  console.log('\n--- 17. Frontend Dev Server Availability ---');
  res = await request({ hostname: '127.0.0.1', port: 5173, path: '/', method: 'GET' });
  assertCheck('Frontend HTTP 200 OK', res.status === 200 && res.headers['content-type']?.includes('text/html'), 'Vite serving Single Page Application');

  // 18. Security Hardening & Zero Plaintext Exposure
  console.log('\n--- 18. Security Hardening & Zero Plaintext Exposure ---');
  // Check admin login payload did not leak password_hash
  assertCheck('Admin Credentials Never Leaked in API Response', adminUserObj?.password === undefined && adminUserObj?.password_hash === undefined, 'No password or hash fields serialized in User DTO');

  // Check demo voter registration blocked
  let secRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'Demo Voter', email: 'voter@voxentra.com', password: 'password123' });
  assertCheck('Demo Voter Registration Permanently Blocked (403)', secRes.status === 403, 'Demo voter registration rejected');

  // Check demo voter login blocked
  secRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'voter@voxentra.com', password: 'voxentra2026' });
  assertCheck('Demo Voter Login Blocked (401)', secRes.status === 401, 'Demo voter authentication rejected');

  // Check password reset protects admin credentials
  secRes = await request({
    hostname: 'localhost',
    port: 8080,
    path: '/api/auth/reset-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'swetha4110@gmail.com', token: 'token123', new_password: 'newpassword123' });
  assertCheck('Password Reset Blocks Admin Exposure with Masked Status', secRes.status === 200 && secRes.data.status === 'masked' && secRes.data.masked === '••••••••••••', 'Admin credentials protected and masked');

  console.log('\n================================================================');
  console.log(`  🎉 ALL ${passed} OF ${total} SYSTEM VERIFICATION CHECKS PASSED (100%) `);
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('\n❌ Suite Error:', err);
  process.exit(1);
});
