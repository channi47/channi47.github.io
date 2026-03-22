/* ═══════════════════════════════════════════════════
   NEURAL PARTICLE NETWORK
═══════════════════════════════════════════════════ */
class Particle {
  constructor(canvas, isMobile) {
    this.canvas = canvas;
    this.isMobile = isMobile;
    this.spawn();
  }

  spawn() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.baseX = this.x;
    this.baseY = this.y;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.radius = 1.2 + Math.random() * 1.8;
    this.opacity = 0.35 + Math.random() * 0.55;
    this.pulseOffset = Math.random() * Math.PI * 2;
    // 75% cyan, 25% violet
    this.isCyan = Math.random() < 0.75;
    this.color = this.isCyan ? '0,212,255' : '123,47,255';
  }

  update(mouse, time) {
    // Mouse repulsion
    if (mouse.x !== null && mouse.y !== null) {
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const REPEL = this.isMobile ? 80 : 130;
      if (dist < REPEL && dist > 0) {
        const force = (REPEL - dist) / REPEL;
        const strength = force * force * (this.isMobile ? 0.6 : 1.0);
        this.vx += (dx / dist) * strength;
        this.vy += (dy / dist) * strength;
      }
    }

    // Gentle pull toward base position (prevents drifting off-screen)
    this.vx += (this.baseX - this.x) * 0.0018;
    this.vy += (this.baseY - this.y) * 0.0018;

    // Damping
    this.vx *= 0.94;
    this.vy *= 0.94;

    // Clamp velocity
    const maxV = 3.5;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxV) {
      this.vx = (this.vx / speed) * maxV;
      this.vy = (this.vy / speed) * maxV;
    }

    this.x += this.vx;
    this.y += this.vy;

    // Pulse opacity
    this.currentOpacity = this.opacity + Math.sin(time * 0.0008 + this.pulseOffset) * 0.15;
    this.currentOpacity = Math.max(0.1, Math.min(1, this.currentOpacity));
  }

  draw(ctx) {
    const r = this.radius;
    const op = this.currentOpacity;

    // Outer glow
    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 5);
    glow.addColorStop(0, `rgba(${this.color},${op * 0.7})`);
    glow.addColorStop(0.4, `rgba(${this.color},${op * 0.2})`);
    glow.addColorStop(1, `rgba(${this.color},0)`);
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Core particle
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${this.color},${op})`;
    ctx.fill();
  }
}

class NeuralNet {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: null, y: null };
    this.animId = null;
    this.time = 0;
    this.isMobile = window.innerWidth < 768;
    this.PARTICLE_COUNT = this.isMobile ? 80 : 180;
    this.CONNECT_DIST = this.isMobile ? 100 : 145;
  }

  init() {
    this._resize();
    this._spawnParticles();
    this._bindEvents();
    this._loop();
  }

  _resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.offsetWidth;
    this.canvas.height = parent.offsetHeight;
  }

  _spawnParticles() {
    this.particles = [];
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      this.particles.push(new Particle(this.canvas, this.isMobile));
    }
  }

  _respawn() {
    // On resize, rebase particles proportionally
    const scaleX = this.canvas.width  / (this._prevW || this.canvas.width);
    const scaleY = this.canvas.height / (this._prevH || this.canvas.height);
    this.particles.forEach(p => {
      p.baseX *= scaleX;
      p.baseY *= scaleY;
      p.x = p.baseX;
      p.y = p.baseY;
    });
    this._prevW = this.canvas.width;
    this._prevH = this.canvas.height;
  }

  _bindEvents() {
    const rect = () => this.canvas.getBoundingClientRect();

    this.canvas.addEventListener('mousemove', e => {
      const r = rect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const r = rect();
      this.mouse.x = e.touches[0].clientX - r.left;
      this.mouse.y = e.touches[0].clientY - r.top;
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });

    // Resize
    this._prevW = this.canvas.width;
    this._prevH = this.canvas.height;
    const ro = new ResizeObserver(() => {
      this._resize();
      this._respawn();
    });
    ro.observe(this.canvas.parentElement);
  }

  _drawConnections() {
    const ctx = this.ctx;
    const pts = this.particles;
    const dist = this.CONNECT_DIST;
    const len = pts.length;

    for (let i = 0; i < len; i++) {
      for (let j = i + 1; j < len; j++) {
        const dx = pts[i].x - pts[j].x;
        const dy = pts[i].y - pts[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < dist) {
          const alpha = Math.pow(1 - d / dist, 1.8) * 0.55;
          const grad = ctx.createLinearGradient(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
          grad.addColorStop(0, `rgba(${pts[i].color},${alpha})`);
          grad.addColorStop(1, `rgba(${pts[j].color},${alpha})`);
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = alpha * 1.5;
          ctx.stroke();
        }
      }
    }
  }

  _loop() {
    this.animId = requestAnimationFrame(() => this._loop());
    this.time++;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach(p => p.update(this.mouse, this.time));
    this._drawConnections();
    this.particles.forEach(p => p.draw(ctx));
  }

  destroy() {
    cancelAnimationFrame(this.animId);
  }
}

/* ═══════════════════════════════════════════════════
   SCROLL EFFECTS
═══════════════════════════════════════════════════ */
function initScrollEffects() {
  // Section reveal — remove visible when out of view so animation replays
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      } else {
        entry.target.classList.remove('visible');
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // Skill bars — replay on re-scroll
  const skillsGrid = document.querySelector('.skills-grid');
  if (skillsGrid) {
    const skillObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.skill-fill').forEach(bar => bar.classList.add('animate'));
        } else {
          entry.target.querySelectorAll('.skill-fill').forEach(bar => bar.classList.remove('animate'));
        }
      });
    }, { threshold: 0.2 });
    skillObs.observe(skillsGrid);
  }

  // Stat counters — replay on re-scroll
  const statsSection = document.querySelector('.about-stats');
  if (statsSection) {
    const statObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          entry.target.querySelectorAll('.stat-number').forEach((el, i) => {
            const raw = el.dataset.target;
            if (raw === '∞') {
              el._countId = (el._countId || 0) + 1;
              const id = el._countId;
              const duration = 1800;
              setTimeout(() => {
                if (el._countId !== id) return;
                const start = performance.now();
                const overflow = [9999, 99999, 999999];
                const update = (now) => {
                  if (el._countId !== id) return;
                  const p = Math.min((now - start) / duration, 1);
                  if (p < 0.8) {
                    // ease-in: accelerating 0 → 999
                    el.textContent = Math.round(Math.pow(p / 0.8, 2) * 999);
                  } else if (p < 0.97) {
                    // overflow flash
                    el.textContent = overflow[Math.floor(Math.random() * overflow.length)];
                  } else {
                    el.textContent = '∞';
                    el.classList.add('stat-infinity-pop');
                    return;
                  }
                  requestAnimationFrame(update);
                };
                requestAnimationFrame(update);
              }, i * 100 + 120);
            } else {
              countUp(el, parseInt(raw, 10), 1800, i * 100 + 120);
            }
          });
        } else {
          entry.target.classList.remove('visible');
          entry.target.querySelectorAll('.stat-number').forEach(el => {
            el._countId = (el._countId || 0) + 1;
            el.textContent = '0';
            el.classList.remove('stat-infinity-pop');
          });
        }
      });
    }, { threshold: 0.3 });
    statObs.observe(statsSection);
  }
}

function countUp(el, target, duration = 1800, delay = 0) {
  el._countId = (el._countId || 0) + 1;
  const id = el._countId;
  setTimeout(() => {
    if (el._countId !== id) return; // cancelled during delay
    const start = performance.now();
    const update = (now) => {
      if (el._countId !== id) return; // cancelled by re-scroll
      const progress = Math.min((now - start) / duration, 1);
      // ease-out expo: rockets up then glides smoothly to target
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target + '+';
      }
    };
    requestAnimationFrame(update);
  }, delay);
}

/* ═══════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════ */
function initNavigation() {
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');

  // Mobile toggle
  navToggle?.addEventListener('click', () => {
    const isOpen = navToggle.classList.toggle('open');
    navLinks.classList.toggle('open');
    if (isOpen) SFX.navOpen(); else SFX.navClose();
  });

  // Smooth scroll + close mobile nav on link click
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        navLinks?.classList.remove('open');
        navToggle?.classList.remove('open');
      }
    });
  });

  // Navbar scroll state
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  // Active nav link tracking
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-link');
  const sectionObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navAnchors.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`);
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => sectionObs.observe(s));
}

