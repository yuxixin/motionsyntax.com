(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow = window.matchMedia("(max-width: 720px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const header = document.getElementById("site-header");
  const hero = document.querySelector("[data-hero]");

  const onScroll = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
    if (hero instanceof HTMLElement) {
      const h = Math.max(hero.offsetHeight, 1);
      const fade = Math.max(0, 1 - window.scrollY / (h * 0.72));
      hero.style.setProperty("--hero-fade", String(fade));
    }
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

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

  // Hero pointer spotlight + parallax
  const spotlight = document.getElementById("hero-spotlight");
  const parallaxLayers = document.querySelectorAll("[data-parallax]");
  let ptrX = window.innerWidth * 0.5;
  let ptrY = window.innerHeight * 0.42;
  let targetX = ptrX;
  let targetY = ptrY;

  if (hero && !reduceMotion && !coarsePointer) {
    hero.addEventListener(
      "pointermove",
      (event) => {
        const rect = hero.getBoundingClientRect();
        targetX = event.clientX - rect.left;
        targetY = event.clientY - rect.top;
        const px = (targetX / rect.width) * 100;
        const py = (targetY / rect.height) * 100;
        hero.style.setProperty("--ptr-x", `${px}%`);
        hero.style.setProperty("--ptr-y", `${py}%`);
      },
      { passive: true }
    );

    const smoothPtr = () => {
      ptrX += (targetX - ptrX) * 0.12;
      ptrY += (targetY - ptrY) * 0.12;
      if (spotlight) {
        spotlight.style.left = `${ptrX}px`;
        spotlight.style.top = `${ptrY}px`;
      }
      const nx = (ptrX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (ptrY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      parallaxLayers.forEach((layer) => {
        if (!(layer instanceof HTMLElement)) return;
        const depth = Number(layer.dataset.parallax || "0.04");
        layer.style.transform = `translate3d(${(-nx * depth * 40).toFixed(2)}px, ${(-ny * depth * 28).toFixed(2)}px, 0)`;
      });
      requestAnimationFrame(smoothPtr);
    };
    requestAnimationFrame(smoothPtr);
  } else if (hero) {
    hero.style.setProperty("--ptr-x", "50%");
    hero.style.setProperty("--ptr-y", "36%");
  }

  // Hero FX canvas: cue ball + trail + chalk dust + impact
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById("hero-fx"));
  const impact = document.getElementById("hero-impact");

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

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const bounds = hero instanceof HTMLElement ? hero.getBoundingClientRect() : null;
        w = Math.max(1, Math.floor(bounds?.width || window.innerWidth));
        h = Math.max(1, Math.floor(bounds?.height || window.innerHeight));
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dust = [];
        const dustCount = isNarrow
          ? Math.min(36, Math.floor(w / 28))
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
      };

      /** Path for the cue “shot” across the felt */
      const pathAt = (u) => {
        const x0 = w * 0.08;
        const x1 = w * 0.86;
        const x = x0 + (x1 - x0) * u;
        const y =
          h * 0.38 +
          Math.sin(u * Math.PI) * h * -0.08 +
          Math.sin(u * Math.PI * 2.2) * h * 0.015;
        return { x, y };
      };

      const burst = (x, y) => {
        const count = isNarrow ? 22 : 48;
        for (let i = 0; i < count; i++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = 1.5 + Math.random() * 5;
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
        if (impact) {
          impact.classList.remove("is-flash");
          // force reflow for restart
          void impact.offsetWidth;
          impact.classList.add("is-flash");
        }
      };

      const tick = (now) => {
        if (!running) return;
        const elapsed = (now - t0) / 1000;
        ctx.clearRect(0, 0, w, h);

        // Ambient dust
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

        // Shot cycle every ~4.2s
        const cycle = 4.2;
        const phase = (elapsed % cycle) / cycle;
        let u = 0;
        if (phase < 0.55) {
          // ease-in-out strike
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
        if (trail.length > 28) trail.shift();

        // Trail glow
        for (let i = 1; i < trail.length; i++) {
          const a = trail[i - 1];
          const b = trail[i];
          const alpha = (i / trail.length) * 0.55;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(150, 255, 200, ${alpha})`;
          ctx.lineWidth = 2 + (i / trail.length) * 4;
          ctx.lineCap = "round";
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        // Cue ball
        const grd = ctx.createRadialGradient(pos.x - 4, pos.y - 5, 2, pos.x, pos.y, 14);
        grd.addColorStop(0, "#ffffff");
        grd.addColorStop(0.45, "#e8fff2");
        grd.addColorStop(1, "#7dceb0");
        ctx.beginPath();
        ctx.fillStyle = grd;
        ctx.shadowColor = "rgba(140, 255, 200, 0.85)";
        ctx.shadowBlur = 22;
        ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Axis marker on ball
        ctx.beginPath();
        ctx.fillStyle = "rgba(0, 80, 50, 0.55)";
        ctx.arc(pos.x + 2, pos.y + 1, 2.2, 0, Math.PI * 2);
        ctx.fill();

        raf = requestAnimationFrame(tick);
      };

      resize();
      t0 = performance.now();
      raf = requestAnimationFrame(tick);
      window.addEventListener("resize", resize, { passive: true });
      document.addEventListener("visibilitychange", () => {
        running = document.visibilityState === "visible";
        if (running) {
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
