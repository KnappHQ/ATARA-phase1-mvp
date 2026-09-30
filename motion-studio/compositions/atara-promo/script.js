'use strict';
/* ATARA launch film · 1920x1080 · 30 fps · 46.5 s. Every frame is a pure function of t (see seek). */

const W = 1920, H = 1080, DUR = 46.5, BPM = 100, BEAT = 60 / BPM, BEAT0 = 3.6;
// Story beats shared with make_audio.py — keep the two files in sync.
const T = {
  tap: 7.4, ok: 7.75, send: 16.6, coin0: 16.75, recv: 18.45,
  orb0: 25.4, orb1: 29.6, scan: 37.2, sign: 38.1, final: 41.0,
};
const SC = { s0: [0, 4.0], s1: [3.2, 13.7], s2: [12.8, 22.8], s3: [21.9, 31.9], s4: [31.0, 41.5], s5: [40.6, DUR] };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const pr = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const E = {
  out: (x) => 1 - (1 - x) ** 3,
  out5: (x) => 1 - (1 - x) ** 5,
  in: (x) => x ** 3,
  io: (x) => (x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  back: (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  elastic: (x) => (x === 0 || x === 1 ? x : 2 ** (-10 * x) * Math.sin((x * 10 - .75) * (2 * Math.PI) / 3) + 1),
};
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const tf = (el, o) => {
  el.style.transform = `translate3d(${o.x || 0}px,${o.y || 0}px,${o.z || 0}px) rotateX(${o.rx || 0}deg) rotateY(${o.ry || 0}deg) rotateZ(${o.rz || 0}deg) scale(${o.s ?? 1})`;
};
const op = (el, v) => { el.style.opacity = v; };
const fmt = (n) => n.toFixed(2).replace('.', ',');
const pulse = (t) => (t >= BEAT0 && t < 40.6 ? Math.exp(-(((t - BEAT0) % BEAT)) * 7) : 0);

/* ---------- building blocks ---------- */
const RECV = `<div class="rs"><div class="hd"><span><svg><use href="#logo"/></svg><b>ATARA</b></span><span class="av">LE</span></div>
  <div class="lab">Solde</div><div class="bal"><span id="recvbal">40,00</span></div><div class="cur">USDC · Base</div>
  <div class="row" id="recvrow" style="opacity:0"><span class="dot">↓</span><div>Reçu de @alex<small>à l’instant</small></div><em>+25,00</em></div>
  <div class="row"><span class="dot" style="background:rgba(255,255,255,.08);color:#fff">↗</span><div>Café du coin<small>hier</small></div><em style="color:#fff;font-weight:500">−3,20</em></div>
  <div class="row"><span class="dot" style="background:rgba(255,255,255,.08);color:#fff">↗</span><div>Marché Bio<small>samedi</small></div><em style="color:#fff;font-weight:500">−18,40</em></div>
  <div class="toast" id="recvtoast" style="opacity:0"><span class="ic">↓</span><div><b>+25 USDC reçus</b><small>de @alex · à l’instant</small></div></div></div>`;

function buildPhone(el) {
  let layers = '';
  for (let i = 1; i <= 9; i++) layers += `<div class="ph-layer" style="transform:translateZ(${-i * 1.5}px)"></div>`;
  const inner = el.dataset.custom === 'recv' ? RECV : `<img src="assets/screens/${el.dataset.screen}.png" alt="">`;
  el.innerHTML = `${layers}<div class="ph-back"></div><div class="ph-front"><div class="ph-screen">${inner}<div class="ov"></div></div><div class="ph-island"></div><div class="ph-glare"></div></div>`;
  el._glare = $('.ph-glare', el);
  el._ov = $('.ov', el);
}
function placePhone(el, o) {
  tf(el, o);
  el._glare.style.backgroundPosition = `${50 + (o.ry || 0) * 2.2}% 0`;
}

function mkTitle(el, lines) {
  el.innerHTML = lines.map((l) => `<span class="ln">${l.split(' ').map((w) => {
    const m = /^\{(.+)\}(.*)$/.exec(w);
    return `<span class="w"><i>${m ? `<span class="badge-base">${m[1]}</span>${m[2]}` : w}</i></span>`;
  }).join(' ')}</span>`).join('');
  el._w = $$('i', el);
}
function animTitle(el, t, start, stag = .08, dur = .75, out = null) {
  el._w.forEach((w, i) => {
    let y = (1 - E.out5(pr(t, start + i * stag, start + i * stag + dur))) * 112;
    if (out !== null) y = -E.in(pr(t, out + i * .03, out + i * .03 + .42)) * 112 + (y > 0 ? y : 0);
    w.style.transform = `translateY(${y}%)`;
  });
}
function fadeUp(el, t, a, b, dy = 30, outA = null, outB = null) {
  let p = E.out(pr(t, a, b));
  let o = p;
  if (outA !== null) o *= 1 - pr(t, outA, outB);
  el.style.opacity = o;
  return dy * (1 - p);
}

/* ---------- static content ---------- */
const els = {};
['s0', 's1', 's2', 's3', 's4', 's5'].forEach((id) => { els[id] = $('#' + id); });
$$('.phone').forEach(buildPhone);
Object.values(els).forEach((s) => { const d = document.createElement('div'); d.className = 'scenebg'; d.innerHTML = $('#bg').innerHTML; s.prepend(d); });

mkTitle($('#t1'), ['Paie tes courses.']);
mkTitle($('#t2'), ['Envoie en un @.']);
mkTitle($('#t3'), ['Sur {Base},', 'le réseau de Coinbase.']);
mkTitle($('#t4a'), ['Tes clés.', 'Ton compte.']);
mkTitle($('#t4b'), ['Toi seul', 'autorises.']);
mkTitle($('#t5'), ['Paie. Envoie. Garde tes clés.']);

// Store: blurred shelves and lamps
(() => {
  const r = rng(7);
  let g = '';
  for (let row = 0; row < 4; row++) {
    const y = 250 + row * 190;
    g += `<rect x="700" y="${y + 150}" width="1240" height="14" fill="#1b252b"/>`;
    let x = 700;
    while (x < 1940) {
      const w = 40 + r() * 50, h = 70 + r() * 70, hue = [145, 35, 200, 12, 50, 280][Math.floor(r() * 6)];
      g += `<rect x="${x}" y="${y + 150 - h}" width="${w}" height="${h}" rx="6" fill="hsl(${hue} ${25 + r() * 30}% ${30 + r() * 22}%)"/>`;
      x += w + 6;
    }
  }
  $('#shelves').innerHTML = g;
  $('#shelves').style.opacity = .62;
})();

// Terminal
(() => {
  let layers = '';
  for (let i = 1; i <= 7; i++) layers += `<div class="tl" style="transform:translateZ(${-i * 2}px)"></div>`;
  $('#term').innerHTML = `${layers}<div class="tf">
    <div class="nfc" id="nfc">)))</div>
    <div class="tscr" style="top:88px"><div><b>TOTAL</b><span>18,40 USDC</span><i>Approche ton téléphone</i></div>
      <div class="tok" id="tok" style="opacity:0"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg></div></div>
    <div class="keys" style="top:258px"><u></u><u></u><u></u></div></div>`;
  $('#term .nfc').style.top = '16px';
})();

// Coin + ghosts
(() => {
  let layers = '';
  for (let i = -6; i <= 6; i++) layers += `<div class="c" style="transform:translateZ(${i}px)"></div>`;
  $('#coin').innerHTML = `${layers}<div class="cf" style="transform:translateZ(7px)"><i>$</i></div><div class="cb" style="transform:translateZ(-7px) rotateY(180deg)"><i>$</i></div>`;
  $('#ghosts').innerHTML = Array.from({ length: 7 }, () => `<div class="coin" style="opacity:0"><div class="cf" style="backface-visibility:visible"><i>$</i></div></div>`).join('');
})();

// Chain
const CUBE_ICONS = ['i-cart', 'i-coin', 'i-send', 'i-key', 'i-shield'];
const HASH = ['0x9f3a…c81d', '0x41be…07aa', '0xd2c7…5e90', '0x7a08…b3f1', '0xe655…2d4c'];
(() => {
  const chain = $('#chain');
  chain.style.left = '960px'; chain.style.top = '575px';
  let html = '';
  for (let i = 0; i < 4; i++) html += `<div class="beam" id="beam${i}" style="width:144px;margin-left:-72px"></div>`;
  CUBE_ICONS.forEach((ic, i) => {
    const icon = `<svg viewBox="0 0 24 24"><use href="#${ic}"/></svg>`;
    const side = `<div class="f side"><div><svg viewBox="0 0 24 24"><use href="#logo"/></svg>${HASH[i]}</div></div>`;
    const face = (tr, inner) => `<div class="f" style="transform:${tr}">${inner}</div>`;
    html += `<div class="cube" id="cube${i}">
      ${face('translateZ(95px)', icon)}${face('rotateY(180deg) translateZ(95px)', icon)}
      <div class="f side" style="transform:rotateY(90deg) translateZ(95px)"><div><svg viewBox="0 0 24 24"><use href="#logo"/></svg>${HASH[i]}</div></div>
      <div class="f side" style="transform:rotateY(-90deg) translateZ(95px)"><div><svg viewBox="0 0 24 24"><use href="#logo"/></svg>${HASH[i]}</div></div>
      ${face('rotateX(90deg) translateZ(95px)', '')}${face('rotateX(-90deg) translateZ(95px)', '')}</div>`;
  });
  html += '<div class="orb" id="orb"></div>';
  chain.innerHTML = html;
})();

// Holders
(() => {
  const data = [['i-bank', 'Banque'], ['i-gov', 'Gouvernement'], ['logo', 'ATARA']];
  $('#holders').innerHTML = data.map(([ic, name], i) => `<div class="holder glass" id="hold${i}">
    <div class="ico"><svg viewBox="0 0 24 24" ${ic === 'logo' ? 'style="fill:currentColor;stroke:none"' : ''}><use href="#${ic}"/></svg></div>
    <h3>${name}</h3><p>Clés détenues</p><div class="zero" id="zero${i}">0</div></div>`).join('');
  let layers = '';
  for (let i = -6; i <= 6; i++) layers += `<svg viewBox="0 0 24 24" style="transform:translateZ(${i * 1.4}px);opacity:${i === 6 ? 1 : .55}"><use href="#i-key"/></svg>`;
  $('#key').innerHTML = layers;
  $('#scan').innerHTML = '';
  $('#miniblock').innerHTML = `<div class="glass" id="mini" style="left:0;top:0;width:430px;height:130px;margin:-65px 0 0 -215px;border-radius:30px;display:flex;align-items:center;gap:22px;padding:0 30px">
    <div style="width:64px;height:64px;border-radius:18px;background:var(--base-d);display:grid;place-items:center;font-weight:700;font-size:30px;letter-spacing:-1px">B</div>
    <div style="font-size:30px;font-weight:600;line-height:1.15">Enregistré sur Base<div style="font-size:22px;color:var(--mute);font-weight:400">par toi, sans intermédiaire</div></div></div>`;
  $('#s4sub').style.transform = 'translate(210px,905px)';
  $$('.ring').forEach((r) => { r.style.opacity = 0; });
})();

// Confetti
const CONF = (() => {
  const r = rng(99), host = $('#confetti'), out = [];
  for (let i = 0; i < 34; i++) {
    const el = document.createElement('i');
    const size = 10 + r() * 14;
    el.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size * (r() > .5 ? 1 : .45)}px;border-radius:${r() > .5 ? '50%' : '3px'};background:${['#4ade80', '#86efac', '#e8dcc8', '#f6f5f4', '#3c83f6'][Math.floor(r() * 5)]};opacity:0`;
    host.appendChild(el);
    out.push({ el, a: -Math.PI * (.05 + r() * .9), v: 380 + r() * 700, spin: (r() - .5) * 900, life: .9 + r() * .7 });
  }
  return out;
})();

/* ---------- scene logic ---------- */
function S0(t) {
  const lock = $('#s0logo'), tag = $('#s0tag'), grid = $('#grid');
  const p = E.out5(pr(t, .25, 1.7));
  lock.style.left = '960px'; lock.style.top = '470px';
  lock.style.transform = `translate(-50%,-50%) scale(${lerp(1.22, 1, p)})`;
  lock.style.opacity = p * (1 - pr(t, 3.5, 4.0));
  $('b', lock).style.letterSpacing = `${lerp(90, 34, p)}px`;
  $('svg', lock).style.filter = `drop-shadow(0 0 ${30 * (1 - p) + 22 + 22 * pulse(t)}px rgba(74,222,128,.55))`;
  tag.style.left = '960px'; tag.style.top = '620px';
  const dy = fadeUp(tag, t, 1.7, 2.5, 30, 3.4, 3.9);
  tag.style.transform = `translate(-50%,${dy}px)`;
  grid.style.opacity = E.out(pr(t, 0, 1.2)) * .7 * (1 - pr(t, 3.3, 3.9));
  grid.style.backgroundPosition = `0 ${t * 150}px`;
}

function handPos(t) {
  const fl = Math.sin(t * 2.3) * 5;
  if (t < 4.8) return { x: 690, y: 800 };
  if (t < 5.8) { const p = E.out(pr(t, 4.8, 5.8)); return { x: lerp(690, 846, p), y: lerp(800, 758, p) }; }
  if (t < 7.0) return { x: 846, y: 758 + fl };
  if (t < T.tap) { const p = E.in(pr(t, 7.0, T.tap)); return { x: lerp(846, 930, p), y: 758 + fl * (1 - p) }; }
  if (t < 8.3) { const p = E.out(pr(t, T.tap, 8.3)); return { x: lerp(930, 880, p), y: 758 }; }
  return { x: 880, y: 758 + fl };
}

function S1(t) {
  animTitle($('#t1'), t, 3.75, .1, .8, 12.3);
  const kd = fadeUp($('#k1'), t, 3.6, 4.2, 20, 12.3, 12.8);
  $('#k1').style.transform = `translateY(${kd}px)`;

  const sp = E.out(pr(t, 3.2, 13.7));
  $('#store').style.transform = `scale(${lerp(1.08, 1, sp)})`;

  const bp = E.out5(pr(t, 3.4, 4.7));
  const body = $('#body');
  const dx = (1 - bp) * -170;
  body.style.transform = `translateX(${dx}px)`;
  op(body, bp);
  $('#bag').style.transform = `translateY(${Math.sin(t * 2.3 + 1) * 3}px)`;

  // Arm (drawn in body coordinates; shoulder fixed at the jacket)
  const h = handPos(t), sho = { x: 656, y: 516 };
  const elbow = { x: sho.x + 34, y: Math.max(sho.y + 200, h.y - 6) };
  $('#arm').setAttribute('d', `M${sho.x} ${sho.y} Q${elbow.x} ${elbow.y} ${h.x - dx} ${h.y + 14}`);
  $('#cuff').setAttribute('d', `M${lerp(elbow.x, h.x - dx, .82)} ${lerp(elbow.y, h.y + 14, .82)} L${h.x - dx} ${h.y + 14}`);
  $('#hand').setAttribute('transform', `translate(${h.x} ${h.y}) rotate(${-8})`);
  $('#handsvg').style.opacity = bp * (t > 4.8 ? 1 : 0.0001);

  // Phone held in the hand, pulled from the pocket, then tapped on the terminal
  const pull = E.out(pr(t, 4.8, 5.8));
  const tapP = 1 - Math.abs(clamp((t - T.tap) / .55, -1, 1));
  const s = lerp(.36, .62, pull);
  const ph = $('#ph1');
  op(ph, pr(t, 4.8, 5.25) * bp);
  placePhone(ph, { x: h.x - 14 - 20 * (1 - pull), y: h.y - 315 * s * .78 - 20 * (1 - pull), z: 0, ry: lerp(-4, -24, E.in(pr(t, 6.6, T.tap))) + 6 * (1 - tapP) * 0, rz: lerp(14, 3, pull), s });
  $('#handsvg').style.zIndex = 5;

  // Terminal
  const term = $('#term');
  tf(term, { x: 1092, y: 643, ry: -24, rz: 0, s: 1.25 });
  op(term, E.out(pr(t, 3.9, 4.8)));
  $('#term').style.transform += ` translateY(${(1 - E.out(pr(t, 3.9, 4.9))) * 70}px)`;
  const okIn = pr(t, T.tap + .15, T.tap + .4);
  op($('#tok'), okIn);
  $('#nfc').style.borderColor = `rgba(74,222,128,${.25 + .75 * clamp(pr(t, 6.9, T.tap) * 1.0, 0, 1) * (t < T.ok ? 1 : .0)})`;
  $('#nfc').style.color = t >= 6.9 && t < T.ok ? '#4ade80' : 'rgba(255,255,255,.55)';

  // Rings from the tap point
  $$('.ring').forEach((r, i) => {
    const p = pr(t, T.tap + i * .16, T.tap + i * .16 + 1.0);
    const sz = lerp(40, 340, E.out(p));
    r.style.left = `${1064 - sz / 2}px`; r.style.top = `${509 - sz / 2}px`;
    r.style.width = r.style.height = `${sz}px`;
    r.style.opacity = p > 0 && p < 1 ? (1 - p) * .9 : 0;
  });

  // Confirmation card
  const c = $('#okcard');
  const cp = pr(t, T.ok, T.ok + .9);
  const ce = E.back(cp);
  op(c, clamp(cp * 3, 0, 1) * (1 - pr(t, 12.5, 13.1)));
  c.style.transform = `perspective(1600px) translate(${(1 - ce) * 120}px,${(1 - ce) * 40}px) rotateY(${lerp(-26, -9, E.out(cp)) + Math.sin(t * 1.4) * 1.2}deg) rotateX(${lerp(8, 3, E.out(cp))}deg) scale(${lerp(.82, 1, ce)})`;
  const path = $('#okpath');
  const dp = E.out(pr(t, T.ok + .25, T.ok + .75));
  path.style.strokeDasharray = 1; path.style.strokeDashoffset = 1 - dp;
  $('#okamt').textContent = fmt(18.4 * E.out(pr(t, T.ok + .1, T.ok + 1.1)));
  // Confetti burst from the check badge
  CONF.forEach((q) => {
    const a = t - (T.ok + .3);
    if (a < 0 || a > q.life) { q.el.style.opacity = 0; return; }
    const x = 1376 + Math.cos(q.a) * q.v * a * (1 - a * .25), y = 174 + Math.sin(q.a) * q.v * a + 620 * a * a;
    q.el.style.opacity = 1 - E.in(a / q.life);
    q.el.style.transform = `translate(${x}px,${y}px) rotate(${q.spin * a}deg)`;
  });
}

function S2(t) {
  animTitle($('#t2'), t, 13.45, .09, .8, 21.4);
  $('#k2').style.transform = `translateY(${fadeUp($('#k2'), t, 13.35, 13.9, 20, 21.4, 21.9)}px)`;
  $('#s2sub').style.transform = `translateY(${fadeUp($('#s2sub'), t, 14.0, 14.7, 24, 21.4, 21.9)}px)`;
  op($('#floor2'), E.out(pr(t, 13.4, 14.6)));

  const ph2 = $('#ph2'), ph3 = $('#ph3');
  const a = E.out5(pr(t, 13.55, 14.75)), b = E.out5(pr(t, 13.75, 14.95));
  const sway = Math.sin(t * 1.3) * 2;
  const bump = t > T.recv ? Math.sin((t - T.recv) * 14) * Math.exp(-(t - T.recv) * 5) * 2.2 : 0;
  placePhone(ph2, { x: 900, y: lerp(1500, 660, a), z: lerp(-300, 0, a), ry: lerp(46, 14, a) + sway, rx: lerp(-10, 0, a), rz: lerp(-8, 0, a), s: 1.1 });
  placePhone(ph3, { x: 1580, y: lerp(1500, 660, b), z: lerp(-300, 0, b), ry: lerp(-46, -14, b) - sway + bump, rx: lerp(-10, 0, b), rz: lerp(8, 0, b), s: 1.1 });

  const lab = (id, x, p) => { const e = $(id); e.style.transform = `translate(${x}px,${1012 + (1 - p) * 30}px) translateX(-50%)`; e.style.opacity = p; };
  lab('#lab2a', 900, E.out(pr(t, 14.6, 15.3)));
  lab('#lab2b', 1580, E.out(pr(t, 14.8, 15.5)));
  $('#lab2a').textContent = '@alex';

  const sc = $('#sendcard'), sp2 = E.out5(pr(t, T.send + .15, T.send + .95));
  sc.style.opacity = sp2 * (1 - pr(t, 21.3, 21.8));
  sc.style.transform = `translateX(${(1 - sp2) * -160}px) perspective(1400px) rotateY(${(1 - sp2) * 30}deg)`;
  // Press ring + banner on the sender's phone
  const ov = ph2._ov;
  const press = pr(t, T.send - .45, T.send);
  const banner = E.out(pr(t, T.send + .05, T.send + .45));
  ov.innerHTML = press > 0 && t < T.send + .4
    ? `<div style="position:absolute;left:50%;top:79%;width:${46 + 30 * (1 - press)}px;height:${46 + 30 * (1 - press)}px;margin:-${(46 + 30 * (1 - press)) / 2}px 0 0 -${(46 + 30 * (1 - press)) / 2}px;border-radius:50%;border:3px solid #4ade80;opacity:${.3 + .7 * press}"></div>` : '';
  if (banner > 0) ov.innerHTML = `<div class="banner" style="opacity:${banner};transform:translateY(${(1 - banner) * 40}px)">25 USDC envoyés ✓<small>à @lea · frais &lt; 0,01 $</small></div>`;

  // Coin flight
  const coin = $('#coin');
  const fly = pr(t, T.coin0, T.recv - .05);
  const pos = (p) => ({ x: lerp(900, 1580, p), y: 660 - Math.sin(Math.PI * p) * 300, z: 80 + Math.sin(Math.PI * p) * 240 });
  if (fly > 0 && fly < 1) {
    const p = E.io(fly), q = pos(p), sc = .52 + .5 * Math.sin(Math.PI * p);
    op(coin, 1);
    tf(coin, { x: q.x, y: q.y, z: q.z, ry: p * 1260, rz: Math.sin(p * 6) * 10, s: sc * (1 - E.in(pr(fly, .9, 1)) * .8) });
    $$('#ghosts .coin').forEach((g, k) => {
      const pg = p - (k + 1) * .032;
      if (pg <= 0) { op(g, 0); return; }
      const gq = pos(pg);
      op(g, (1 - (k + 1) / 8) * .45);
      tf(g, { x: gq.x, y: gq.y, z: gq.z, ry: pg * 1260, s: (.52 + .5 * Math.sin(Math.PI * pg)) * .92 });
    });
  } else {
    op(coin, 0);
    $$('#ghosts .coin').forEach((g) => op(g, 0));
  }

  // Receiver: toast, row and balance
  const tp = E.out(pr(t, T.recv, T.recv + .5)) * (1 - pr(t, T.recv + 2.3, T.recv + 2.8));
  const toast = $('#recvtoast');
  toast.style.opacity = tp; toast.style.transform = `translateY(${(1 - E.out(pr(t, T.recv, T.recv + .5))) * -60}px)`;
  $('#recvrow').style.opacity = E.out(pr(t, T.recv + .6, T.recv + 1.1));
  $('#recvbal').textContent = fmt(40 + 25 * E.out(pr(t, T.recv + .5, T.recv + 1.5)));
  // Glow on arrival
  const g = pr(t, T.recv - .1, T.recv + .9);
  ph3.style.filter = g > 0 && g < 1 ? `drop-shadow(0 0 ${70 * (1 - g)}px rgba(74,222,128,${.8 * (1 - g)}))` : 'none';
}

function S3(t) {
  animTitle($('#t3'), t, 22.55, .09, .8, 30.5);
  $('#k3').style.transform = `translateY(${fadeUp($('#k3'), t, 22.45, 23.0, 20, 30.5, 31.0)}px)`;

  const spin = pr(t, 22.2, 31.6);
  const grp = $('#chain');
  grp.style.transform = `rotateX(${lerp(-16, -7, E.io(spin))}deg) rotateY(${lerp(-42, 26, E.io(spin))}deg) translateZ(${lerp(-200, 140, E.io(spin))}px)`;

  const orbP = E.io(pr(t, T.orb0, T.orb1));
  const ox = lerp(-660, 660, orbP);
  for (let i = 0; i < 5; i++) {
    const cx = (i - 2) * 330, c = $('#cube' + i);
    const p = E.elastic(pr(t, 22.7 + i * .2, 23.6 + i * .2));
    const born = clamp(pr(t, 22.7 + i * .2, 23.1 + i * .2) * 1, 0, 1);
    const passed = t > T.orb0 ? clamp(1 - Math.abs(ox - cx) / 170, 0, 1) : 0;
    const after = t > T.orb0 && ox > cx ? .32 : 0;
    const lit = Math.max(passed, after * (1 - .0));
    c.style.setProperty('--lit', lit.toFixed(3));
    op(c, born);
    tf(c, { x: cx, y: Math.sin(t * 1.6 + i) * 10 - (1 - p) * 420, ry: t * 14 + i * 18, rx: Math.sin(t + i) * 5, s: Math.max(.001, p) * (1 + .12 * passed) });
    $$('.f', c).forEach((f) => { f.style.borderColor = `rgba(74,222,128,${.16 + .75 * lit})`; f.style.boxShadow = lit > .05 ? `0 0 ${60 * lit}px rgba(74,222,128,${.6 * lit})` : 'none'; });
  }
  for (let i = 0; i < 4; i++) {
    const b = $('#beam' + i), bp = E.out(pr(t, 23.4 + i * .2, 24.0 + i * .2));
    op(b, bp);
    tf(b, { x: (i - 1.5) * 330, y: 0, s: 1 });
    b.style.transform += ` scaleX(${bp})`;
  }
  const orb = $('#orb');
  const ov = t > T.orb0 && t < T.orb1 + .5 ? 1 - pr(t, T.orb1, T.orb1 + .5) : 0;
  op(orb, ov);
  tf(orb, { x: ox, y: Math.sin(t * 9) * 4, z: 120, s: 1 + .25 * Math.sin(t * 14) });

  ['#c1', '#c2', '#c3'].forEach((id, i) => {
    const e = $(id), p = E.out5(pr(t, 25.6 + i * .35, 26.5 + i * .35));
    e.style.opacity = p * (1 - pr(t, 30.6 + i * .08, 31.1 + i * .08));
    e.style.transform = `translateY(${(1 - p) * 130}px) rotateX(${(1 - p) * 40}deg)`;
  });
}

function S4(t) {
  animTitle($('#t4a'), t, 31.55, .09, .8, 35.0);
  animTitle($('#t4b'), t, 35.45, .09, .8, 40.0);
  $('#k4').style.transform = `translateY(${fadeUp($('#k4'), t, 31.45, 32.0, 20, 40.0, 40.5)}px)`;

  // Holders: three parties, zero keys each
  [0, 1, 2].forEach((i) => {
    const h = $('#hold' + i), a = E.out5(pr(t, 32.3 + i * .28, 33.4 + i * .28)), out = E.in(pr(t, 35.1 + i * .08, 35.7 + i * .08));
    op(h, a * (1 - out));
    tf(h, { x: 480 + i * 480, y: lerp(900, 590, a) - out * 420, z: lerp(-900, 0, a) + out * 500, ry: (1 - i) * 16 * a + Math.sin(t * 1.2 + i) * 2, rx: lerp(40, 0, a), s: 1 });
    const zero = $('#zero' + i);
    const zp = pr(t, 33.0 + i * .28, 33.6 + i * .28);
    zero.textContent = zp < 1 ? String(Math.floor((1 - zp) * 9)) : '0';
  });
  const sub = $('#s4sub');
  sub.style.opacity = E.out(pr(t, 34.0, 34.6)) * (1 - pr(t, 35.0, 35.4));

  // Phone + key
  const ph = $('#ph4'), enter = E.out5(pr(t, 35.55, 36.65));
  placePhone(ph, { x: 1400, y: lerp(1500, 650, enter), z: lerp(-300, 0, enter), ry: lerp(44, -12, enter) + Math.sin(t * 1.3) * 2, rx: lerp(-10, 0, enter), s: 1.05 });
  const key = $('#key');
  const kin = E.out5(pr(t, 35.7, 36.5)), kgo = E.io(pr(t, 36.55, T.scan));
  const kx = lerp(580, 1400, kgo), ky = lerp(820, 640, kgo) + Math.sin(t * 2.2) * 12 * (1 - kgo);
  op(key, kin * (1 - E.in(pr(t, T.scan - .12, T.scan + .12))));
  tf(key, { x: kx, y: ky, z: lerp(0, 140, Math.sin(Math.PI * kgo)), ry: t * 150, rz: -35, s: lerp(1.25, .45, kgo) * kin });

  // Scan rings and unlock flash on the phone
  const scan = $('#scan'), sp = pr(t, T.scan, T.sign + .3);
  scan.style.left = '1400px'; scan.style.top = '640px';
  scan.style.marginLeft = '-60px'; scan.style.marginTop = '-60px';
  scan.style.opacity = sp > 0 && sp < 1 ? 1 - sp * .7 : 0;
  scan.style.transform = `scale(${lerp(.6, 2.4, E.out(sp))})`;
  scan.style.boxShadow = `0 0 40px rgba(74,222,128,.7), inset 0 0 40px rgba(74,222,128,.4)`;
  ph._ov.innerHTML = t > T.scan && t < T.sign + .5 ? `<div style="position:absolute;inset:0;background:rgba(74,222,128,${.18 * Math.abs(Math.sin((t - T.scan) * 7))})"></div>` : '';

  // Checklist
  [['#ck1', 36.9], ['#ck2', 37.6], ['#ck3', 38.35]].forEach(([id, at]) => {
    const e = $(id), p = E.out5(pr(t, at, at + .7));
    e.style.opacity = p * (1 - pr(t, 40.0, 40.5));
    e.style.transform = `translateX(${(1 - p) * 90}px)`;
  });

  // Signed transaction flies to Base
  const pill = $('#txpill'), fp = E.io(pr(t, T.sign, T.sign + 1.25));
  const fo = pr(t, T.sign, T.sign + .25) * (1 - E.in(pr(t, T.sign + 1.15, T.sign + 1.4)));
  op(pill, fo);
  tf(pill, { x: lerp(1400, 560, fp) - 150, y: lerp(640, 890, fp) - Math.sin(Math.PI * fp) * 140 - 28, s: lerp(.8, 1, fp) });
  const mini = $('#mini'), mp = E.out5(pr(t, 38.1, 38.9)), lit = E.out(pr(t, T.sign + 1.15, T.sign + 1.7));
  op($('#miniblock'), mp * (1 - pr(t, 40.0, 40.5)));
  $('#miniblock').style.left = '560px'; $('#miniblock').style.top = '900px';
  mini.style.transform = `scale(${lerp(.85, 1, mp)})`;
  mini.style.borderColor = `rgba(74,222,128,${.12 + .8 * lit})`;
  mini.style.boxShadow = `0 40px 90px rgba(0,0,0,.6), 0 0 ${80 * lit}px rgba(74,222,128,${.45 * lit})`;
}

function S5(t) {
  const p = E.out5(pr(t, 41.0, 42.3));
  const lock = $('#s5logo');
  lock.style.left = '960px'; lock.style.top = '400px';
  lock.style.transform = `translate(-50%,-50%) scale(${lerp(1.2, 1, p)})`;
  lock.style.opacity = p;
  $('b', lock).style.letterSpacing = `${lerp(80, 34, p)}px`;
  $('svg', lock).style.filter = `drop-shadow(0 0 ${24 + 24 * pulse(t)}px rgba(74,222,128,.5))`;
  const t5 = $('#t5');
  t5.style.transform = 'translate(0,560px)';
  animTitle(t5, t, 42.0, .11, .8);
  [['#g1', 960 - 420, 43.0], ['#g2', 960, 43.25], ['#g3', 960 + 420, 43.5]].forEach(([id, x, at]) => {
    const e = $(id), q = E.out5(pr(t, at, at + .7));
    e.style.transform = `translate(${x}px,${730 + (1 - q) * 40}px) translateX(-50%)`;
    e.style.opacity = q;
  });
  op($('#foot'), E.out(pr(t, 43.8, 44.6)));

  const fan = [['#ph5a', 430, 640, 30, .78], ['#ph5b', 960, 600, 0, .86], ['#ph5c', 1490, 640, -30, .78]];
  fan.forEach(([id, x, y, ry, s], i) => {
    const e = $(id), a = E.out5(pr(t, 40.9 + i * .12, 42.2 + i * .12));
    op(e, .2 * a);
    placePhone(e, { x, y: lerp(1300, y + 40, a), z: lerp(-400, -200, a), ry: ry + Math.sin(t * .9 + i) * 4, rx: 0, rz: (i - 1) * -3, s });
  });
  // Quiet exit on the very last frames
  $('#s5').style.opacity = 1 - pr(t, DUR - .5, DUR);
}

/* ---------- transitions ---------- */
function sweep(target, p, dir) {
  // Reveals `target` behind a glowing diagonal bar. dir 1: left→right, -1: right→left.
  const bar = $('#sweep');
  if (p <= 0 || p >= 1) { target.style.clipPath = 'none'; return false; }
  const e = E.io(p), X = dir > 0 ? lerp(-260, W + 260, e) : lerp(W + 260, -260, e), sk = 135;
  target.style.clipPath = dir > 0
    ? `polygon(0 0,${X + sk}px 0,${X - sk}px ${H}px,0 ${H}px)`
    : `polygon(${W}px 0,${X + sk}px 0,${X - sk}px ${H}px,${W}px ${H}px)`;
  bar.style.display = 'block';
  bar.style.left = `${X - 60}px`;
  bar.style.transform = `skewX(${dir > 0 ? -14 : 14}deg)`;
  bar.style.opacity = Math.sin(Math.PI * p) * 1;
  return true;
}

function seek(t) {
  $('#stage').style.transform = `scale(${window.innerWidth / W})`;
  const pl = pulse(t);
  $$('.g1').forEach((g) => { g.style.opacity = .85 + .15 * pl; });
  $$('.g2').forEach((g) => { g.style.transform = `translate(${Math.sin(t * .25) * 60}px,${Math.cos(t * .2) * 40}px)`; });

  for (const id of Object.keys(SC)) els[id].style.display = t >= SC[id][0] && t <= SC[id][1] ? 'block' : 'none';
  const active = { s0: S0, s1: S1, s2: S2, s3: S3, s4: S4, s5: S5 };
  for (const id of Object.keys(SC)) if (els[id].style.display === 'block') active[id](t);

  let sweeping = false;
  sweeping = sweep(els.s1, pr(t, 3.2, 4.0), 1) || sweeping;
  sweeping = sweep(els.s5, pr(t, 40.6, 41.4), -1) || sweeping;
  if (!sweeping) $('#sweep').style.display = 'none';

  // B · cube turn S1 → S2
  const cw = $('#cubewrap'), pB = pr(t, 12.8, 13.7), eB = E.io(pB);
  if (pB > 0 && pB < 1) {
    cw.style.transformStyle = 'preserve-3d';
    cw.style.transform = `translateZ(-960px) rotateY(${-eB * 90}deg)`;
    els.s1.style.transform = 'rotateY(0deg) translateZ(960px)';
    els.s2.style.transform = 'rotateY(90deg) translateZ(960px)';
    els.s1.style.backfaceVisibility = els.s2.style.backfaceVisibility = 'hidden';
    els.s1.style.boxShadow = 'inset 0 0 0 1px rgba(74,222,128,.25)';
  } else {
    cw.style.transformStyle = 'flat'; cw.style.transform = 'none';
    els.s1.style.transform = els.s2.style.transform = 'none';
    els.s1.style.boxShadow = 'none';
  }

  // C · zoom-through S2 → S3
  const pC = pr(t, 21.9, 22.8), a2 = $('#s2'), a3 = $('#s3');
  if (pC > 0 && pC < 1) {
    a2.style.transform = `scale(${lerp(1, 2.3, E.in(pC))})`; a2.style.filter = `blur(${E.in(pC) * 16}px)`; a2.style.opacity = 1 - E.in(pC);
    a3.style.transform = `scale(${lerp(.62, 1, E.out(pC))})`; a3.style.filter = `blur(${(1 - E.out(pC)) * 16}px)`; a3.style.opacity = E.out(pC);
    $('#flash').style.opacity = .22 * Math.sin(Math.PI * pC);
  } else {
    a2.style.filter = a3.style.filter = 'none';
    a3.style.opacity = 1;
    if (pB <= 0 || pB >= 1) { a2.style.transform = 'none'; a2.style.opacity = 1; }
    a3.style.transform = 'none';
  }

  // D · blinds S3 → S4
  const pD = pr(t, 31.0, 31.85), s4 = els.s4, N = 12, sw = W / N;
  if (pD > 0 && pD < 1) {
    let d = '';
    for (let i = 0; i < N; i++) {
      const w = sw * E.io(clamp(pD * 1.7 - i * .06, 0, 1));
      d += `M${i * sw} 0h${w}v${H}h${-w}z`;
    }
    s4.style.clipPath = `path('${d}')`;
  } else s4.style.clipPath = 'none';

  // Hit flash on the final logo
  const f = pr(t, T.final - .05, T.final + .5);
  if (!(pC > 0 && pC < 1)) $('#flash').style.opacity = f > 0 && f < 1 ? .16 * (1 - f) : 0;

  // Corner signature between the intro and the end card
  op($('#bug'), .7 * E.out(pr(t, 4.6, 5.2)) * (1 - pr(t, 40.3, 40.8)));
}

const fontsReady = Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 40px Inter`)));
window.composition = {
  width: W, height: H, fps: 30, duration: DUR,
  async seek(t) { await fontsReady; seek(t); },
};
seek(0);
if (!navigator.webdriver) {
  const start = performance.now();
  const tick = (now) => { seek(((now - start) / 1000) % DUR); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
