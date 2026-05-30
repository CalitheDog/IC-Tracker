/**
 * IC Tracker test suite.
 *
 * Runs INSIDE the app iframe (injected by tests/index.html), so it references
 * the app's top-level functions and state directly — fmt, DISTRICTS, dcHeld,
 * killBoss, etc. are all in scope.
 *
 * Behaviour notes that differ from the pre-redesign app:
 *  - Keyboard shortcuts are prefixed: s/g/r set a "seen/guess/reset" prefix,
 *    then a 1-6 key targets a district. Bare 1-6 kills. b banks, x ganks,
 *    u undoes.
 *  - Kill streak and full session save/restore were removed.
 *  - bankTelVar() also zeroes totalKills, and (like kills/ganks) pushes an undo
 *    snapshot, so a bank can be undone.
 */
const { describe, it, assert } = TestRunner;

/* Reset all mutable app state to a known baseline between tests.
   stI/grSz/etc. are `let` globals (reassignable); dcHeld/timers are `const`
   collections (mutated in place). */
function resetState() {
  stI = 0; grSz = 1;
  totalKills = 0; currentTelVar = 0; bankedTelVar = 0; lostTelVar = 0;
  farmStart = null; farmEnd = null; farmRunning = false;
  activePreset = null; alliance = 'dc'; sortByRespawn = false; telvarTarget = 0;
  muted = true;
  if (typeof notifyEnabled !== 'undefined') notifyEnabled = false;
  if (typeof esoPlus !== 'undefined') esoPlus = true; // default: ESO Plus on (base 1327)
  dcHeld.clear();
  actionStack = []; eventLog = []; lastNextTarget = null;
  shortcutPrefix = null;
  if (typeof clearAlertTimers === 'function') DISTRICTS.forEach((_, i) => clearAlertTimers(i));
  DISTRICTS.forEach((_, i) => Object.assign(timers[i], {
    end: null, running: false, wasRunning: false, warnFired: false,
    unknown: false, unknownAt: null, seenAt: null,
  }));
  const adj = document.getElementById('tvAdjustInput'); if (adj) adj.value = '';
  const tgt = document.getElementById('tvTargetInput'); if (tgt) tgt.value = '';
  const ho = document.getElementById('helpOverlay'); if (ho) ho.style.display = 'none';
}

function press(key, opts = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
  document.dispatchEvent(ev);
  return ev;
}

/* ═══════════════════════════════════════════ 1. UTILITIES ═══ */
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
    DISTRICTS.forEach(d => assert.equal(d.bosses.length, 2));
  });
  it('Tel Var constants are correct', () => {
    assert.equal(BASE_TV, 1327);
    assert.deepEqual(MULT, [1, 2, 3, 4]);
    assert.equal(RESPAWN, 900);
    assert.equal(WARN_AT, 60);
  });
});

/* ═══════════════════════════════════════════ 2. perKill() ═══ */
describe('Tel Var Economy — perKill()', () => {
  it('Base kill value is 1327 at x1 mult, solo, 0 DC', () => {
    resetState(); assert.equal(perKill(), 1327);
  });
  it('x2 multiplier doubles kill value', () => {
    resetState(); stI = 1; assert.equal(perKill(), 2654);
  });
  it('x3 multiplier triples kill value', () => {
    resetState(); stI = 2; assert.equal(perKill(), 3981);
  });
  it('x4 multiplier quadruples kill value', () => {
    resetState(); stI = 3; assert.equal(perKill(), 5308);
  });
  it('Group of 2 halves the per-kill value', () => {
    resetState(); grSz = 2; assert.equal(perKill(), 664);
  });
  it('Group of 4 quarters the per-kill value', () => {
    resetState(); grSz = 4; assert.equal(perKill(), 332);
  });
  it('3 held districts ≈ 1.99x bonus', () => {
    resetState(); dcHeld.add(0); dcHeld.add(1); dcHeld.add(2);
    assert.equal(perKill(), 2641);
  });
  it('All 6 held districts ≈ 2.98x bonus', () => {
    resetState(); DISTRICTS.forEach((_, i) => dcHeld.add(i));
    assert.equal(perKill(), 3954);
  });
  it('Multiplier + group + held combine correctly', () => {
    resetState(); stI = 3; grSz = 2; dcHeld.add(0); dcHeld.add(1);
    assert.equal(perKill(), 4406);
  });
});

