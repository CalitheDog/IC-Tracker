/**
 * IC Tracker Test Suite
 * Tests core logic: utilities, tel var economy, timers, streaks, persistence, keyboard shortcuts
 */
const { describe, it, assert } = TestRunner;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${r}, ${g}, ${b})`;
}

/* ═══════════════════════════════════════════
   HELPERS: save/restore global state between tests
   ═══════════════════════════════════════════ */
function resetState() {
  stI = 0;
  grSz = 1;
  totalKills = 0;
  currentTelVar = 0;
  bankedTelVar = 0;
  lostTelVar = 0;
  farmStart = null;
  farmEnd = null;
  farmRunning = false;
  activePreset = null;
  alliance = 'dc';
  killStreak = 0;
  sortByRespawn = false;
  telvarTarget = 0;
  riskTolerance = 0;
  dcHeld.clear();
  actionStack = [];
  eventLog = [];
  DISTRICTS.forEach((_, i) => {
    timers[i].end = null;
    timers[i].running = false;
    timers[i].wasRunning = false;
    timers[i].warnFired = false;
    timers[i].unknown = false;
    timers[i].unknownAt = null;
    if (timers[i].seenAt !== undefined) timers[i].seenAt = null;
  });
  const adj = document.getElementById('tvAdjustInput');
  if (adj) adj.value = '';
  const tgt = document.getElementById('tvTargetInput');
  if (tgt) tgt.value = '';
  const risk = document.getElementById('tvRiskInput');
  if (risk) risk.value = '';
}


/* ═══════════════════════════════════════════
   1. UTILITY FUNCTIONS
   ═══════════════════════════════════════════ */
describe('Utility Functions', () => {

  it('fmt() formats seconds as MM:SS', () => {
    assert.equal(fmt(0), '00:00');
    assert.equal(fmt(59), '00:59');
    assert.equal(fmt(60), '01:00');
    assert.equal(fmt(125), '02:05');
    assert.equal(fmt(900), '15:00');
  });

  it('fmt() clamps negatives to 00:00', () => {
    assert.equal(fmt(-10), '00:00');
    assert.equal(fmt(-999), '00:00');
  });

  it('fmtH() formats seconds as HH:MM:SS', () => {
    assert.equal(fmtH(0), '00:00:00');
    assert.equal(fmtH(61), '00:01:01');
    assert.equal(fmtH(3661), '01:01:01');
    assert.equal(fmtH(7200), '02:00:00');
  });

  it('fmtH() clamps negatives to 00:00:00', () => {
    assert.equal(fmtH(-50), '00:00:00');
  });

  it('DISTRICTS has 6 entries with correct names', () => {
    assert.equal(DISTRICTS.length, 6);
    assert.equal(DISTRICTS[0].name, 'Memorial');
    assert.equal(DISTRICTS[5].name, 'Elvens');
  });

  it('Each district has exactly 2 bosses', () => {
    DISTRICTS.forEach((d, i) => {
      assert.equal(d.bosses.length, 2, `District ${d.name} should have 2 bosses`);
    });
  });

  it('RESPAWN is 900 seconds (15 minutes)', () => {
    assert.equal(RESPAWN, 900);
  });

  it('WARN_AT is 60 seconds (1 minute)', () => {
    assert.equal(WARN_AT, 60);
  });
});


/* ═══════════════════════════════════════════
   2. TEL VAR ECONOMY — perKill calculations
   ═══════════════════════════════════════════ */
describe('Tel Var Economy — perKill()', () => {

  it('Base kill value is 1327 at x1 mult, solo, 0 DC', () => {
    resetState();
    assert.equal(perKill(), 1327);
  });

  it('x2 multiplier doubles kill value', () => {
    resetState();
    stI = 1;
    assert.equal(perKill(), 2654);
  });

  it('x3 multiplier triples kill value', () => {
    resetState();
    stI = 2;
    assert.equal(perKill(), 3981);
  });

  it('x4 multiplier quadruples kill value', () => {
    resetState();
    stI = 3;
    assert.equal(perKill(), 5308);
  });

  it('Group of 2 halves the per-kill value', () => {
    resetState();
    grSz = 2;
    assert.equal(perKill(), Math.round(1327 / 2));
  });

  it('Group of 4 quarters the per-kill value', () => {
    resetState();
    grSz = 4;
    assert.equal(perKill(), Math.round(1327 / 4));
  });

  it('DC-held districts increase bonus by 33% each', () => {
    resetState();
    dcHeld.add(0);
    // 1327 * 1 * (1 + 1*0.33) / 1 = 1327 * 1.33 = 1764.91 -> 1765
    assert.equal(perKill(), Math.round(1327 * 1.33));
  });

  it('3 DC districts = 1.99x bonus', () => {
    resetState();
    dcHeld.add(0); dcHeld.add(1); dcHeld.add(2);
    assert.equal(perKill(), Math.round(1327 * 1.99));
  });

  it('All 6 DC districts = 2.98x bonus', () => {
    resetState();
    for (let i = 0; i < 6; i++) dcHeld.add(i);
    assert.equal(perKill(), Math.round(1327 * 2.98));
  });

  it('Multiplier + group + DC combine correctly', () => {
    resetState();
    stI = 3;   // x4
    grSz = 2;  // group 2
    dcHeld.add(0); dcHeld.add(1); // 2 DC = 1.66 bonus
    const expected = Math.round(1327 * 4 * 1.66 / 2);
    assert.equal(perKill(), expected);
  });
});


/* ═══════════════════════════════════════════
   3. TEL VAR ECONOMY — banking & ganking
   ═══════════════════════════════════════════ */
describe('Tel Var Economy — Bank & Gank', () => {

  it('killBoss() adds Tel Var and increments kill count', () => {
    resetState();
    const before = currentTelVar;
    killBoss(0);
    assert.equal(totalKills, 1);
    assert.greaterThan(currentTelVar, before);
  });

  it('bankTelVar() moves carried to banked', () => {
    resetState();
    killBoss(0);
    const carried = currentTelVar;
    bankTelVar();
    assert.equal(bankedTelVar, carried);
    assert.equal(currentTelVar, 0);
  });

  it('bankTelVar() with 0 carried does nothing', () => {
    resetState();
    bankTelVar();
    assert.equal(bankedTelVar, 0);
  });

  it('gankedTelVar() removes 50% of carried', () => {
    resetState();
    killBoss(0); killBoss(1);
    const carried = currentTelVar;
    gankedTelVar();
    const expectedLost = Math.floor(carried * 0.5);
    assert.equal(lostTelVar, expectedLost);
    assert.equal(currentTelVar, carried - expectedLost);
  });

  it('gankedTelVar() with 0 carried does nothing', () => {
    resetState();
    gankedTelVar();
    assert.equal(lostTelVar, 0);
  });

  it('Multiple kills accumulate Tel Var', () => {
    resetState();
    killBoss(0); killBoss(1); killBoss(2);
    assert.equal(totalKills, 3);
    assert.equal(currentTelVar, perKill() * 3);
  });
});


/* ═══════════════════════════════════════════
   4. TIMER / DISTRICT STATE
   ═══════════════════════════════════════════ */
describe('Timer & District State', () => {

  it('Fresh district is alive with 0 remaining', () => {
    resetState();
    const state = districtState(0);
    assert.ok(state.up, 'Should be alive');
    assert.notOk(state.unknown, 'Should not be unknown');
    assert.equal(state.rem, 0);
  });

  it('After killBoss(), district is dead with ~900s remaining', () => {
    resetState();
    killBoss(0);
    const state = districtState(0);
    assert.notOk(state.up, 'Should not be alive after kill');
    assert.greaterThan(state.rem, 890);
    assert.lessThan(state.rem, 901);
  });

  it('rstBoss() returns district to alive', () => {
    resetState();
    killBoss(0);
    rstBoss(0);
    const state = districtState(0);
    assert.ok(state.up);
    assert.notOk(state.unknown);
  });

  it('resetAll() returns all districts to alive', () => {
    resetState();
    killBoss(0); killBoss(1); killBoss(2);
    resetAll();
    DISTRICTS.forEach((_, i) => {
      const state = districtState(i);
      assert.ok(state.up, `District ${i} should be alive after resetAll`);
    });
  });

  it('districtStatusClass() returns correct classes', () => {
    assert.equal(districtStatusClass({ up: true, unknown: false }), 'alive');
    assert.equal(districtStatusClass({ up: false, urg: true, unknown: false }), 'urgent');
    assert.equal(districtStatusClass({ up: false, wn: true, urg: false, unknown: false }), 'warn');
    assert.equal(districtStatusClass({ up: false, wn: false, urg: false, unknown: false }), 'dead');
    assert.equal(districtStatusClass({ unknown: true }), 'unknown');
  });
});


/* ═══════════════════════════════════════════
   5. UNKNOWN TIMER DECAY
   ═══════════════════════════════════════════ */
describe('Unknown Timer Decay', () => {

  it('Fresh unknown (<5min) shows "Fresh unknown"', () => {
    resetState();
    timers[0].unknown = true;
    timers[0].unknownAt = Date.now() - 120 * 1000; // 2 min ago
    const info = unknownDecayInfo(0);
    assert.equal(info.label, 'Fresh unknown');
  });

  it('5-10 min unknown shows "Uncertain"', () => {
    resetState();
    timers[0].unknown = true;
    timers[0].unknownAt = Date.now() - 450 * 1000; // 7.5 min ago
    const info = unknownDecayInfo(0);
    assert.equal(info.label, 'Uncertain');
  });

  it('10-15 min unknown shows "Check soon"', () => {
    resetState();
    timers[0].unknown = true;
    timers[0].unknownAt = Date.now() - 750 * 1000; // 12.5 min ago
    const info = unknownDecayInfo(0);
    assert.equal(info.label, 'Check soon');
  });

  it('15+ min unknown shows "Likely ready"', () => {
    resetState();
    timers[0].unknown = true;
    timers[0].unknownAt = Date.now() - 1200 * 1000; // 20 min ago
    const info = unknownDecayInfo(0);
    assert.equal(info.label, 'Likely ready');
  });

  it('Non-unknown timer returns default info', () => {
    resetState();
    const info = unknownDecayInfo(0);
    assert.equal(info.label, 'Unknown');
    assert.equal(info.age, 0);
  });
});


/* ═══════════════════════════════════════════
   6. KILL STREAK
   ═══════════════════════════════════════════ */
describe('Kill Streak', () => {

  it('bumpStreak() increments streak counter', () => {
    resetState();
    bumpStreak();
    assert.equal(killStreak, 1);
    bumpStreak();
    assert.equal(killStreak, 2);
    bumpStreak();
    assert.equal(killStreak, 3);
  });

  it('resetStreak() sets streak to 0', () => {
    resetState();
    bumpStreak(); bumpStreak(); bumpStreak();
    resetStreak();
    assert.equal(killStreak, 0);
  });

  it('killBoss() bumps streak', () => {
    resetState();
    killBoss(0);
    assert.equal(killStreak, 1);
    killBoss(1);
    assert.equal(killStreak, 2);
  });

  it('gankedTelVar() resets streak', () => {
    resetState();
    killBoss(0); killBoss(1); killBoss(2);
    assert.equal(killStreak, 3);
    gankedTelVar();
    assert.equal(killStreak, 0);
  });

  it('bestStreak tracks the highest streak', () => {
    resetState();
    const oldBest = bestStreak;
    for (let i = 0; i < 10; i++) bumpStreak();
    assert.greaterThan(bestStreak, 9);
    resetStreak();
    // bestStreak should not decrease
    assert.greaterThan(bestStreak, 9);
  });

  it('Streak badge shows at 2+ kills', () => {
    resetState();
    bumpStreak();
    const badge = document.getElementById('streakBadge');
    assert.notOk(badge.classList.contains('show'), 'Badge should not show at streak 1');
    bumpStreak();
    assert.ok(badge.classList.contains('show'), 'Badge should show at streak 2');
  });

  it('Streak badge hides when streak resets', () => {
    resetState();
    bumpStreak(); bumpStreak(); bumpStreak();
    resetStreak();
    const badge = document.getElementById('streakBadge');
    assert.notOk(badge.classList.contains('show'), 'Badge should hide after reset');
  });
});


/* ═══════════════════════════════════════════
   7. SESSION PERSISTENCE
   ═══════════════════════════════════════════ */
describe('Session Persistence', () => {

  it('saveSession() writes to localStorage', () => {
    resetState();
    killBoss(0); killBoss(1);
    saveSession();
    const raw = localStorage.getItem('esoIcSession');
    assert.ok(raw, 'Session should be saved');
    const data = JSON.parse(raw);
    assert.equal(data.totalKills, 2);
    assert.greaterThan(data.currentTelVar, 0);
  });

  it('loadSession() restores state correctly', () => {
    resetState();
    killBoss(0); killBoss(1); killBoss(2);
    dcHeld.add(0); dcHeld.add(3);
    stI = 2;
    grSz = 3;
    bankedTelVar = 5000;
    saveSession();

    const savedTelVar = currentTelVar;
    const savedKills = totalKills;

    // Reset everything
    resetState();
    assert.equal(totalKills, 0);

    // Restore
    const data = JSON.parse(localStorage.getItem('esoIcSession'));
    loadSession(data);
    assert.equal(totalKills, savedKills);
    assert.equal(currentTelVar, savedTelVar);
    assert.equal(bankedTelVar, 5000);
    assert.equal(stI, 2);
    assert.equal(grSz, 3);
    assert.ok(dcHeld.has(0));
    assert.ok(dcHeld.has(3));
    assert.notOk(dcHeld.has(1));
  });

  it('Session data includes timer states', () => {
    resetState();
    killBoss(0);
    killBoss(2);
    saveSession();
    const data = JSON.parse(localStorage.getItem('esoIcSession'));
    assert.ok(data.timers[0].running, 'Timer 0 should be running');
    assert.ok(data.timers[2].running, 'Timer 2 should be running');
    assert.notOk(data.timers[1].running, 'Timer 1 should not be running');
  });

  it('Session data includes event log', () => {
    resetState();
    killBoss(0);
    bankTelVar();
    saveSession();
    const data = JSON.parse(localStorage.getItem('esoIcSession'));
    assert.ok(data.eventLog.length > 0, 'Event log should not be empty');
  });

  it('Old sessions (>4h) are not offered for restore', () => {
    resetState();
    const oldData = {
      ts: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
      timers: timers.map(t => ({ ...t })),
      dcHeld: [], stI: 0, grSz: 1, totalKills: 0,
      currentTelVar: 0, bankedTelVar: 0, lostTelVar: 0,
      farmStart: null, farmEnd: null, farmRunning: false,
      activePreset: null, killStreak: 0, bestStreak: 0, eventLog: []
    };
    localStorage.setItem('esoIcSession', JSON.stringify(oldData));
    checkSavedSession();
    const bar = document.getElementById('restoreBar');
    assert.notOk(bar.classList.contains('show'), 'Should not show restore for old sessions');
    // Verify it was cleaned up
    assert.notOk(localStorage.getItem('esoIcSession'), 'Old session should be removed');
  });

  // Clean up
  it('cleanup: remove test session data', () => {
    localStorage.removeItem('esoIcSession');
    resetState();
    assert.ok(true);
  });
});


/* ═══════════════════════════════════════════
   8. KEYBOARD SHORTCUTS
   ═══════════════════════════════════════════ */
describe('Keyboard Shortcuts', () => {

  function pressKey(key) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('Pressing "1" kills Memorial district (index 0)', () => {
    resetState();
    pressKey('1');
    assert.equal(totalKills, 1);
    assert.ok(timers[0].running, 'Memorial timer should be running');
  });

  it('Pressing "6" kills Elvens district (index 5)', () => {
    resetState();
    pressKey('6');
    assert.equal(totalKills, 1);
    assert.ok(timers[5].running, 'Elvens timer should be running');
  });

  it('Pressing "b" banks Tel Var', () => {
    resetState();
    killBoss(0);
    const carried = currentTelVar;
    pressKey('b');
    assert.equal(bankedTelVar, carried);
    assert.equal(currentTelVar, 0);
  });

  it('Pressing "g" triggers ganked', () => {
    resetState();
    killBoss(0);
    const carried = currentTelVar;
    pressKey('g');
    assert.equal(lostTelVar, Math.floor(carried * 0.5));
  });

  it('Pressing "u" undoes last action', () => {
    resetState();
    killBoss(0);
    assert.equal(totalKills, 1);
    pressKey('u');
    // After undo, kill count should revert
    assert.equal(totalKills, 0);
  });

  it('Pressing "s" starts farming if not running', () => {
    resetState();
    assert.notOk(farmRunning);
    pressKey('s');
    assert.ok(farmRunning, 'Farming should be running after pressing s');
  });

  it('Pressing "s" again stops farming', () => {
    resetState();
    pressKey('s'); // start
    assert.ok(farmRunning);
    pressKey('s'); // stop
    assert.notOk(farmRunning, 'Farming should stop on second press');
  });

  it('Keys are ignored when typing in an input', () => {
    resetState();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    // Simulate keydown on input
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    assert.equal(totalKills, 0, 'Should not kill boss when typing in input');
    document.body.removeChild(input);
  });

  it('Modified keys (ctrl+1) are ignored', () => {
    resetState();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }));
    assert.equal(totalKills, 0, 'Ctrl+key should not trigger shortcuts');
  });
});


/* ═══════════════════════════════════════════
   9. PRESETS
   ═══════════════════════════════════════════ */
describe('Presets', () => {

  it('Chud preset sets x2 mult, solo', () => {
    resetState();
    applyPreset('chud');
    assert.equal(stI, 1);
    assert.equal(grSz, 1);
    assert.equal(activePreset, 'chud');
  });

  it('Chad preset sets x4 mult, group 2', () => {
    resetState();
    applyPreset('chad');
    assert.equal(stI, 3);
    assert.equal(grSz, 2);
    assert.equal(activePreset, 'chad');
  });

  it('Streakah preset locks district captures', () => {
    resetState();
    applyPreset('streakah');
    assert.ok(districtCapturesLocked(), 'District captures should be locked in Streakah mode');
  });

  it('Switching away from Streakah unlocks captures', () => {
    resetState();
    applyPreset('streakah');
    applyPreset('chud');
    assert.notOk(districtCapturesLocked(), 'Captures should unlock after leaving Streakah');
  });
});


/* ═══════════════════════════════════════════
   10. UNDO SYSTEM
   ═══════════════════════════════════════════ */
describe('Undo System', () => {

  it('Undo reverts a kill', () => {
    resetState();
    killBoss(0);
    assert.equal(totalKills, 1);
    assert.ok(timers[0].running);
    undoLastAction();
    assert.equal(totalKills, 0);
    assert.notOk(timers[0].running);
  });

  it('Undo reverts a bank', () => {
    resetState();
    killBoss(0);
    const carried = currentTelVar;
    bankTelVar();
    assert.equal(bankedTelVar, carried);
    assert.equal(currentTelVar, 0);
    undoLastAction();
    assert.equal(currentTelVar, carried);
    assert.equal(bankedTelVar, 0);
  });

  it('Multiple undos work in stack order', () => {
    resetState();
    killBoss(0);
    killBoss(1);
    assert.equal(totalKills, 2);
    undoLastAction(); // undo kill 1
    assert.equal(totalKills, 1);
    assert.notOk(timers[1].running, 'Timer 1 should be reverted');
    assert.ok(timers[0].running, 'Timer 0 should still be running');
    undoLastAction(); // undo kill 0
    assert.equal(totalKills, 0);
  });

  it('Undo with empty stack does nothing', () => {
    resetState();
    undoLastAction(); // should not throw
    assert.equal(totalKills, 0);
  });
});


/* ═══════════════════════════════════════════
   11. FARM TIMER
   ═══════════════════════════════════════════ */
describe('Farm Timer', () => {

  it('startFarm() initializes farm state', () => {
    resetState();
    startFarm();
    assert.ok(farmRunning);
    assert.ok(farmStart > 0);
    assert.equal(farmEnd, null);
  });

  it('endFarm() stops farm and records end time', () => {
    resetState();
    startFarm();
    endFarm();
    assert.notOk(farmRunning);
    assert.ok(farmEnd > 0);
  });

  it('farmElapsed() returns 0 before start', () => {
    resetState();
    assert.equal(farmElapsed(), 0);
  });

  it('farmElapsed() returns positive during farming', () => {
    resetState();
    farmStart = Date.now() - 5000;
    farmRunning = true;
    assert.greaterThan(farmElapsed(), 4);
  });

  it('Starting farm resets Tel Var counters', () => {
    resetState();
    killBoss(0);
    bankedTelVar = 1000;
    lostTelVar = 500;
    startFarm();
    assert.equal(currentTelVar, 0);
    assert.equal(bankedTelVar, 0);
    assert.equal(lostTelVar, 0);
    assert.equal(totalKills, 0);
  });
});


/* ═══════════════════════════════════════════
   12. ALLIANCE SELECTION
   ═══════════════════════════════════════════ */
describe('Alliance Selection', () => {

  it('Default alliance is DC', () => {
    assert.equal(alliance, 'dc');
  });

  it('setAlliance() changes active alliance', () => {
    setAlliance('ep');
    assert.equal(alliance, 'ep');
    setAlliance('ad');
    assert.equal(alliance, 'ad');
    setAlliance('dc');
    assert.equal(alliance, 'dc');
  });

  it('setAlliance() ignores invalid values', () => {
    setAlliance('dc');
    setAlliance('invalid');
    assert.equal(alliance, 'dc', 'Should remain DC after invalid input');
    setAlliance(null);
    assert.equal(alliance, 'dc', 'Should remain DC after null');
  });

  it('ALLIANCES constant has all three factions', () => {
    assert.ok(ALLIANCES.ep, 'EP should exist');
    assert.ok(ALLIANCES.dc, 'DC should exist');
    assert.ok(ALLIANCES.ad, 'AD should exist');
    assert.equal(ALLIANCES.ep.name, 'Ebonheart Pact');
    assert.equal(ALLIANCES.dc.name, 'Daggerfall Covenant');
    assert.equal(ALLIANCES.ad.name, 'Aldmeri Dominion');
  });

  it('setAlliance() updates DC label text', () => {
    const lbl = document.getElementById('dcLabel');
    setAlliance('ep');
    assert.includes(lbl.textContent, 'EP');
    setAlliance('ad');
    assert.includes(lbl.textContent, 'AD');
    setAlliance('dc');
    assert.includes(lbl.textContent, 'DC');
  });

  it('Alliance is persisted to localStorage', () => {
    setAlliance('ep');
    assert.equal(localStorage.getItem('ic-alliance'), 'ep');
    setAlliance('dc');
    assert.equal(localStorage.getItem('ic-alliance'), 'dc');
  });

  it('Alliance UI buttons update sel class', () => {
    const btns = document.querySelectorAll('#allianceEl .alliance-btn');
    const selFor = (a) => [...btns].find(b => b.dataset.al === a && b.classList.contains('sel'));

    setAlliance('ep');
    assert.ok(selFor('ep'), 'EP button should have sel class');
    assert.notOk(selFor('dc'), 'DC button should not have sel class');
    assert.notOk(selFor('ad'), 'AD button should not have sel class');

    setAlliance('ad');
    assert.ok(selFor('ad'), 'AD button should have sel class');
    assert.notOk(selFor('ep'), 'EP button should not have sel class');

    setAlliance('dc');
    assert.ok(selFor('dc'), 'DC button should have sel class');
    assert.notOk(selFor('ad'), 'AD button should not have sel class');
  });
});


/* ═══════════════════════════════════════════
   13. DC-HELD DISTRICT TOGGLES
   ═══════════════════════════════════════════ */
describe('DC-Held District Toggles', () => {

  it('toggleDC() adds a district to dcHeld', () => {
    resetState();
    assert.notOk(dcHeld.has(0));
    toggleDC(0);
    assert.ok(dcHeld.has(0));
  });

  it('toggleDC() removes the district when called again', () => {
    resetState();
    toggleDC(0);
    assert.ok(dcHeld.has(0));
    toggleDC(0);
    assert.notOk(dcHeld.has(0));
  });

  it('Multiple districts can be held independently', () => {
    resetState();
    toggleDC(0);
    toggleDC(3);
    assert.ok(dcHeld.has(0));
    assert.ok(dcHeld.has(3));
    assert.notOk(dcHeld.has(1));
    assert.equal(dcHeld.size, 2);
  });

  it('toggleDC() is blocked when Streakah mode is active', () => {
    resetState();
    applyPreset('streakah');
    toggleDC(0);
    assert.notOk(dcHeld.has(0), 'District capture should be blocked in Streakah mode');
  });

  it('Streakah preset clears all held districts', () => {
    resetState();
    dcHeld.add(0); dcHeld.add(1); dcHeld.add(3);
    applyPreset('streakah');
    assert.equal(dcHeld.size, 0, 'Streakah should clear all held districts');
  });

  it('Holding a district increases perKill', () => {
    resetState();
    const before = perKill();
    toggleDC(0);
    assert.greaterThan(perKill(), before);
  });

  it('All 6 districts can be held simultaneously', () => {
    resetState();
    for (let i = 0; i < 6; i++) toggleDC(i);
    assert.equal(dcHeld.size, 6);
  });

  it('Toggling off each held district reduces perKill back to base', () => {
    resetState();
    for (let i = 0; i < 6; i++) toggleDC(i);
    for (let i = 0; i < 6; i++) toggleDC(i);
    assert.equal(perKill(), 1327);
  });
});


/* ═══════════════════════════════════════════
   14. ALLIANCE SLICE COLORS
   ═══════════════════════════════════════════ */
describe('Alliance Slice Colors', () => {

  it('heldC() returns DC colors by default', () => {
    resetState();
    const hc = heldC();
    assert.equal(hc.dA.f, ALLIANCE_HELD.dc.dA.f);
    assert.equal(hc.dA.s, ALLIANCE_HELD.dc.dA.s);
  });

  it('heldC() returns EP colors when EP is selected', () => {
    resetState();
    setAlliance('ep');
    assert.equal(heldC().dA.f, ALLIANCE_HELD.ep.dA.f);
    setAlliance('dc');
  });

  it('heldC() returns AD colors when AD is selected', () => {
    resetState();
    setAlliance('ad');
    assert.equal(heldC().dA.f, ALLIANCE_HELD.ad.dA.f);
    setAlliance('dc');
  });

  it('heldC() falls back to DC colors for an invalid alliance', () => {
    resetState();
    alliance = 'invalid';
    assert.equal(heldC().dA.f, ALLIANCE_HELD.dc.dA.f);
    alliance = 'dc';
  });

  it('ALLIANCE_HELD has dA, dD, dW entries with f and s for all factions', () => {
    ['ep', 'dc', 'ad'].forEach(a => {
      const hc = ALLIANCE_HELD[a];
      assert.ok(hc, `${a} should exist in ALLIANCE_HELD`);
      ['dA', 'dD', 'dW'].forEach(key => {
        assert.ok(hc[key] && hc[key].f && hc[key].s,
          `${a}.${key} should have fill (f) and stroke (s)`);
      });
    });
  });

  it('All three alliances have distinct alive fill colors', () => {
    const fills = new Set(['ep', 'dc', 'ad'].map(a => ALLIANCE_HELD[a].dA.f));
    assert.equal(fills.size, 3, 'Each alliance should have a unique alive fill color');
  });

  it('sliceC() returns neutral alive color for a non-held alive district', () => {
    resetState();
    const c = sliceC(0);
    assert.equal(c.f, C.nA.f);
    assert.equal(c.s, C.nA.s);
  });

  it('sliceC() returns alliance alive color for a held alive district', () => {
    resetState();
    dcHeld.add(0);
    const c = sliceC(0);
    assert.equal(c.f, heldC().dA.f);
    assert.equal(c.s, heldC().dA.s);
  });

  it('sliceC() returns neutral dead color for a non-held dead district', () => {
    resetState();
    killBoss(0);
    assert.equal(sliceC(0).f, C.nD.f);
  });

  it('sliceC() returns alliance dead color for a held dead district', () => {
    resetState();
    dcHeld.add(0);
    killBoss(0);
    assert.equal(sliceC(0).f, heldC().dD.f);
  });

  it('sliceC() returns neutral dead color for a non-held unknown district', () => {
    resetState();
    timers[0].unknown = true;
    assert.equal(sliceC(0).f, C.nD.f);
  });

  it('sliceC() returns alliance dead color for a held unknown district', () => {
    resetState();
    dcHeld.add(0);
    timers[0].unknown = true;
    assert.equal(sliceC(0).f, heldC().dD.f);
  });

  it('Switching alliance changes the color sliceC returns for a held district', () => {
    resetState();
    dcHeld.add(0);
    setAlliance('dc');
    const colorDC = sliceC(0).f;
    setAlliance('ep');
    const colorEP = sliceC(0).f;
    setAlliance('ad');
    const colorAD = sliceC(0).f;
    assert.notOk(colorDC === colorEP, 'DC and EP held colors should differ');
    assert.notOk(colorDC === colorAD, 'DC and AD held colors should differ');
    setAlliance('dc');
  });
});


/* ═══════════════════════════════════════════
   15. PRESET NAMES
   ═══════════════════════════════════════════ */
describe('Preset Names — modeName()', () => {

  it('Returns "Chud Mode" for chud preset', () => {
    resetState();
    activePreset = 'chud';
    assert.equal(modeName(), 'Chud Mode');
  });

  it('Returns "Chad Mode" for chad preset', () => {
    resetState();
    activePreset = 'chad';
    assert.equal(modeName(), 'Chad Mode');
  });

  it('Returns "The Streakah" for streakah preset', () => {
    resetState();
    activePreset = 'streakah';
    assert.equal(modeName(), 'The Streakah');
  });

  it('Returns "Manual" when no preset is active', () => {
    resetState();
    assert.equal(modeName(), 'Manual');
  });
});


/* ═══════════════════════════════════════════
   16. COMMAND CENTER — getNextTarget()
   ═══════════════════════════════════════════ */
describe('Command Center — getNextTarget()', () => {

  it('Returns a ready target when any district is alive', () => {
    resetState();
    const result = getNextTarget();
    assert.ok(result.ready, 'Should be ready when districts are alive');
    assert.notOk(result.di === null, 'Should have a target district index');
  });

  it('Returns not-ready when all districts are dead', () => {
    resetState();
    for (let i = 0; i < 6; i++) killBoss(i);
    const result = getNextTarget();
    assert.notOk(result.ready, 'Should not be ready when all are dead');
    assert.ok(result.reason.length > 0, 'Should explain why no target');
  });

  it('Prioritizes held alive district over non-held alive', () => {
    resetState();
    dcHeld.add(3);
    const result = getNextTarget();
    assert.equal(result.di, 3, 'Held district should be first priority');
  });

  it('Falls back to unknown districts when all timers are unknown', () => {
    resetState();
    DISTRICTS.forEach((_, i) => {
      timers[i].running = false;
      timers[i].end = null;
      timers[i].unknown = true;
      timers[i].unknownAt = Date.now() - i * 60000;
    });
    const result = getNextTarget();
    assert.notOk(result.ready, 'Unknown district should not be marked ready');
    assert.ok(result.title.includes('Check'), 'Should recommend checking an unknown district');
  });
});


/* ═══════════════════════════════════════════
   17. TIMER GUESS — setTimerGuess()
   ═══════════════════════════════════════════ */
describe('Timer Guess — setTimerGuess()', () => {

  it('7-minute guess sets a running timer with ~8 minutes remaining', () => {
    resetState();
    setTimerGuess(0, 7);
    const state = districtState(0);
    assert.notOk(state.up, 'District should still be dead');
    assert.greaterThan(state.rem, 460);
    assert.lessThan(state.rem, 481);
  });

  it('15-minute guess marks district as alive (exactly at respawn threshold)', () => {
    resetState();
    setTimerGuess(0, 15);
    const state = districtState(0);
    assert.ok(state.up, 'District guessed dead 15 min ago should be alive');
  });

  it('20-minute guess also marks district as alive', () => {
    resetState();
    setTimerGuess(0, 20);
    assert.ok(districtState(0).up, 'District guessed 20 min ago should be alive');
  });

  it('setTimerGuess() clears unknown timer state', () => {
    resetState();
    timers[0].unknown = true;
    timers[0].unknownAt = Date.now() - 300000;
    setTimerGuess(0, 5);
    assert.notOk(timers[0].unknown, 'Unknown flag should be cleared after guess');
    assert.notOk(districtState(0).unknown, 'districtState should not report unknown');
  });

  it('seenAlive() marks a district as alive and records scout time', () => {
    resetState();
    killBoss(0); // set it dead first
    seenAlive(0);
    const state = districtState(0);
    assert.ok(state.up, 'Should be alive after seenAlive');
    assert.notOk(state.unknown, 'Should not be unknown after seenAlive');
    assert.ok(timers[0].seenAt > 0, 'seenAt should be recorded');
  });

  it('seenAlive() clears unknown state', () => {
    resetState();
    timers[0].unknown = true;
    timers[0].unknownAt = Date.now();
    seenAlive(0);
    assert.notOk(timers[0].unknown, 'Unknown flag should be cleared');
    assert.ok(districtState(0).up, 'District should be alive after seen');
  });
});


/* ═══════════════════════════════════════════
   18. MANUAL TEL VAR ADD
   ═══════════════════════════════════════════ */
describe('Manual Tel Var Add — addManualTelvar()', () => {

  it('Adds amount to currentTelVar', () => {
    resetState();
    document.getElementById('tvAdjustInput').value = '500';
    addManualTelvar();
    assert.equal(currentTelVar, 500);
  });

  it('Stacks with existing currentTelVar', () => {
    resetState();
    currentTelVar = 1000;
    document.getElementById('tvAdjustInput').value = '350';
    addManualTelvar();
    assert.equal(currentTelVar, 1350);
  });

  it('Clears the input after adding', () => {
    resetState();
    const input = document.getElementById('tvAdjustInput');
    input.value = '200';
    addManualTelvar();
    assert.equal(input.value, '');
  });

  it('Logs the event', () => {
    resetState();
    document.getElementById('tvAdjustInput').value = '777';
    addManualTelvar();
    assert.ok(eventLog.some(e => e.text.includes('777')), 'Event log should mention the amount');
  });

  it('Supports undo', () => {
    resetState();
    document.getElementById('tvAdjustInput').value = '999';
    addManualTelvar();
    assert.equal(currentTelVar, 999);
    undoLastAction();
    assert.equal(currentTelVar, 0);
  });

  it('Ignores zero', () => {
    resetState();
    document.getElementById('tvAdjustInput').value = '0';
    addManualTelvar();
    assert.equal(currentTelVar, 0);
  });

  it('Ignores negative values', () => {
    resetState();
    document.getElementById('tvAdjustInput').value = '-100';
    addManualTelvar();
    assert.equal(currentTelVar, 0);
  });

  it('Does not affect totalKills', () => {
    resetState();
    document.getElementById('tvAdjustInput').value = '5000';
    addManualTelvar();
    assert.equal(totalKills, 0);
  });
});


/* ═══════════════════════════════════════════
   19. TELVAR TARGET
   ═══════════════════════════════════════════ */
describe('Telvar Target — setTelvarTarget()', () => {

  it('Sets telvarTarget from input', () => {
    resetState();
    document.getElementById('tvTargetInput').value = '50000';
    setTelvarTarget();
    assert.equal(telvarTarget, 50000);
  });

  it('Empty input clears the target', () => {
    resetState();
    telvarTarget = 50000;
    document.getElementById('tvTargetInput').value = '';
    setTelvarTarget();
    assert.equal(telvarTarget, 0);
  });

  it('Zero input clears the target', () => {
    resetState();
    telvarTarget = 10000;
    document.getElementById('tvTargetInput').value = '0';
    setTelvarTarget();
    assert.equal(telvarTarget, 0);
  });

  it('Clears the input field after setting', () => {
    resetState();
    const input = document.getElementById('tvTargetInput');
    input.value = '25000';
    setTelvarTarget();
    assert.equal(input.value, '');
  });

  it('Persists to localStorage', () => {
    resetState();
    document.getElementById('tvTargetInput').value = '75000';
    setTelvarTarget();
    assert.equal(localStorage.getItem('ic-telvar-target'), '75000');
  });

  it('Target 0 hides the progress bar', () => {
    resetState();
    telvarTarget = 0;
    updateTV();
    const wrap = document.getElementById('tvTargetWrap');
    assert.equal(wrap.style.display, 'none');
  });

  it('Target > 0 shows the progress bar', () => {
    resetState();
    telvarTarget = 50000;
    updateTV();
    const wrap = document.getElementById('tvTargetWrap');
    assert.notOk(wrap.style.display === 'none', 'Wrap should be visible');
  });

  it('Progress text shows net / target', () => {
    resetState();
    currentTelVar = 10000;
    bankedTelVar = 5000;
    telvarTarget = 50000;
    updateTV();
    const text = document.getElementById('tvTargetText').textContent;
    assert.includes(text, '15,000');
    assert.includes(text, '50,000');
  });

  it('Progress percentage is capped at 100%', () => {
    resetState();
    currentTelVar = 60000;
    telvarTarget = 50000;
    updateTV();
    const pct = document.getElementById('tvTargetPct').textContent;
    assert.equal(pct, '100%');
  });

  it('Fill has "done" class when target reached', () => {
    resetState();
    currentTelVar = 50000;
    telvarTarget = 50000;
    updateTV();
    assert.ok(document.getElementById('tvTargetFill').classList.contains('done'));
  });

  it('Fill does not have "done" class when below target', () => {
    resetState();
    currentTelVar = 10000;
    telvarTarget = 50000;
    updateTV();
    assert.notOk(document.getElementById('tvTargetFill').classList.contains('done'));
  });
});


/* ═══════════════════════════════════════════
   20. RESPAWN SORT — applyRespawnSort()
   ═══════════════════════════════════════════ */
describe('Respawn Sort — applyRespawnSort()', () => {

  function districtOrder() {
    return [...document.getElementById('districts').children]
      .map(el => parseInt(el.id.replace('dr', '')));
  }

  it('Default order is 0-1-2-3-4-5', () => {
    resetState();
    const order = districtOrder();
    assert.equal(order.join(','), '0,1,2,3,4,5');
  });

  it('All-alive: sort preserves original order', () => {
    resetState();
    applyRespawnSort();
    assert.equal(districtOrder().join(','), '0,1,2,3,4,5');
  });

  it('Killed district moves below alive districts', () => {
    resetState();
    killBoss(0);
    applyRespawnSort();
    const order = districtOrder();
    assert.notOk(order[0] === 0, 'Killed district 0 should not be first');
    assert.equal(order[order.length - 1], 0, 'Killed district 0 should be last when others are alive');
  });

  it('Among dead districts, soonest respawn sorts first', () => {
    resetState();
    // Kill district 2 first (oldest, most time elapsed, least remaining)
    timers[2].end = Date.now() + 60 * 1000;   // 1 min left
    timers[2].running = true;
    // Kill district 4 with more time left
    timers[4].end = Date.now() + 600 * 1000;  // 10 min left
    timers[4].running = true;
    // Kill all others so only 2 and 4 are dead
    [0, 1, 3, 5].forEach(i => killBoss(i));
    applyRespawnSort();
    const order = districtOrder();
    const pos2 = order.indexOf(2), pos4 = order.indexOf(4);
    assert.lessThan(pos2, pos4, 'District 2 (less remaining) should sort before district 4');
  });

  it('Unknown districts sort after all known timers', () => {
    resetState();
    timers[1].unknown = true;
    timers[1].unknownAt = Date.now();
    applyRespawnSort();
    const order = districtOrder();
    assert.equal(order[order.length - 1], 1, 'Unknown district should be last');
  });

  it('Multiple unknowns all sort to the end', () => {
    resetState();
    timers[0].unknown = true; timers[0].unknownAt = Date.now();
    timers[3].unknown = true; timers[3].unknownAt = Date.now();
    applyRespawnSort();
    const order = districtOrder();
    const knownCount = DISTRICTS.length - 2;
    const tail = order.slice(knownCount);
    assert.ok(tail.includes(0) && tail.includes(3), 'Both unknowns should be in the tail');
  });
});


/* ═══════════════════════════════════════════
   21. ALLIANCE MAP HINT
   ═══════════════════════════════════════════ */
describe('Alliance Map Hint', () => {

  it('EP alliance sets hint text to "EP control"', () => {
    resetState();
    setAlliance('ep');
    assert.equal(document.getElementById('mapHintAlliance').textContent, 'EP control');
    setAlliance('dc');
  });

  it('DC alliance sets hint text to "DC control"', () => {
    resetState();
    setAlliance('dc');
    assert.equal(document.getElementById('mapHintAlliance').textContent, 'DC control');
  });

  it('AD alliance sets hint text to "AD control"', () => {
    resetState();
    setAlliance('ad');
    assert.equal(document.getElementById('mapHintAlliance').textContent, 'AD control');
    setAlliance('dc');
  });

  it('EP hint color matches ALLIANCES.ep.color', () => {
    resetState();
    setAlliance('ep');
    assert.equal(document.getElementById('mapHintAlliance').style.color, hexToRgb(ALLIANCES.ep.color));
    setAlliance('dc');
  });

  it('DC hint color matches ALLIANCES.dc.color', () => {
    resetState();
    setAlliance('dc');
    assert.equal(document.getElementById('mapHintAlliance').style.color, hexToRgb(ALLIANCES.dc.color));
  });

  it('AD hint color matches ALLIANCES.ad.color', () => {
    resetState();
    setAlliance('ad');
    assert.equal(document.getElementById('mapHintAlliance').style.color, hexToRgb(ALLIANCES.ad.color));
    setAlliance('dc');
  });

  it('Hint updates immediately on every alliance switch', () => {
    resetState();
    setAlliance('ep');
    assert.equal(document.getElementById('mapHintAlliance').textContent, 'EP control');
    setAlliance('ad');
    assert.equal(document.getElementById('mapHintAlliance').textContent, 'AD control');
    setAlliance('dc');
    assert.equal(document.getElementById('mapHintAlliance').textContent, 'DC control');
  });
});


/* ═══════════════════════════════════════════
   22. RISK METER
   ═══════════════════════════════════════════ */
describe('Risk Meter — setRiskTolerance()', () => {

  it('setRiskTolerance() sets riskTolerance from input', () => {
    resetState();
    document.getElementById('tvRiskInput').value = '5000';
    setRiskTolerance();
    assert.equal(riskTolerance, 5000);
  });

  it('Empty input clears riskTolerance to 0', () => {
    resetState();
    riskTolerance = 5000;
    document.getElementById('tvRiskInput').value = '';
    setRiskTolerance();
    assert.equal(riskTolerance, 0);
  });

  it('Zero input clears riskTolerance to 0', () => {
    resetState();
    riskTolerance = 5000;
    document.getElementById('tvRiskInput').value = '0';
    setRiskTolerance();
    assert.equal(riskTolerance, 0);
  });

  it('Negative input clears riskTolerance to 0', () => {
    resetState();
    document.getElementById('tvRiskInput').value = '-1000';
    setRiskTolerance();
    assert.equal(riskTolerance, 0);
  });

  it('setRiskTolerance() clears the input field', () => {
    resetState();
    document.getElementById('tvRiskInput').value = '3000';
    setRiskTolerance();
    assert.equal(document.getElementById('tvRiskInput').value, '');
  });

  it('riskWarn shows when carrying >= riskTolerance', () => {
    resetState();
    riskTolerance = 2000;
    currentTelVar = 2000;
    updateTV();
    assert.ok(document.getElementById('riskWarn').classList.contains('show'));
  });

  it('riskWarn is hidden when carrying < riskTolerance', () => {
    resetState();
    riskTolerance = 5000;
    currentTelVar = 1000;
    updateTV();
    assert.notOk(document.getElementById('riskWarn').classList.contains('show'));
  });

  it('riskWarn is hidden when riskTolerance is 0', () => {
    resetState();
    riskTolerance = 0;
    currentTelVar = 99999;
    updateTV();
    assert.notOk(document.getElementById('riskWarn').classList.contains('show'));
  });

  it('tvT gets at-risk class when carrying >= riskTolerance', () => {
    resetState();
    riskTolerance = 1000;
    currentTelVar = 1500;
    updateTV();
    assert.ok(document.getElementById('tvT').classList.contains('at-risk'));
  });

  it('tvT loses at-risk class when carrying drops below riskTolerance', () => {
    resetState();
    riskTolerance = 5000;
    currentTelVar = 1000;
    updateTV();
    assert.notOk(document.getElementById('tvT').classList.contains('at-risk'));
  });
});


/* ═══════════════════════════════════════════
   CLEANUP
   ═══════════════════════════════════════════ */
describe('Cleanup', () => {
  it('Reset state after all tests', () => {
    resetState();
    localStorage.removeItem('esoIcSession');
    localStorage.removeItem('esoIcBestStreak');
    localStorage.removeItem('ic-alliance');
    localStorage.removeItem('ic-telvar-target');
    localStorage.removeItem('ic-risk-tolerance');
    localStorage.removeItem('ic-help-seen');
    assert.ok(true);
  });
});
