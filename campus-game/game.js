// Campus Quest: a tiny Y2K-style top-down walk around the real University of West Georgia campus.
// The map comes from map.js (OpenStreetMap building/road outlines rasterized to a tile grid).
(() => {
  'use strict';
  const C = window.CAMPUS;
  const TS = 16, VW = 320, VH = 240;
  const W = C.w, H = C.h, G = C.rows;
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const FONT = '8px PS2P, monospace';

  // ---------- helpers ----------
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '#' : G[y][x];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const isRoad = (c) => c === 'R' || c === 'r' || c === 'p';

  // ---------- buildings: connected components of B tiles ----------
  const comp = new Int32Array(W * H).fill(-1);
  const comps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (G[y][x] !== 'B' || comp[y * W + x] >= 0) continue;
    const id = comps.length, c = { id, tiles: [], names: [], target: null, minx: x, maxx: x, miny: y, maxy: y };
    const st = [[x, y]]; comp[y * W + x] = id;
    while (st.length) {
      const [a, b] = st.pop(); c.tiles.push([a, b]);
      c.minx = Math.min(c.minx, a); c.maxx = Math.max(c.maxx, a); c.miny = Math.min(c.miny, b); c.maxy = Math.max(c.maxy, b);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const u = a + dx, v = b + dy;
        if (at(u, v) === 'B' && comp[v * W + u] < 0) { comp[v * W + u] = id; st.push([u, v]); }
      }
    }
    comps.push(c);
  }
  const areas = [];
  for (const L of C.labels) {
    if (L.area) { areas.push(L); continue; }
    let best = null;
    for (let r = 0; r < 5 && !best; r++) {
      for (let yy = Math.floor(L.y) - r; yy <= Math.floor(L.y) + r; yy++)
        for (let xx = Math.floor(L.x) - r; xx <= Math.floor(L.x) + r; xx++) {
          if (at(xx, yy) !== 'B') continue;
          const d = (xx + .5 - L.x) ** 2 + (yy + .5 - L.y) ** 2;
          if (!best || d < best.d) best = { d, id: comp[yy * W + xx] };
        }
    }
    if (!best) continue;
    const c = comps[best.id];
    c.names.push(L.name);
    if (L.target) c.target = L.target;
  }
  for (const c of comps) c.name = c.names.join(' & ');

  const TARGETS = {
    gunn: { label: 'GUNN HALL', pages: [
      ['GUNN HALL', 'The Academy dorm. Home sweet home.'],
      ['GUNN HALL', 'Don\'t forget to sign the book.'] ] },
    honors: { label: 'HONORS HOUSE', pages: [
      ['THE HONORS HOUSE', 'You\'re five minutes late to German Horror Film and Literature. Come in and take a seat.'] ] },
    z: { label: 'THE Z', pages: [
      ['THE Z (Z-6)', 'Welcome to Thursday night dinner at the Z.'] ] },
  };
  const ORDER = ['gunn', 'honors', 'z'];
  const targetComp = {};
  for (const c of comps) if (c.target) targetComp[c.target] = c;

  // ---------- palettes ----------
  const ROOFS = ['#8e8a84', '#9a8f7e', '#7d8590', '#a07a5a', '#857565', '#93877a', '#6f7884'];
  const TARGET_ROOF = { gunn: '#3fa7a0', honors: '#ff9a62', z: '#e6c34f' };
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  for (const c of comps) {
    c.small = c.tiles.length <= 4;
    c.roof = c.target ? TARGET_ROOF[c.target] : c.small ? '#6b4a3a' : ROOFS[Math.floor(hash(c.minx, c.miny, 7) * ROOFS.length)];
    // door: the bottom-edge tile closest to the building's centre line
    const cx = (c.minx + c.maxx) / 2;
    let door = null;
    for (const [x, y] of c.tiles) if (at(x, y + 1) !== 'B') {
      const s = Math.abs(x - cx) * 2 - y;
      if (!door || s < door.s) door = { x, y, s };
    }
    c.door = c.tiles.length >= 3 || c.target ? door : null;
  }

  // decorative trees on open lawns (they block, like real trees)
  const deco = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const c = G[y][x];
    if ((c === '.' || c === 'g') && hash(x, y, 3) < (c === 'g' ? 0.05 : 0.035)) {
      let ok = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = at(x + dx, y + dy);
        if (!(n === '.' || n === 'g' || n === 't')) ok = false;
      }
      if (ok) deco[y * W + x] = 1;
    }
  }
  const blocked = (tx, ty) => {
    const c = at(tx, ty);
    return c === '#' || c === 'B' || c === 't' || c === '~' || deco[ty * W + tx] === 1;
  };

  // ---------- pre-render the whole campus ----------
  const world = document.createElement('canvas');
  world.width = W * TS; world.height = H * TS;
  const g = world.getContext('2d');
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  function speckle(px, py, x, y, n, cols, seed) {
    for (let i = 0; i < n; i++) {
      const sx = Math.floor(hash(x, y, seed + i) * 15), sy = Math.floor(hash(x, y, seed + i + 50) * 15);
      R(cols[i % cols.length], px + sx, py + sy, i % 3 === 0 ? 2 : 1, 1);
    }
  }
  function tree(px, py, x, y) {
    const j = Math.floor(hash(x, y, 11) * 3) - 1;
    R('#5a3b22', px + 7, py + 10, 2, 5);
    const cx = px + 8 + j, cy = py + 7;
    for (let dy = -7; dy <= 6; dy++) for (let dx = -7; dx <= 7; dx++) {
      const d = dx * dx + dy * dy * 1.15;
      if (d > 49) continue;
      let col = '#3f7d33';
      if (d > 36) col = '#2b5a24';
      else if (dx + dy < -5 && d < 20) col = '#5fa548';
      else if (hash(x * 16 + dx, y * 16 + dy, 5) < 0.12) col = '#356d2b';
      R(col, cx + dx, cy + dy, 1, 1);
    }
  }
  function drawTile(x, y) {
    const c = G[y][x], px = x * TS, py = y * TS;
    switch (c) {
      case '.': R('#5fae4c', px, py, TS, TS); speckle(px, py, x, y, 7, ['#4f9a3f', '#74c25e', '#56a344'], 1);
        if (hash(x, y, 9) < 0.04) { R(['#fff6d6', '#ffd54a', '#ff9ac8'][Math.floor(hash(x, y, 10) * 3)], px + 6, py + 6, 2, 2); }
        break;
      case 'g': R('#6cc457', px, py, TS, TS); speckle(px, py, x, y, 6, ['#5bb247', '#86d46d'], 2);
        if (hash(x, y, 9) < 0.08) { R(['#ffffff', '#ffd54a', '#ff9ac8', '#ff9a62'][Math.floor(hash(x, y, 10) * 4)], px + 4 + Math.floor(hash(x, y, 12) * 8), py + 5, 2, 2); }
        break;
      case 'f': R(((x >> 1) & 1) ? '#4fa83f' : '#5cb84b', px, py, TS, TS);
        if (at(x - 1, y) !== 'f') R('#f4f4ee', px + 1, py, 1, TS);
        if (at(x + 1, y) !== 'f') R('#f4f4ee', px + 14, py, 1, TS);
        if (at(x, y - 1) !== 'f') R('#f4f4ee', px, py + 1, TS, 1);
        if (at(x, y + 1) !== 'f') R('#f4f4ee', px, py + 14, TS, 1);
        break;
      case 't': R('#4a8f3c', px, py, TS, TS); tree(px, py, x, y); break;
      case '~': R('#3b7fd6', px, py, TS, TS);
        for (let i = 0; i < 3; i++) R('#8cc2ff', px + Math.floor(hash(x, y, i) * 11), py + 3 + i * 5, 4, 1);
        break;
      case 'R': case 'r': case 'p': {
        R(c === 'R' ? '#4f5058' : c === 'r' ? '#5c5d65' : '#66676f', px, py, TS, TS);
        speckle(px, py, x, y, 5, ['#6e6f78', '#474850'], 4);
        if (c === 'p' && at(x, y - 1) === 'p') R('#e8e8e2', px + 1, py + 2, 1, 7);
        const kerb = '#bdb8ab';
        if (!isRoad(at(x - 1, y))) R(kerb, px, py, 1, TS);
        if (!isRoad(at(x + 1, y))) R(kerb, px + 15, py, 1, TS);
        if (!isRoad(at(x, y - 1))) R(kerb, px, py, TS, 1);
        if (!isRoad(at(x, y + 1))) R(kerb, px, py + 15, TS, 1);
        break;
      }
      case 'w': R('#dcd2b8', px, py, TS, TS);
        R('#cbbfa4', px, py, TS, 1); R('#cbbfa4', px, py, 1, TS);
        R('#cbbfa4', px + 8, py + 8, 8, 1); R('#cbbfa4', px + 8, py, 1, 8);
        speckle(px, py, x, y, 3, ['#c4b99f', '#e8dfc8'], 6);
        break;
      case 'B': drawBuilding(x, y, px, py); break;
    }
    if (deco[y * W + x]) tree(px, py, x, y);
  }
  function drawBuilding(x, y, px, py) {
    const c = comps[comp[y * W + x]];
    const roof = c.roof, dark = shade(roof, 0.72), light = shade(roof, 1.15);
    const bottom = at(x, y + 1) !== 'B';
    R(roof, px, py, TS, TS);
    for (let yy = 3; yy < TS; yy += 4) R(shade(roof, c.small ? 0.82 : 0.92), px, py + yy, TS, 1);
    if (c.small) for (let yy = 1; yy < TS; yy += 4) R(shade(roof, 0.88), px + ((yy >> 2) & 1 ? 4 : 10), py + yy, 1, 3);
    if (at(x, y - 1) !== 'B') { R(light, px, py, TS, 1); R(dark, px, py + 1, TS, 1); }
    if (at(x - 1, y) !== 'B') R(dark, px, py, 2, TS);
    if (at(x + 1, y) !== 'B') R(dark, px + 14, py, 2, TS);
    if (c.target && at(x, y - 1) !== 'B' && x % 3 === 0) R('#ffffff', px + 7, py + 3, 2, 2);
    if (!bottom) return;
    // front wall with windows
    const brick = c.small ? '#efe6d4' : '#b0603f', mortar = c.small ? '#d6cab3' : '#93492f';
    R(dark, px, py + 3, TS, 2);
    R(brick, px, py + 5, TS, 11);
    for (let yy = 7; yy < 16; yy += 3) R(mortar, px, py + yy, TS, 1);
    if (at(x - 1, y) !== 'B') R(shade(brick, 0.8), px, py + 5, 1, 11);
    if (at(x + 1, y) !== 'B') R(shade(brick, 0.8), px + 15, py + 5, 1, 11);
    const isDoor = c.door && c.door.x === x && c.door.y === y;
    if (isDoor) {
      R('#f4f1ea', px + 3, py + 5, 10, 2);
      R('#3a2416', px + 5, py + 8, 6, 8); R('#5a3a24', px + 6, py + 9, 4, 7); R('#ffd54a', px + 9, py + 12, 1, 1);
      if (!c.small) { R('#f4f1ea', px + 3, py + 7, 1, 9); R('#f4f1ea', px + 12, py + 7, 1, 9); }
    } else {
      for (const wx of [3, 10]) {
        R('#2b3d5c', px + wx - 1, py + 7, 5, 6);
        const lit = hash(x, y, wx) < 0.3;
        R(lit ? '#ffe58a' : '#8fd3ff', px + wx, py + 8, 3, 4);
        R('#ffffff', px + wx, py + 8, 1, 1);
      }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawTile(x, y);
  // soft shadows below and right of buildings
  g.fillStyle = 'rgba(20,10,30,0.22)';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (G[y][x] === 'B') continue;
    if (at(x, y - 1) === 'B') g.fillRect(x * TS, y * TS, TS, 4);
    if (at(x - 1, y) === 'B') g.fillRect(x * TS, y * TS + (at(x, y - 1) === 'B' ? 4 : 0), 3, TS - (at(x, y - 1) === 'B' ? 4 : 0));
  }

  // ---------- sprites ----------
  const FR = {
    down: [
      '................', '.....HHHHHH.....', '....HHHHHHHH....', '....HSSSSSSH....', '....SSESSESS....', '....SSSSSSSS....',
      '.....SSSSSS.....', '....TTTTTTTT....', '...STTTTTTTTS...', '...STTTTTTTTS...', '....TTTTTTTT....', '....JJJJJJJJ....',
      '....JJJ..JJJ....', '....JJJ..JJJ....', '....KKK..KKK....', '................'],
    up: [
      '................', '.....HHHHHH.....', '....HHHHHHHH....', '....HHHHHHHH....', '....HHHHHHHH....', '....SHHHHHHS....',
      '.....SSSSSS.....', '....TPPPPPPT....', '...STPPPPPPTS...', '...STPPPPPPTS...', '....TPPPPPPT....', '....JJJJJJJJ....',
      '....JJJ..JJJ....', '....JJJ..JJJ....', '....KKK..KKK....', '................'],
    right: [
      '................', '......HHHHH.....', '.....HHHHHHH....', '.....HHHSSSS....', '.....HHSSSES....', '.....HSSSSSSS...',
      '......SSSSS.....', '.....PTTTTT.....', '.....PTTTTT.....', '.....PTTSTT.....', '.....PTTSTT.....', '......JJJJ......',
      '......JJJJ......', '......JJJJ......', '......KKKKK.....', '................'],
  };
  function walkRows(dir, rows, step) {
    const r = rows.slice();
    if (dir === 'right') {
      if (step) { r[12] = '.....JJ..JJ.....'; r[13] = '....JJ....JJ....'; r[14] = '...KK.....KKK...'; }
    } else if (step === 1) { r[13] = '....KKK..JJJ....'; r[14] = '.........KKK....'; }
    else if (step === 2) { r[13] = '....JJJ..KKK....'; r[14] = '....KKK.........'; }
    return r;
  }
  function makeSprite(rows, pal, flip) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x2 = c.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = rows[y][flip ? 15 - x : x];
      if (ch !== '.') { x2.fillStyle = pal[ch]; x2.fillRect(x, y, 1, 1); }
    }
    const d = x2.getImageData(0, 0, 16, 16), o = x2.createImageData(16, 16);
    const A = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && d.data[(y * 16 + x) * 4 + 3] > 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (A(x, y)) continue;
      if (A(x - 1, y) || A(x + 1, y) || A(x, y - 1) || A(x, y + 1)) { const i = (y * 16 + x) * 4; o.data[i] = 26; o.data[i + 1] = 20; o.data[i + 2] = 32; o.data[i + 3] = 255; }
    }
    const c2 = document.createElement('canvas'); c2.width = c2.height = 16;
    const y2 = c2.getContext('2d'); y2.putImageData(o, 0, 0); y2.drawImage(c, 0, 0);
    return c2;
  }
  function spriteSet(pal) {
    const s = {};
    for (const dir of ['down', 'up']) s[dir] = [0, 1, 2].map((st) => makeSprite(walkRows(dir, FR[dir], st), pal));
    s.right = [0, 1].map((st) => makeSprite(walkRows('right', FR.right, st), pal));
    s.left = [0, 1].map((st) => makeSprite(walkRows('right', FR.right, st), pal, true));
    return s;
  }
  const PLAYER = spriteSet({ H: '#3a2416', S: '#f1c09a', E: '#1b1b1a', T: '#2bb3a3', P: '#ff7a3d', J: '#3d5fa8', K: '#f2f2f2' });
  const NPC_PALS = [
    { H: '#e8c65a', S: '#f6cfae', E: '#1b1b1a', T: '#c83e7a', P: '#7a4fd1', J: '#2f3f6e', K: '#222222' },
    { H: '#1b1310', S: '#8a5a3c', E: '#1b1b1a', T: '#f2f2f2', P: '#e04848', J: '#5a6a8a', K: '#f2f2f2' },
    { H: '#b84a1e', S: '#f1c09a', E: '#1b1b1a', T: '#4c7be0', P: '#ffd54a', J: '#2b2b33', K: '#9a6a3a' },
    { H: '#2a1a12', S: '#c68a63', E: '#1b1b1a', T: '#f39c2a', P: '#2bb3a3', J: '#3d5fa8', K: '#f2f2f2' },
    { H: '#5a3a24', S: '#f6cfae', E: '#1b1b1a', T: '#7ac943', P: '#c83e7a', J: '#6b6f7a', K: '#222222' },
    { H: '#111111', S: '#e2a47e', E: '#1b1b1a', T: '#9b59d0', P: '#ff9a62', J: '#2f3f6e', K: '#f2f2f2' },
  ];
  const NPC_SETS = NPC_PALS.map(spriteSet);
  const PEACH = makeSprite([
    '................', '.......LL.......', '......LL........', '....OOOOOOO.....', '...OPPPPPPPO....', '..OPPPPPPPYYO...',
    '..OPPPPPPPYYO...', '..OPPPPPPYYYO...', '..OPPPPPYYYYO...', '...OPPPYYYYO....', '....OOOOOOO.....', '................',
    '................', '................', '................', '................'],
    { L: '#4fae4f', O: '#c2552a', P: '#ff9a62', Y: '#ffc39a' });

  // ---------- world state ----------
  function nearestWalk(tx, ty) {
    for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (at(x, y) === 'w' && !blocked(x, y) && !blocked(x - 1, y) && !blocked(x + 1, y)) return [x, y];
    }
    return [tx, ty];
  }
  const [sx, sy] = nearestWalk(152, 41); // the Quad
  const player = { x: sx * TS + 8, y: sy * TS + 12, dir: 'down', t: 0, moving: false };
  const found = {};
  const LINES = [
    'brb, Dawson\'s Creek is on.', 'Did you burn me that mix CD yet?', 'My pager keeps going off. 143!',
    'Meet at the Z at six?', 'Somebody picked up the phone and killed my dial-up!', 'Y2K is gonna crash everything, I\'m telling you.',
    'Napster says 3 hours left on this song.', 'Has anyone seen my Discman?', 'Away message: at the library, IM me.',
    'Is it Thursday? Pizza night?', 'I have SO much reading for tomorrow.', 'Wanna walk to the Quad?',
  ];
  const npcs = [];
  for (let i = 0; i < 14; i++) {
    let x, y, tries = 0;
    do { x = 30 + Math.floor(Math.random() * 160); y = 22 + Math.floor(Math.random() * 80); tries++; }
    while ((at(x, y) !== 'w' || blocked(x, y)) && tries < 500);
    npcs.push({ x: x * TS + 8, y: y * TS + 12, dir: 'down', t: Math.random(), moving: false, wait: Math.random() * 2,
      set: NPC_SETS[i % NPC_SETS.length], line: LINES[i % LINES.length] });
  }

  // ---------- input ----------
  const keys = {};
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'a', Enter: 'a', KeyZ: 'a', KeyE: 'a', KeyM: 'map', Escape: 'esc', ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run' };
  addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault();
    if (!keys[k]) press(k);
    keys[k] = true;
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  cvs.addEventListener('pointerdown', () => { cvs.focus(); if (state === 'title') press('a'); });
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
  for (const b of document.querySelectorAll('#touch button')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (!keys[k]) press(k); keys[k] = true; });
    const up = () => { keys[k] = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  document.getElementById('close').addEventListener('click', closeGame);
  function closeGame() {
    if (window.parent !== window) { window.parent.postMessage({ type: 'campus-game:close' }, '*'); return; }
    if (history.length > 1) history.back(); else location.href = '../';
  }

  // ---------- sound ----------
  let ac = null;
  function beep(notes, dur = 0.09, type = 'square', vol = 0.05) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      let t = ac.currentTime;
      for (const f of notes) {
        const o = ac.createOscillator(), gn = ac.createGain();
        o.type = type; o.frequency.value = f; gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + dur); t += dur * 0.9;
      }
    } catch (e) { /* audio is optional */ }
  }

  // ---------- game state ----------
  let state = 'title', showMap = false, dialog = null, win = null, clock = 0, hintT = 9;
  function say(pages, onDone) { dialog = { pages, i: 0, shown: 0, onDone }; beep([880], 0.04); }
  function press(k) {
    if (state === 'title') { if (k === 'a') { state = 'play'; beep([523, 659, 784]); say([['CAMPUS QUEST', 'Welcome back to West Georgia! Find the three Academy hangouts: Gunn Hall, the Honors House, and The Z.'], ['HOW TO PLAY', 'Arrows or WASD to walk, hold Shift to run. A/Space talks and reads signs. M opens the campus map.']]); } else if (k === 'esc') closeGame(); return; }
    if (k === 'esc') { if (showMap) showMap = false; else if (dialog) dialog = null; else closeGame(); return; }
    if (win && k === 'a') { win = null; return; }
    if (k === 'map') { showMap = !showMap; beep([showMap ? 660 : 440], 0.05); return; }
    if (showMap) { if (k === 'a') showMap = false; return; }
    if (dialog && k === 'a') {
      const p = dialog.pages[dialog.i];
      if (dialog.shown < p[1].length) { dialog.shown = p[1].length; return; }
      dialog.i++; dialog.shown = 0;
      if (dialog.i >= dialog.pages.length) { const cb = dialog.onDone; dialog = null; if (cb) cb(); } else beep([880], 0.03);
      return;
    }
    if (k === 'a') interact();
  }
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function interact() {
    const [dx, dy] = DIRV[player.dir];
    const fx = player.x + dx * 12, fy = player.y - 3 + dy * 12;
    for (const n of npcs) if (Math.abs(n.x - fx) < 12 && Math.abs(n.y - fy) < 12) {
      n.dir = player.dir === 'up' ? 'down' : player.dir === 'down' ? 'up' : player.dir === 'left' ? 'right' : 'left';
      n.wait = 3; say([['STUDENT', n.line]]); return;
    }
    const tx = Math.floor(fx / TS), ty = Math.floor(fy / TS);
    if (at(tx, ty) === 'B') {
      const c = comps[comp[ty * W + tx]];
      if (c.target) { say(TARGETS[c.target].pages); return; }
      say([[c.name ? c.name.toUpperCase() : 'BUILDING', c.name ? 'You peek in the window. Looks like class is in session.' : 'Nobody you know lives here.']]);
    }
  }
  function touching() {
    // buildings within a few px of the player's feet
    const res = new Set();
    for (const [ox, oy] of [[-8, -4], [8, -4], [0, -10], [0, 5], [-8, 2], [8, 2]]) {
      const tx = Math.floor((player.x + ox) / TS), ty = Math.floor((player.y + oy) / TS);
      if (at(tx, ty) === 'B') res.add(comps[comp[ty * W + tx]]);
    }
    return [...res];
  }
  function nameHere() {
    const t = touching().find((c) => c.name);
    if (t) return t.target ? TARGETS[t.target].label : t.name;
    const px = player.x / TS, py = player.y / TS;
    for (const a of areas) if ((a.x - px) ** 2 + (a.y - py) ** 2 < 30) return a.name;
    return null;
  }
  function checkDiscover() {
    for (const c of touching()) {
      if (!c.target || found[c.target]) continue;
      found[c.target] = true;
      const n = Object.keys(found).length;
      beep([659, 784, 988, 1319], 0.1, 'square', 0.06);
      const pages = TARGETS[c.target].pages.slice();
      pages.push(['FOUND ' + n + '/3', n < 3 ? 'Nice! ' + (3 - n) + ' to go. Press M for the map.' : 'That\'s all three!']);
      say(pages, n === 3 ? () => { win = { t: 0, bits: confetti() }; beep([523, 659, 784, 1047, 784, 1047], 0.12, 'square', 0.06); } : null);
      return;
    }
  }
  function confetti() {
    const a = [];
    for (let i = 0; i < 40; i++) a.push({ x: Math.random() * VW, y: -Math.random() * VH, v: 20 + Math.random() * 40, s: Math.random() * 6.28, c: ['#ff9a62', '#2bb3a3', '#ffd54a', '#c83e7a', '#ffffff'][i % 5], p: i % 6 === 0 });
    return a;
  }

  function move(e, dx, dy) {
    const hw = 5;
    const free = (x, y) => !blocked(Math.floor((x - hw) / TS), Math.floor((y - 4) / TS)) && !blocked(Math.floor((x + hw) / TS), Math.floor((y - 4) / TS))
      && !blocked(Math.floor((x - hw) / TS), Math.floor((y + 1) / TS)) && !blocked(Math.floor((x + hw) / TS), Math.floor((y + 1) / TS));
    let moved = false;
    if (dx && free(e.x + dx, e.y)) { e.x += dx; moved = true; }
    if (dy && free(e.x, e.y + dy)) { e.y += dy; moved = true; }
    return moved;
  }

  function update(dt) {
    clock += dt;
    if (state !== 'play') return;
    if (hintT > 0) hintT -= dt;
    if (win) { win.t += dt; for (const b of win.bits) { b.y += b.v * dt; b.s += dt * 3; if (b.y > VH + 10) { b.y = -10; b.x = Math.random() * VW; } } }
    if (!dialog && !showMap) {
      let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      const sp = (keys.run ? 150 : 85) * dt;
      if (dx || dy) {
        const len = Math.hypot(dx, dy); dx = dx / len * sp; dy = dy / len * sp;
        player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        player.moving = move(player, dx, dy);
        if (player.moving) player.t += dt * (keys.run ? 1.7 : 1);
        checkDiscover();
      } else player.moving = false;
    } else player.moving = false;
    if (dialog) dialog.shown = Math.min(dialog.pages[dialog.i][1].length, dialog.shown + dt * 45);
    for (const n of npcs) {
      if (n.wait > 0) { n.wait -= dt; n.moving = false; continue; }
      const [vx, vy] = DIRV[n.dir];
      const nx = n.x + vx * 9, ny = n.y - 2 + vy * 9;
      const ahead = at(Math.floor(nx / TS), Math.floor(ny / TS));
      const nearP = Math.abs(nx - player.x) < 12 && Math.abs(ny - player.y) < 12;
      if (ahead !== 'w' || nearP || Math.random() < dt * 0.25) {
        n.dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
        n.wait = Math.random() < 0.4 ? 0.5 + Math.random() * 2 : 0; n.moving = false; continue;
      }
      n.moving = move(n, vx * 32 * dt, vy * 32 * dt);
      if (n.moving) n.t += dt;
    }
  }

  // ---------- drawing ----------
  function text(s, x, y, col = '#fff', align = 'left', shadow = '#1a1420') {
    ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = align;
    if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, x + 1, y + 1); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  function wrap(s, max) {
    const out = []; let line = '';
    for (const w of s.split(' ')) {
      if ((line + ' ' + w).trim().length > max) { out.push(line.trim()); line = w; } else line += ' ' + w;
    }
    if (line.trim()) out.push(line.trim());
    return out;
  }
  function frameOf(e, set) {
    const seq = e.dir === 'left' || e.dir === 'right' ? [1, 0, 1, 0] : [1, 0, 2, 0];
    return set[e.dir][e.moving ? seq[Math.floor(e.t / 0.14) % 4] : 0];
  }
  function win98(x, y, w, h, title) {
    ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#f4f2ec'; ctx.fillRect(x, y, w, h);
    const gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#1d3fa8'); gr.addColorStop(1, '#5f9bff');
    ctx.fillStyle = gr; ctx.fillRect(x, y, w, 11);
    if (title) text(title, x + 3, y + 2, '#fff', 'left', null);
  }
  function drawWorld() {
    const camX = clamp(Math.round(player.x - VW / 2), 0, W * TS - VW), camY = clamp(Math.round(player.y - 8 - VH / 2), 0, H * TS - VH);
    ctx.drawImage(world, camX, camY, VW, VH, 0, 0, VW, VH);
    const ents = npcs.filter((n) => n.x > camX - 16 && n.x < camX + VW + 16 && n.y > camY - 16 && n.y < camY + VH + 24)
      .map((n) => ({ e: n, s: frameOf(n, n.set) }));
    ents.push({ e: player, s: frameOf(player, PLAYER) });
    ents.sort((a, b) => a.e.y - b.e.y);
    for (const { e, s } of ents) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.round(e.x - camX) - 5, Math.round(e.y - camY) - 1, 10, 3);
      ctx.drawImage(s, Math.round(e.x - camX) - 8, Math.round(e.y - camY) - 15);
    }
  }
  function drawHUD() {
    const n = Object.keys(found).length;
    win98(6, 6, 112, 46, 'Quest.txt ' + n + '/3');
    ORDER.forEach((k, i) => {
      const y = 21 + i * 10, done = found[k];
      ctx.fillStyle = '#1a1420'; ctx.fillRect(10, y, 7, 7); ctx.fillStyle = '#fff'; ctx.fillRect(11, y + 1, 5, 5);
      if (done) { ctx.fillStyle = '#1f9e4a'; ctx.fillRect(12, y + 3, 1, 2); ctx.fillRect(13, y + 4, 1, 2); ctx.fillRect(14, y + 2, 1, 3); ctx.fillRect(15, y + 1, 1, 2); }
      text(TARGETS[k].label, 21, y, done ? '#8a8f99' : '#1a1420', 'left', null);
      if (done) { ctx.fillStyle = '#8a8f99'; ctx.fillRect(21, y + 3, TARGETS[k].label.length * 8, 1); }
    });
    const nm = !dialog && !showMap && nameHere();
    if (nm) {
      const w = Math.min(VW - 16, nm.length * 8 + 14), x = (VW - w) / 2;
      ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 1, VH - 25, w + 2, 18);
      ctx.fillStyle = '#ff9a62'; ctx.fillRect(x, VH - 24, w, 16);
      ctx.fillStyle = '#ffc39a'; ctx.fillRect(x, VH - 24, w, 2);
      text(nm.length * 8 > w - 14 ? nm.slice(0, Math.floor((w - 14) / 8) - 1) + '…' : nm, VW / 2, VH - 20, '#3b1206', 'center', null);
    }
    if (hintT > 0 && !dialog) text('M: MAP   A: TALK', VW - 6, 8, Math.floor(clock * 2) % 2 ? '#fff' : '#ffd54a', 'right');
  }
  function drawDialog() {
    if (!dialog) return;
    const [title, body] = dialog.pages[dialog.i];
    const x = 8, y = VH - 66, w = VW - 16, h = 58;
    ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffd9bf'; ctx.fillRect(x, y + h - 3, w, 3);
    const tw = title.length * 8 + 10;
    ctx.fillStyle = '#1a1420'; ctx.fillRect(x + 6, y - 9, tw + 2, 12);
    ctx.fillStyle = '#ff7a3d'; ctx.fillRect(x + 7, y - 8, tw, 10);
    text(title, x + 12, y - 7, '#fff', 'left', null);
    const lines = wrap(body.slice(0, Math.floor(dialog.shown)), 36);
    lines.slice(0, 4).forEach((l, i) => text(l, x + 8, y + 8 + i * 11, '#1a1420', 'left', null));
    if (dialog.shown >= body.length && Math.floor(clock * 3) % 2) { ctx.fillStyle = '#ff7a3d'; ctx.fillRect(x + w - 14, y + h - 12, 6, 2); ctx.fillRect(x + w - 13, y + h - 10, 4, 2); ctx.fillRect(x + w - 12, y + h - 8, 2, 2); }
  }
  // minimap, 1.5px per tile
  const MS = 1.5, MW = Math.floor(W * MS), MH = Math.floor(H * MS);
  const mini = document.createElement('canvas'); mini.width = MW; mini.height = MH;
  (() => {
    const m = mini.getContext('2d'), img = m.createImageData(MW, MH);
    const COL = { '.': [95, 174, 76], g: [108, 196, 87], f: [79, 168, 63], t: [47, 98, 40], '~': [59, 127, 214], R: [70, 71, 79], r: [92, 93, 101], p: [110, 111, 119], w: [220, 210, 184], B: [176, 96, 63] };
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const tx = Math.floor(x / MS), ty = Math.floor(y / MS), ch = G[ty][tx];
      let c = COL[ch] || [0, 0, 0];
      if (ch === 'B') { const cc = comps[comp[ty * W + tx]]; if (cc.target) c = [255, 154, 98]; }
      const i = (y * MW + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    m.putImageData(img, 0, 0);
  })();
  function drawMap() {
    if (!showMap) return;
    ctx.fillStyle = 'rgba(18,9,31,0.85)'; ctx.fillRect(0, 0, VW, VH);
    const x0 = Math.floor((VW - MW) / 2), y0 = 30;
    win98(x0 - 4, y0 - 17, MW + 8, MH + 21, 'CampusMap.bmp - UWG Carrollton');
    ctx.drawImage(mini, x0, y0);
    ORDER.forEach((k) => {
      const c = targetComp[k]; if (!c) return;
      const mx = x0 + ((c.minx + c.maxx) / 2 + 0.5) * MS, my = y0 + ((c.miny + c.maxy) / 2 + 0.5) * MS;
      const lab = { gunn: 'GUNN', honors: 'HONORS', z: 'THE Z' }[k];
      ctx.fillStyle = '#1a1420'; ctx.fillRect(mx - 3, my - 3, 6, 6);
      ctx.fillStyle = found[k] ? '#1f9e4a' : (Math.floor(clock * 3) % 2 ? '#ff9a62' : '#ffd54a'); ctx.fillRect(mx - 2, my - 2, 4, 4);
      text(lab, mx + 5, my - 4, found[k] ? '#b8f5c8' : '#fff');
    });
    const px = x0 + player.x / TS * MS, py = y0 + player.y / TS * MS;
    ctx.fillStyle = '#1a1420'; ctx.fillRect(px - 3, py - 3, 6, 6);
    ctx.fillStyle = Math.floor(clock * 4) % 2 ? '#ffffff' : '#2bb3a3'; ctx.fillRect(px - 2, py - 2, 4, 4);
    text('YOU', px + 4, py + 2, '#fff');
    text('N', x0 + MW - 10, y0 + 4, '#fff'); ctx.fillStyle = '#fff'; ctx.fillRect(x0 + MW - 8, y0 + 13, 2, 6);
    text('Map data (c) OpenStreetMap', VW / 2, y0 + MH + 8, '#c9c3d6', 'center', null);
  }
  function drawTitle() {
    const gr = ctx.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, '#1b0b3a'); gr.addColorStop(0.55, '#7a2f7a'); gr.addColorStop(0.8, '#ff7a3d'); gr.addColorStop(1, '#ffd08a');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 60; i++) { const x = hash(i, 1) * VW, y = hash(i, 2) * VH * 0.5; if ((Math.floor(clock * 2 + i) % 7) !== 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x | 0, y | 0, 1, 1); } }
    // sun + grid horizon
    ctx.fillStyle = '#ffcf7a'; for (let r = 0; r < 30; r++) { const w = Math.sqrt(900 - r * r) * 2; if (r % 6 < 4) ctx.fillRect(VW / 2 - w / 2, 150 - r, w, 1); }
    ctx.fillStyle = '#2a1040'; ctx.fillRect(0, 150, VW, VH - 150);
    ctx.fillStyle = '#ff5fa2';
    for (let i = 0; i < 8; i++) { const y = 150 + Math.pow(i / 8, 2) * 90 + ((clock * 8) % 10) * (i / 8); ctx.fillRect(0, y | 0, VW, 1); }
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.strokeStyle = '#ff5fa2'; ctx.moveTo(VW / 2 + i * 6, 150); ctx.lineTo(VW / 2 + i * 60, VH); ctx.stroke(); }
    ctx.save(); ctx.font = '16px PS2P, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const [s, y] of [['CAMPUS', 40], ['QUEST', 62]]) {
      ctx.fillStyle = '#1a1420'; ctx.fillText(s, VW / 2 + 2, y + 2);
      const tg = ctx.createLinearGradient(0, y, 0, y + 16); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, '#bfe9ff'); tg.addColorStop(0.55, '#5f8fd8'); tg.addColorStop(1, '#e8f6ff');
      ctx.fillStyle = tg; ctx.fillText(s, VW / 2, y);
    }
    ctx.restore();
    ctx.save(); ctx.translate(VW / 2 - 16, 92 + Math.sin(clock * 3) * 3); ctx.scale(2, 2); ctx.drawImage(PEACH, 0, 0); ctx.restore();
    text('UNIVERSITY OF WEST GEORGIA', VW / 2, 128, '#ffd9bf', 'center');
    if (Math.floor(clock * 2) % 2) text('PRESS START', VW / 2, 178, '#fff', 'center');
    text('ADVANCED ACADEMY EDITION', VW / 2, 222, '#ff9ac8', 'center');
  }
  function drawWin() {
    if (!win) return;
    ctx.fillStyle = 'rgba(18,9,31,0.55)'; ctx.fillRect(0, 0, VW, VH);
    for (const b of win.bits) {
      if (b.p) ctx.drawImage(PEACH, b.x | 0, b.y | 0);
      else { ctx.fillStyle = b.c; ctx.fillRect(b.x | 0, b.y | 0, 3, Math.abs(Math.sin(b.s)) * 4 + 1); }
    }
    win98(40, 70, 240, 92, 'Congrats.exe');
    text('YOU FOUND ALL 3!', VW / 2, 92, '#ff7a3d', 'center', null);
    text('Gunn Hall. The Honors', VW / 2, 110, '#1a1420', 'center', null);
    text('House. The Z.', VW / 2, 121, '#1a1420', 'center', null);
    text('Welcome back, Academy.', VW / 2, 136, '#1a1420', 'center', null);
    if (Math.floor(clock * 2) % 2) text('A: KEEP EXPLORING', VW / 2, 150, '#1d3fa8', 'center', null);
  }

  // ---------- canvas scaling ----------
  function fit() {
    const maxW = innerWidth - 28, maxH = innerHeight - 28 - (document.body.classList.contains('touch') ? 170 : 0);
    let s = Math.min(maxW / VW, Math.max(maxH, 160) / VH);
    s = s >= 2 ? Math.floor(s) : Math.max(1, s);
    cvs.style.width = Math.floor(VW * s) + 'px'; cvs.style.height = Math.floor(VH * s) + 'px';
    if (document.body.classList.contains('touch')) document.body.style.alignItems = 'flex-start', document.getElementById('frame').style.marginTop = '24px';
  }
  addEventListener('resize', fit); fit();

  window.__campusQuest = { player, found, press, targetComp, get state() { return state; }, get dialog() { return dialog; } }; // handy for testing

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt);
    if (state === 'title') drawTitle();
    else { drawWorld(); drawHUD(); drawDialog(); drawMap(); drawWin(); }
    requestAnimationFrame(loop);
  }
  (document.fonts ? document.fonts.load(FONT) : Promise.resolve()).catch(() => {}).then(() => { cvs.focus(); requestAnimationFrame(loop); });
})();
