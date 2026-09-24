// SCRIPTS MAIN PAGE

const config = window.APP_CONFIG;
const cloud = document.getElementById("cloud");
const form = document.getElementById("indicator-form");
const input = document.getElementById("indicator");
const statusEl = document.getElementById("status");

input.maxLength = config.MAX_INDICATOR_LENGTH;
document.getElementById("mock-note").hidden = !Api.useMock;

// Indicators currently shown, keyed by normalized text.
const shown = new Map();

// Deterministic pseudo-random number from a string, so each word keeps
// the same position across reloads instead of jumping around.
function hash(str, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
        h ^= h >>> 13;
    }
    return (h >>> 0) / 4294967295;
}

function addToCloud(text, highlight) {
    const key = Api.normalize(text);
    if (!key || shown.has(key)) return;
    const span = document.createElement("span");
    span.textContent = text; // textContent, never innerHTML: input is untrusted
    span.style.left = (5 + hash(key, 1) * 90) + "%";
    span.style.top = (4 + hash(key, 2) * 92) + "%";
    if (highlight) span.classList.add("new");
    cloud.appendChild(span);
    shown.set(key, span);
}

async function refresh() {
    const data = await Api.getIndicators();
    data.indicators.forEach((text) => addToCloud(text, false));
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim().replace(/\s+/g, " ");
    if (!text) return;

    const button = form.querySelector("button");
    button.disabled = true;
    statusEl.className = "";
    statusEl.textContent = "Sending…";
    try {
        const result = await Api.addIndicator(text);
        input.value = "";
        if (result.requireApproval) {
            statusEl.textContent = "Thank you! Your indicator will appear after review.";
        } else {
            addToCloud(text, true);
            statusEl.textContent = "Thank you! Your indicator was added.";
        }
    } catch (err) {
        statusEl.className = "error";
        statusEl.textContent = "Could not send: " + err.message;
    } finally {
        button.disabled = false;
    }
});

startPolling(refresh, config.POLL_INTERVAL_MS);