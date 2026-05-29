/**
 * Minimal browser test runner — no dependencies, no build step.
 * Provides a describe/it/assert pattern and a run() that returns a results
 * summary. Rendering lives in the harness page (tests/index.html) so the
 * runner can execute inside the app iframe and report back to the parent.
 *
 * Exposed on window.TestRunner because top-level `const` is a lexical global,
 * not a property of the window — the parent harness reaches it via
 * iframe.contentWindow.TestRunner.
 */
const TestRunner = (function () {
  const suites = [];
  let currentSuite = null;

  function describe(name, fn) {
    const suite = { name, tests: [], passed: 0, failed: 0, errors: [] };
    currentSuite = suite;
    suites.push(suite);
    try { fn(); } catch (e) {
      suite.errors.push({ name: '(suite setup)', error: e });
      suite.failed++;
    }
    currentSuite = null;
  }

  function it(name, fn) {
    if (!currentSuite) throw new Error('it() must be called inside describe()');
    currentSuite.tests.push({ name, fn });
  }

  const assert = {
    equal(actual, expected, msg) {
      if (actual !== expected)
        throw new Error(`${msg || 'assert.equal'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    deepEqual(actual, expected, msg) {
      const a = JSON.stringify(actual), b = JSON.stringify(expected);
      if (a !== b)
        throw new Error(`${msg || 'assert.deepEqual'}: expected ${b}, got ${a}`);
    },
    ok(val, msg) {
      if (!val) throw new Error(`${msg || 'assert.ok'}: expected truthy, got ${JSON.stringify(val)}`);
    },
    notOk(val, msg) {
      if (val) throw new Error(`${msg || 'assert.notOk'}: expected falsy, got ${JSON.stringify(val)}`);
    },
    throws(fn, msg) {
      let threw = false;
      try { fn(); } catch (e) { threw = true; }
      if (!threw) throw new Error(`${msg || 'assert.throws'}: expected function to throw`);
    },
    greaterThan(actual, expected, msg) {
      if (!(actual > expected))
        throw new Error(`${msg || 'assert.greaterThan'}: expected ${actual} > ${expected}`);
    },
    lessThan(actual, expected, msg) {
      if (!(actual < expected))
        throw new Error(`${msg || 'assert.lessThan'}: expected ${actual} < ${expected}`);
    },
    includes(str, substr, msg) {
      if (typeof str !== 'string' || !str.includes(substr))
        throw new Error(`${msg || 'assert.includes'}: expected "${str}" to include "${substr}"`);
    }
  };

  async function run() {
    let totalPassed = 0, totalFailed = 0;
    for (const suite of suites) {
      for (const test of suite.tests) {
        try {
          const result = test.fn();
          if (result && typeof result.then === 'function') await result;
          suite.passed++;
          totalPassed++;
        } catch (e) {
          suite.failed++;
          totalFailed++;
          suite.errors.push({ name: test.name, error: e });
        }
      }
    }
    return { suites, totalPassed, totalFailed };
  }

  return { describe, it, assert, run };
})();

// Expose to the parent harness (see file header).
window.TestRunner = TestRunner;