/* ═══════════════════════════════════════════ 3. BANK & GANK ═══ */
describe('Tel Var Economy — Bank & Gank', () => {
  it('killBoss() adds Tel Var and increments kill count', () => {
    resetState();
    killBoss(0);
    assert.equal(totalKills, 1);
    assert.equal(currentTelVar, 1327);
  });
  it('bankTelVar() moves carried to banked and zeroes kills', () => {
    resetState();
    currentTelVar = 500; totalKills = 3;
    bankTelVar();
    assert.equal(bankedTelVar, 500);
    assert.equal(currentTelVar, 0);
    assert.equal(totalKills, 0);
  });
  it('bankTelVar() with 0 carried does nothing', () => {
    resetState();
    bankTelVar();
    assert.equal(bankedTelVar, 0);
  });
  it('gankedTelVar() removes 50% of carried', () => {
    resetState();
    currentTelVar = 400;
    gankedTelVar();
    assert.equal(currentTelVar, 200);
    assert.equal(lostTelVar, 200);
  });
  it('gankedTelVar() with 0 carried does nothing', () => {
    resetState();
    gankedTelVar();
    assert.equal(currentTelVar, 0);
    assert.equal(lostTelVar, 0);
  });
  it('Multiple kills accumulate Tel Var', () => {
    resetState();
    killBoss(0); killBoss(1); killBoss(2);
    assert.equal(totalKills, 3);
    assert.equal(currentTelVar, 1327 * 3);
  });
});

/* ═══════════════════════════════════════════ 4. TIMER STATE ═══ */
describe('Timer & District State', () => {
  it('Fresh district is alive with 0 remaining', () => {
    resetState();
    const s = districtState(0);
    assert.ok(s.up);
    assert.equal(s.rem, 0);
  });
  it('After killBoss(), district is dead with ~900s remaining', () => {
    resetState();
    killBoss(0);
    const s = districtState(0);
    assert.notOk(s.up);
    assert.greaterThan(s.rem, 895);
    assert.ok(s.rem <= 900);
  });
  it('rstBoss() returns district to alive', () => {
    resetState();
    killBoss(0); rstBoss(0);
    assert.ok(districtState(0).up);
  });
  it('resetAll() returns all districts to alive', () => {
    resetState();
    killBoss(0); killBoss(3); killBoss(5);
    resetAll();
    DISTRICTS.forEach((_, i) => assert.ok(districtState(i).up, `district ${i} should be alive`));
  });
  it('districtStatusClass() maps state to the right class', () => {
    assert.equal(districtStatusClass({ unknown: true }), 'unknown');
    assert.equal(districtStatusClass({ up: true }), 'alive');
    assert.equal(districtStatusClass({ up: false, urg: true }), 'urgent');
    assert.equal(districtStatusClass({ up: false, urg: false, wn: true }), 'warn');
    assert.equal(districtStatusClass({ up: false, urg: false, wn: false }), 'dead');
  });
});

/* ═══════════════════════════════════════════ 5. UNKNOWN DECAY ═══ */
describe('Unknown Timer Decay', () => {
  function setUnknown(i, ageSec) {
    timers[i].unknown = true;
    timers[i].unknownAt = Date.now() - ageSec * 1000;
  }
  it('Fresh unknown (<5min) shows "Fresh unknown"', () => {
    resetState(); setUnknown(0, 60);
    assert.equal(unknownDecayInfo(0).label, 'Fresh unknown');
  });
  it('5-10 min unknown shows "Uncertain"', () => {
    resetState(); setUnknown(0, 7 * 60);
    assert.equal(unknownDecayInfo(0).label, 'Uncertain');
  });
  it('10-15 min unknown shows "Check soon"', () => {
    resetState(); setUnknown(0, 12 * 60);
    assert.equal(unknownDecayInfo(0).label, 'Check soon');
  });
  it('15+ min unknown shows "Likely ready"', () => {
    resetState(); setUnknown(0, 20 * 60);
    assert.equal(unknownDecayInfo(0).label, 'Likely ready');
  });
  it('Non-unknown timer returns default info', () => {
    resetState();
    assert.equal(unknownDecayInfo(0).label, 'Unknown');
  });
});

