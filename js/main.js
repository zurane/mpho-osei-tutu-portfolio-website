/* Motion for the site. Vendored in /vendor: GSAP + ScrollTrigger + SplitText, Lenis. */
(() => {
  gsap.registerPlugin(ScrollTrigger, SplitText);

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const EASE = { reveal: 'expo.out', bounce: 'back.out(1.7)', swing: 'expo.inOut' };

  /* ---------- Safety net: anything on screen for 3s is shown, whatever happened to its trigger ---------- */
  const REVEAL_DEADLINE = 3000;
  function guardReveal(el, getAnimation, deadline = REVEAL_DEADLINE) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      setTimeout(() => {
        const anim = getAnimation();
        if (!anim || anim.progress() >= 1) return;
        anim.scrollTrigger?.kill();
        anim.progress(1);
      }, deadline);
    });
    io.observe(el);
  }

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  function initScroll() {
    if (!reduced) {
      lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: false });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const hash = a.getAttribute('href');
      e.preventDefault();
      if (hash === '#') return; // Link not wired up yet
      closeMenu();
      const target = hash === '#top' ? 0 : $(hash);
      if (lenis) lenis.scrollTo(target, { duration: 1.6, force: true, easing: (x) => 1 - Math.pow(1 - x, 4) });
      else if (target === 0) scrollTo(0, 0);
      else target.scrollIntoView();
    });
  }

  const INTRO_HOLD = 2.8; // Seconds the logo and name hold the screen before the view flies through the O
  const INTRO_CLEAR = INTRO_HOLD + 0.6; // When the heading starts, as the footage dissolves

  /* ---------- Line-by-line title reveal, keeping one gradient across the lines ---------- */
  function paintGradient(el, lines, image) {
    const height = el.offsetHeight;
    el.classList.add('is-split');
    lines.forEach((line) => {
      const top = line.parentElement.offsetTop - el.firstElementChild.offsetTop;
      line.style.backgroundImage = image;
      line.style.backgroundSize = `300% ${height}px`;
      line.style.backgroundPosition = `calc(var(--sheen, 0) * 100%) ${-top}px`;
      line.style.backgroundRepeat = 'no-repeat';
    });
  }

  // The statement's hand-set line breaks only suit wide screens; phones wrap naturally.
  function setResponsiveBreaks(el, wide) {
    const withBreaks = el.innerHTML;
    const withoutBreaks = withBreaks.replace(/<br\s*\/?>/gi, ' ');
    el.innerHTML = wide ? withBreaks : withoutBreaks;
    return (isWide) => { el.innerHTML = isWide ? withBreaks : withoutBreaks; };
  }

  /* The colour drifts slowly on its own and races while the page is being scrolled */
  function initSheen(titles) {
    const sheens = titles.map((el) => {
      const sheen = gsap.fromTo(el, { '--sheen': 0 }, { '--sheen': 1, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true });
      ScrollTrigger.create({
        trigger: el, start: 'top bottom', end: 'bottom top',
        onToggle: (self) => (self.isActive ? sheen.play() : sheen.pause()),
      });
      return sheen;
    });
    let speed = 1;
    gsap.ticker.add(() => {
      const target = 1 + Math.min(Math.abs(lenis?.velocity || 0) * 0.3, 6);
      speed += (target - speed) * 0.08;
      sheens.forEach((sheen) => sheen.timeScale(speed));
    });
  }

  function initReveals() {
    const mq = matchMedia('(min-width: 768px)');
    // The hero's content waits for the intro's big name to clear the middle of the screen
    const introDelay = (el) => (!location.hash && el.closest('.statement') ? INTRO_CLEAR : 0);
    initSheen($$('[data-reveal]'));
    $$('[data-reveal]').forEach((el) => {
      // Read before the first split removes the parent's gradient
      const gradient = getComputedStyle(el).backgroundImage;
      const applyBreaks = el.classList.contains('title--statement') ? setResponsiveBreaks(el, mq.matches) : null;
      let anim = null;
      guardReveal(el, () => anim, REVEAL_DEADLINE + introDelay(el) * 1000);
      const split = SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'line',
        autoSplit: true,
        onSplit(self) {
          self.masks.forEach((m) => m.classList.add('line-mask'));
          paintGradient(el, self.lines, gradient);
          el.style.visibility = 'visible';
          anim = gsap.from(self.lines, {
            yPercent: 118,
            rotate: 2.5,
            duration: 1.25,
            ease: EASE.reveal,
            stagger: 0.085,
            delay: introDelay(el),
            scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          });
          return anim;
        },
      });
      if (applyBreaks) {
        mq.addEventListener('change', (e) => {
          split.revert();
          applyBreaks(e.matches);
          split.split();
        });
      }
    });

    $$('[data-fade]').forEach((el) => {
      const anim = gsap.from(el, {
        autoAlpha: 0, y: 18, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 94%', once: true },
      });
      guardReveal(el, () => anim);
    });

    $$('[data-pop]').forEach((el) => {
      const anim = gsap.from(el, {
        autoAlpha: 0, scale: 0.6, rotate: -5, duration: 0.9, ease: EASE.bounce,
        delay: introDelay(el) && introDelay(el) + 0.85, // In the hero, as the heading lands
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
      guardReveal(el, () => anim, REVEAL_DEADLINE + introDelay(el) * 1000);
    });
  }

  /* ---------- Media: behind the title, the centre column leads and the outer ones trail, then they level out ---------- */
  function initMedia() {
    const grid = $('[data-media-grid]');
    gsap.matchMedia().add({ wide: '(min-width: 768px)', narrow: '(max-width: 767px)' }, (context) => {
      if (context.conditions.wide) {
        const start = [0.2, -0.24, 0.2]; // Screen heights above (-) or below (+) the column's final spot
        // The grid curves away like a cinema screen: each column tilts as one solid panel, so its cards stay aligned
        const curve = [
          { rotationY: 24, transformOrigin: '100% 50%' },
          { z: -90, transformOrigin: '50% 50%' },
          { rotationY: -24, transformOrigin: '0% 50%' },
        ];
        $$('[data-media-col]').forEach((col, i) => {
          gsap.set(col, { ...curve[i], transformPerspective: 1400 });
          gsap.fromTo(col, { y: () => innerHeight * start[i] }, {
            y: 0,
            ease: 'none',
            scrollTrigger: { trigger: grid, start: 'top bottom', end: 'center center', scrub: 0.6, invalidateOnRefresh: true },
          });
        });
      } else {
        $$('.vcard').forEach((card) => {
          gsap.from(card, {
            y: 40, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: card, start: 'top 95%', once: true },
          });
        });
      }
    });
  }

  /* ---------- Cards are background footage: silent, with no controls, and only running while on screen ---------- */
  function initPreviews() {
    const videos = $$('.vcard video');
    const load = (video, i) => {
      if (video.src) return;
      // Each card starts at a different point, so repeated clips don't play in step and none opens on a title slate
      video.addEventListener('loadedmetadata', () => { video.currentTime = (video.duration * (i + 0.5)) / videos.length; }, { once: true });
      video.src = video.dataset.src;
    };

    if (reduced) { // A still frame on each card, and nothing moves
      videos.forEach(load);
      return;
    }

    const io = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        load(target, videos.indexOf(target));
        target.play().catch(() => {}); // A blocked autoplay just leaves the still frame
      } else {
        target.pause();
      }
    }), { rootMargin: '150px 0px' });
    videos.forEach((video) => io.observe(video));
  }

  /* ---------- Word: the three posts fan out as they arrive ---------- */
  function initWord() {
    const posts = $$('[data-post]');
    const sides = posts.filter((p) => !p.classList.contains('post--center'));
    gsap.set(posts, { rotation: (i, p) => parseFloat(p.style.getPropertyValue('--r')) });

    const fan = gsap.timeline({
      scrollTrigger: { trigger: '[data-fan]', start: 'top 88%', once: true },
    })
      .from('.post--center', { y: 90, scale: 0.8, rotation: -5, duration: 1, ease: EASE.bounce }, 0)
      .from(sides, {
        x: (i, p) => -parseFloat(getComputedStyle(p).marginLeft),
        y: 40,
        rotation: 0,
        duration: 1.1,
        ease: 'back.out(1.4)',
      }, 0.15);
    guardReveal($('[data-fan]'), () => fan);

    if (canHover) {
      posts.forEach((post) => {
        const rest = parseFloat(post.style.getPropertyValue('--r'));
        post.addEventListener('pointerenter', () => {
          gsap.to(post, { rotation: rest * 0.55, scale: 1.05, y: -14, zIndex: 3, duration: 0.6, ease: EASE.bounce, overwrite: 'auto' });
        });
        post.addEventListener('pointerleave', () => {
          gsap.to(post, { rotation: rest, scale: 1, y: 0, duration: 0.6, ease: EASE.bounce, overwrite: 'auto',
            onComplete: () => gsap.set(post, { clearProps: 'zIndex' }) });
        });
      });
    }
  }

  /* ---------- Footer: contact rows, then dividers draw across and links rise in ---------- */
  function initFooter() {
    $$('[data-contact-row]').forEach((row) => {
      const anim = gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 88%', once: true } })
        .fromTo(row, { '--draw': 0 }, { '--draw': 1, duration: 1, ease: 'expo.out' }, 0)
        .from(row.children, { autoAlpha: 0, y: 28, duration: 0.8, ease: 'power3.out', stagger: 0.1 }, 0.05);
      guardReveal(row, () => anim);
    });

    const list = $('[data-footer-list]');
    const arrival = gsap.timeline({
      scrollTrigger: { trigger: list, start: 'top 88%', once: true },
    })
      .fromTo('[data-footer-list] li', { '--draw': 0 }, { '--draw': 1, duration: 1, ease: 'expo.out', stagger: 0.08 }, 0.1)
      .from('[data-footer-list] a', { autoAlpha: 0, y: 44, duration: 0.85, ease: 'power3.out', stagger: 0.08 }, 0.2)
      .from('.footer__base small', { autoAlpha: 0, y: 16, duration: 0.7, ease: 'power3.out' }, 0.7)
      .from('[data-social] li', { autoAlpha: 0, y: 14, scale: 0.7, duration: 0.6, ease: EASE.bounce, stagger: 0.05 }, 0.7);
    guardReveal(list, () => arrival);
  }

  /* ---------- Magnetic buttons ---------- */
  function initMagnetic() {
    if (!canHover) return;
    $$('[data-magnetic]').forEach((el) => {
      const x = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, .45)' });
      const y = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, .45)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - r.left - r.width / 2) * 0.28);
        y((e.clientY - r.top - r.height / 2) * 0.28);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }

  /* ---------- Menu ---------- */
  const menu = $('[data-menu]');
  const toggle = $('[data-menu-toggle]');
  let menuTl = null;

  /* ---------- Menu page turn: like a hand lifting the bottom-right corner and turning the page to the left ----------
     The corner travels along an arc. The fold is the line halfway between where the corner started and where it
     is now, so the part of the page past the fold is mirrored over it, which is what a real sheet does. */
  const menuPage = (() => {
    const canvas = $('[data-menu-page]');
    const ctx = canvas.getContext('2d');
    const DARK = '#1e1e1e';
    const state = { p: 0 };
    let W = 0, H = 0, dpr = 1;
    let tornRim, tornBack, texture;

    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const noise1d = () => {
      const table = Array.from({ length: 512 }, () => rnd() * 2 - 1);
      return (x) => {
        const i = Math.floor(x);
        const f = x - i;
        const u = f * f * (3 - 2 * f);
        const at = (n) => table[((n % 512) + 512) % 512];
        return at(i) * (1 - u) + at(i + 1) * u;
      };
    };
    const [n1, n2, n3, n4, n5] = Array.from({ length: 5 }, noise1d);

    // Grey fibrous paper core, showing along the torn edges
    function buildTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 320;
      const g = c.getContext('2d');
      const img = g.createImageData(320, 320);
      for (let y = 0; y < 320; y++) {
        for (let x = 0; x < 320; x++) {
          const blotch = n1(x / 37 + y / 53) * 9 + n2(y / 29 - x / 61) * 9;
          const v = 208 + blotch + (rnd() - 0.5) * 26;
          const i = (y * 320 + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      return ctx.createPattern(c, 'repeat');
    }

    // The sheet's outline, torn all the way round. It belongs to the sheet, so it stays put as the page turns.
    function buildOutlines() {
      const scale = gsap.utils.clamp(0.6, 1.25, W / 1900);
      const STEP = 5;
      const rim = [], paper = [];
      const perimeter = 2 * (W + H);
      for (let s = 0; s < perimeter; s += STEP) {
        const outer = Math.max(0, 10 + n1(s / 110) * 14 + n2(s / 34) * 7 + n3(s / 10) * 3) * scale;
        const inner = outer + (22 + n4(s / 80) * 16 + n5(s / 22) * 7 + n3(s / 7 + 40) * 2.5) * scale;
        const at = (inset) => {
          if (s < W) return [s, inset];
          if (s < W + H) return [W - inset, s - W];
          if (s < 2 * W + H) return [W - (s - W - H), H - inset];
          return [inset, H - (s - 2 * W - H)];
        };
        rim.push(at(outer));
        paper.push(at(inner));
      }
      tornRim = rim;
      tornBack = paper;
    }

    function layout() {
      W = innerWidth;
      H = innerHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (!texture) texture = buildTexture();
      buildOutlines();
    }

    // Keeps the part of a shape on the corner's side of the fold
    function clipToFold(points, fold) {
      const side = ([x, y]) => (x - fold.x) * fold.nx + (y - fold.y) * fold.ny;
      const out = [];
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length];
        const sa = side(a), sb = side(b);
        if (sa >= 0) out.push(a);
        if ((sa >= 0) !== (sb >= 0)) {
          const t = sa / (sa - sb);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      });
      return out;
    }

    const trace = (points) => {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    };

    function draw() {
      if (!W) layout();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const { p } = state;
      if (p <= 0) return;
      if (p >= 1) { // Fully turned: just the dark background
        ctx.fillStyle = DARK;
        ctx.fillRect(0, 0, W, H);
        return;
      }

      // Where the hand has carried the corner: up in an arc, and over past the left edge
      const cornerX = W - p * (2 * W + 80);
      const cornerY = H - Math.sin(p * Math.PI) * H * 0.42;
      const dx = W - cornerX, dy = H - cornerY;
      const len = Math.hypot(dx, dy) || 1;
      const fold = { x: (W + cornerX) / 2, y: (H + cornerY) / 2, nx: dx / len, ny: dy / len };

      const revealed = clipToFold([[0, 0], [W, 0], [W, H], [0, H]], fold);
      if (revealed.length < 3) return;
      const mirror = ([x, y]) => {
        const d = (x - fold.x) * fold.nx + (y - fold.y) * fold.ny;
        return [x - 2 * d * fold.nx, y - 2 * d * fold.ny];
      };
      const flapRim = clipToFold(tornRim, fold).map(mirror);
      const flapBack = clipToFold(tornBack, fold).map(mirror);

      // 1. The dark menu the turning page reveals
      trace(revealed);
      ctx.fillStyle = DARK;
      ctx.fill();

      // 2. The shadow the lifted page casts onto the menu, just past the fold
      const reach = Math.min(W, H) * 0.3;
      const onMenu = ctx.createLinearGradient(fold.x, fold.y, fold.x + fold.nx * reach, fold.y + fold.ny * reach);
      onMenu.addColorStop(0, 'rgba(0, 0, 0, .55)');
      onMenu.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = onMenu;
      ctx.fill();

      if (flapRim.length < 3) return;

      // 3. The torn fibrous edge of the sheet, its shadow falling on the page that hasn't turned yet
      trace(flapRim);
      ctx.save();
      ctx.shadowColor = 'rgba(5, 12, 40, .45)';
      ctx.shadowBlur = 60 * dpr;
      ctx.shadowOffsetX = -14 * dpr;
      ctx.shadowOffsetY = 10 * dpr;
      ctx.fillStyle = texture;
      ctx.fill();
      ctx.restore();
      if (flapBack.length < 3) return;

      // 4. The back of the page inside that edge, shaded across its width so it reads as a curving sheet
      let width = 1;
      flapBack.forEach(([x, y]) => { width = Math.max(width, (fold.x - x) * fold.nx + (fold.y - y) * fold.ny); });
      const back = ctx.createLinearGradient(fold.x, fold.y, fold.x - fold.nx * width, fold.y - fold.ny * width);
      back.addColorStop(0, '#a9adb8');
      back.addColorStop(Math.min(0.08, 40 / width), '#e4e6ea');
      back.addColorStop(Math.min(0.28, 150 / width), '#ffffff');
      back.addColorStop(0.72, '#f1f2f4');
      back.addColorStop(1, '#d9dbe0');
      trace(flapBack);
      ctx.fillStyle = back;
      ctx.fill();
    }

    addEventListener('resize', () => { if (W) { layout(); if (state.p > 0) draw(); } });
    return { canvas, state, draw };
  })();

  function buildMenuTimeline() {
    const { canvas, state, draw } = menuPage;
    if (reduced) { // No page turn: the dark background is simply there
      state.p = 1;
      draw();
    }
    return gsap.timeline({ paused: true })
      .set([menu, canvas], { visibility: 'visible' })
      .to(state, { p: 1, duration: reduced ? 0 : 1.8, ease: 'power2.inOut', onUpdate: draw }, 0)
      .fromTo($$('.biglist li', menu),
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, duration: reduced ? 0 : 0.9, ease: 'power3.out', stagger: reduced ? 0 : { each: 0.12, from: 'end' } }, reduced ? 0 : 0.8)
      .fromTo($$('.menu__base > *', menu),
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: reduced ? 0 : 0.7, ease: 'power3.out', stagger: reduced ? 0 : 0.08 }, reduced ? 0 : 1.45);
  }

  function isMenuOpen() { return root.classList.contains('menu-open'); }

  function openMenu() {
    menuTl = buildMenuTimeline();
    root.classList.add('menu-open');
    menu.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    lenis?.stop();
    menuTl.play(0);
  }

  function closeMenu() {
    if (!isMenuOpen()) return;
    root.classList.remove('menu-open');
    menu.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    lenis?.start();
    menuTl.timeScale(1.5).reverse();
  }

  function initMenu() {
    toggle.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMenuOpen()) { closeMenu(); toggle.focus(); }
    });
  }

  /* ---------- Preloader: footage plays inside the logo, then the view flies through the O into the page ---------- */
  function playIntro() {
    const loader = $('[data-loader]');
    const headerLogo = $('[data-logo]');
    const actions = $('[data-nav-actions]');

    if (location.hash) { // Arrived on a section: go straight there
      loader.remove();
      gsap.set([headerLogo, actions], { visibility: 'visible' });
      return;
    }

    // The browser can restore an old scroll position late, so keep the page at the top until the reveal
    const toTop = () => { scrollTo(0, 0); lenis?.scrollTo(0, { immediate: true, force: true }); };
    toTop();
    addEventListener('load', toTop, { once: true });
    lenis?.stop();
    gsap.ticker.lagSmoothing(500, 33); // A busy start-up mustn't eat into the time people get to read the name

    const stage = $('[data-loader-stage]');
    const video = $('[data-loader-video]');
    const logo = $('[data-loader-logo]');
    const name = $('[data-loader-name]');
    video.src = video.dataset.src;
    video.play().catch(() => {}); // Blocked or slow: the letters simply stay white
    loader.classList.add('is-ready');

    const LOGO_W = 93, LOGO_H = 47;
    const THROUGH = { x: 44, y: 23 }; // A point on the O's left wall, in the logo's own units: the view flies into it
    const ZOOM = 70;
    const fly = { p: 0 };
    let scale = 1, baseX = 0, baseY = 0;

    const place = () => {
      const w = innerWidth, h = innerHeight;
      scale = Math.min((w * 0.62) / LOGO_W, (h * 0.42) / LOGO_H);
      const gap = h * 0.03;
      const top = (h - LOGO_H * scale - gap - name.offsetHeight) / 2;
      name.style.top = `${top + LOGO_H * scale + gap}px`;
      baseX = (w - LOGO_W * scale) / 2;
      baseY = top;
    };
    const draw = () => {
      const s = scale * Math.pow(ZOOM, fly.p);
      // The fly-through point glides from its place in the logo to the middle of the screen
      const px = baseX + THROUGH.x * scale + (innerWidth / 2 - baseX - THROUGH.x * scale) * fly.p;
      const py = baseY + THROUGH.y * scale + (innerHeight / 2 - baseY - THROUGH.y * scale) * fly.p;
      logo.setAttribute('transform', `translate(${px - THROUGH.x * s} ${py - THROUGH.y * s}) scale(${s})`);
    };
    const onResize = () => { place(); draw(); };
    place();
    draw();
    addEventListener('resize', onResize);

    const nameChars = SplitText.create(name, { type: 'chars', mask: 'chars' }).chars;

    gsap.timeline({
      onComplete() {
        removeEventListener('resize', onResize);
        loader.remove();
        gsap.ticker.lagSmoothing(0);
        lenis?.start();
        ScrollTrigger.refresh();
      },
    })
      .from($$('path', logo), { y: LOGO_H * 1.1, duration: 0.7, ease: EASE.bounce, stagger: 0.07 }, 0.05)
      .from(nameChars, { yPercent: 110, duration: 0.55, ease: 'power3.out', stagger: 0.014 }, 0.3)
      .call(toTop, null, INTRO_HOLD)
      .to(nameChars, { yPercent: -110, duration: 0.3, ease: 'power3.in', stagger: 0.006 }, INTRO_HOLD - 0.1)
      .to(fly, { p: 1, duration: 0.75, ease: 'power3.in', onUpdate: draw }, INTRO_HOLD)
      .to(stage, { autoAlpha: 0, duration: 0.4, ease: 'none' }, INTRO_HOLD + 0.6)
      .set([headerLogo, actions], { visibility: 'visible' }, INTRO_HOLD + 0.6)
      .fromTo(headerLogo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, clearProps: 'opacity' }, INTRO_HOLD + 0.6)
      .fromTo(actions, { scale: 0.5, autoAlpha: 0, transformOrigin: '100% 50%' },
        { scale: 1, autoAlpha: 1, duration: 0.6, ease: EASE.bounce, clearProps: 'transform,opacity' }, INTRO_HOLD + 0.6);
  }

  /* ---------- Boot ---------- */
  function boot() {
    initPreviews();
    $$('.btn__label').forEach((l) => { l.innerHTML = `<span class="btn__roll">${l.textContent}</span>`; });
    initScroll();
    initMenu();

    if (reduced) return; // Everything else is already in its final state

    if (!location.hash) scrollTo(0, 0);

    initReveals();
    initMedia();
    initWord();
    initFooter();
    initMagnetic();
    playIntro();

    if (location.hash) {
      const target = $(location.hash);
      if (target) { ScrollTrigger.refresh(); lenis?.scrollTo(target, { immediate: true, force: true }); }
    }
  }

  // Line breaks depend on the font, so wait for it (with a safety timeout).
  const fontsReady = document.fonts
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))])
    : Promise.resolve();
  window.__motionReady = true;
  fontsReady.then(boot).catch((err) => {
    // A motion failure must never leave content hidden
    console.error(err);
    root.classList.remove('js-motion');
  });
})();
