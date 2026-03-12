/* =========================================
   Market Overview — Binance WebSocket + Chart.js
   ========================================= */

const COINS = [
  { symbol: "BTCUSDT", name: "Bitcoin",  short: "BTC", color: "#f7931a" },
  { symbol: "ETHUSDT", name: "Ethereum", short: "ETH", color: "#627eea" },
  { symbol: "SOLUSDT", name: "Solana",   short: "SOL", color: "#9945ff" },
  { symbol: "BNBUSDT", name: "BNB",      short: "BNB", color: "#f3ba2f" },
  { symbol: "XRPUSDT", name: "XRP",      short: "XRP", color: "#00aae4" },
  { symbol: "ADAUSDT", name: "Cardano",  short: "ADA", color: "#0033ad" },
];

const KLINE_LIMIT = 60; // last 60 minutes
const BINANCE_REST = "https://api.binance.com/api/v3";
const BINANCE_WS   = "wss://stream.binance.com:9443/stream";

// State
let charts = {};        // symbol → Chart instance
let klineData = {};     // symbol → [{t, o, h, l, c}]
let tickerData = {};    // symbol → {price, change}
let activeCoins = new Set(["BTCUSDT"]); // which coins are charted
let ws = null;
let wsReconnectTimer = null;
let marketInitialized = false;

// =========================================
// Init (called when Market tab is clicked)
// =========================================
function initMarket() {
  if (marketInitialized) return;
  marketInitialized = true;
  renderMarketGrid();
  loadAllKlines().then(() => connectWS());
}

// =========================================
// REST — initial kline data
// =========================================
async function loadAllKlines() {
  await Promise.all(COINS.map(c => loadKlines(c.symbol)));
}

async function loadKlines(symbol) {
  try {
    const res = await fetch(`${BINANCE_REST}/klines?symbol=${symbol}&interval=1m&limit=${KLINE_LIMIT}`);
    const raw = await res.json();
    klineData[symbol] = raw.map(k => ({
      t: k[0],
      c: parseFloat(k[4]),
    }));
    if (charts[symbol]) updateChartData(symbol);
    updateTickerCard(symbol);
  } catch (e) {
    console.warn("kline fetch error", symbol, e);
  }
}

// =========================================
// WebSocket — real-time kline + miniTicker
// =========================================
function buildStreams() {
  const klineStreams  = COINS.map(c => `${c.symbol.toLowerCase()}@kline_1m`);
  const tickerStreams = COINS.map(c => `${c.symbol.toLowerCase()}@miniTicker`);
  return [...klineStreams, ...tickerStreams].join("/");
}

function connectWS() {
  if (ws) { ws.onclose = null; ws.close(); }

  ws = new WebSocket(`${BINANCE_WS}?streams=${buildStreams()}`);

  ws.onopen = () => setWsStatus(true);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const data = msg.data;
    if (!data) return;

    if (data.e === "kline") {
      const sym = data.s;
      const k   = data.k;
      if (!klineData[sym]) klineData[sym] = [];
      const last = klineData[sym][klineData[sym].length - 1];
      const point = { t: k.t, c: parseFloat(k.c) };

      if (last && last.t === k.t) {
        klineData[sym][klineData[sym].length - 1] = point;
      } else {
        klineData[sym].push(point);
        if (klineData[sym].length > KLINE_LIMIT) klineData[sym].shift();
      }
      if (charts[sym]) updateChartData(sym);
    }

    if (data.e === "24hrMiniTicker") {
      const sym = data.s;
      const price  = parseFloat(data.c);
      const open24 = parseFloat(data.o);
      const change = ((price - open24) / open24) * 100;
      tickerData[sym] = { price, change };
      updateTickerCard(sym);
    }
  };

  ws.onclose = () => {
    setWsStatus(false);
    wsReconnectTimer = setTimeout(connectWS, 3000);
  };

  ws.onerror = () => ws.close();
}

function setWsStatus(connected) {
  const dot   = document.querySelector(".ws-dot");
  const label = document.querySelector(".ws-label");
  if (!dot) return;
  dot.style.background   = connected ? "var(--green)" : "var(--red)";
  label.textContent      = connected ? "Live" : "Reconnecting...";
}

// =========================================
// Ticker strip
// =========================================
function updateTickerCard(symbol) {
  const coin = COINS.find(c => c.symbol === symbol);
  if (!coin) return;
  const td = tickerData[symbol];
  const kd = klineData[symbol];

  const price  = td ? td.price  : (kd && kd.length ? kd[kd.length - 1].c : null);
  const change = td ? td.change : null;

  let el = document.getElementById(`ticker-${symbol}`);
  if (!el) {
    el = document.createElement("div");
    el.className = "ticker-item";
    el.id = `ticker-${symbol}`;
    document.getElementById("ticker-strip").innerHTML = "";
    COINS.forEach(c => {
      const item = document.createElement("div");
      item.className = "ticker-item";
      item.id = `ticker-${c.symbol}`;
      item.innerHTML = buildTickerHTML(c, null, null);
      document.getElementById("ticker-strip").appendChild(item);
    });
    return;
  }
  el.innerHTML = buildTickerHTML(coin, price, change);
}