/* ═══════════════════════════════════════════ 6. PRESETS ═══ */
describe('Presets', () => {
  it('Chud preset sets x2 mult, solo', () => {
    resetState(); applyPreset('chud');
    assert.equal(stI, 1); assert.equal(grSz, 1);
  });
  it('Chad preset sets x4 mult, group 2', () => {
    resetState(); applyPreset('chad');
    assert.equal(stI, 3); assert.equal(grSz, 2);
  });
  it('Streakah preset locks district captures and clears held', () => {
    resetState(); dcHeld.add(0); applyPreset('streakah');
    assert.ok(districtCapturesLocked());
    assert.equal(dcHeld.size, 0);
  });
  it('Switching away from Streakah unlocks captures', () => {
    resetState(); applyPreset('streakah'); applyPreset('chud');
    assert.notOk(districtCapturesLocked());
  });
  it('modeName() reflects the active preset', () => {
    resetState();
    activePreset = 'chud'; assert.equal(modeName(), 'Chud Mode');
    activePreset = 'chad'; assert.equal(modeName(), 'Chad Mode');
    activePreset = 'streakah'; assert.equal(modeName(), 'The Streakah');
    activePreset = null; assert.equal(modeName(), 'Manual');
  });
});

/* ═══════════════════════════════════════════ 7. UNDO ═══ */
describe('Undo System', () => {
  it('Undo reverts a kill', () => {
    resetState();
    killBoss(0);
    undoLastAction();
    assert.equal(currentTelVar, 0);
    assert.notOk(timers[0].running);
  });
  it('Undo reverts a district-control toggle', () => {
    resetState();
    toggleDC(2);
    assert.ok(dcHeld.has(2));
    undoLastAction();
    assert.notOk(dcHeld.has(2));
  });
  it('Undo reverts a bank', () => {
    resetState();
    currentTelVar = 800;
    bankTelVar();
    assert.equal(bankedTelVar, 800);
    assert.equal(currentTelVar, 0);
    undoLastAction();
    assert.equal(bankedTelVar, 0);
    assert.equal(currentTelVar, 800);
  });
  it('Multiple undos unwind in stack order', () => {
    resetState();
    killBoss(0); killBoss(1);
    undoLastAction();
    assert.notOk(timers[1].running, 'last kill undone first');
    assert.ok(timers[0].running, 'first kill still applied');
    undoLastAction();
    assert.equal(totalKills, 0);
  });
  it('Undo with empty stack does nothing', () => {
    resetState();
    currentTelVar = 123;
    undoLastAction();
    assert.equal(currentTelVar, 123);
  });
});

/* ═══════════════════════════════════════════ 8. FARM TIMER ═══ */
describe('Farm Timer', () => {
  it('startFarm() initializes farm state', () => {
    resetState(); startFarm();
    assert.ok(farmRunning);
    assert.equal(farmEnd, null);
    assert.equal(typeof farmStart, 'number');
  });
  it('endFarm() stops farm and records end time', () => {
    resetState(); startFarm(); endFarm();
    assert.notOk(farmRunning);
    assert.equal(typeof farmEnd, 'number');
  });
  it('farmElapsed() returns 0 before start', () => {
    resetState();
    assert.equal(farmElapsed(), 0);
  });
  it('farmElapsed() returns positive during farming', () => {
    resetState();
    startFarm();
    farmStart -= 3000; // pretend we started 3s ago
    assert.greaterThan(farmElapsed(), 2);
  });
  it('Starting farm resets Tel Var counters', () => {
    resetState();
    currentTelVar = 999; totalKills = 5; bankedTelVar = 7; lostTelVar = 3;
    startFarm();
    assert.equal(currentTelVar, 0);
    assert.equal(totalKills, 0);
    assert.equal(bankedTelVar, 0);
    assert.equal(lostTelVar, 0);
  });
});

