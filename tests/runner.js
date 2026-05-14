/**
 * Minimal browser test runner — no dependencies needed.
 * Provides describe/it/assert pattern, renders results to the page.
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

  function render(containerId) {
    run().then(({ suites, totalPassed, totalFailed }) => {
      const el = document.getElementById(containerId);
      if (!el) return;
      const total = totalPassed + totalFailed;
      const allGood = totalFailed === 0;

      let html = `<div style="font-family:monospace;padding:20px;max-width:800px;margin:0 auto">`;
      html += `<h1 style="color:${allGood ? '#58c070' : '#e03820'};margin-bottom:4px">
        ${allGood ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}
      </h1>`;
      html += `<p style="color:#888;margin-bottom:20px">${totalPassed}/${total} passed</p>`;

      for (const suite of suites) {
        const color = suite.failed ? '#e03820' : '#58c070';
        html += `<div style="margin-bottom:16px;border-left:3px solid ${color};padding-left:12px">`;
        html += `<h3 style="color:${color};margin:0 0 6px">${suite.name} (${suite.passed}/${suite.tests.length})</h3>`;

        for (const test of suite.tests) {
          const failed = suite.errors.find(e => e.name === test.name);
          if (failed) {
            html += `<div style="color:#e03820;margin:2px 0">  FAIL  ${test.name}</div>`;
            html += `<div style="color:#a04030;margin:0 0 4px 40px;font-size:12px">${failed.error.message}</div>`;
          } else {
            html += `<div style="color:#58c070;margin:2px 0">  PASS  ${test.name}</div>`;
          }
        }
        html += `</div>`;
      }
      html += `</div>`;
      el.innerHTML = html;
    });
  }

  return { describe, it, assert, run, render };
})();
