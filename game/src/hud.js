// The heads-up display and menus of Palma Sol, all crisp DOM/SVG/canvas over the 3D view: mission
// card, PSPD dispatch table, cash, wanted stars, weapon bar, crew ability cards, district badge,
// circular vector minimap, health/armor/respect bars, dialogue box with illustrated SVG portraits,
// radio ticker and speedometer; plus the World Map / pause / save screen and the title screen.
// Every panel sits on a dark frosted backing with a 1px accent border so it stays readable when
// the screenshot is shrunk, and the centre of the screen is kept clear for the action.
import { CHARACTERS, CREW, DISTRICTS, MISSIONS, POLICE, WEAPONS, WORLD, districtAt } from './config.js';
import { currentObjective, respectProgress } from './missions.js';
import { getDispatchRows } from './police.js';

const FONT = '"Noto Sans", "DejaVu Sans", "Helvetica Neue", Arial, sans-serif';
const NARROW = '"Nimbus Sans Narrow", "Noto Sans", "DejaVu Sans Condensed", sans-serif';

const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:${FONT};color:#f4f6fb;-webkit-font-smoothing:antialiased;z-index:5}
#hud *{box-sizing:border-box}
.pn{background:rgba(10,14,22,.86);border:1px solid rgba(255,255,255,.14);border-radius:9px;box-shadow:0 6px 22px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(6px)}
.lbl{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9fb0c8}
.pill{display:inline-block;padding:2px 8px;border-radius:5px;font-weight:900;font-size:12px;letter-spacing:.06em;color:#0a0e16}
#tl{position:absolute;left:16px;top:14px;width:356px;display:flex;flex-direction:column;gap:9px}
#mission{padding:11px 14px 11px;border-color:rgba(255,184,77,.55);border-left:4px solid #ffb84d}
#mission .row{display:flex;align-items:center;gap:8px}
#mission .job{background:#ffb84d}
#mission .title{font:italic 900 19px ${NARROW};letter-spacing:.04em;color:#ffcf6e}
#mission .timer{margin-left:auto;font:800 15px ${FONT};padding:2px 9px;border:1px solid #ff5d73;border-radius:6px;color:#fff;background:rgba(255,93,115,.16)}
#mission .giver{font-size:12px;color:#c3cfdf;margin-top:3px;font-weight:600}
#mission .obj{font-size:17px;font-weight:800;line-height:1.22;margin-top:6px;color:#fff}
#mission .segs{display:flex;gap:5px;margin-top:8px;align-items:center}
#mission .seg{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.14)}
#mission .seg.on{background:linear-gradient(90deg,#ff7a59,#ffcf4a)}
#mission .seg.cur{background:linear-gradient(90deg,#ffcf4a,#fff1b8);box-shadow:0 0 8px rgba(255,207,74,.7)}
#mission .stg{font-size:11px;font-weight:800;color:#c3cfdf;margin-left:6px;letter-spacing:.06em}
#mission .next{font-size:12.5px;color:#d8e1ee;margin-top:7px;font-weight:600}
#mission .next b{color:#5cf2b0;font-weight:900;letter-spacing:.08em;margin-right:5px}
#dispatch{padding:9px 12px 9px;border-color:rgba(79,139,255,.55)}
#dispatch .hd{display:flex;align-items:center;gap:7px;margin-bottom:5px}
#dispatch .hd .t{font-weight:900;font-size:13.5px;letter-spacing:.08em}
#dispatch .hd .n{margin-left:auto;font-weight:900;font-size:13px;color:#ffd84f}
.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
#dispatch .r{display:grid;grid-template-columns:16px 1fr 46px 104px;align-items:center;height:23px;font-size:13px;font-weight:800;border-top:1px solid rgba(255,255,255,.06)}
#dispatch .r .d{color:#9fb0c8;font-weight:700;text-align:right;padding-right:8px;font-size:12px}
#dispatch .r .pill{text-align:center;font-size:11px;padding:2px 0}
#dispatch .more{font-size:11.5px;color:#9fb0c8;margin-top:4px;font-weight:600}
#bl{position:absolute;left:16px;bottom:14px;width:300px;display:flex;flex-direction:column;gap:8px}
#district{padding:7px 12px 8px;border-left:4px solid #ff9f5a}
#district .n{font:italic 900 19px ${NARROW};letter-spacing:.05em}
#district .s{font-size:12px;color:#c3cfdf;font-weight:700;margin-top:-1px}
#district .bar{height:5px;border-radius:3px;background:rgba(255,255,255,.14);margin-top:5px;overflow:hidden}
#district .bar i{display:block;height:100%}
#mmwrap{position:relative;width:196px;height:196px;margin-left:4px}
#minimap{width:196px;height:196px;border-radius:50%;border:3px solid rgba(10,14,22,.95);box-shadow:0 0 0 2px rgba(255,159,90,.8),0 8px 24px rgba(0,0,0,.5);display:block}
#mmN{position:absolute;left:50%;top:-6px;transform:translateX(-50%);background:#0a0e16;border:1px solid #ff9f5a;border-radius:50%;width:22px;height:22px;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center}
#vitals{padding:8px 12px}
.vrow{display:grid;grid-template-columns:62px 1fr 34px;align-items:center;gap:6px;height:19px;font-size:11.5px;font-weight:900;letter-spacing:.08em}
.vbar{height:8px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}
.vbar i{display:block;height:100%;border-radius:4px}
.vrow .v{text-align:right;font-size:12.5px}
#respect{display:flex;align-items:center;gap:8px;margin-top:4px}
#respect .badge{width:26px;height:26px;border-radius:50%;background:#ffcf4a;color:#0a0e16;font-weight:900;display:flex;align-items:center;justify-content:center;font-size:14px}
#respect .t{font-size:12px;font-weight:900;letter-spacing:.06em;color:#ffcf4a}
#respect .p{font-size:11px;color:#9fb0c8;font-weight:700;margin-left:auto}
#tr{position:absolute;right:16px;top:12px;width:404px;display:flex;flex-direction:column;align-items:flex-end;gap:7px}
#cashrow{display:flex;align-items:center;gap:10px}
#clock{font:800 14px ${FONT};color:#e7edf6;padding:4px 9px}
#cash{font:italic 900 34px ${NARROW};color:#7dff9b;padding:2px 14px 0;letter-spacing:.02em;border-color:rgba(125,255,155,.5);text-shadow:0 0 14px rgba(125,255,155,.35)}
#stars{display:flex;gap:4px;padding:4px 10px}
#stars svg{width:27px;height:27px}
#sight{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px}
#sight .pill{background:#ff3b5c;color:#fff}
#sight span{font-size:12.5px;font-weight:700;color:#e7edf6}
#weapons{display:flex;gap:5px;padding:6px}
.wslot{width:61px;height:62px;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:3px}
.wslot.on{background:rgba(255,207,74,.18);border-color:#ffcf4a;box-shadow:0 0 10px rgba(255,207,74,.35)}
.wslot.lock{opacity:.42}
.wslot .k{position:absolute;left:4px;top:2px;font-size:10px;font-weight:900;color:#9fb0c8}
.wslot svg{width:42px;height:22px;margin-bottom:1px}
.wslot .nm{font-size:8.6px;font-weight:900;letter-spacing:.04em;white-space:nowrap}
.wslot .am{font-size:11px;font-weight:900;color:#ffcf4a}
#wlabel{font-size:12px;font-weight:900;color:#ffcf4a;letter-spacing:.08em;padding:2px 10px}
#crew{display:flex;flex-direction:column;gap:6px;width:268px}
.ccard{display:grid;grid-template-columns:46px 1fr auto;align-items:center;gap:9px;padding:5px 10px 5px 5px;border-left:3px solid var(--a)}
.ccard .pt{width:46px;height:46px;border-radius:7px;overflow:hidden;position:relative}
.ccard .pt svg{width:46px;height:46px;display:block}
.ccard .key{position:absolute;right:-1px;bottom:-1px;background:var(--a);color:#0a0e16;font-size:10px;font-weight:900;width:16px;height:16px;border-radius:4px 0 6px 0;display:flex;align-items:center;justify-content:center}
.ccard .ab{font:italic 900 15px ${NARROW};letter-spacing:.05em}
.ccard .who{font-size:11px;color:#c3cfdf;font-weight:700}
.ccard .cd{font-size:11px;font-weight:900;letter-spacing:.06em;color:var(--a)}
.ccard .cdbar{height:3px;border-radius:2px;background:rgba(255,255,255,.12);margin-top:3px;overflow:hidden}
.ccard .cdbar i{display:block;height:100%;background:var(--a)}
#dialog{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:540px;display:grid;grid-template-columns:76px 1fr;gap:12px;padding:10px 14px 10px 10px;border-color:rgba(255,122,89,.55);border-left:4px solid #ff7a59;margin-left:-6px}
#dialog .pt{width:76px;height:76px;border-radius:8px;overflow:hidden}
#dialog .pt svg{width:76px;height:76px;display:block}
#dialog .sp{font:italic 900 17px ${NARROW};letter-spacing:.04em;color:#ff9f7a}
#dialog .sp small{font:800 10.5px ${FONT};letter-spacing:.1em;color:#9fb0c8;margin-left:8px;font-style:normal}
#dialog .tx{font-size:15px;font-weight:700;line-height:1.3;margin-top:3px;color:#fff}
#br{position:absolute;right:16px;bottom:14px;width:300px;display:flex;flex-direction:column;gap:7px;align-items:stretch}
#radio{display:flex;align-items:center;gap:9px;padding:6px 11px;border-left:3px solid #ff9f5a}
#radio .ic{width:24px;height:24px;border-radius:50%;background:conic-gradient(#ff9f5a,#ff4fd8,#46e0ff,#ff9f5a);display:flex;align-items:center;justify-content:center}
#radio .ic i{width:9px;height:9px;border-radius:50%;background:#0a0e16;display:block}
#radio .st{font-size:12.5px;font-weight:900;letter-spacing:.06em}
#radio .tk{font-size:11.5px;color:#c3cfdf;font-weight:700}
#speedo{padding:9px 14px 10px;border-color:rgba(70,224,255,.5)}
#speedo .car{display:flex;justify-content:space-between;align-items:baseline}
#speedo .cn{font:italic 900 19px ${NARROW};letter-spacing:.05em;color:#46e0ff}
#speedo .tune{font-size:11px;font-weight:900;color:#9fb0c8;letter-spacing:.08em}
#speedo .big{display:flex;align-items:flex-end;gap:8px;margin:2px 0 4px}
#speedo .num{font:italic 900 64px/0.95 ${NARROW};letter-spacing:-.01em}
#speedo .unit{font-size:14px;font-weight:900;color:#c3cfdf;margin-bottom:8px}
#speedo .gear{margin-left:auto;margin-bottom:8px;border:2px solid #ffcf4a;color:#ffcf4a;font-weight:900;font-size:17px;padding:1px 8px;border-radius:6px}
#speedo .vrow{grid-template-columns:82px 1fr 40px}
#prompt{position:absolute;left:50%;top:63%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:8px 16px 8px 8px;border-color:rgba(255,207,74,.7)}
#prompt kbd{background:#ffcf4a;color:#0a0e16;font:900 16px ${FONT};border-radius:6px;padding:3px 10px}
#prompt span{font-weight:900;font-size:15px;letter-spacing:.08em}
#callout{position:absolute;right:16px;top:50%;padding:7px 12px;font-size:13px;font-weight:800;border-left:3px solid #7dff9b}
#toast{position:absolute;left:50%;top:20%;transform:translateX(-50%);padding:10px 22px;font:italic 900 26px ${NARROW};letter-spacing:.08em;color:#ffcf4a;opacity:0;transition:opacity .3s}
#vignette{position:fixed;inset:0;pointer-events:none;z-index:4;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 58%,rgba(10,6,20,.42) 100%)}
.hide{display:none!important}
#overlay{position:fixed;inset:0;z-index:20;font-family:${FONT};color:#f4f6fb}
`;

// ---------------------------------------------------------------------------------------------
// Illustrated portraits

/** An illustrated SVG portrait for a character record (skin, hair, hairStyle, shirt, accent). */
export function makePortraitSVG(c, id = 'p') {
  const uid = `${id}${Math.abs(hashString(c.name || id))}`;
  const hair = c.hair;
  const skin = c.skin;
  const shade = shadeColor(skin, -0.18);
  let back = '';
  let front = '';
  switch (c.hairStyle) {
    case 'long':
      back = `<path d="M26 44 Q24 18 50 16 Q76 18 74 44 L78 92 L22 92 Z" fill="${hair}"/>`;
      front = `<path d="M30 40 Q34 20 52 21 Q70 22 71 42 Q62 30 46 31 Q36 33 30 40Z" fill="${hair}"/>`;
      break;
    case 'bob':
      back = `<path d="M27 46 Q25 18 50 17 Q75 18 73 46 L74 66 L64 66 L64 48 L36 48 L36 66 L26 66 Z" fill="${hair}"/>`;
      front = `<path d="M30 42 Q31 21 50 20 Q70 21 70 42 L68 36 Q58 31 50 34 Q40 30 32 37Z" fill="${hair}"/>`;
      break;
    case 'fade':
      front = `<path d="M32 38 Q33 19 50 18 Q67 19 68 38 Q64 28 50 27 Q37 28 32 38Z" fill="${hair}"/><path d="M33 40 Q33 34 35 31 L35 44Z M67 40 Q67 34 65 31 L65 44Z" fill="${hair}" opacity=".55"/>`;
      break;
    case 'bun':
      back = `<circle cx="50" cy="13" r="9" fill="${hair}"/>`;
      front = `<path d="M31 41 Q31 19 50 19 Q69 19 69 41 Q63 27 50 27 Q38 27 31 41Z" fill="${hair}"/>`;
      break;
    case 'cap':
    default:
      front = `<path d="M30 34 Q31 16 50 16 Q69 16 70 34 Z" fill="${c.accent || hair}"/><path d="M30 33 L80 35 Q78 39 70 38 L30 37Z" fill="${shadeColor(c.accent || hair, -0.25)}"/><path d="M33 38 Q34 42 34 46 L32 46Z M67 38 L68 46 L66 46Z" fill="${hair}"/>`;
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="bg${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.accent}"/><stop offset="1" stop-color="${shadeColor(c.accent, -0.55)}"/></linearGradient>
<radialGradient id="gl${uid}" cx=".5" cy=".35" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="100" height="100" fill="url(#bg${uid})"/><rect width="100" height="100" fill="url(#gl${uid})"/>
<circle cx="84" cy="16" r="20" fill="#fff" opacity=".08"/>
${back}
<path d="M14 100 Q16 74 38 70 L62 70 Q84 74 86 100Z" fill="${c.shirt}"/>
<path d="M40 70 L50 84 L60 70Z" fill="${shade}"/>
<path d="M42 58 L58 58 L59 72 Q50 78 41 72Z" fill="${shade}"/>
<ellipse cx="50" cy="44" rx="19" ry="22" fill="${skin}"/>
<ellipse cx="31.5" cy="46" rx="3.5" ry="5" fill="${shade}"/><ellipse cx="68.5" cy="46" rx="3.5" ry="5" fill="${shade}"/>
${front}
<path d="M38 41 Q42 38.5 46 40.5" stroke="${shadeColor(hair, 0.1)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M54 40.5 Q58 38.5 62 41" stroke="${shadeColor(hair, 0.1)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<ellipse cx="42.5" cy="46" rx="2.6" ry="2.9" fill="#1a1420"/><ellipse cx="57.5" cy="46" rx="2.6" ry="2.9" fill="#1a1420"/>
<circle cx="43.4" cy="45" r=".9" fill="#fff"/><circle cx="58.4" cy="45" r=".9" fill="#fff"/>
<path d="M50 47 L48 54 Q50 55.5 52 54" stroke="${shade}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<path d="M43.5 59 Q50 63.5 56.5 59" stroke="#7a2e2e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<ellipse cx="38" cy="53" rx="3.4" ry="2" fill="#ff6f6f" opacity=".22"/><ellipse cx="62" cy="53" rx="3.4" ry="2" fill="#ff6f6f" opacity=".22"/>
</svg>`;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function shadeColor(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  r = f(r); g = f(g); b = f(b);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Icons

const STAR = (on) => `<svg viewBox="0 0 24 24"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5L7 14.3l-5.3-5 7.2-.9z" fill="${on ? '#ffcf3a' : 'rgba(255,255,255,.14)'}" stroke="${on ? '#fff3c4' : 'rgba(255,255,255,.3)'}" stroke-width="1.1" stroke-linejoin="round"/></svg>`;

/** Vector silhouettes for the six weapon slots. */
export const WEAPON_ICONS = {
  fists: '<path d="M12 5h14a4 4 0 014 4v6a5 5 0 01-5 5H15a5 5 0 01-5-5V7a2 2 0 012-2z M14 5v6 M18 5v6 M22 5v6 M26 5v6" fill="#e7edf6" stroke="#0a0e16" stroke-width="1.2"/>',
  nine: '<path d="M6 6h28v5H18l-2 9h-6l2-9H6z" fill="#e7edf6"/><rect x="30" y="6" width="5" height="2" fill="#46e0ff"/>',
  viper: '<path d="M3 7h30l2 3h-7v3h-6l-2 8h-5l1-8H9l-1 4H4l1-4H3z" fill="#e7edf6"/><rect x="21" y="13" width="3" height="8" fill="#e7edf6"/><rect x="10" y="7" width="14" height="2" fill="#46e0ff"/>',
  breacher: '<path d="M1 8h32v4H18l-3 3H8l-3 6H1l2-7H1z" fill="#e7edf6"/><rect x="18" y="12" width="10" height="2.5" fill="#bfa27a"/>',
  carbine: '<path d="M0 8h36v3h-5v2h-9l-2 8h-4l1-8h-4l-3 6H5l2-6H2z" fill="#e7edf6"/><rect x="14" y="5" width="8" height="3" fill="#e7edf6"/><rect x="20" y="13" width="3" height="7" fill="#e7edf6"/>',
  flare: '<path d="M6 8h20a4 4 0 014 4v0H16l-2 9H8l2-9H6z" fill="#e7edf6"/><circle cx="31" cy="10" r="3" fill="#ff5d3a"/>',
};

function weaponSlotHTML(w, state) {
  const owned = state.owned;
  const ammo = w.id === 'fists' ? '∞' : owned ? state.ammo : 'LOCKED';
  return `<div class="wslot ${state.active ? 'on' : ''} ${owned ? '' : 'lock'}"><span class="k">${w.slot}</span><svg viewBox="0 0 36 24">${WEAPON_ICONS[w.id]}</svg><span class="nm">${w.name}</span><span class="am">${ammo}</span></div>`;
}

// ---------------------------------------------------------------------------------------------
// Minimap

/** Paint the static city map (ocean, beach, blocks, roads, districts) onto a canvas once. */
export function paintCityMap(ctx, x0, z0, scale, w, h, { districts = false, night = false } = {}) {
  const X = (x) => (x - x0) * scale;
  const Z = (z) => (z - z0) * scale;
  ctx.fillStyle = night ? '#232838' : '#d9d3c7';
  ctx.fillRect(0, 0, w, h);
  if (districts) {
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.28;
      ctx.fillRect(X(Math.max(d.x0, WORLD.beachInnerX)), Z(d.z0), (d.x1 - Math.max(d.x0, WORLD.beachInnerX)) * scale, (d.z1 - d.z0) * scale);
    }
    ctx.globalAlpha = 1;
  }
  // City blocks between roads.
  ctx.fillStyle = night ? '#3a4058' : '#b9b2a6';
  const xs = [WORLD.boulevardHalfWidth + 6, ...WORLD.avenueXs, WORLD.cityMaxX + 30];
  const zs = [WORLD.minZ, ...WORLD.streetZs, WORLD.maxZ];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let k = 0; k < zs.length - 1; k += 1) {
      const bx0 = xs[i] + (i === 0 ? 0 : WORLD.avenueWidth / 2 + 3);
      const bx1 = xs[i + 1] - WORLD.avenueWidth / 2 - 3;
      const bz0 = zs[k] + WORLD.streetWidth / 2 + 3;
      const bz1 = zs[k + 1] - WORLD.streetWidth / 2 - 3;
      ctx.fillRect(X(bx0), Z(bz0), (bx1 - bx0) * scale, (bz1 - bz0) * scale);
    }
  }
  // Beach and ocean.
  ctx.fillStyle = '#f0d39a';
  ctx.fillRect(X(WORLD.oceanEdgeX), Z(WORLD.minZ - 200), (WORLD.beachInnerX - WORLD.oceanEdgeX) * scale, (WORLD.maxZ - WORLD.minZ + 400) * scale);
  ctx.fillStyle = '#9a7552';
  ctx.fillRect(X(-62), Z(150), (WORLD.beachInnerX + 62) * scale, 270 * scale);
  const og = ctx.createLinearGradient(X(WORLD.oceanEdgeX), 0, X(WORLD.oceanEdgeX - 120), 0);
  og.addColorStop(0, '#3fd6d0');
  og.addColorStop(1, '#1576a8');
  ctx.fillStyle = og;
  ctx.fillRect(0, 0, Math.max(0, X(WORLD.oceanEdgeX)), h);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillRect(X(WORLD.oceanEdgeX) - 2 * scale, 0, 2.5 * scale, h);
  // Roads.
  ctx.fillStyle = night ? '#8a93ad' : '#fbf8f1';
  ctx.fillRect(X(-WORLD.boulevardHalfWidth), 0, WORLD.boulevardHalfWidth * 2 * scale, h);
  for (const ax of WORLD.avenueXs) ctx.fillRect(X(ax - WORLD.avenueWidth / 2), 0, WORLD.avenueWidth * scale, h);
  for (const sz of WORLD.streetZs) ctx.fillRect(X(-WORLD.boulevardHalfWidth), Z(sz - WORLD.streetWidth / 2), (WORLD.cityMaxX + 20) * scale, WORLD.streetWidth * scale);
  ctx.fillStyle = '#ffc93a';
  ctx.fillRect(X(-0.6), 0, Math.max(1, 1.2 * scale), h);
}

/** The minimap renderer: rotates the city around the player, draws police, sight cones and icons. */
export function createMinimap(canvas) {
  const size = 392;
  canvas.width = size;
  canvas.height = size;
  const base = document.createElement('canvas');
  const scale = 1.4;
  const x0 = -260;
  const z0 = WORLD.minZ - 80;
  base.width = Math.ceil((WORLD.cityMaxX + 80 - x0) * scale);
  base.height = Math.ceil((WORLD.maxZ - WORLD.minZ + 160) * scale);
  paintCityMap(base.getContext('2d'), x0, z0, scale, base.width, base.height);
  const ctx = canvas.getContext('2d');
  return {
    draw(state) {
      const { x, z, heading, police = [], icons = [], cones = false, t = 0, objective = null, zoom = 1.25 } = state;
      ctx.save();
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(size / 2, size / 2 + 40);
      ctx.rotate(heading);
      ctx.scale(zoom, zoom);
      ctx.drawImage(base, -(x - x0) * scale, -(z - z0) * scale);
      const P = (px, pz) => [(px - x) * scale, (pz - z) * scale];
      if (objective) {
        const [ox, oz] = P(objective.x, objective.z);
        ctx.strokeStyle = '#ffcf4a';
        ctx.lineWidth = 6 / zoom;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ox, oz); ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const p of police) {
        const [px, pz] = P(p.x, p.z);
        if (cones || p.air) {
          ctx.fillStyle = p.air ? 'rgba(120,170,255,.28)' : 'rgba(255,60,90,.22)';
          ctx.beginPath();
          if (p.air) ctx.arc(px, pz, 34, 0, Math.PI * 2);
          else { ctx.moveTo(px, pz); ctx.arc(px, pz, 70, -p.heading - Math.PI / 2 - 0.5, -p.heading - Math.PI / 2 + 0.5); }
          ctx.fill();
        }
      }
      ctx.restore();
      // Icons are drawn unrotated so they stay upright.
      const toScreen = (px, pz) => {
        const dx = (px - x) * scale * zoom;
        const dz = (pz - z) * scale * zoom;
        const c = Math.cos(heading);
        const s = Math.sin(heading);
        return [size / 2 + dx * c - dz * s, size / 2 + 40 + dx * s + dz * c];
      };
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      for (const p of police) {
        const [sx, sy] = toScreen(p.x, p.z);
        const blink = ((t * 3 + (p.air ? 0.5 : 0)) % 1) < 0.5;
        ctx.fillStyle = p.air ? '#4f8bff' : blink ? '#ff3b5c' : '#3f7bff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, p.air ? 12 : 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (p.air) { ctx.fillStyle = '#fff'; ctx.font = `900 14px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', sx, sy + 1); }
      }
      for (const ic of icons) {
        const [sx0, sy0] = toScreen(ic.x, ic.z);
        const dx = sx0 - size / 2;
        const dy = sy0 - size / 2;
        const d = Math.hypot(dx, dy);
        const maxR = size / 2 - 22;
        const [sx, sy] = d > maxR ? [size / 2 + (dx / d) * maxR, size / 2 + (dy / d) * maxR] : [sx0, sy0];
        ctx.fillStyle = ic.color;
        ctx.strokeStyle = '#0a0e16';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#0a0e16';
        ctx.font = `900 16px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ic.label, sx, sy + 1);
      }
      ctx.restore();
      // Player arrow.
      ctx.save();
      ctx.translate(size / 2, size / 2 + 40);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ff3b5c';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(14, 16); ctx.lineTo(0, 8); ctx.lineTo(-14, 16); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      // Rim ring.
      ctx.strokeStyle = 'rgba(10,14,22,.9)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); ctx.stroke();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// HUD

function h(tag, id, cls = 'pn') {
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (cls) el.className = cls;
  return el;
}

/** Build the HUD DOM inside a root element and return its updater. */
export function createHUD(root) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const hud = h('div', 'hud', '');
  root.appendChild(h('div', 'vignette', ''));
  root.appendChild(hud);
  hud.innerHTML = `
  <div id="tl"><div id="mission" class="pn"></div><div id="dispatch" class="pn"></div></div>
  <div id="bl"><div id="district" class="pn"></div><div id="mmwrap"><canvas id="minimap"></canvas><div id="mmN">N</div></div><div id="vitals" class="pn"></div></div>
  <div id="tr"><div id="cashrow"><div id="clock" class="pn"></div><div id="cash" class="pn"></div></div><div id="stars" class="pn"></div><div id="sight" class="pn"></div><div id="weapons" class="pn"></div><div id="wlabel" class="pn"></div><div id="crew"></div></div>
  <div id="dialog" class="pn"></div>
  <div id="br"><div id="radio" class="pn"></div><div id="speedo" class="pn"></div></div>
  <div id="prompt" class="pn hide"></div>
  <div id="callout" class="pn hide"></div>
  <div id="toast" class="pn"></div>`;
  const $ = (id) => hud.querySelector(`#${id}`);
  const els = Object.fromEntries(['mission', 'dispatch', 'district', 'vitals', 'clock', 'cash', 'stars', 'sight', 'weapons', 'wlabel', 'crew', 'dialog', 'radio', 'speedo', 'prompt', 'callout', 'toast', 'mmwrap'].map((k) => [k, $(k)]));
  const minimap = createMinimap($('minimap'));
  const cache = {};
  const set = (key, html) => {
    if (cache[key] === html) return;
    cache[key] = html;
    els[key].innerHTML = html;
  };
  const show = (key, on) => els[key].classList.toggle('hide', !on);
  let toastTimer = 0;

  return {
    root: hud,
    minimap,
    setVisible(on) { hud.style.display = on ? '' : 'none'; document.getElementById('vignette').style.display = on ? '' : 'none'; },
    /** Update every panel from a HUD state object (see shots.js and main.js for its shape). */
    update(s) {
      const m = s.mission;
      if (m) {
        show('mission', true);
        const segs = m.stages.map((_, i) => `<i class="seg ${i < m.stage ? 'on' : i === m.stage ? 'cur' : ''}"></i>`).join('');
        set('mission', `<div class="row"><span class="pill job">JOB ${m.id}/${MISSIONS.length}</span><span class="title">${m.title}</span><span class="timer">⏱ ${formatTime(m.timer)}</span></div>
          <div class="giver">${m.giver}</div><div class="obj">${m.objective}</div>
          <div class="segs">${segs}<span class="stg">STAGE ${m.stage + 1}/${m.stages.length}</span></div><div class="next"><b>NEXT</b>${m.next}</div>`);
      } else show('mission', false);
      const d = s.dispatch;
      if (d && s.wanted > 0) {
        show('dispatch', true);
        const rows = d.rows.map((r) => `<div class="r"><span>${r.air ? '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0v12M0 6h12" stroke="#4f8bff" stroke-width="3"/></svg>' : '<i class="dot" style="background:#ff3b5c"></i>'}</span><span>${r.callsign}</span><span class="d">${Math.round(r.distance)} m</span><span class="pill" style="background:${POLICE.tacticColors[r.tactic] || '#888'};${r.tactic === 'SPOTLIGHT' || r.tactic === 'ROADBLOCK' || r.tactic === 'RAMMING' ? 'color:#fff' : ''}">${r.tactic}</span></div>`).join('');
        set('dispatch', `<div class="hd"><i class="dot" style="background:#ff3b5c;box-shadow:0 0 8px #ff3b5c"></i><i class="dot" style="background:#3f7bff;box-shadow:0 0 8px #3f7bff;margin-left:-3px"></i><span class="t">PSPD DISPATCH</span><span class="n">${d.total} UNITS · ${s.wanted}★</span></div>${rows}${d.more ? `<div class="more">${d.more}</div>` : ''}`);
      } else show('dispatch', false);
      const dist = s.district;
      set('district', `<div class="n" style="color:${dist.color}">${dist.name}</div><div class="s">${dist.street} · Standing ${dist.standing}%</div><div class="bar"><i style="width:${dist.standing}%;background:${dist.color}"></i></div>`);
      els.district.style.borderLeftColor = dist.color;
      const rp = s.respect;
      set('vitals', `<div class="vrow"><span>HEALTH</span><span class="vbar"><i style="width:${s.health}%;background:linear-gradient(90deg,#2fd27a,#7dff9b)"></i></span><span class="v">${Math.round(s.health)}</span></div>
        <div class="vrow"><span>ARMOR</span><span class="vbar"><i style="width:${s.armor}%;background:linear-gradient(90deg,#2f8bff,#7fc8ff)"></i></span><span class="v">${Math.round(s.armor)}</span></div>
        <div id="respect"><span class="badge">${rp.rank}</span><span class="t">RESPECT RANK ${rp.rank} · ${rp.title}</span><span class="p">${rp.respect.toLocaleString('en-US')} / ${rp.nextNeed.toLocaleString('en-US')}</span></div>
        <div class="vbar" style="height:5px;margin-top:4px"><i style="width:${Math.round(rp.progress * 100)}%;background:#ffcf4a"></i></div>`);
      set('clock', s.clock);
      set('cash', `$${s.cash.toLocaleString('en-US')}`);
      set('stars', [1, 2, 3, 4, 5].map((i) => STAR(i <= s.wanted)).join(''));
      show('stars', true);
      if (s.wanted > 0) {
        show('sight', true);
        set('sight', s.inSight ? `<span class="pill">IN SIGHT</span><span>${s.sightText}</span>` : `<span class="pill" style="background:#ffcf4a;color:#0a0e16">SEARCHING</span><span>${s.sightText}</span>`);
      } else show('sight', false);
      set('weapons', WEAPONS.map((w) => weaponSlotHTML(w, s.weapons[w.slot - 1])).join(''));
      set('wlabel', s.weaponLabel);
      set('crew', s.crew.map((c) => {
        const cm = CREW.find((x) => x.key === c.key);
        const ready = c.remaining <= 0;
        const pct = ready ? 100 : Math.round((1 - c.remaining / c.cooldown) * 100);
        return `<div class="ccard pn" style="--a:${cm.accent}"><div class="pt">${makePortraitSVG(cm, `c${c.key}`)}<span class="key">${c.key}</span></div><div><div class="ab">${cm.ability}</div><div class="who">${cm.name} · ${cm.role}</div><div class="cdbar"><i style="width:${pct}%"></i></div></div><div class="cd">${c.status || (ready ? 'READY' : `${Math.ceil(c.remaining)}s`)}</div></div>`;
      }).join(''));
      const dl = s.dialogue;
      if (dl) {
        show('dialog', true);
        const ch = CHARACTERS[dl.speaker];
        set('dialog', `<div class="pt">${makePortraitSVG(ch, 'dlg')}</div><div><div class="sp">${ch.name}<small>${ch.role}</small></div><div class="tx">${dl.text}</div></div>`);
        els.dialog.style.borderLeftColor = ch.accent;
      } else show('dialog', false);
      const r = s.radio;
      set('radio', `<div class="ic"><i></i></div><div><div class="st" style="color:${r.color}">${r.station}</div><div class="tk">♪ ${r.track}</div></div>`);
      els.radio.style.borderLeftColor = r.color;
      const v = s.vehicle;
      if (v) {
        set('speedo', `<div class="car"><span class="cn">${v.name}</span><span class="tune">SPORTS · TUNE ${v.tune}</span></div>
          <div class="big"><span class="num">${Math.round(v.speed)}</span><span class="unit">KM/H</span><span class="gear">G${v.gear}</span></div>
          <div class="vrow"><span>CONDITION</span><span class="vbar"><i style="width:${v.condition}%;background:linear-gradient(90deg,#2fd27a,#7dff9b)"></i></span><span class="v">${Math.round(v.condition)}%</span></div>
          <div class="vrow"><span style="color:#46e0ff">NITRO</span><span class="vbar"><i style="width:${v.nitro}%;background:linear-gradient(90deg,#1aa6ff,#46e0ff,#c8f8ff)"></i></span><span class="v">${Math.round(v.nitro)}%</span></div>`);
      } else {
        const w = s.weapons.find((x) => x.active);
        const wd = WEAPONS[s.weapons.indexOf(w)];
        set('speedo', `<div class="car"><span class="cn">ON FOOT</span><span class="tune">${s.weaponLabel}</span></div>
          <div class="big"><span class="num">${w.clip ?? w.ammo}</span><span class="unit">/ ${w.reserve ?? ''}</span><span class="gear">${wd.name}</span></div>
          <div class="vrow"><span>STAMINA</span><span class="vbar"><i style="width:${s.stamina ?? 84}%;background:linear-gradient(90deg,#ffcf4a,#fff1b8)"></i></span><span class="v">${Math.round(s.stamina ?? 84)}%</span></div>`);
      }
      if (s.prompt) { show('prompt', true); set('prompt', s.prompt); } else show('prompt', false);
      if (s.callout) { show('callout', true); set('callout', s.callout); } else show('callout', false);
    },
    drawMinimap(state) { minimap.draw(state); },
    toast(text, seconds = 2) {
      els.toast.textContent = text;
      els.toast.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { els.toast.style.opacity = '0'; }, seconds * 1000);
    },
    els,
  };
}

/**
 * Gather the HUD state from live game systems: career, campaign, dispatch, player, crew,
 * dialogue and radio. overrides replace any field (used for per-scene flavour text).
 */
export function buildHudState(game, overrides = {}) {
  const { career, campaign, dispatch, player, crew, dialogue } = game;
  const obj = currentObjective(campaign);
  const giver = obj ? CHARACTERS[obj.mission.giver] : null;
  const pos = player.mode === 'car' && player.vehicle ? player.vehicle : player;
  const district = districtAt(pos.x, pos.z);
  const rows = getDispatchRows(dispatch, 5);
  const weapons = WEAPONS.map((w, i) => {
    const owned = w.id === 'fists' || player.owned.has(w.id);
    const ammo = player.ammo[w.id];
    return { slot: w.slot, owned, active: i === player.weaponIndex, ammo: Number.isFinite(ammo) ? ammo : '∞', clip: Number.isFinite(ammo) ? Math.min(w.clip, ammo) : '∞', reserve: Number.isFinite(ammo) ? Math.max(0, ammo - w.clip) : '∞' };
  });
  const v = player.mode === 'car' ? player.vehicle : null;
  const speedKmh = v ? Math.abs(v.speed) * 3.6 : 0;
  const state = {
    mission: obj ? { id: obj.mission.id, title: obj.mission.title, giver: `${giver.name} · ${giver.role.split('·').pop().trim()}`, timer: campaign.timer, stage: obj.stage, stages: obj.mission.stages, objective: obj.text, next: obj.next } : null,
    dispatch: { rows: rows.rows, total: rows.total, more: rows.total > rows.rows.length ? `+${rows.total - rows.rows.length} more units · ${dispatch.wanted >= 4 ? 'roadblock ahead' : 'closing in'}` : '' },
    wanted: dispatch.wanted,
    inSight: dispatch.inSight,
    sightText: dispatch.inSight ? (dispatch.heli ? 'Air-1 spotlight locked' : 'Units have eyes on you') : 'Break line of sight',
    cash: career.cash,
    clock: game.clock || '18:42',
    weapons,
    weaponLabel: `${WEAPONS[player.weaponIndex].name}${Number.isFinite(player.ammo[WEAPONS[player.weaponIndex].id]) ? ` · ${player.ammo[WEAPONS[player.weaponIndex].id]}` : ''}`,
    crew: crew.map((c) => ({ key: c.key, remaining: c.remaining, cooldown: c.cooldown, status: c.active > 0 ? 'ACTIVE' : '' })),
    district: { name: district.name, street: district.street, color: district.color, standing: career.districtStanding[district.id] ?? 0 },
    health: player.health,
    armor: player.armor,
    respect: respectProgress(career),
    dialogue: dialogue.current,
    radio: { station: game.radio.station, track: game.radio.track, color: game.radio.color },
    vehicle: v ? { name: VEHICLE_NAMES[v.classId] || 'CAR', tune: career.car.tune, speed: speedKmh, gear: Math.max(1, Math.min(6, 1 + Math.floor(speedKmh / 34))), condition: v.condition * 100, nitro: v.nitro * 100 } : null,
    prompt: null,
    callout: null,
  };
  return Object.assign(state, overrides);
}

const VEHICLE_NAMES = { solara: 'SOLARA GT', cruiser: 'PSPD INTERCEPTOR', cab: 'PALMA CAB', coupe: 'MARE COUPE', wagon: 'BRISEÑO WAGON', scooter: 'VESPINA 50' };

/** m:ss */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// World map, story, crew, stats and saves

const MAP_ICONS = [
  { x: WORLD.safehouse.x, z: WORLD.safehouse.z, label: 'S', color: '#7dff9b', name: 'Safehouse' },
  { x: WORLD.garage.x, z: WORLD.garage.z, label: 'G', color: '#46e0ff', name: 'Chrome & Torque' },
  { x: 4, z: -60, label: '!', color: '#ffcf4a', name: 'Story job' },
  { x: -40, z: 260, label: 'M', color: '#ff4fd8', name: 'Neon Mercado' },
  { x: 222, z: -300, label: 'R', color: '#ff7a59', name: 'Street race' },
  { x: 300, z: 180, label: '$', color: '#c08bff', name: 'Heist target' },
  { x: 60, z: -470, label: 'B', color: '#4fc3ff', name: 'Marina' },
  { x: 180, z: -120, label: 'P', color: '#ff3b5c', name: 'PSPD precinct' },
];

/** Show the full-screen World Map / pause / save screen. data: { career, completion, saves, player, tab } */
export function showWorldMap(container, data) {
  const { career, completion, saves, player } = data;
  container.innerHTML = '';
  container.classList.remove('hide');
  const done = new Map(career.completed.map((c) => [c.id, c.medal]));
  const missionRows = MISSIONS.map((m) => {
    const medal = done.get(m.id);
    const cur = m.id === career.missionIndex + 1 && !medal;
    const col = medal === 'gold' ? '#ffcf3a' : medal === 'silver' ? '#cfd8e6' : cur ? '#ff7a59' : 'rgba(255,255,255,.18)';
    return `<div style="display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;height:25px;font-size:12.5px;font-weight:800;border-top:1px solid rgba(255,255,255,.06);${cur ? 'color:#ffb38f' : medal ? '' : 'color:#7d8aa3'}">
      <span style="width:18px;height:18px;border-radius:50%;background:${col};display:flex;align-items:center;justify-content:center;color:#0a0e16;font-size:10px;font-weight:900">${medal ? '★' : m.id}</span>
      <span>${m.id}. ${m.title}</span><span style="font-size:10.5px;letter-spacing:.08em;color:${col}">${medal ? medal.toUpperCase() : cur ? 'ACTIVE' : '$' + m.reward.toLocaleString('en-US')}</span></div>`;
  }).join('');
  const crewRows = CREW.map((c) => `<div style="display:grid;grid-template-columns:40px 1fr;gap:8px;align-items:center;margin-top:6px"><div style="width:40px;height:40px;border-radius:7px;overflow:hidden">${makePortraitSVG(c, 'm' + c.key)}</div><div><div style="font:italic 900 14px ${NARROW};color:${c.accent};letter-spacing:.05em">${c.name.toUpperCase()}</div><div style="font-size:11px;color:#c3cfdf;font-weight:700">${c.role} · ${c.key} ${c.ability}</div></div></div>`).join('');
  const s = career.stats;
  const statRows = [['Distance driven', `${s.distanceKm.toFixed(1)} km`], ['Cops evaded', s.copsEvaded], ['Cars stolen', s.carsStolen], ['Races won', s.racesWon], ['Headshots', s.headshots], ['Time played', `${Math.floor(s.playMinutes / 60)}h ${s.playMinutes % 60}m`]]
    .map(([k, v]) => `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;height:20px;color:#c3cfdf"><span>${k}</span><b style="color:#fff">${v}</b></div>`).join('');
  const saveRows = saves.map((sv) => `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:6px 8px;margin-top:5px;border-radius:6px;background:${sv.slot === 1 ? 'rgba(255,207,74,.14)' : 'rgba(255,255,255,.05)'};border:1px solid ${sv.slot === 1 ? '#ffcf4a' : 'rgba(255,255,255,.1)'}"><b style="font-size:12px;color:#ffcf4a">SLOT ${sv.slot}</b><span style="font-size:11.5px;font-weight:700">${sv.empty ? '— Empty —' : sv.label}</span><span style="font-size:11px;color:#9fb0c8;font-weight:700">${sv.empty ? '' : `$${(sv.cash || 0).toLocaleString('en-US')} · ${sv.completed}/10`}</span></div>`).join('');
  const ring = 2 * Math.PI * 34;
  const panel = (inner, extra = '') => `<div class="pn" style="padding:11px 13px;${extra}">${inner}</div>`;
  const head = (t, c = '#9fb0c8') => `<div style="font-size:11px;font-weight:900;letter-spacing:.14em;color:${c};margin-bottom:4px">${t}</div>`;
  container.innerHTML = `<div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(14,10,34,.94),rgba(8,14,26,.96))"></div>
  <div style="position:absolute;inset:0;padding:16px 18px;display:grid;grid-template-rows:44px 1fr 26px;gap:10px">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="font:italic 900 30px ${NARROW};letter-spacing:.06em;background:linear-gradient(90deg,#ffcf4a,#ff7a59,#ff4fd8);-webkit-background-clip:text;color:transparent">PALMA SOL</div>
      ${['MAP', 'STORY', 'CREW', 'STATS', 'SAVE'].map((t, i) => `<span style="font-size:12.5px;font-weight:900;letter-spacing:.12em;padding:5px 12px;border-radius:5px;${i === 0 ? 'background:#ffcf4a;color:#0a0e16' : 'color:#c3cfdf;border:1px solid rgba(255,255,255,.14)'}">${t}</span>`).join('')}
      <span style="margin-left:auto;font:italic 900 28px ${NARROW};color:#7dff9b">$${career.cash.toLocaleString('en-US')}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 330px 300px;gap:12px;min-height:0">
      <div class="pn" style="position:relative;padding:10px;display:flex;flex-direction:column;min-height:0">
        <div style="display:flex;justify-content:space-between;align-items:center">${head('PALMA SOL · CITY MAP', '#ffcf4a')}<span style="font-size:11px;color:#9fb0c8;font-weight:700">6 DISTRICTS · ${MAP_ICONS.length} POINTS OF INTEREST</span></div>
        <canvas id="wmap" style="flex:1;width:100%;min-height:0;border-radius:6px"></canvas>
        <div id="wlegend" style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px 10px;margin-top:8px"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
        ${panel(`<div style="display:flex;align-items:center;gap:14px"><svg width="84" height="84" viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" stroke="rgba(255,255,255,.12)" stroke-width="9" fill="none"/><circle cx="42" cy="42" r="34" stroke="url(#rg)" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="${(ring * completion) / 100} ${ring}" transform="rotate(-90 42 42)"/><defs><linearGradient id="rg"><stop offset="0" stop-color="#ffcf4a"/><stop offset="1" stop-color="#ff4fd8"/></linearGradient></defs><text x="42" y="47" text-anchor="middle" fill="#fff" font-size="16" font-weight="900" font-family="${FONT}">${completion}%</text></svg>
          <div>${head('STORY PROGRESS', '#ffcf4a')}<div style="font:italic 900 22px ${NARROW};letter-spacing:.04em">${completion}% COMPLETE</div><div style="font-size:11.5px;color:#c3cfdf;font-weight:700">${career.completed.length}/10 jobs · Rank ${data.rank.rank} ${data.rank.title}</div></div></div>`)}
        ${panel(`${head('STORY JOBS · RATINGS', '#ff7a59')}${missionRows}`, 'flex:1;min-height:0')}
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
        ${panel(`${head('CREW ROSTER', '#46e0ff')}${crewRows}`)}
        ${panel(`${head('CAREER STATS', '#7dff9b')}${statRows}`)}
        ${panel(`${head('SAVE SLOTS', '#ffcf4a')}${saveRows}<div style="font-size:10.5px;color:#9fb0c8;margin-top:6px;font-weight:700">[1-3] save · [Shift+1-3] load · Saved on this device</div>`, 'flex:1')}
      </div>
    </div>
    <div style="display:flex;gap:18px;font-size:11.5px;color:#9fb0c8;font-weight:700;letter-spacing:.05em"><span><b style="color:#fff">M / ESC</b> resume</span><span><b style="color:#fff">G</b> garage</span><span><b style="color:#fff">R</b> radio</span><span><b style="color:#fff">WASD</b> drive · <b style="color:#fff">SPACE</b> handbrake · <b style="color:#fff">SHIFT</b> nitro · <b style="color:#fff">F</b> steal car · <b style="color:#fff">CLICK</b> shoot</span></div>
  </div>`;
  const legend = container.querySelector('#wlegend');
  legend.innerHTML = DISTRICTS.map((d) => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800"><i style="width:11px;height:11px;border-radius:3px;background:${d.color};display:block"></i>${d.name}</div>`).join('')
    + MAP_ICONS.slice(0, 6).map((ic) => `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#c3cfdf"><i style="width:15px;height:15px;border-radius:50%;background:${ic.color};color:#0a0e16;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;font-style:normal">${ic.label}</i>${ic.name}</div>`).join('');
  const canvas = container.querySelector('#wmap');
  requestAnimationFrame(() => drawWorldMapCanvas(canvas, player, data));
  drawWorldMapCanvas(canvas, player, data);
}

function drawWorldMapCanvas(canvas, player, data) {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, Math.floor(rect.width));
  const hgt = Math.max(200, Math.floor(rect.height));
  canvas.width = w * 2;
  canvas.height = hgt * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  // Map is drawn rotated so the coast runs left-right: world z → screen x, world x → screen y (ocean at the bottom).
  ctx.save();
  const span = WORLD.maxZ - WORLD.minZ + 40;
  const depth = WORLD.cityMaxX + 30 - (WORLD.oceanEdgeX - 50);
  const scale = Math.min(w / span, hgt / depth);
  ctx.translate((w - span * scale) / 2, (hgt - depth * scale) / 2);
  ctx.translate(0, depth * scale);
  ctx.rotate(-Math.PI / 2);
  ctx.translate(0, 0);
  const off = document.createElement('canvas');
  const x0 = WORLD.oceanEdgeX - 50;
  const z0 = WORLD.minZ - 20;
  off.width = Math.ceil(depth * scale);
  off.height = Math.ceil(span * scale);
  paintCityMap(off.getContext('2d'), x0, z0, scale, off.width, off.height, { districts: true });
  ctx.drawImage(off, 0, 0);
  ctx.restore();
  const toScreen = (x, z) => [(w - span * scale) / 2 + (z - z0) * scale, (hgt - depth * scale) / 2 + depth * scale - (x - x0) * scale];
  // District labels.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const [sx, sy] = toScreen((Math.max(d.x0, -10) + d.x1) / 2, (d.z0 + d.z1) / 2);
    ctx.font = `italic 900 13px ${NARROW}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,14,22,.85)';
    ctx.strokeText(d.name, sx, sy);
    ctx.fillStyle = d.color;
    ctx.fillText(d.name, sx, sy);
  }
  for (const ic of MAP_ICONS) {
    const [sx, sy] = toScreen(ic.x, ic.z);
    ctx.fillStyle = ic.color;
    ctx.strokeStyle = '#0a0e16';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0a0e16';
    ctx.font = `900 10px ${FONT}`;
    ctx.fillText(ic.label, sx, sy + 0.5);
  }
  if (player) {
    const [px, py] = toScreen(player.x, player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.heading - Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ff3b5c';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 8); ctx.lineTo(0, 3); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.font = `900 10px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText('YOU', px, py + 18);
  }
  ctx.font = `800 10px ${FONT}`;
  ctx.fillStyle = '#e7f7ff';
  ctx.textAlign = 'left';
  ctx.fillText('PACIFIC OF PALMA · OCEAN', 10, hgt - 12);
}

/** Hide the world map. */
export function hideOverlay(container) {
  container.classList.add('hide');
  container.innerHTML = '';
}

/** The title screen: logo, tagline and menu over the live city view. */
export function showTitleScreen(container, { hasSave = false } = {}) {
  container.classList.remove('hide');
  const items = [hasSave ? 'CONTINUE' : 'NEW GAME', hasSave ? 'NEW GAME' : 'LOAD GAME', 'CONTROLS', 'SETTINGS'];
  container.innerHTML = `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,8,26,.82) 0%,rgba(10,8,26,.45) 45%,rgba(10,8,26,0) 70%)"></div>
  <div style="position:absolute;left:70px;top:110px">
    <div style="font:800 13px ${FONT};letter-spacing:.4em;color:#ffcf4a">AN ORIGINAL OPEN-WORLD CRIME STORY</div>
    <div style="font:italic 900 112px/0.95 ${NARROW};letter-spacing:.02em;background:linear-gradient(180deg,#fff1b8 0%,#ffcf4a 35%,#ff7a59 65%,#ff4fd8 100%);-webkit-background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 rgba(10,8,26,.6))">PALMA SOL</div>
    <div style="display:inline-block;margin-top:6px;padding:4px 16px;background:#46e0ff;color:#0a0e16;font:italic 900 30px ${NARROW};letter-spacing:.16em;transform:skewX(-10deg)">NEON COAST</div>
    <div style="margin-top:40px;display:flex;flex-direction:column;gap:10px">${items.map((t, i) => `<div style="font:italic 900 26px ${NARROW};letter-spacing:.08em;color:${i === 0 ? '#0a0e16' : '#fff'};${i === 0 ? 'background:#ffcf4a;padding:3px 18px;display:inline-block;width:max-content' : 'padding:3px 18px'}">${t}</div>`).join('')}</div>
    <div style="margin-top:28px;font:700 13px ${FONT};color:#c3cfdf">Press <b style="color:#fff">ENTER</b> or click to play · WASD drive · F steal car · M map</div>
  </div>`;
}