/* ═══════════════════════════════════════════ 9. ALLIANCE ═══ */
describe('Alliance Selection', () => {
  it('setAlliance() changes the active alliance', () => {
    resetState(); setAlliance('ep');
    assert.equal(alliance, 'ep');
  });
  it('setAlliance() ignores invalid values', () => {
    resetState(); setAlliance('ep'); setAlliance('nope');
    assert.equal(alliance, 'ep');
  });
  it('ALLIANCES constant has all three factions', () => {
    assert.ok(ALLIANCES.ep && ALLIANCES.dc && ALLIANCES.ad);
  });
  it('setAlliance() updates the held-districts label', () => {
    resetState(); setAlliance('ad');
    const lbl = document.getElementById('dcLabel');
    assert.ok(lbl, '#dcLabel should exist');
    assert.includes(lbl.textContent, 'AD-held');
  });
  it('Alliance is persisted to localStorage', () => {
    resetState(); setAlliance('ad');
    assert.equal(localStorage.getItem('ic-alliance'), 'ad');
  });
});

/* ═══════════════════════════════════════════ 10. HELD TOGGLES ═══ */
describe('Held-District Toggles', () => {
  it('toggleDC() adds a district to dcHeld', () => {
    resetState(); toggleDC(0);
    assert.ok(dcHeld.has(0));
  });
  it('toggleDC() removes the district when called again', () => {
    resetState(); toggleDC(0); toggleDC(0);
    assert.notOk(dcHeld.has(0));
  });
  it('Multiple districts can be held independently', () => {
    resetState(); toggleDC(1); toggleDC(4);
    assert.ok(dcHeld.has(1) && dcHeld.has(4));
    assert.equal(dcHeld.size, 2);
  });
  it('toggleDC() is blocked when Streakah mode is active', () => {
    resetState(); applyPreset('streakah'); toggleDC(1);
    assert.notOk(dcHeld.has(1));
  });
  it('Holding a district increases perKill', () => {
    resetState();
    const base = perKill();
    toggleDC(0);
    assert.greaterThan(perKill(), base);
  });
  it('All 6 districts can be held simultaneously', () => {
    resetState(); DISTRICTS.forEach((_, i) => toggleDC(i));
    assert.equal(dcHeld.size, 6);
  });
  it('Toggling held off reduces perKill back to base', () => {
    resetState();
    const base = perKill();
    toggleDC(0); toggleDC(0);
    assert.equal(perKill(), base);
  });
});

/* ═══════════════════════════════════════════ 11. SLICE COLORS ═══ */
describe('Alliance Slice Colors', () => {
  it('heldC() returns DC colors by default', () => {
    resetState(); assert.deepEqual(heldC(), ALLIANCE_HELD.dc);
  });
  it('heldC() returns EP colors when EP is selected', () => {
    resetState(); setAlliance('ep'); assert.deepEqual(heldC(), ALLIANCE_HELD.ep);
  });
  it('heldC() returns AD colors when AD is selected', () => {
    resetState(); setAlliance('ad'); assert.deepEqual(heldC(), ALLIANCE_HELD.ad);
  });
  it('heldC() falls back to DC colors for an invalid alliance', () => {
    resetState(); alliance = 'zz';
    assert.deepEqual(heldC(), ALLIANCE_HELD.dc);
  });
  it('ALLIANCE_HELD has dA/dD/dW with f and s for all factions', () => {
    ['ep', 'dc', 'ad'].forEach(a => {
      ['dA', 'dD', 'dW'].forEach(k => {
        assert.ok(ALLIANCE_HELD[a][k].f && ALLIANCE_HELD[a][k].s, `${a}.${k}`);
      });
    });
  });
  it('All three alliances have distinct alive fill colors', () => {
    const fills = new Set(['ep', 'dc', 'ad'].map(a => ALLIANCE_HELD[a].dA.f));
    assert.equal(fills.size, 3);
  });
  it('sliceC() returns neutral alive color for a non-held alive district', () => {
    resetState(); assert.deepEqual(sliceC(0), C.nA);
  });
  it('sliceC() returns alliance alive color for a held alive district', () => {
    resetState(); dcHeld.add(0); assert.deepEqual(sliceC(0), heldC().dA);
  });
  it('sliceC() returns neutral dead color for a non-held dead district', () => {
    resetState();
    timers[0].running = true; timers[0].end = Date.now() + 500000;
    assert.deepEqual(sliceC(0), C.nD);
  });
  it('sliceC() returns alliance dead color for a held dead district', () => {
    resetState();
    dcHeld.add(0); timers[0].running = true; timers[0].end = Date.now() + 500000;
    assert.deepEqual(sliceC(0), heldC().dD);
  });
  it('sliceC() returns neutral dead color for a non-held unknown district', () => {
    resetState(); timers[0].unknown = true;
    assert.deepEqual(sliceC(0), C.nD);
  });
  it('sliceC() returns alliance dead color for a held unknown district', () => {
    resetState(); dcHeld.add(0); timers[0].unknown = true;
    assert.deepEqual(sliceC(0), heldC().dD);
  });
  it('Switching alliance changes the color sliceC returns for a held district', () => {
    resetState(); dcHeld.add(0);
    setAlliance('dc'); const dc = sliceC(0);
    setAlliance('ep'); const ep = sliceC(0);
    assert.ok(dc.f !== ep.f);
  });
});

