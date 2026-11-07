const colors = ['#c8ff00', '#ffb314', '#ff633d', '#b55cff', '#f3f5f6'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let canvas;
let context;
let frame = 0;
let pixels = [];

function draw(now) {
  context.clearRect(0, 0, innerWidth, innerHeight);
  pixels = pixels.filter(pixel => now - pixel.start < pixel.life);

  for (const pixel of pixels) {
    const age = now - pixel.start;
    const t = age / 1000;
    const progress = age / pixel.life;
    context.globalAlpha = Math.min(1, (1 - progress) / 0.35);
    context.fillStyle = pixel.color;
    const x = Math.round(pixel.x + pixel.vx * t);
    const y = Math.round(pixel.y + pixel.vy * t + 600 * t * t);
    // Square chips and tiny scanline fragments match the site's pixel graphics.
    const height = Math.floor(age / 90) % 2 ? pixel.size : Math.ceil(pixel.size / 2);
    context.fillRect(x, y, pixel.size, height);
  }

  if (pixels.length) {
    frame = requestAnimationFrame(draw);
  } else {
    canvas.remove();
    canvas = context = undefined;
    frame = 0;
  }
}

export function burstConfetti(award) {
  if (reducedMotion.matches) return;

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'award-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    context = canvas.getContext('2d');
  }

  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * scale);
  canvas.height = Math.round(innerHeight * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);

  const rect = award.querySelector('summary').getBoundingClientRect();
  const count = innerWidth < 760 ? 36 : 56;
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1;
    pixels.push({
      x: rect.left + rect.width * (side === 1 ? 0.85 : 0.15),
      y: rect.bottom + 10,
      vx: -side * (55 + Math.random() * 210),
      vy: -(140 + Math.random() * 260),
      size: 3 + Math.floor(Math.random() * 5),
      color: colors[i % colors.length],
      life: 650 + Math.random() * 200,
      start,
    });
  }
  // Rapid reveals can overlap, while keeping the effect light.
  pixels = pixels.slice(-168);
  if (!frame) frame = requestAnimationFrame(draw);
}