/* ═══════════════════════════════════════════════════
   HUD CLOCK
═══════════════════════════════════════════════════ */
function initHUDClock() {
  const hudTime = document.getElementById('hud-time');
  const footerUptime = document.getElementById('footer-uptime');
  const startTime = Date.now();

  const update = () => {
    // HUD: current time (KST, UTC+9)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    if (hudTime) hudTime.textContent = `${hh}:${mm}:${ss}`;

    // Footer: uptime since page load
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const uh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const um = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const us = String(elapsed % 60).padStart(2, '0');
    if (footerUptime) footerUptime.textContent = `${uh}:${um}:${us}`;
  };

  update();
  setInterval(update, 1000);
}

/* ═══════════════════════════════════════════════════
   HUD MOUSE COORDS
═══════════════════════════════════════════════════ */
function initHUDCoords() {
  const label = document.querySelector('.hud-tl .hud-label');
  if (!label) return;
  document.addEventListener('mousemove', e => {
    const x = String(Math.round(e.clientX)).padStart(4, '0');
    const y = String(Math.round(e.clientY)).padStart(4, '0');
    label.textContent = `X:${x} Y:${y}`;
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════
   CONTACT FORM
═══════════════════════════════════════════════════ */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const WEBHOOK = 'https://discord.com/api/webhooks/1484926426766639256/6d0Akzrn5i7PAy94a2cPP18ZvehEg10tn41tAzixNfyDebsJlEW4LBumG5yl3W_FNQtA';

  // Real-time validation — shake empty fields on input blur
  const inputs = form.querySelectorAll('input, textarea');
  inputs.forEach(el => {
    el.addEventListener('blur', () => validateField(el));
    el.addEventListener('input', () => {
      if (el.value.trim()) el.classList.remove('field-error');
    });
  });

  function validateField(el) {
    const empty = !el.value.trim();
    el.classList.toggle('field-error', empty);
    return !empty;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Validate all fields
    let valid = true;
    inputs.forEach(el => { if (!validateField(el)) valid = false; });
    if (!valid) {
      // Shake the button
      const btn = form.querySelector('button[type="submit"]');
      btn.classList.add('btn-shake');
      setTimeout(() => btn.classList.remove('btn-shake'), 500);
      SFX.error();
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>TRANSMITTING...</span>';

    const name    = form.querySelector('#name').value.trim();
    const email   = form.querySelector('#email').value.trim();
    const message = form.querySelector('#message').value.trim();

    const payload = {
      embeds: [{
        title: '📨 새 메시지 도착',
        color: 0x00d4ff,
        fields: [
          { name: 'NAME',    value: name,    inline: true },
          { name: 'EMAIL',   value: email,   inline: true },
          { name: 'MESSAGE', value: message, inline: false },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'channi47.github.io — CONTACT FORM' },
      }],
    };

    try {
      const res = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        SFX.success();
        btn.innerHTML = '<span>TRANSMITTED ✓</span>';
        btn.style.borderColor = '#00ff88';
        btn.style.color = '#00ff88';
        form.reset();
        inputs.forEach(el => el.classList.remove('field-error'));
        setTimeout(() => {
          btn.innerHTML = original;
          btn.style.borderColor = '';
          btn.style.color = '';
          btn.disabled = false;
        }, 3000);
      } else {
        throw new Error('webhook failed');
      }
    } catch {
      SFX.error();
      btn.innerHTML = '<span>ERROR — RETRY</span>';
      btn.style.borderColor = '#ff4444';
      btn.style.color = '#ff4444';
      setTimeout(() => {
        btn.innerHTML = original;
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.disabled = false;
      }, 3000);
    }
  });
}

/* ═══════════════════════════════════════════════════
   AGE COUNTER (born 2006.04.07)
═══════════════════════════════════════════════════ */
function initAgeClock() {
  const el = document.getElementById('age-counter');
  if (!el) return;

  const BIRTH = new Date('2006-04-07T00:00:00+09:00'); // KST midnight
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const isBirthday = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return now.getMonth() === 3 && now.getDate() === 7; // April 7 (KST)
  };

  const activateBirthday = () => {
    const block = document.querySelector('.scan-block');
    if (block) block.classList.add('birthday-mode');
    // Confetti burst
    spawnBirthdayParticles();
  };

  let birthdayActivated = false;

  const update = () => {
    const birthday = isBirthday();
    let ms = Date.now() - BIRTH.getTime();
    const years  = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
    ms -= years * 365.25 * 24 * 3600 * 1000;
    const months = Math.floor(ms / (30.44 * 24 * 3600 * 1000));
    ms -= months * 30.44 * 24 * 3600 * 1000;
    const days   = Math.floor(ms / (24 * 3600 * 1000));
    ms -= days   * 24 * 3600 * 1000;
    const hours  = Math.floor(ms / (3600 * 1000));
    ms -= hours  * 3600 * 1000;
    const mins   = Math.floor(ms / 60000);
    const secs   = Math.floor((ms - mins * 60000) / 1000);

    if (birthday) {
      el.textContent = `HBD ✦ ${years}Y ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      if (!birthdayActivated) { activateBirthday(); birthdayActivated = true; }
    } else {
      el.textContent = `${years}Y ${pad(months)}M ${pad(days)}D ${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }
  };

  update();
  setInterval(update, 1000);
}

function spawnBirthdayParticles() {
  const colors = ['#00d4ff', '#7b2fff', '#ff2fff', '#ffdd00', '#00ff88'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('span');
    p.className = 'bday-particle';
    p.style.cssText = `
      left:${Math.random() * 100}vw;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      width:${4 + Math.random() * 6}px;
      height:${4 + Math.random() * 6}px;
      animation-delay:${Math.random() * 1.5}s;
      animation-duration:${2 + Math.random() * 2}s;
    `;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

/* ═══════════════════════════════════════════════════
   SCROLL PROGRESS BAR
═══════════════════════════════════════════════════ */
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════
   HERO PARALLAX
═══════════════════════════════════════════════════ */
function initParallax() {
  const hero = document.getElementById('hero');
  const content = hero?.querySelector('.hero-content');
  if (!content) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > window.innerHeight) return; // only in hero viewport
    const offset = scrollY * 0.18;
    content.style.transform = `translateY(${offset}px)`;
    // Fade out hero content gently as user scrolls
    const opacity = Math.max(0, 1 - scrollY / (window.innerHeight * 0.7));
    content.style.opacity = opacity;
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════
   MUSIC PLAYER (YouTube IFrame API)
═══════════════════════════════════════════════════ */
let ytPlayer = null;
let ytReady = false;
let progressTimer = null;

// Called automatically by YouTube IFrame API when loaded
window.onYouTubeIframeAPIReady = function () {
  ytReady = true;
  ytPlayer = new YT.Player('yt-player', {
    videoId: 'G5mbcsDvKo8',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      rel: 0,
      modestbranding: 1,
    },
    events: {
      onReady: onYTReady,
      onStateChange: onYTStateChange,
    },
  });
};

function onYTReady(event) {
  const data = event.target.getVideoData();
  const titleEl  = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');
  if (titleEl)  titleEl.textContent  = data.title  || 'Unknown Track';
  if (artistEl) artistEl.textContent = data.author || 'Unknown Artist';

  const totalEl = document.getElementById('time-total');
  if (totalEl) totalEl.textContent = formatTime(event.target.getDuration());
}

function onYTStateChange(event) {
  const disc    = document.getElementById('vinyl-disc');
  const needle  = document.getElementById('vinyl-needle');
  const playIcon  = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');

  const isPlaying = event.data === YT.PlayerState.PLAYING;

  if (disc)   disc.classList.toggle('playing', isPlaying);
  if (needle) needle.classList.toggle('playing', isPlaying);
  if (playIcon)  playIcon.style.display  = isPlaying ? 'none' : '';
  if (pauseIcon) pauseIcon.style.display = isPlaying ? ''     : 'none';

  clearInterval(progressTimer);
  if (isPlaying) {
    progressTimer = setInterval(updateProgress, 500);
  }
}

function updateProgress() {
  if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
  const current  = ytPlayer.getCurrentTime();
  const duration = ytPlayer.getDuration();
  if (!duration) return;

  const pct = (current / duration) * 100;
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = pct + '%';

  const curEl = document.getElementById('time-current');
  if (curEl) curEl.textContent = formatTime(current);
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function initMusicPlayer() {
  const playBtn = document.getElementById('play-btn');
  const track   = document.getElementById('progress-track');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!ytPlayer || !ytReady) return;
      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) {
        ytPlayer.pauseVideo();
      } else {
        ytPlayer.playVideo();
      }
    });
  }

  if (track) {
    track.addEventListener('click', (e) => {
      if (!ytPlayer || !ytReady) return;
      const rect = track.getBoundingClientRect();
      const pct  = (e.clientX - rect.left) / rect.width;
      ytPlayer.seekTo(ytPlayer.getDuration() * pct, true);
    });
  }

  // Volume control
  let currentVol = 80;
  let isMuted = false;
  const volTrack   = document.getElementById('volume-track');
  const volFill    = document.getElementById('volume-fill');
  const volLabel   = document.getElementById('vol-label');
  const volIconBtn = document.getElementById('vol-icon-btn');

  const setVolume = (vol) => {
    currentVol = Math.max(0, Math.min(100, Math.round(vol)));
    if (volFill)  volFill.style.width = currentVol + '%';
    if (volLabel) volLabel.textContent = currentVol;
    if (ytPlayer && ytReady) ytPlayer.setVolume(currentVol);
    isMuted = currentVol === 0;
    updateVolIcon();
  };

  const updateVolIcon = () => {
    if (!volIconBtn) return;
    const icon = volIconBtn.querySelector('svg');
    if (!icon) return;
    if (isMuted || currentVol === 0) {
      icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else if (currentVol < 50) {
      icon.innerHTML = '<path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>';
    } else {
      icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    }
  };

  if (volTrack) {
    const applyVolFromEvent = (e) => {
      const rect = volTrack.getBoundingClientRect();
      const pct  = ((e.clientX - rect.left) / rect.width) * 100;
      isMuted = false;
      setVolume(pct);
    };
    let dragging = false;
    volTrack.addEventListener('mousedown', (e) => { dragging = true; applyVolFromEvent(e); });
    document.addEventListener('mousemove', (e) => { if (dragging) applyVolFromEvent(e); });
    document.addEventListener('mouseup',   () => { dragging = false; });
    volTrack.addEventListener('click', applyVolFromEvent);
  }

  if (volIconBtn) {
    volIconBtn.addEventListener('click', () => {
      if (isMuted) {
        isMuted = false;
        setVolume(currentVol || 50);
      } else {
        isMuted = true;
        if (ytPlayer && ytReady) ytPlayer.setVolume(0);
        if (volFill)  volFill.style.width = '0%';
        if (volLabel) volLabel.textContent = '0';
        updateVolIcon();
      }
    });
  }
}