/* ═══════════════════════════════════════════ 12. NEXT TARGET ═══ */
describe('Command Center — getNextTarget()', () => {
  it('Returns a ready target when any district is alive', () => {
    resetState();
    assert.ok(getNextTarget().ready);
  });
  it('Returns not-ready when all districts are dead', () => {
    resetState();
    DISTRICTS.forEach((_, i) => { timers[i].running = true; timers[i].end = Date.now() + 500000; });
    assert.notOk(getNextTarget().ready);
  });
  it('Prioritizes a held alive district over a non-held alive one', () => {
    resetState(); dcHeld.add(3);
    assert.equal(getNextTarget().di, 3);
  });
  it('Falls back to an unknown district when all timers are unknown', () => {
    resetState();
    DISTRICTS.forEach((_, i) => { timers[i].unknown = true; timers[i].unknownAt = Date.now(); });
    const next = getNextTarget();
    assert.notOk(next.ready);
    assert.includes(next.title.toLowerCase(), 'unknown');
  });
});

/* ═══════════════════════════════════════════ 13. TIMER GUESS / SCOUT ═══ */
describe('Timer Guess & Scout', () => {
  it('7-minute guess sets a running timer with ~8 minutes remaining', () => {
    resetState(); setTimerGuess(0, 7);
    assert.ok(timers[0].running);
    const rem = (timers[0].end - Date.now()) / 1000;
    assert.greaterThan(rem, 470);
    assert.lessThan(rem, 481);
  });
  it('15-minute guess marks the district alive (at respawn threshold)', () => {
    resetState(); setTimerGuess(0, 15);
    assert.ok(districtState(0).up);
  });
  it('20-minute guess also marks the district alive', () => {
    resetState(); setTimerGuess(0, 20);
    assert.ok(districtState(0).up);
  });
  it('setTimerGuess() clears unknown state', () => {
    resetState(); timers[0].unknown = true; timers[0].unknownAt = Date.now();
    setTimerGuess(0, 5);
    assert.notOk(timers[0].unknown);
  });
  it('seenAlive() marks a district alive and records scout time', () => {
    resetState(); seenAlive(0);
    assert.ok(districtState(0).up);
    assert.equal(typeof timers[0].seenAt, 'number');
  });
  it('seenAlive() clears unknown state', () => {
    resetState(); timers[0].unknown = true; timers[0].unknownAt = Date.now();
    seenAlive(0);
    assert.notOk(timers[0].unknown);
  });
});

/* ═══════════════════════════════════════════ 14. MANUAL TEL VAR ═══ */
describe('Manual Tel Var Set — setManualTelvar()', () => {
  function setInput(v) { document.getElementById('tvAdjustInput').value = v; }
  it('Sets currentTelVar to the entered amount', () => {
    resetState(); setInput('5000'); setManualTelvar();
    assert.equal(currentTelVar, 5000);
  });
  it('Overwrites existing currentTelVar (does not stack)', () => {
    resetState(); currentTelVar = 1000; setInput('3000'); setManualTelvar();
    assert.equal(currentTelVar, 3000);
  });
  it('Clears the input after setting', () => {
    resetState(); setInput('5000'); setManualTelvar();
    assert.equal(document.getElementById('tvAdjustInput').value, '');
  });
  it('Logs the event', () => {
    resetState(); setInput('5000'); setManualTelvar();
    assert.includes(eventLog[0].text, 'Set carrying');
  });
  it('Supports undo', () => {
    resetState(); currentTelVar = 100; setInput('9000'); setManualTelvar();
    undoLastAction();
    assert.equal(currentTelVar, 100);
  });
  it('Allows setting to zero', () => {
    resetState(); currentTelVar = 500; setInput('0'); setManualTelvar();
    assert.equal(currentTelVar, 0);
  });
  it('Ignores negative values', () => {
    resetState(); currentTelVar = 500; setInput('-5'); setManualTelvar();
    assert.equal(currentTelVar, 500);
  });
  it('Ignores empty input', () => {
    resetState(); currentTelVar = 500; setInput(''); setManualTelvar();
    assert.equal(currentTelVar, 500);
  });
  it('Does not affect totalKills', () => {
    resetState(); totalKills = 4; setInput('5000'); setManualTelvar();
    assert.equal(totalKills, 4);
  });
});

