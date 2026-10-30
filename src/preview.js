// Optional local browser preview: scales the 1920×1080 stage to fit and scrubs time.
// Headless Playwright capture ignores this (navigator.webdriver) and only uses window.renderFrame.

function fitStage() {
  const stage = document.getElementById('stage');
  const viewport = document.getElementById('viewport');
  if (!stage || !viewport) return;
  const pad = 16;
  const sw = Math.max(1, viewport.clientWidth - pad);
  const sh = Math.max(1, viewport.clientHeight - pad);
  stage.style.transform = `scale(${Math.min(sw / 1920, sh / 1080)})`;
}

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function startInteractivePreview() {
  const status = document.getElementById('status');
  const bar = document.getElementById('preview');
  const playBtn = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time');
  if (!bar || !playBtn || !scrub || !timeEl || typeof window.renderFrame !== 'function') return;

  document.body.classList.add('interactive');

  const params = new URLSearchParams(location.search);
  let t = Number(params.get('t'));
  if (!Number.isFinite(t)) t = 15;
  t = Math.min(180, Math.max(0, t));
  let playing = params.get('play') !== '0';
  let last = performance.now();

  const draw = () => {
    window.renderFrame(t);
    scrub.value = String(t);
    timeEl.textContent = fmt(t);
  };

  fitStage();
  window.addEventListener('resize', fitStage);
  status?.classList.add('hidden');
  bar.classList.remove('hidden');
  scrub.value = String(t);
  playBtn.textContent = playing ? 'Pause' : 'Play';
  draw();

  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? 'Pause' : 'Play';
    last = performance.now();
  });
  scrub.addEventListener('input', () => {
    t = Number(scrub.value);
    playing = false;
    playBtn.textContent = 'Play';
    draw();
  });

  const tick = (now) => {
    if (playing) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (t > 180) t = 0;
      draw();
    } else {
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function waitForReady() {
  // Frame capture loads the same page; leave layout alone so screenshots stay 1920×1080.
  if (navigator.webdriver) return;

  const status = document.getElementById('status');
  const start = performance.now();
  const poll = () => {
    if (window.bootError) {
      if (status) {
        status.classList.remove('hidden');
        status.textContent = `Failed to load: ${window.bootError}`;
      }
      return;
    }
    if (window.ready && typeof window.renderFrame === 'function') {
      startInteractivePreview();
      return;
    }
    if (performance.now() - start > 120000) {
      if (status) {
        status.classList.remove('hidden');
        status.textContent = 'Timed out waiting for scene to boot.';
      }
      return;
    }
    requestAnimationFrame(poll);
  };
  poll();
}

waitForReady();
