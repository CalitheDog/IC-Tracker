/**
 * IC Tracker Test Suite
 * Tests core logic: utilities, tel var economy, timers, streaks, persistence, keyboard shortcuts
 */
const { describe, it, assert } = TestRunner;

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
    setAlliance('ep');
    const btns = document.querySelectorAll('#allianceEl .alliance-btn');
    let epSel = false, dcSel = false;
    btns.forEach(b => {
      if (b.classList.contains('ep') && b.classList.contains('sel')) epSel = true;
      if (b.classList.contains('dc') && b.classList.contains('sel')) dcSel = true;
    });
    assert.ok(epSel, 'EP button should have sel class');
    assert.notOk(dcSel, 'DC button should not have sel class');
    setAlliance('dc');
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
    assert.ok(true);
  });
});