/* ═══════════════════════════════════════════ 15. TEL VAR TARGET ═══ */
describe('Tel Var Target — setTelvarTarget()', () => {
  function setInput(v) { document.getElementById('tvTargetInput').value = v; }
  it('Sets telvarTarget from input', () => {
    resetState(); setInput('100000'); setTelvarTarget();
    assert.equal(telvarTarget, 100000);
  });
  it('Empty input clears the target', () => {
    resetState(); telvarTarget = 50000; setInput(''); setTelvarTarget();
    assert.equal(telvarTarget, 0);
  });
  it('Zero input clears the target', () => {
    resetState(); telvarTarget = 50000; setInput('0'); setTelvarTarget();
    assert.equal(telvarTarget, 0);
  });
  it('Clears the input field after setting', () => {
    resetState(); setInput('100000'); setTelvarTarget();
    assert.equal(document.getElementById('tvTargetInput').value, '');
  });
  it('Persists to localStorage', () => {
    resetState(); setInput('80000'); setTelvarTarget();
    assert.equal(localStorage.getItem('ic-telvar-target'), '80000');
  });
});

/* ═══════════════════════════════════════════ 16. RESPAWN SORT ═══ */
describe('Respawn Sort — applyRespawnSort()', () => {
  function order() {
    return [...document.getElementById('districts').children].map(r => r.id);
  }
  it('Dead districts sort below alive ones', () => {
    resetState();
    killBoss(0); // district 0 now dead, rest alive
    applyRespawnSort();
    assert.equal(order()[order().length - 1], 'dr0');
  });
  it('Among dead districts, the soonest respawn sorts first', () => {
    resetState();
    // make all dead, district 2 soonest
    DISTRICTS.forEach((_, i) => { timers[i].running = true; timers[i].end = Date.now() + (i === 2 ? 10000 : 600000); });
    applyRespawnSort();
    assert.equal(order()[0], 'dr2');
  });
  it('Unknown districts sort after all known timers', () => {
    resetState();
    timers[0].unknown = true; timers[0].unknownAt = Date.now();
    killBoss(1); // dead but known
    applyRespawnSort();
    assert.equal(order()[order().length - 1], 'dr0');
  });
});

/* ═══════════════════════════════════════════ 17. KEYBOARD SHORTCUTS ═══ */
describe('Keyboard Shortcuts', () => {
  it('Pressing "1" kills Memorial district (index 0)', () => {
    resetState(); press('1');
    assert.ok(timers[0].running);
    assert.equal(totalKills, 1);
  });
  it('Pressing "6" kills Elvens district (index 5)', () => {
    resetState(); press('6');
    assert.ok(timers[5].running);
  });
  it('Pressing "b" banks Tel Var', () => {
    resetState(); currentTelVar = 500; press('b');
    assert.equal(bankedTelVar, 500);
    assert.equal(currentTelVar, 0);
  });
  it('Pressing "x" triggers ganked (loses 50%)', () => {
    resetState(); currentTelVar = 400; press('x');
    assert.equal(currentTelVar, 200);
  });
  it('Pressing "u" undoes the last action', () => {
    resetState(); killBoss(0); press('u');
    assert.equal(totalKills, 0);
  });
  it('Pressing "s" arms the "seen" prefix; then 1 marks district scouted', () => {
    resetState();
    press('s');
    assert.equal(shortcutPrefix, 'seen');
    press('1');
    assert.equal(typeof timers[0].seenAt, 'number');
    assert.equal(shortcutPrefix, null);
  });
  it('Pressing "r" arms the "reset" prefix; then 1 resets that timer', () => {
    resetState();
    killBoss(0);
    press('r');
    assert.equal(shortcutPrefix, 'reset');
    press('1');
    assert.notOk(timers[0].running);
  });
  it('Pressing "g" arms the "guess" prefix', () => {
    resetState();
    press('g');
    assert.equal(shortcutPrefix, 'guess');
    clearShortcutPrefix(); // avoid the prompt() path on a following number key
  });
  it('Keys are ignored when typing in an input', () => {
    resetState();
    const input = document.getElementById('tvAdjustInput');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
    assert.equal(totalKills, 0);
  });
  it('Modified keys (ctrl+1) are ignored', () => {
    resetState(); press('1', { ctrlKey: true });
    assert.equal(totalKills, 0);
  });
});

