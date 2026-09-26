// ---------------------------------------------------------------
// "This site is gentrified" ending.
// Every click on the bottom map (#map, created in script.js) or on one of
// the buttons next to it (#toolbox) makes the page darker. After a random
// number of clicks the page is completely black and the final message appears.
// Load this file AFTER script.js (it uses the `map` variable from there).
// ---------------------------------------------------------------

// Which darkening effect to use:
//   'vignette' = black creeps in smoothly from the edges of the screen
//   'mold'     = soft black spots of different sizes spread over the screen
const GENTRIFY_EFFECT = 'mold';

const GENTRIFY_START_MIN = 5;      // the number of clicks is picked at random
const GENTRIFY_START_MAX = 10;      // between these two values (inclusive)
const GENTRIFY_EXTRA_MIN = 3;       // then 3, 4 or 5 more clicks until the page is black + message
const GENTRIFY_EXTRA_MAX = 3;       // (e.g. start 11 + extra 4 -> black at click 15)
const GENTRIFY_STEP_MS = 1400;      // how long the first darkening step takes
const GENTRIFY_SPEEDUP = 0.6;       // each following step takes this share of the previous one
                                    // (1.4 s -> 0.84 s -> 0.5 s ...), so it rushes to black at the end
const GENTRIFY_IDLE_MS = 8000;      // if nobody clicks for this long after it started, it
                                    // continues by itself (so it never stays half dark).
                                    // Set to 0 to only move on with clicks.
const GENTRIFY_RELOAD_SECONDS = 8; // countdown under the message, then the page reloads
const GENTRIFY_BUSINESSES = [
    'a Pilates Studio',
    'a Café selling flatwhite',
    'a luxury Hairsalon',
    'a fancy Winebar',
    'a Coworking place with expensive membership fees'
];