function buildTickerHTML(coin, price, change) {
  const priceStr  = price  !== null ? "$" + price.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: price > 100 ? 2 : 6}) : "—";
  const changeStr = change !== null ? (change >= 0 ? "+" : "") + change.toFixed(2) + "%" : "—";
  const cls       = change === null ? "neutral" : change >= 0 ? "positive" : "negative";
  return `
    <div class="ticker-coin" style="border-top: 2px solid ${coin.color}">
      <div class="ticker-short">${coin.short}</div>
      <div class="ticker-price">${priceStr}</div>
      <div class="ticker-change ${cls}">${changeStr}</div>
    </div>`;
}

// =========================================
// Chart grid
// =========================================
function renderMarketGrid() {
  const grid = document.getElementById("market-grid");
  grid.innerHTML = "";

  COINS.forEach(coin => {
    const card = document.createElement("div");
    card.className = `card chart-card ${activeCoins.has(coin.symbol) ? "" : "chart-hidden"}`;
    card.id = `chart-card-${coin.symbol}`;
    card.innerHTML = `
      <div class="chart-card-header">
        <div>
          <span class="chart-coin-dot" style="background:${coin.color}"></span>
          <span class="chart-coin-name">${coin.short}/USDT</span>
          <span class="chart-coin-fullname">${coin.name}</span>
        </div>
        <div>
          <span class="chart-price" id="chart-price-${coin.symbol}">—</span>
          <span class="chart-change" id="chart-change-${coin.symbol}">—</span>
        </div>
      </div>
      <div class="chart-wrap">
        <canvas id="canvas-${coin.symbol}"></canvas>
      </div>`;
    grid.appendChild(card);
    initChart(coin);
  });

  // Initialize ticker strip
  const strip = document.getElementById("ticker-strip");
  strip.innerHTML = "";
  COINS.forEach(coin => {
    const item = document.createElement("div");
    item.className = "ticker-item";
    item.id = `ticker-${coin.symbol}`;
    item.innerHTML = buildTickerHTML(coin, null, null);
    strip.appendChild(item);
  });
}

function initChart(coin) {
  const canvas = document.getElementById(`canvas-${coin.symbol}`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0, coin.color + "40");
  gradient.addColorStop(1, coin.color + "00");

  charts[coin.symbol] = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: coin.color,
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => " $" + ctx.parsed.y.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
            title: (items) => items[0].label + " UTC",
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#484f58", maxTicksLimit: 6, font: { size: 10 } },
          grid: { color: "#21262d" },
        },
        y: {
          position: "right",
          ticks: {
            color: "#8b949e",
            font: { size: 10 },
            callback: (v) => "$" + v.toLocaleString("en-US", { notation: "compact" }),
          },
          grid: { color: "#21262d" },
        }
      }
    }
  });

  if (klineData[coin.symbol]) updateChartData(coin.symbol);
}

function updateChartData(symbol) {
  const chart = charts[symbol];
  const data  = klineData[symbol];
  const coin  = COINS.find(c => c.symbol === symbol);
  if (!chart || !data || !data.length) return;

  chart.data.labels = data.map(k => {
    const d = new Date(k.t);
    return d.getUTCHours().toString().padStart(2,"0") + ":" + d.getUTCMinutes().toString().padStart(2,"0");
  });
  chart.data.datasets[0].data = data.map(k => k.c);
  chart.update("none");

  // Update card header price
  const last   = data[data.length - 1].c;
  const first  = data[0].c;
  const change = ((last - first) / first) * 100;
  const priceEl  = document.getElementById(`chart-price-${symbol}`);
  const changeEl = document.getElementById(`chart-change-${symbol}`);
  if (priceEl) priceEl.textContent = "$" + last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: last > 100 ? 2 : 6 });
  if (changeEl) {
    changeEl.textContent = (change >= 0 ? "+" : "") + change.toFixed(2) + "%";
    changeEl.className = "chart-change " + (change >= 0 ? "positive" : "negative");
  }
}

// =========================================
// Coin filter buttons
// =========================================
document.querySelectorAll(".market-filter-bar .filter-btn[data-coin]").forEach(btn => {
  btn.addEventListener("click", () => {
    const sym = btn.dataset.coin;
    btn.classList.toggle("active");
    const card = document.getElementById(`chart-card-${sym}`);
    if (btn.classList.contains("active")) {
      activeCoins.add(sym);
      card.classList.remove("chart-hidden");
      if (!charts[sym] || !charts[sym].data.labels.length) {
        initChart(COINS.find(c => c.symbol === sym));
        if (klineData[sym]) updateChartData(sym);
      }
    } else {
      activeCoins.delete(sym);
      card.classList.add("chart-hidden");
    }
  });
});

// =========================================
// Hook into nav switching
// =========================================
const _origNavClick = document.querySelectorAll(".nav-item");
_origNavClick.forEach(item => {
  item.addEventListener("click", () => {
    if (item.dataset.section === "market") initMarket();
  });
});