/* ═══════════════════════════════════════════════════
   SCI-FI SOUND ENGINE (Web Audio API)
═══════════════════════════════════════════════════ */
const SFX = (() => {
  let ctx = null;
  let lastHover = 0;

  const getCtx = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const play = (fn) => { try { fn(getCtx()); } catch (e) {} };

  // Very subtle hover blip
  const hover = () => {
    const now = Date.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    play(c => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.frequency.setValueAtTime(1600, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.055);
      g.gain.setValueAtTime(0.045, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.055);
      o.start(c.currentTime); o.stop(c.currentTime + 0.055);
    });
  };

  // Click / select — short square descend
  const click = () => play(c => {
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'square';
    o.frequency.setValueAtTime(700, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.1);
    g.gain.setValueAtTime(0.09, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
    o.start(c.currentTime); o.stop(c.currentTime + 0.1);
  });

  // Section scan reveal — ascending sine sweep
  const reveal = () => play(c => {
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(280, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(860, c.currentTime + 0.28);
    g.gain.setValueAtTime(0.04, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.28);
    o.start(c.currentTime); o.stop(c.currentTime + 0.28);
  });

  // Form success — ascending 3-note arpeggio (C5 E5 G5)
  const success = () => play(c => {
    [523, 659, 784].forEach((freq, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.frequency.value = freq;
      const t = c.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.start(t); o.stop(t + 0.22);
    });
  });

  // Form error — sawtooth descend buzz
  const error = () => play(c => {
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(75, c.currentTime + 0.18);
    g.gain.setValueAtTime(0.09, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    o.start(c.currentTime); o.stop(c.currentTime + 0.18);
  });

  // Nav menu open — quick sweep up
  const navOpen = () => play(c => {
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(180, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.14);
    g.gain.setValueAtTime(0.07, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    o.start(c.currentTime); o.stop(c.currentTime + 0.14);
  });

  // Nav menu close — sweep down
  const navClose = () => play(c => {
    const o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.frequency.setValueAtTime(620, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.14);
    g.gain.setValueAtTime(0.07, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.14);
    o.start(c.currentTime); o.stop(c.currentTime + 0.14);
  });

  // Arcade coin insert — hover on PLAY NOW
  const coin = () => play(c => {
    [[988, 0], [1318, 0.07]].forEach(([freq, delay]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'square';
      o.frequency.setValueAtTime(freq, c.currentTime + delay);
      const t = c.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.12);
    });
  });

  // Game start — click on PLAY NOW (ascending power-up sweep)
  const gameStart = () => play(c => {
    [261, 329, 392, 523, 659, 784].forEach((freq, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'square';
      o.frequency.value = freq;
      const t = c.currentTime + i * 0.07;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.12);
    });
  });

  return { hover, click, reveal, success, error, navOpen, navClose, coin, gameStart };
})();

function initSoundEffects() {
  // Hover + click sounds on all interactive elements
  const hoverTargets = [
    '.nav-link', '.about-link', '.social-link', '.project-link',
    '.project-card', '.btn-primary', '.btn-outline', '.play-btn',
    '#play-btn', '.vol-icon-btn',
  ];
  hoverTargets.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.addEventListener('mouseenter', () => SFX.hover(), { passive: true });
      el.addEventListener('click', () => SFX.click(), { passive: true });
    });
  });

  // PLAY NOW button — arcade coin on hover, power-up on click
  const gameBtn = document.querySelector('.game-play-btn');
  if (gameBtn) {
    gameBtn.addEventListener('mouseenter', () => SFX.coin(), { passive: true });
    gameBtn.addEventListener('click', () => SFX.gameStart(), { passive: true });
  }

  // Section reveal sounds (only once per section entering view)
  const revealedSections = new WeakSet();
  const secObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !revealedSections.has(entry.target)) {
        revealedSections.add(entry.target);
        SFX.reveal();
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('section[id]').forEach(s => secObs.observe(s));
}