/* ═══════════════════════════════════════════ 18. RESPAWN ALERTS ═══ */
describe('Respawn Alert Scheduling', () => {
  it('killBoss() arms warn + spawn timeouts', () => {
    resetState();
    killBoss(0);
    assert.ok(alertTimers[0].warn !== null, 'warn timeout armed');
    assert.ok(alertTimers[0].spawn !== null, 'spawn timeout armed');
  });
  it('rstBoss() cancels scheduled alerts', () => {
    resetState();
    killBoss(0);
    rstBoss(0);
    assert.equal(alertTimers[0].warn, null);
    assert.equal(alertTimers[0].spawn, null);
  });
  it('seenAlive() cancels scheduled alerts', () => {
    resetState();
    killBoss(0);
    seenAlive(0);
    assert.equal(alertTimers[0].spawn, null);
  });
  it('setTimerGuess() arms a spawn timeout for a running guess', () => {
    resetState();
    setTimerGuess(0, 7);
    assert.ok(alertTimers[0].spawn !== null);
  });
  it('fireWarn() sets warnFired inside the window and is idempotent', () => {
    resetState();
    timers[0].running = true; timers[0].end = Date.now() + 30000;
    fireWarn(0);
    assert.ok(timers[0].warnFired);
    fireWarn(0); // second call must be a no-op, not throw
    assert.ok(timers[0].warnFired);
  });
  it('fireWarn() does nothing outside the warn window', () => {
    resetState();
    timers[0].running = true; timers[0].end = Date.now() + 500000;
    fireWarn(0);
    assert.notOk(timers[0].warnFired);
  });
  it('fireSpawn() flips a due timer to alive', () => {
    resetState();
    timers[0].running = true; timers[0].wasRunning = true; timers[0].end = Date.now() - 1000;
    fireSpawn(0);
    assert.notOk(timers[0].running);
    assert.equal(timers[0].end, null);
    assert.ok(districtState(0).up);
  });
  it('fireSpawn() ignores a timer that is not due yet', () => {
    resetState();
    timers[0].running = true; timers[0].wasRunning = true; timers[0].end = Date.now() + 300000;
    fireSpawn(0);
    assert.ok(timers[0].running);
  });
});

/* ═══════════════════════════════════════════ 19. DESKTOP NOTIFICATIONS ═══ */
describe('Desktop Notifications', () => {
  it('notify() is a no-op when notifications are disabled', () => {
    notifyEnabled = false;
    assert.equal(notify('Memorial', 'spawn'), false);
  });
  it('applyNotifyPref(true) enables and persists ic-notify=1', () => {
    applyNotifyPref(true);
    assert.ok(notifyEnabled);
    assert.equal(localStorage.getItem('ic-notify'), '1');
    applyNotifyPref(false); // restore
  });
  it('applyNotifyPref(false) disables and persists ic-notify=0', () => {
    applyNotifyPref(true);
    applyNotifyPref(false);
    assert.notOk(notifyEnabled);
    assert.equal(localStorage.getItem('ic-notify'), '0');
  });
  it('applyNotifyPref updates the Notify button label/state', () => {
    applyNotifyPref(true);
    const btn = document.getElementById('notifyBtn');
    assert.ok(btn, '#notifyBtn should exist');
    assert.includes(btn.textContent, 'Notify On');
    assert.ok(btn.classList.contains('on'));
    applyNotifyPref(false);
    assert.includes(btn.textContent, 'Notify Off');
    assert.notOk(btn.classList.contains('on'));
  });
});

