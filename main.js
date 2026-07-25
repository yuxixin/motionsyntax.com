(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const header = document.getElementById("site-header");
  const hero = document.querySelector("[data-hero]");

  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
    if (hero instanceof HTMLElement) {
      const h = Math.max(hero.offsetHeight, 1);
      const fade = Math.max(0, 1 - window.scrollY / (h * 0.72));
      // Only fade foreground copy — never scale/repaint the felt scene.
      hero.style.setProperty("--hero-fade", fade.toFixed(3));
    }
  };
  let scrollQueued = false;
  const onScrollRaf = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      onScroll();
    });
  };
  onScroll();
  window.addEventListener("scroll", onScrollRaf, { passive: true });

  // Split brand letters
  const split = document.querySelector("[data-split]");
  if (split && !reduceMotion) {
    const text = split.textContent || "";
    split.textContent = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = ch;
      span.style.animationDelay = `${0.32 + i * 0.055}s`;
      split.appendChild(span);
    });
  }

  // Reveal on scroll
  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    reveals.forEach((el) => observer.observe(el));
  }

  // Metric panel live + counters
  const metricPanel = document.getElementById("metric-panel");
  const animateCount = (el) => {
    const target = Number(el.getAttribute("data-count") || "0");
    const decimals = Number(el.getAttribute("data-decimals") || "0");
    const duration = 1100;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (metricPanel) {
    const run = () => {
      metricPanel.classList.add("is-live");
      metricPanel.querySelectorAll("[data-count]").forEach((el) => animateCount(el));
    };
    if (reduceMotion || !("IntersectionObserver" in window)) {
      run();
    } else {
      const metricObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              run();
              metricObserver.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.35 }
      );
      metricObserver.observe(metricPanel);
    }
  }

  // Hero pointer spotlight only (no felt parallax / CSS-var gradient repaints).
  const spotlight = document.getElementById("hero-spotlight");
  let ptrX = window.innerWidth * 0.5;
  let ptrY = window.innerHeight * 0.36;
  let targetX = ptrX;
  let targetY = ptrY;
  let ptrRaf = 0;
  let ptrActive = false;

  const placeSpotlight = (x, y) => {
    if (!(spotlight instanceof HTMLElement)) return;
    spotlight.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  };

  const smoothPtr = () => {
    ptrX += (targetX - ptrX) * 0.14;
    ptrY += (targetY - ptrY) * 0.14;
    placeSpotlight(ptrX, ptrY);
    const dx = Math.abs(targetX - ptrX);
    const dy = Math.abs(targetY - ptrY);
    if (dx > 0.4 || dy > 0.4) {
      ptrRaf = requestAnimationFrame(smoothPtr);
    } else {
      ptrActive = false;
      ptrRaf = 0;
      placeSpotlight(targetX, targetY);
    }
  };

  if (hero && !reduceMotion && !coarsePointer && spotlight) {
    placeSpotlight(ptrX, ptrY);
    hero.addEventListener(
      "pointermove",
      (event) => {
        const rect = hero.getBoundingClientRect();
        targetX = event.clientX - rect.left;
        targetY = event.clientY - rect.top;
        if (!ptrActive) {
          ptrActive = true;
          ptrRaf = requestAnimationFrame(smoothPtr);
        }
      },
      { passive: true }
    );
    hero.addEventListener(
      "pointerleave",
      () => {
        targetX = (hero.getBoundingClientRect().width || window.innerWidth) * 0.5;
        targetY = (hero.getBoundingClientRect().height || window.innerHeight) * 0.36;
        if (!ptrActive) {
          ptrActive = true;
          ptrRaf = requestAnimationFrame(smoothPtr);
        }
      },
      { passive: true }
    );
  } else if (spotlight) {
    placeSpotlight(ptrX, ptrY);
  }

  // Hero FX canvas: cue ball + trail + chalk dust + impact
  // Ball lane is measured from `.hero__axis` so CSS line and path stay locked.
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("hero-fx"));
  const impact = document.getElementById("hero-impact");
  const axis = document.querySelector(".hero__axis");

  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      /** @type {{ x: number; y: number; r: number; vx: number; vy: number; a: number; life: number }[]} */
      let dust = [];
      /** @type {{ x: number; y: number; a: number }[]} */
      let trail = [];
      let w = 0;
      let h = 0;
      let t0 = performance.now();
      let fired = false;
      let running = true;
      let raf = 0;
      /** @type {{ x0: number; x1: number; y: number; arc: number; ballR: number }} */
      let lane = { x0: 0, x1: 0, y: 0, arc: 0, ballR: 9 };

      const narrowNow = () => window.matchMedia("(max-width: 720px)").matches;

      const measureLane = () => {
        const narrow = narrowNow();
        if (hero instanceof HTMLElement && axis instanceof HTMLElement) {
          const heroRect = hero.getBoundingClientRect();
          const axisRect = axis.getBoundingClientRect();
          const sx = w / Math.max(heroRect.width, 1);
          const sy = h / Math.max(heroRect.height, 1);
          lane.x0 = (axisRect.left - heroRect.left) * sx;
          lane.x1 = (axisRect.right - heroRect.left) * sx;
          lane.y = (axisRect.top + axisRect.height / 2 - heroRect.top) * sy;
        } else {
          lane.x0 = w * 0.08;
          lane.x1 = w * 0.86;
          lane.y = h * 0.38;
        }
        // Keep the arc subtle on phones so the ball rides the white line.
        lane.arc = narrow ? Math.min(14, h * 0.022) : h * 0.08;
        lane.ballR = narrow ? 6.5 : 9;
      };

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (hero instanceof HTMLElement) {
          w = Math.max(1, Math.floor(hero.clientWidth));
          h = Math.max(1, Math.floor(hero.clientHeight));
        } else {
          w = Math.max(1, Math.floor(window.innerWidth));
          h = Math.max(1, Math.floor(window.innerHeight));
        }
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        measureLane();
        dust = [];
        const dustCount = narrowNow()
          ? Math.min(28, Math.floor(w / 30))
          : Math.min(90, Math.floor(w / 16));
        for (let i = 0; i < dustCount; i++) {
          dust.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.5 + Math.random() * 2.2,
            vx: -0.2 + Math.random() * 0.4,
            vy: -0.08 - Math.random() * 0.25,
            a: 0.08 + Math.random() * 0.28,
            life: 2,
          });
        }
        trail = [];
        fired = false;
      };

      /** Path locked to the white axis lane */
      const pathAt = (u) => {
        const x = lane.x0 + (lane.x1 - lane.x0) * u;
        const y =
          lane.y +
          Math.sin(u * Math.PI) * -lane.arc +
          Math.sin(u * Math.PI * 2.2) * lane.arc * 0.16;
        return { x, y };
      };

      const burst = (x, y) => {
        const count = narrowNow() ? 18 : 48;
        for (let i = 0; i < count; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 1.2 + Math.random() * (narrowNow() ? 3.2 : 5);
          dust.push({
            x,
            y,
            r: 0.8 + Math.random() * 2.4,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            a: 0.35 + Math.random() * 0.45,
            life: 0.95,
          });
        }
        if (hero instanceof HTMLElement) {
          hero.style.setProperty("--impact-x", `${x}px`);
          hero.style.setProperty("--impact-y", `${y}px`);
        }
        if (impact) {
          impact.classList.remove("is-flash");
          void impact.offsetWidth;
          impact.classList.add("is-flash");
        }
      };

      const tick = (now) => {
        if (!running) return;
        const elapsed = (now - t0) / 1000;
        ctx.clearRect(0, 0, w, h);

        for (const p of dust) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.life <= 1) {
            p.life -= 0.018;
            p.vx *= 0.98;
            p.vy *= 0.98;
          } else if (p.y < -10) {
            p.y = h + 8;
            p.x = Math.random() * w;
          }
          if (p.x < -10) p.x = w + 8;
          if (p.x > w + 10) p.x = -8;
          const alpha = p.life <= 1 ? Math.max(0, p.a * p.life) : p.a;
          if (alpha <= 0.01) continue;
          ctx.beginPath();
          ctx.fillStyle = `rgba(210, 255, 230, ${alpha})`;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        dust = dust.filter((p) => p.life > 0.02);

        const cycle = 4.2;
        const phase = (elapsed % cycle) / cycle;
        let u = 0;
        if (phase < 0.55) {
          const local = phase / 0.55;
          u = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2;
          fired = false;
        } else {
          u = 1;
          if (!fired && phase > 0.55 && phase < 0.58) {
            const tip = pathAt(1);
            burst(tip.x, tip.y);
            fired = true;
          }
        }

        const pos = pathAt(u);
        trail.push({ x: pos.x, y: pos.y, a: 1 });
        const trailMax = narrowNow() ? 18 : 28;
        if (trail.length > trailMax) trail.shift();

        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          const alpha = (i / trail.length) * 0.55;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(150, 255, 200, ${alpha})`;
          ctx.lineWidth = (narrowNow() ? 1.4 : 2) + (i / trail.length) * (narrowNow() ? 2.6 : 4);
          ctx.lineCap = "round";
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        const r = lane.ballR;
        const grd = ctx.createRadialGradient(pos.x - r * 0.45, pos.y - r * 0.55, r * 0.2, pos.x, pos.y, r * 1.55);
        grd.addColorStop(0, "#ffffff");
        grd.addColorStop(0.45, "#e8fff2");
        grd.addColorStop(1, "#7dceb0");
        ctx.beginPath();
        ctx.fillStyle = grd;
        ctx.shadowColor = "rgba(140, 255, 200, 0.85)";
        ctx.shadowBlur = narrowNow() ? 14 : 22;
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.fillStyle = "rgba(0, 80, 50, 0.55)";
        ctx.arc(pos.x + r * 0.22, pos.y + r * 0.12, r * 0.24, 0, Math.PI * 2);
        ctx.fill();

        raf = requestAnimationFrame(tick);
      };

      resize();
      // Re-measure after layout settles (mobile address bar / font load).
      requestAnimationFrame(() => {
        measureLane();
        requestAnimationFrame(measureLane);
      });
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
      window.addEventListener("resize", resize, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", resize, { passive: true });
      }
      document.addEventListener("visibilitychange", () => {
        running = document.visibilityState === "visible";
        if (running) {
          measureLane();
          t0 = performance.now();
          raf = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(raf);
        }
      });
    }
  }

  // Waitlist form intentionally disabled (no email backend yet).
})();
