// Shared data layer for both pages.
// Talks to the Google Apps Script web app, or to an in-memory demo store
// when APP_CONFIG.API_URL is empty (useful for testing the pages locally).
const Api = (() => {
  const config = window.APP_CONFIG;
  const url = (config.API_URL || "").trim();
  const useMock = url === "";

  // Normalized form used to treat "Rising Rents" and "rising  rents" as the same indicator.
  function normalize(text) {
    return String(text || "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  }

  // Keeps the first spelling of every indicator and drops later duplicates.
  function uniqueIndicators(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
      const key = normalize(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(item).trim().replace(/\s+/g, " "));
    }
    return out;
  }

  // ---------- Demo store (no backend) ----------
  const mock = {
    requireApproval: false,
    indicators: ["Rising rents", "New specialty cafés", "Renovated old buildings", "Closing corner shops"],
    pins: [
      { id: "demo-1", lat: 50.1146, lng: 8.6916, indicator: "Rising rents", comment: "Demo pin: rents on this street went up a lot." },
      { id: "demo-2", lat: 50.1037, lng: 8.6627, indicator: "New specialty cafés", comment: "Demo pin: three new cafés opened here." },
    ],
  };

  function mockGet(action) {
    if (action === "indicators") {
      return { requireApproval: mock.requireApproval, indicators: uniqueIndicators(mock.indicators) };
    }
    return { requireApproval: mock.requireApproval, pins: mock.pins.map((p) => ({ ...p })) };
  }

  function mockPost(payload) {
    if (payload.type === "indicator") {
      mock.indicators.push(payload.indicator);
      return { ok: true, requireApproval: mock.requireApproval, item: { indicator: payload.indicator } };
    }
    const pin = { id: "demo-" + Date.now(), lat: payload.lat, lng: payload.lng, indicator: payload.indicator, comment: payload.comment };
    mock.pins.push(pin);
    if (!mock.indicators.some((i) => normalize(i) === normalize(pin.indicator))) mock.indicators.push(pin.indicator);
    return { ok: true, requireApproval: mock.requireApproval, item: pin };
  }

  // ---------- Real backend ----------
  async function get(action) {
    if (useMock) return mockGet(action);
    const res = await fetch(`${url}?action=${encodeURIComponent(action)}&t=${Date.now()}`);
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function post(payload) {
    if (useMock) return mockPost(payload);
    // text/plain avoids a CORS preflight, which Apps Script cannot answer.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  return {
    useMock,
    normalize,
    uniqueIndicators,
    getIndicators: () => get("indicators"),
    getPins: () => get("pins"),
    addIndicator: (indicator) => post({ type: "indicator", indicator }),
    addPin: ({ lat, lng, indicator, comment }) => post({ type: "pin", lat, lng, indicator, comment }),
  };
})();

// Runs `task` every `ms` milliseconds, pausing while the browser tab is hidden.
function startPolling(task, ms) {
  let timer = null;
  const tick = async () => {
    try { await task(); } catch (err) { console.warn("Polling failed:", err); }
    timer = setTimeout(tick, ms);
  };
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    if (!document.hidden) tick();
  });
  tick();
}
