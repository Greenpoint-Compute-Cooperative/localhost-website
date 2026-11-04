// Prize heat map: every [data-amt] link inside the canvas's parent is a heat source.
// Heat and size follow the prize amount; hover flares a source; the cursor adds heat.
// Rendered at 1/BLOCK resolution through the same ironbow palette as thermal.js.

const BLOCK = 5;
const MAX = 1750;

function ironLUT() {
  const stops = [[0, [4, 3, 9]], [.2, [36, 8, 84]], [.42, [133, 10, 143]], [.64, [240, 56, 43]], [.84, [255, 179, 20]], [1, [255, 250, 219]]];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    for (let j = 0; j < 3; j++) lut[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * f;
  }
  return lut;
}

function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function heatmap(canvas) {
  if (!canvas) return;
  const host = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const lut = ironLUT();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els = [...host.querySelectorAll("[data-amt]")];
  const feedEls = [...host.querySelectorAll(".g-body")];
  const feeds = feedEls.map(() => ({ x0: 0, y0: 0, x1: 0, y1: 0, src: [] }));
  const src = els.map((el, i) => ({ el, amt: +el.dataset.amt, hot: 0, target: 0, x: 0, y: 0, r: 0, seed: i * 1.7, feed: Math.max(0, feedEls.findIndex(f => f.contains(el))) }));
  for (const s of src) feeds[s.feed]?.src.push(s);
  let W = 0, H = 0, img = null, mouse = { x: -1e4, y: -1e4, heat: 0, target: 0 };
  let visible = true, raf = 0;

  function layout() {
    const cr = canvas.getBoundingClientRect();
    W = Math.max(1, Math.ceil(cr.width / BLOCK));
    H = Math.max(1, Math.ceil(cr.height / BLOCK));
    canvas.width = W; canvas.height = H;
    img = ctx.createImageData(W, H);
    feedEls.forEach((f, i) => {
      const r = f.getBoundingClientRect();
      feeds[i].x0 = (r.left - cr.left + 1) / BLOCK; feeds[i].x1 = (r.right - cr.left - 1) / BLOCK;
      feeds[i].y0 = (r.top - cr.top + 1) / BLOCK; feeds[i].y1 = (r.bottom - cr.top - 1) / BLOCK;
    });
    for (const s of src) {
      const r = s.el.getBoundingClientRect();
      s.x = (r.left + r.width / 2 - cr.left) / BLOCK;
      s.y = (r.top + r.height / 2 - cr.top) / BLOCK;
      const scale = Math.pow(s.amt / MAX, .35);
      s.r = (Math.min(r.width, r.height * 1.25) * .5 * scale + 6) / BLOCK;
      s.amp = .26 + .66 * Math.pow(s.amt / MAX, .75);
    }
  }

  for (const s of src) {
    s.el.addEventListener("pointerenter", () => { s.target = 1; if (reduce) draw(0); });
    s.el.addEventListener("pointerleave", () => { s.target = 0; if (reduce) draw(0); });
    s.el.addEventListener("focus", () => { s.target = 1; });
    s.el.addEventListener("blur", () => { s.target = 0; });
  }
  host.addEventListener("pointermove", e => {
    const cr = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - cr.left) / BLOCK; mouse.y = (e.clientY - cr.top) / BLOCK; mouse.target = 1;
  });
  host.addEventListener("pointerleave", () => { mouse.target = 0; });

  function draw(t) {
    const d = img.data;
    const ts = t * .001;
    const grain = Math.floor(ts * 12);
    for (const s of src) {
      s.hot += (s.target - s.hot) * (reduce ? 1 : .12);
      s.breath = 1 + .06 * Math.sin(ts * .9 + s.seed);
    }
    mouse.heat += (mouse.target - mouse.heat) * .08;
    const mr2 = (70 / BLOCK) ** 2;
    let o = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let feed = null;
        for (const f of feeds) if (x + .5 >= f.x0 && x + .5 <= f.x1 && y + .5 >= f.y0 && y + .5 <= f.y1) { feed = f; break; }
        if (!feed) { d[o + 3] = 0; o += 4; continue; }
        const n = noise(x * .07 + ts * .05, y * .07 - ts * .04);
        let h = .035 + n * .08;
        const wob = (n - .5) * .55;
        for (let i = 0; i < feed.src.length; i++) {
          const s = feed.src[i];
          const r = s.r * (1 + .18 * s.hot) * s.breath;
          const dx = x - s.x, dy = (y - s.y) * 1.15;
          const q = (dx * dx + dy * dy) / (r * r) + wob;
          if (q < 6) h += (s.amp + .22 * s.hot) * Math.exp(-q * 1.25);
        }
        if (mouse.heat > .01) {
          const mx = x - mouse.x, my = y - mouse.y;
          h += .22 * mouse.heat * Math.exp(-(mx * mx + my * my) / mr2);
        }
        h += (hash(x + grain, y - grain) - .5) * .025;
        h = 1 - Math.exp(-h * 1.55);
        const k = Math.max(0, Math.min(255, (h * 255) | 0)) * 3;
        d[o] = lut[k]; d[o + 1] = lut[k + 1]; d[o + 2] = lut[k + 2]; d[o + 3] = 255;
        o += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop(t) {
    if (!visible) { raf = 0; return; }
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  layout();
  new ResizeObserver(() => { layout(); if (reduce) draw(0); }).observe(host);
  if (reduce) { draw(0); return; }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(loop);
  }).observe(host);
}