(function setupGentrification() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const firstStepMs = reduceMotion ? 200 : GENTRIFY_STEP_MS;
        const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    const startClick = randomBetween(GENTRIFY_START_MIN, GENTRIFY_START_MAX);
    const extraClicks = randomBetween(GENTRIFY_EXTRA_MIN, GENTRIFY_EXTRA_MAX);

    const business = GENTRIFY_BUSINESSES[Math.floor(Math.random() * GENTRIFY_BUSINESSES.length)];

    // Full-screen layer on top of the page. It lets clicks pass through
    // until the very end, so the map stays usable while it darkens.
    const overlay = document.createElement('div');
    overlay.id = 'gentrify-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const message = document.createElement('p');
    message.id = 'gentrify-message';
    message.setAttribute('role', 'status');
    message.textContent = `This site is also gentrified.\nNow ${business} is under construction here.`;

    // Countdown shown under the message (20 ... 0), then the page starts over.
    const countdown = document.createElement('p');
    countdown.id = 'gentrify-countdown';
    countdown.setAttribute('aria-live', 'polite');

    document.body.append(overlay, message, countdown);

    const smoothstep = (x) => x * x * (3 - 2 * x);

    // -----------------------------------------------------------
    // Effect 1: vignette from the edges
    // -----------------------------------------------------------
    function createVignetteEffect() {
        // Many colour stops along a smooth curve instead of two, so the
        // transition from clear to black has no visible steps ("banding").
        const STOPS = 14;

        // Very faint noise on top breaks up any remaining bands.
        const noise = document.createElement('div');
        noise.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;mix-blend-mode:overlay;';
        noise.style.backgroundImage = `url(${makeNoiseTile()})`;
        overlay.appendChild(noise);

        function makeNoiseTile() {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            const img = ctx.createImageData(size, size);
            for (let i = 0; i < img.data.length; i += 4) {
                const v = Math.random() * 255;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
                img.data[i + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
            return c.toDataURL();
        }

        return {
            beginStep() {},
            render(level) {
                const clearStop = (1 - level) * 55;             // % where the black starts
                const blackStop = clearStop + (1 - level) * 55; // % where it is fully black
                const edgeAlpha = Math.min(1, 0.6 + level * 0.4);
                if (level >= 1) {
                    overlay.style.background = '#171717';
                } else {
                    const stops = [];
                    for (let i = 0; i <= STOPS; i++) {
                        const f = i / STOPS;
                        const pos = clearStop + (blackStop - clearStop) * f;
                        const alpha = edgeAlpha * smoothstep(f);
                        stops.push(`rgba(0,0,0,${alpha.toFixed(3)}) ${pos.toFixed(2)}%`);
                    }
                    overlay.style.background = `radial-gradient(ellipse at center, ${stops.join(', ')})`;
                }
                noise.style.opacity = level > 0 && level < 1 ? String(0.045 * Math.min(1, level * 2)) : '0';
                overlay.style.opacity = level > 0 ? '1' : '0';
            },
        };
    }

    // -----------------------------------------------------------
    // Effect 2: mold spots spreading over the screen
    // -----------------------------------------------------------
    function createMoldEffect() {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        overlay.appendChild(canvas);
        const ctx = canvas.getContext('2d');

        // Finished spots are drawn once onto this hidden canvas; only the
        // spots that are still growing get redrawn every frame.
        const settled = document.createElement('canvas');
        const settledCtx = settled.getContext('2d');

        const spots = [];     // all spots, positions as fractions of the screen
        let growing = [];     // spots added in the current step
        let finalStep = false;
        let w = 0, h = 0, dpr = 1;

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth; h = window.innerHeight;
            for (const c of [canvas, settled]) {
                c.width = Math.round(w * dpr);
                c.height = Math.round(h * dpr);
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            settledCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            settledCtx.clearRect(0, 0, w, h);
            spots.filter(s => !growing.includes(s)).forEach(s => drawSpot(settledCtx, s, 1));
        }

        // One soft spot: dark core, edge fading out, plus a few tiny "spores" around it.
        function drawSpot(c, s, grow) {
            const x = s.x * w, y = s.y * h;
            const r = s.r * Math.min(w, h) * grow;
            if (r < 0.5) return;
            const g = c.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(0,0,0,${s.a})`);
            g.addColorStop(0.35, `rgba(0,0,0,${s.a * 0.92})`);
            g.addColorStop(0.6, `rgba(0,0,0,${s.a * 0.6})`);
            g.addColorStop(0.8, `rgba(0,0,0,${s.a * 0.22})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.fill();
            for (const p of s.spores) {
                const px = x + Math.cos(p.angle) * r * p.dist;
                const py = y + Math.sin(p.angle) * r * p.dist;
                const pr = r * p.size;
                const pg = c.createRadialGradient(px, py, 0, px, py, pr);
                pg.addColorStop(0, `rgba(0,0,0,${s.a * 0.9})`);
                pg.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = pg;
                c.beginPath();
                c.arc(px, py, pr, 0, Math.PI * 2);
                c.fill();
            }
        }

        function makeSpot(level) {
            // New spots mostly grow next to existing ones (like mold spreading),
            // some start somewhere new. The first ones start near the edges.
            let x, y;
            if (spots.length && Math.random() < 0.65) {
                const parent = spots[Math.floor(Math.random() * spots.length)];
                const angle = Math.random() * Math.PI * 2;
                const dist = parent.r * (0.6 + Math.random() * 1.2);
                x = parent.x + Math.cos(angle) * dist * (h / w);
                y = parent.y + Math.sin(angle) * dist;
            } else if (spots.length < 6) {
                const edge = Math.floor(Math.random() * 4);
                const t = Math.random();
                x = edge === 0 ? 0 : edge === 1 ? 1 : t;
                y = edge === 2 ? 0 : edge === 3 ? 1 : t;
                x += (Math.random() - 0.5) * 0.15;
                y += (Math.random() - 0.5) * 0.15;
            } else {
                x = Math.random(); y = Math.random();
            }
            // Mostly small spots, a few big ones; they get bigger as the page darkens.
            const big = Math.random() < 0.18;
            const base = big ? 0.12 + Math.random() * 0.16 : 0.015 + Math.pow(Math.random(), 2) * 0.07;
            const spores = Array.from({ length: Math.floor(Math.random() * 6) }, () => ({
                angle: Math.random() * Math.PI * 2,
                dist: 1.0 + Math.random() * 1.4,
                size: 0.06 + Math.random() * 0.16,
            }));
            return {
                x: Math.min(1.05, Math.max(-0.05, x)),
                y: Math.min(1.05, Math.max(-0.05, y)),
                r: base * (0.8 + level * 1.2),
                a: 0.75 + Math.random() * 0.25,
                spores,
                delay: Math.random() * 0.45, // spots appear one after another, not all at once
            };
        }

        window.addEventListener('resize', resize);
        resize();

        return {
            beginStep(from, to) {
                // settle the spots from the previous step
                growing.forEach(s => drawSpot(settledCtx, s, 1));
                growing = [];
                finalStep = to >= 1;
                // more (and bigger) spots with every step
                const count = Math.round(25 + 90 * to * to);
                for (let i = 0; i < count; i++) {
                    const s = makeSpot(to);
                    spots.push(s);
                    growing.push(s);
                }
            },
            render(level, t) {
                overlay.style.opacity = level > 0 ? '1' : '0';
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(settled, 0, 0, w, h);
                for (const s of growing) {
                    const local = Math.min(1, Math.max(0, (t - s.delay) / (1 - s.delay)));
                    drawSpot(ctx, s, smoothstep(local));
                }
                if (finalStep) {
                    // last step: everything sinks into black
                    ctx.fillStyle = `rgba(0,0,0,${smoothstep(Math.min(1, t * 1.15)).toFixed(3)})`;
                    ctx.fillRect(0, 0, w, h);
                }
            },
        };
    }

    const effect = GENTRIFY_EFFECT === 'vignette' ? createVignetteEffect() : createMoldEffect();

    let clicks = 0;
    let shown = 0;          // darkness currently drawn, 0 = none, 1 = fully black
    let animation = null;

    // Smoothly moves the darkness to `target` within `duration` ms.
    function animateTo(target, duration, onDone) {
        cancelAnimationFrame(animation);
        const from = shown;
        effect.beginStep(from, target);
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out
            shown = from + (target - from) * eased;
            effect.render(shown, t);
            if (t < 1) animation = requestAnimationFrame(tick);
            else if (onDone) onDone();
        };
        animation = requestAnimationFrame(tick);
    }

    function startCountdown() {
        // Based on the clock, not on counting ticks, so it stays exact even
        // if the browser slows down timers.
        const end = Date.now() + GENTRIFY_RELOAD_SECONDS * 1000;
        const update = () => {
            const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            countdown.textContent = String(left);
            if (left > 0) {
                setTimeout(update, 250);
            } else {
                // Start again from the top of the page, not where the visitor left off.
                if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
                window.scrollTo(0, 0);
                setTimeout(() => location.reload(), 700); // let "0" be seen for a moment
            }
        };
        update();
    }

    function finish() {
        overlay.style.background = '#171717'; // make sure it is fully black
        overlay.classList.add('is-final'); // now blocks the page
        message.classList.add('is-visible');
        // Start counting once the message has faded in, so "20" is clearly visible.
        countdown.textContent = String(GENTRIFY_RELOAD_SECONDS);
        countdown.classList.add('is-visible');
        setTimeout(startCountdown, 1500);
    }

    // Clicks before the MIN-th one change nothing. At the MIN-th click the
    // darkening starts; after that it moves on by itself, step by step and
    // faster each time, until the page is black and the message appears.
    // Extra clicks only bring the next step sooner.
    
    const visibleSteps = extraClicks + 1;   
    let step = 0;           // darkening steps done so far
    let autoTimer = null;

    function nextStep() {
        clearTimeout(autoTimer);
        if (step >= visibleSteps) return;   // already black
        step += 1;
        const target = step / visibleSteps;
        const speed = Math.pow(GENTRIFY_SPEEDUP, step - 1); // 1, 0.6, 0.36, ...
        // Only one step (straight from clear to black): take longer so it still feels gradual.
        const duration = visibleSteps === 1 ? firstStepMs * 2 : firstStepMs * speed;
        animateTo(target, duration, () => {
            if (target >= 1) finish();
            else if (GENTRIFY_IDLE_MS > 0) idleTimer = setTimeout(nextStep, GENTRIFY_IDLE_MS);
        });
    }

    function registerClick() {
        clicks += 1;
        if (clicks >= startClick) nextStep();  
    }
    // 1) Clicks on the bottom map
    map.on('click', registerClick);

    // 2) Clicks on the buttons next to it (Pilates, Cafés, Wohnlage areas, ...).
    // The listener sits on #toolbox itself, because script.js rebuilds the
    // buttons inside it after the data has loaded.
    const toolbox = document.getElementById('toolbox');
    if (toolbox) {
        toolbox.addEventListener('click', (event) => {
            if (event.target.closest('button')) registerClick();
        });
    };
})();    