/* ═══════════════════════════════════════════════════
   EASTER EGGS
═══════════════════════════════════════════════════ */
function initEasterEggs(neuralNet) {

  /* ── 히어로 이름 클릭 → 글리치 버스트 ── */
  const heroName = document.querySelector('.hero-name.glitch');
  if (heroName) {
    const CODE_NAMES = ['//CR-7734', 'SUBJECT_07', 'NODE_∅X', '█████████', 'ERR_IDENTITY'];
    let glitching = false;

    const sfxGlitchBurst = () => {
      try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        [0, 0.07, 0.14].forEach(delay => {
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(880, c.currentTime + delay);
          o.frequency.exponentialRampToValueAtTime(220, c.currentTime + delay + 0.12);
          g.gain.setValueAtTime(0.12, c.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.13);
          o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.15);
        });
      } catch(e) {}
    };

    heroName.style.cursor = 'pointer';
    heroName.addEventListener('click', () => {
      if (glitching) return;
      glitching = true;
      const original = heroName.getAttribute('data-text');
      const codeName = CODE_NAMES[Math.floor(Math.random() * CODE_NAMES.length)];
      heroName.setAttribute('data-text', codeName);
      heroName.classList.add('super-glitch');
      sfxGlitchBurst();
      setTimeout(() => {
        heroName.setAttribute('data-text', original);
        heroName.classList.remove('super-glitch');
        glitching = false;
      }, 1800);
    });
  }

  /* ── D: HUD 좌표 패널 5회 클릭 → 커서 추적 모드 ── */
  const hudTl = document.querySelector('.hud-tl');
  const hudLabel = hudTl ? hudTl.querySelector('.hud-label') : null;
  if (hudTl && hudLabel && neuralNet) {
    let hudClicks = 0;
    let hudTimer = null;
    let trackActive = false;

    // 플래시 엘리먼트 생성
    const flash = document.createElement('div');
    flash.id = 'hud-locked-flash';
    document.body.appendChild(flash);

    const showFlash = (msg) => {
      flash.textContent = msg;
      flash.classList.add('show');
      setTimeout(() => flash.classList.remove('show'), 1800);
    };

    // 파티클 추적 모드 토글
    const setTrackMode = (on) => {
      trackActive = on;
      neuralNet.trackMode = on;
      if (on) {
        hudTl.classList.add('track-active');
        showFlash('// COORDINATES LOCKED — TRACKING ACTIVE');
      } else {
        hudTl.classList.remove('track-active');
        showFlash('// TRACKING DISENGAGED');
      }
    };

    hudTl.style.cursor = 'pointer';
    hudTl.addEventListener('click', () => {
      hudClicks++;
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => { hudClicks = 0; }, 1200);

      if (hudClicks >= 5) {
        hudClicks = 0;
        setTrackMode(!trackActive);
      }
    });
  }

  /* ── E: 백틱(`) 키 → 히든 미니 터미널 토글 ── */
  // 터미널 HTML 생성
  const terminal = document.createElement('div');
  terminal.id = 'easter-terminal';
  terminal.innerHTML = `
    <div class="terminal-titlebar">
      <div class="terminal-dot"></div>
      <span>HYEONGCHAN-SYS v1.0 // SECURE SHELL</span>
    </div>
    <div class="terminal-body" id="term-body"></div>
    <div class="terminal-input-row">
      <span class="term-prompt">visitor@portfolio:~$&nbsp;</span>
      <input id="term-input" type="text" autocomplete="off" spellcheck="false" />
    </div>
  `;
  document.body.appendChild(terminal);

  const termBody = document.getElementById('term-body');
  const termInput = document.getElementById('term-input');

  const termPrint = (text, cls = 'out') => {
    text.split('\n').forEach(line => {
      const el = document.createElement('div');
      el.className = `term-line ${cls}`;
      el.textContent = line;
      termBody.appendChild(el);
    });
    termBody.scrollTop = termBody.scrollHeight;
  };

  const FS = {
    'about.txt': `NAME     : 박형찬 (HYEONGCHAN)\nROLE     : Developer & Gamer\nLOC      : Seoul, KR\nSTATUS   : // ONLINE\nSPEC     : JavaScript, Python, C, C++`,
    'projects.txt': `[0] breakout.exe   — Arcade Breakout (JS/HTML/CSS)\n[1] portfolio.exe  — This site (Vanilla JS)`,
    'readme.txt': `이 터미널을 찾아낸 당신, 눈썰미가 좋군요.\n// easter egg unlocked`,
  };

  const CMDS = {
    help: () => termPrint(
      'Available commands:\n  ls            — list files\n  cat <file>    — read file\n  whoami        — identify visitor\n  clear         — clear terminal\n  exit          — close terminal\n  ping          — test connection',
      'ok'
    ),
    ls: () => termPrint(Object.keys(FS).join('  '), 'ok'),
    whoami: () => termPrint('visitor // ACCESS_LEVEL: GUEST\nYou found a hidden terminal. Impressive.', 'ok'),
    ping: () => termPrint('PONG — latency: 0ms // all systems nominal', 'ok'),
    clear: () => { termBody.innerHTML = ''; },
    exit: () => { terminal.classList.remove('open'); },
    cat: (args) => {
      const file = args[0];
      if (!file) return termPrint('usage: cat <filename>', 'err');
      if (FS[file]) termPrint(FS[file], 'ok');
      else termPrint(`cat: ${file}: No such file`, 'err');
    },
  };

  const execCmd = (raw) => {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    termPrint(`visitor@portfolio:~$ ${raw}`, 'cmd');

    if (!cmd) return;
    if (CMDS[cmd]) CMDS[cmd](args);
    else termPrint(`command not found: ${cmd}  (type 'help')`, 'err');
  };

  const openTerminal = () => {
    terminal.classList.add('open');
    if (termBody.children.length === 0) {
      termPrint('// SECURE SHELL — HYEONGCHAN-SYS', 'ok');
      termPrint("Type 'help' for available commands.", 'out');
    }
    setTimeout(() => termInput.focus(), 50);
  };

  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      execCmd(termInput.value);
      termInput.value = '';
    }
    if (e.key === 'Escape') {
      terminal.classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '`') {
      e.preventDefault();
      terminal.classList.contains('open') ? terminal.classList.remove('open') : openTerminal();
    }
    if (e.key === 'Escape' && terminal.classList.contains('open')) {
      terminal.classList.remove('open');
    }
  });

  /* ── G: 롱프레스 → CLASSIFIED 팝업 + CRT 플리커 ── */
  (() => {
    const SECRETS = [
      'PROTOCOL-DELTA ACTIVE\nCLEARANCE: LEVEL 7\nSUBJECT: HYEONGCHAN\nSTATUS: // WATCHING',
      'FILE: REDACTED\nOPERATION: ████████\nCOORDINATES: ENCRYPTED\nTIMESTAMP: ' + new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).toLocaleDateString('sv-SE'),
      'AGENT ID: CR-7734\nMISSION: PORTFOLIO_DEPLOY\nRISK LEVEL: LOW\nNEXT STEP: CLASSIFIED',
      'NEURAL_NET BREACH DETECTED\nINTRUSION SOURCE: UNKNOWN\nCOUNTERMEASURES: ACTIVE',
      'SYS CORE DUMP:\n> memory_leak: 0\n> uptime: ∞\n> threat_level: NONE',
    ];

    const sfxAlert = () => {
      try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        [[600, 0], [400, 0.12]].forEach(([freq, delay]) => {
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.type = 'square';
          o.frequency.setValueAtTime(freq, c.currentTime + delay);
          g.gain.setValueAtTime(0.08, c.currentTime + delay);
          g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 0.1);
          o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 0.1);
        });
      } catch(e) {}
    };

    // 팝업 엘리먼트 생성
    const popup = document.createElement('div');
    popup.id = 'longpress-popup';
    popup.innerHTML = '<div class="lp-inner"><div class="lp-header">// ACCESS GRANTED — CLASSIFIED</div><pre class="lp-body"></pre></div>';
    document.body.appendChild(popup);

    const showPopup = () => {
      const text = SECRETS[Math.floor(Math.random() * SECRETS.length)];
      popup.querySelector('.lp-body').textContent = text;
      popup.classList.add('show');
      document.body.classList.add('crt-flicker-once');
      sfxAlert();
      setTimeout(() => document.body.classList.remove('crt-flicker-once'), 500);
      setTimeout(() => popup.classList.remove('show'), 2500);
    };

    popup.addEventListener('click', () => popup.classList.remove('show'));

    const targets = document.querySelectorAll('.hero-name, .scan-block');
    targets.forEach(el => {
      let timer = null;
      const start = (e) => {
        if (e.button !== undefined && e.button !== 0) return; // 좌클릭만
        timer = setTimeout(() => { timer = null; showPopup(); }, 600);
      };
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

      el.addEventListener('mousedown', start);
      el.addEventListener('touchstart', start, { passive: true });
      el.addEventListener('mouseup', cancel);
      el.addEventListener('mouseleave', cancel);
      el.addEventListener('touchend', cancel);
      el.addEventListener('touchcancel', cancel);
    });
  })();

}