/* ═══════════════════════════════════════════ 20. UPDATE PROMPT ═══ */
describe('PWA Update Prompt', () => {
  it('showUpdatePrompt() reveals the update bar', () => {
    const bar = document.getElementById('updateBar');
    bar.classList.remove('show');
    showUpdatePrompt();
    assert.ok(bar.classList.contains('show'));
  });
  it('dismissUpdate() hides the update bar', () => {
    showUpdatePrompt();
    dismissUpdate();
    assert.notOk(document.getElementById('updateBar').classList.contains('show'));
  });
});

/* ═══════════════════════════════════════════ 21. TOPBAR + BOSS MODAL ═══ */
describe('Topbar alliance + boss modal', () => {
  it('topbar reflects the AD alliance name (regression: showed "—")', async () => {
    resetState();
    setAlliance('ad');
    const cell = document.getElementById('ctbAlliance');
    const deadline = Date.now() + 2000; // poll() mirrors it on a 400ms interval
    while (Date.now() < deadline && !/Aldmeri/i.test(cell.textContent || '')) {
      await new Promise(r => setTimeout(r, 100));
    }
    assert.includes(cell.textContent, 'Aldmeri');
    setAlliance('dc');
  });
  it('district name is wired to open the boss modal', () => {
    const name = document.querySelector('#dr0 .dname');
    assert.ok(name, '#dr0 .dname exists');
    assert.equal(name.getAttribute('role'), 'button');
    assert.includes(name.getAttribute('onclick') || '', 'openBossModal');
  });
  it('openBossModal(i) shows both district bosses side by side', () => {
    closeBossModal();
    openBossModal(0); // Memorial — two bosses
    assert.ok(document.getElementById('bossModal').classList.contains('show'));
    assert.equal(Number(document.getElementById('bossModalImages').dataset.count), 2);
    closeBossModal();
  });
});

/* ═══════════════════════════════════════════ 22. ESO PLUS TOGGLE ═══ */
describe('ESO Plus base toggle', () => {
  it('defaults to ESO Plus on (base 1327)', () => {
    resetState();
    assert.ok(esoPlus);
    assert.equal(activeBaseTV(), 1327);
    assert.equal(perKill(), 1327); // x1, solo, 0 districts
  });
  it('turning ESO Plus off uses the 1200 base', () => {
    resetState();
    applyEsoPlus(false);
    assert.equal(activeBaseTV(), 1200);
    assert.equal(perKill(), 1200); // x1, solo, 0 districts
    applyEsoPlus(true);
  });
  it('the ESO Plus bonus scales with multiplier/group/districts', () => {
    resetState();
    stI = 3; grSz = 2; dcHeld.add(0); dcHeld.add(1); // x4, group 2, 2 districts
    const withPlus = perKill();
    applyEsoPlus(false);
    const without = perKill();
    applyEsoPlus(true);
    assert.equal(withPlus, Math.round(1327 * 4 * 1.66 / 2));
    assert.equal(without, Math.round(1200 * 4 * 1.66 / 2));
    assert.greaterThan(withPlus, without);
  });
  it('applyEsoPlus persists the preference + updates the button', () => {
    resetState();
    applyEsoPlus(false);
    assert.equal(localStorage.getItem('ic-eso-plus'), '0');
    const btn = document.getElementById('esoPlusBtn');
    assert.ok(btn, '#esoPlusBtn exists');
    assert.notOk(btn.classList.contains('on'));
    assert.equal(btn.getAttribute('aria-pressed'), 'false');
    applyEsoPlus(true);
    assert.equal(localStorage.getItem('ic-eso-plus'), '1');
    assert.ok(btn.classList.contains('on'));
  });
});

/* ═══════════════════════════════════════════ 23. HELP DISCOVERABILITY ═══ */
describe('Help discoverability', () => {
  it('Help modal surfaces the newer features', () => {
    const t = document.getElementById('helpOverlay').textContent;
    assert.includes(t, 'ESO Plus');
    assert.includes(t, 'Notify');
    assert.includes(t, 'district name');
  });
});

/* ═══════════════════════════════════════════ CLEANUP ═══ */
describe('Cleanup', () => {
  it('Reset state after all tests', () => {
    resetState();
    assert.equal(totalKills, 0);
    assert.equal(dcHeld.size, 0);
  });
});
