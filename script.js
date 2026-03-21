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
  // Section reveal
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // Skill bars
  const skillsGrid = document.querySelector('.skills-grid');
  if (skillsGrid) {
    const skillObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.skill-fill').forEach(bar => {
            bar.classList.add('animate');
          });
          skillObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    skillObs.observe(skillsGrid);
  }

  // Stat counters
  const statsSection = document.querySelector('.about-stats');
  if (statsSection) {
    const statObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.stat-number').forEach(el => {
            const target = parseInt(el.dataset.target, 10);
            countUp(el, target);
          });
          statObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    statObs.observe(statsSection);
  }
}

function countUp(el, target, duration = 1800) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target + '+';
    }
  };
  requestAnimationFrame(update);
}

/* ═══════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════ */
function initNavigation() {
  const navToggle = document.getElementById('nav-toggle');
  const navLinks  = document.getElementById('nav-links');

  // Mobile toggle
  navToggle?.addEventListener('click', () => {
    navToggle.classList.toggle('open');
    navLinks.classList.toggle('open');
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

  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const original = btn.innerHTML;
    btn.innerHTML = '<span>TRANSMITTED ✓</span>';
    btn.style.borderColor = '#00ff88';
    btn.style.color = '#00ff88';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.borderColor = '';
      btn.style.color = '';
      form.reset();
    }, 3000);
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

  // Start neural net
  const net = new NeuralNet('neural-canvas');
  net.init();
});
