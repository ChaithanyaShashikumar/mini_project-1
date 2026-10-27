const assert = require('assert');

const BASE_URL = 'http://localhost:4000';

async function runTests() {
  console.log('=== STARTING WE-REVIEW AUTH & REVIEW TESTS ===\n');
  const results = [];

  const testUser = {
    name: 'Alice Tester',
    email: `alice_test_${Date.now()}@example.com`,
    password: 'Password123!',
    confirm_password: 'Password123!',
  };

  let authCookie = null;
  let registeredUser = null;

  // Test 1: Register New User
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
    }
    registeredUser = data.user;

    assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
    assert.strictEqual(data.status, 'success');
    assert.strictEqual(data.user.email, testUser.email.toLowerCase());
    assert.ok(data.user.reviewer_id.startsWith('REV_'), 'reviewer_id should start with REV_');
    assert.ok(authCookie && authCookie.includes('token='), 'Cookie token must be set');
    console.log('✅ Test 1 Passed: User Registration successful with HTTP-only cookie and reviewer_id:', data.user.reviewer_id);
    results.push({ name: 'User Registration', passed: true });
  } catch (err) {
    console.error('❌ Test 1 Failed: User Registration error:', err.message);
    results.push({ name: 'User Registration', passed: false, error: err.message });
  }

  // Test 2: Duplicate Email Registration Prevention
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();

    assert.strictEqual(res.status, 400, `Expected status 400 for duplicate email, got ${res.status}`);
    assert.strictEqual(data.status, 'error');
    assert.strictEqual(data.message, 'An account with this email already exists.');
    console.log('✅ Test 2 Passed: Duplicate email registration properly rejected with 400.');
    results.push({ name: 'Duplicate Email Prevention', passed: true });
  } catch (err) {
    console.error('❌ Test 2 Failed: Duplicate Email Prevention error:', err.message);
    results.push({ name: 'Duplicate Email Prevention', passed: false, error: err.message });
  }

  // Test 3: Login with Invalid Password
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'WrongPassword999' }),
    });
    const data = await res.json();

    assert.strictEqual(res.status, 401, `Expected status 401 for wrong password, got ${res.status}`);
    assert.strictEqual(data.status, 'error');
    assert.strictEqual(data.message, 'Invalid email or password.');
    console.log('✅ Test 3 Passed: Invalid login credentials properly rejected with 401.');
    results.push({ name: 'Invalid Login Rejection', passed: true });
  } catch (err) {
    console.error('❌ Test 3 Failed: Invalid Login Rejection error:', err.message);
    results.push({ name: 'Invalid Login Rejection', passed: false, error: err.message });
  }

  // Test 4: Login with Valid Credentials
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    const data = await res.json();
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      authCookie = setCookie.split(';')[0];
    }

    assert.strictEqual(res.status, 200, `Expected status 200 for valid login, got ${res.status}`);
    assert.strictEqual(data.status, 'success');
    assert.strictEqual(data.user.email, testUser.email.toLowerCase());
    assert.ok(authCookie && authCookie.includes('token='), 'Cookie token must be set on login');
    console.log('✅ Test 4 Passed: Valid login successful, new session cookie issued.');
    results.push({ name: 'Valid Login', passed: true });
  } catch (err) {
    console.error('❌ Test 4 Failed: Valid Login error:', err.message);
    results.push({ name: 'Valid Login', passed: false, error: err.message });
  }

  // Test 5: Session Persistence via GET /api/auth/me
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: authCookie },
    });
    const data = await res.json();

    assert.strictEqual(res.status, 200, `Expected status 200 from /api/auth/me, got ${res.status}`);
    assert.strictEqual(data.authenticated, true);
    assert.strictEqual(data.user.id, registeredUser.id);
    assert.strictEqual(data.user.reviewer_id, registeredUser.reviewer_id);
    console.log('✅ Test 5 Passed: Session persisted successfully via cookie verification.');
    results.push({ name: 'Session Persistence (/api/auth/me)', passed: true });
  } catch (err) {
    console.error('❌ Test 5 Failed: Session Persistence error:', err.message);
    results.push({ name: 'Session Persistence (/api/auth/me)', passed: false, error: err.message });
  }

  // Test 6: Unauthenticated Review Submission Blocked
  try {
    const res = await fetch(`${BASE_URL}/api/reviews/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asin: 'B08N5WRWNW',
        review_title: 'Unauthenticated test',
        review_text: 'Should be rejected because no cookie',
        rating: 5,
      }),
    });
    const data = await res.json();

    assert.strictEqual(res.status, 401, `Expected status 401 when unauthenticated, got ${res.status}`);
    assert.strictEqual(data.status, 'error');
    console.log('✅ Test 6 Passed: Unauthenticated review submission rejected with 401.');
    results.push({ name: 'Unauthenticated Submission Protection', passed: true });
  } catch (err) {
    console.error('❌ Test 6 Failed: Unauthenticated Submission Protection error:', err.message);
    results.push({ name: 'Unauthenticated Submission Protection', passed: false, error: err.message });
  }

  // Test 7: Authenticated Review Submission with reviewer_id Enforcement
  try {
    // We send a spoofed reviewer_id in the body to verify backend ignores it and uses req.user.reviewer_id
    const res = await fetch(`${BASE_URL}/api/reviews/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie,
      },
      body: JSON.stringify({
        reviewer_id: 'SPOOFED_FAKE_ID',
        asin: 'B08N5WRWNW',
        review_title: 'Genuine Verified Purchase Review',
        review_text: 'Great sound quality and battery life. Exceeded my expectations!',
        rating: 5,
      }),
    });
    const data = await res.json();

    assert.strictEqual(res.status, 200, `Expected status 200 for review submission, got ${res.status}`);
    assert.strictEqual(data.saved, true);
    // Crucial: check that reviewer_id is the authenticated user's ID, not SPOOFED_FAKE_ID!
    assert.strictEqual(
      data.review.reviewer_id,
      registeredUser.reviewer_id,
      `Backend MUST enforce authenticated reviewer_id! Expected ${registeredUser.reviewer_id}, got ${data.review.reviewer_id}`
    );
    console.log(`✅ Test 7 Passed: Authenticated review saved with authenticated reviewer_id (${data.review.reviewer_id}), spoofed ID ignored.`);
    results.push({ name: 'Authenticated Review Submission & reviewer_id Enforcement', passed: true });
  } catch (err) {
    console.error('❌ Test 7 Failed: Review Submission error:', err.message);
    results.push({ name: 'Authenticated Review Submission & reviewer_id Enforcement', passed: false, error: err.message });
  }

  // Test 8: Logout Clears Session
  try {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'success');

    // Verify /api/auth/me fails after clearing cookie
    const setCookie = res.headers.get('set-cookie');
    let expiredCookie = setCookie ? setCookie.split(';')[0] : '';

    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: expiredCookie },
    });
    assert.strictEqual(meRes.status, 401, `Expected status 401 after logout, got ${meRes.status}`);
    console.log('✅ Test 8 Passed: Logout successfully clears session cookie and revokes access.');
    results.push({ name: 'User Logout', passed: true });
  } catch (err) {
    console.error('❌ Test 8 Failed: User Logout error:', err.message);
    results.push({ name: 'User Logout', passed: false, error: err.message });
  }

  console.log('\n=== TEST SUMMARY ===');
  console.table(results);
  const allPassed = results.every(r => r.passed);
  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