/* ─── NeuralNet 추적 모드 패치 ─── */
(function patchParticleUpdate() {
  const orig = Particle.prototype.update;
  Particle.prototype.update = function(mouse, time, trackMode) {
    if (trackMode && mouse.x !== null && mouse.y !== null) {
      // 추적 모드: 반발 대신 인력
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ATTRACT = this.isMobile ? 120 : 180;
      if (dist < ATTRACT && dist > 1) {
        const force = (ATTRACT - dist) / ATTRACT;
        const strength = force * force * 0.5;
        this.vx += (dx / dist) * strength;
        this.vy += (dy / dist) * strength;
      }
      // 기본 물리 (repulsion 없이)
      this.vx += (this.baseX - this.x) * 0.0018;
      this.vy += (this.baseY - this.y) * 0.0018;
      this.vx *= 0.94;
      this.vy *= 0.94;
      const maxV = this.isMobile ? 2 : 3;
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > maxV) { this.vx = (this.vx / speed) * maxV; this.vy = (this.vy / speed) * maxV; }
      this.x += this.vx;
      this.y += this.vy;
      this.currentOpacity = this.opacity + Math.sin(time * 0.0008 + this.pulseOffset) * 0.15;
      this.currentOpacity = Math.max(0.1, Math.min(1, this.currentOpacity));
    } else {
      orig.call(this, mouse, time);
    }
  };
})();

/* ─── NeuralNet._loop trackMode 전달 패치 ─── */
(function patchLoop() {
  const origLoop = NeuralNet.prototype._loop;
  NeuralNet.prototype._loop = function() {
    this.animId = requestAnimationFrame(() => this._loop());
    this.time++;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => p.update(this.mouse, this.time, this.trackMode));
    this._drawConnections();
    this.particles.forEach(p => p.draw(ctx));
  };
})();

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Delay observers slightly so elements in initial viewport animate in
  setTimeout(() => {
    initScrollEffects();
  }, 120);

  initNavigation();
  initAgeClock();
  initScrollProgress();
  initParallax();
  initHUDClock();
  initHUDCoords();
  initContactForm();
  initMusicPlayer();
  initSoundEffects();

  // Start neural net
  const net = new NeuralNet('neural-canvas');
  net.init();

  initEasterEggs(net);
});
