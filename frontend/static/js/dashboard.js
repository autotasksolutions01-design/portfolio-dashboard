/* =========================================
   Dashboard Logic
   ========================================= */

// Auth guard
if (!getToken()) {
  window.location.href = "/";
}

// State
let assets = [];
let prices = {};
let currentFilter = "all";
let editingAssetId = null;

// DOM refs
const totalValueEl = document.getElementById("total-value");
const totalCostEl = document.getElementById("total-cost");
const totalPnlEl = document.getElementById("total-pnl");
const totalPnlPctEl = document.getElementById("total-pnl-pct");
const assetCountEl = document.getElementById("asset-count");
const allocationBarsEl = document.getElementById("allocation-bars");
const topMoversEl = document.getElementById("top-movers");
const assetsTbody = document.getElementById("assets-tbody");
const lastUpdatedEl = document.getElementById("last-updated");
const modal = document.getElementById("asset-modal");

// Set username
document.getElementById("nav-username").textContent = getUsername();

// =========================================
// Navigation
// =========================================
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    const section = item.dataset.section;
    document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
    document.querySelectorAll(".content-section").forEach((s) => s.classList.remove("active"));
    item.classList.add("active");
    document.getElementById(`section-${section}`).classList.add("active");
    document.getElementById("section-title").textContent =
      section === "overview" ? "Overview" : "Assets";
  });
});

// =========================================
// Logout
// =========================================
document.getElementById("logout-btn").addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

// =========================================
// Filters
// =========================================
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderAssetsTable();
  });
});

// =========================================
// Price fetching
// =========================================
async function fetchPrices(assetList) {
  const cryptoAssets = assetList.filter((a) => a.asset_type === "crypto" && a.coingecko_id);
  const stockAssets = assetList.filter((a) => a.asset_type === "stock");

  const fetchers = [];

  if (cryptoAssets.length > 0) {
    const ids = cryptoAssets.map((a) => a.coingecko_id).join(",");
    fetchers.push(
      api.getCryptoPrices(ids).then((data) => {
        for (const asset of cryptoAssets) {
          if (data[asset.coingecko_id]) {
            prices[asset.symbol] = data[asset.coingecko_id];
          }
        }
      }).catch(() => {})
    );
  }

  // Fetch stock prices sequentially to respect API limits
  for (const asset of stockAssets) {
    fetchers.push(
      api.getStockPrice(asset.symbol).then((data) => {
        prices[asset.symbol] = { price: data.price, change_24h: data.change_24h };
      }).catch(() => {})
    );
  }

  // Cash / stablecoin = price is always 1 USD
  for (const asset of assetList.filter((a) => a.asset_type === "cash")) {
    prices[asset.symbol] = { price: 1.0, change_24h: 0 };
  }

  await Promise.all(fetchers);
}

function getPriceForAsset(asset) {
  return prices[asset.symbol] || null;
}

// =========================================
// Summary
// =========================================
function computeSummary() {
  let totalValue = 0;
  let totalCost = 0;
  const byType = { crypto: 0, stock: 0, forex: 0, cash: 0 };

  for (const asset of assets) {
    const p = getPriceForAsset(asset);
    const currentPrice = p ? p.price : asset.avg_buy_price;
    const value = currentPrice * asset.quantity;
    const cost = asset.avg_buy_price * asset.quantity;
    totalValue += value;
    totalCost += cost;
    byType[asset.asset_type] = (byType[asset.asset_type] || 0) + value;
  }

  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  return { totalValue, totalCost, pnl, pnlPct, byType };
}

function fmtUSD(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function renderSummary() {
  const { totalValue, totalCost, pnl, pnlPct, byType } = computeSummary();

  totalValueEl.textContent = fmtUSD(totalValue);
  totalCostEl.textContent = fmtUSD(totalCost);
  totalPnlEl.textContent = fmtUSD(pnl);
  totalPnlEl.className = "card-value " + (pnl >= 0 ? "positive" : "negative");
  totalPnlPctEl.textContent = fmtPct(pnlPct);
  totalPnlPctEl.className = "card-sub " + (pnlPct >= 0 ? "positive" : "negative");
  assetCountEl.textContent = assets.length;

  // Allocation bars
  allocationBarsEl.innerHTML = "";
  const typeLabels = { crypto: "Crypto", stock: "Stocks", forex: "Forex", cash: "Cash" };
  for (const [type, value] of Object.entries(byType)) {
    if (value === 0) continue;
    const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
    allocationBarsEl.innerHTML += `
      <div class="alloc-bar-wrap">
        <div class="alloc-label-row">
          <span>${typeLabels[type]}</span>
          <span>${fmtUSD(value)} (${pct.toFixed(1)}%)</span>
        </div>
        <div class="alloc-bar-bg">
          <div class="alloc-bar-fill type-${type}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }

  // Top movers
  const assetMovers = assets
    .map((a) => {
      const p = getPriceForAsset(a);
      return { ...a, change: p ? p.change_24h : null };
    })
    .filter((a) => a.change !== null)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);

  topMoversEl.innerHTML = assetMovers.length === 0
    ? '<p class="neutral" style="padding:8px 0;font-size:12px;">No price data yet. Add assets and refresh.</p>'
    : assetMovers.map((a) => `
        <div class="mover-row">
          <div>
            <div class="mover-symbol">${a.symbol}</div>
            <div class="mover-name">${a.name}</div>
          </div>
          <span class="${a.change >= 0 ? "positive" : "negative"}">${fmtPct(a.change)}</span>
        </div>`).join("");
}

// =========================================
// Assets Table
// =========================================
function badgeHtml(type) {
  return `<span class="badge badge-${type}">${type}</span>`;
}

function renderAssetsTable() {
  const filtered = currentFilter === "all"
    ? assets
    : assets.filter((a) => a.asset_type === currentFilter);

  if (filtered.length === 0) {
    assetsTbody.innerHTML = `<tr><td colspan="9" class="loading-row">No assets found. Click "+ Add Asset" to get started.</td></tr>`;
    return;
  }

  assetsTbody.innerHTML = filtered.map((asset) => {
    const p = getPriceForAsset(asset);
    const currentPrice = p ? p.price : null;
    const value = currentPrice !== null ? currentPrice * asset.quantity : null;
    const cost = asset.avg_buy_price * asset.quantity;
    const pnl = value !== null ? value - cost : null;
    const pnlPct = cost > 0 && pnl !== null ? (pnl / cost) * 100 : null;
    const change = p ? p.change_24h : null;

    return `
      <tr data-type="${asset.asset_type}">
        <td>
          <div class="asset-symbol">${asset.symbol}</div>
          <div class="asset-name">${asset.name}</div>
        </td>
        <td>${badgeHtml(asset.asset_type)}</td>
        <td>${asset.quantity.toLocaleString("en-US", {maximumFractionDigits: 8})}</td>
        <td>${fmtUSD(asset.avg_buy_price)}</td>
        <td>${currentPrice !== null ? fmtUSD(currentPrice) : '<span class="neutral">—</span>'}</td>
        <td>${value !== null ? fmtUSD(value) : '<span class="neutral">—</span>'}</td>
        <td class="${pnl !== null ? (pnl >= 0 ? 'positive' : 'negative') : 'neutral'}">
          ${pnl !== null ? fmtUSD(pnl) : '—'}
          ${pnlPct !== null ? `<br><small>${fmtPct(pnlPct)}</small>` : ''}
        </td>
        <td class="${change !== null ? (change >= 0 ? 'positive' : 'negative') : 'neutral'}">
          ${change !== null ? fmtPct(change) : '—'}
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-sm" onclick="openEditModal(${asset.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteAsset(${asset.id})">Del</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

// =========================================
// Modal
// =========================================
document.getElementById("add-asset-btn").addEventListener("click", () => openAddModal());
document.getElementById("modal-close-btn").addEventListener("click", closeModal);
document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);

document.getElementById("asset-type").addEventListener("change", (e) => {
  const cgGroup = document.getElementById("coingecko-group");
  cgGroup.style.display = e.target.value === "crypto" ? "block" : "none";
});

function openAddModal() {
  editingAssetId = null;
  document.getElementById("modal-title").textContent = "Add Asset";
  document.getElementById("asset-form").reset();
  document.getElementById("asset-id").value = "";
  document.getElementById("coingecko-group").style.display = "block";
  document.getElementById("asset-form-error").classList.add("hidden");
  modal.classList.remove("hidden");
}

function openEditModal(id) {
  const asset = assets.find((a) => a.id === id);
  if (!asset) return;
  editingAssetId = id;
  document.getElementById("modal-title").textContent = "Edit Asset";
  document.getElementById("asset-id").value = id;
  document.getElementById("asset-type").value = asset.asset_type;
  document.getElementById("asset-symbol").value = asset.symbol;
  document.getElementById("asset-name").value = asset.name;
  document.getElementById("asset-coingecko").value = asset.coingecko_id || "";
  document.getElementById("asset-quantity").value = asset.quantity;
  document.getElementById("asset-avg-price").value = asset.avg_buy_price;
  document.getElementById("coingecko-group").style.display = asset.asset_type === "crypto" ? "block" : "none";
  document.getElementById("asset-form-error").classList.add("hidden");
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  editingAssetId = null;
}

document.getElementById("asset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("asset-form-error");
  errEl.classList.add("hidden");

  const data = {
    asset_type: document.getElementById("asset-type").value,
    symbol: document.getElementById("asset-symbol").value.trim(),
    name: document.getElementById("asset-name").value.trim(),
    coingecko_id: document.getElementById("asset-coingecko").value.trim() || null,
    quantity: parseFloat(document.getElementById("asset-quantity").value),
    avg_buy_price: parseFloat(document.getElementById("asset-avg-price").value),
  };

  try {
    if (editingAssetId) {
      await api.updateAsset(editingAssetId, data);
    } else {
      await api.createAsset(data);
    }
    closeModal();
    await loadData();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove("hidden");
  }
});

async function deleteAsset(id) {
  if (!confirm("Delete this asset?")) return;
  try {
    await api.deleteAsset(id);
    await loadData();
  } catch (err) {
    alert("Error: " + err.message);
  }
}

// =========================================
// Main load
// =========================================
async function loadData() {
  try {
    assets = await api.getAssets();
    await fetchPrices(assets);
    renderSummary();
    renderAssetsTable();
    lastUpdatedEl.textContent = "Updated " + new Date().toLocaleTimeString();
  } catch (err) {
    if (err.message !== "Unauthorized") {
      console.error("Load error:", err);
    }
  }
}

document.getElementById("refresh-btn").addEventListener("click", loadData);

// Initial load + auto-refresh every 60s
loadData();
setInterval(loadData, 60_000);
