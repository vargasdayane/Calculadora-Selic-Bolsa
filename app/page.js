"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ─── Popular B3 Stocks ──────────────────────────────────────────────────────
const POPULAR_STOCKS = [
  { ticker: "PETR4.SA", name: "Petrobras PN" },
  { ticker: "VALE3.SA", name: "Vale ON" },
  { ticker: "ITUB4.SA", name: "Itaú Unibanco PN" },
  { ticker: "BBDC4.SA", name: "Bradesco PN" },
  { ticker: "ABEV3.SA", name: "Ambev ON" },
  { ticker: "B3SA3.SA", name: "B3 ON" },
  { ticker: "WEGE3.SA", name: "WEG ON" },
  { ticker: "MGLU3.SA", name: "Magazine Luiza ON" },
  { ticker: "RENT3.SA", name: "Localiza ON" },
  { ticker: "BBAS3.SA", name: "Banco do Brasil ON" },
  { ticker: "LREN3.SA", name: "Lojas Renner ON" },
  { ticker: "EGIE3.SA", name: "Engie Brasil ON" },
  { ticker: "RADL3.SA", name: "Raia Drogasil ON" },
  { ticker: "TOTS3.SA", name: "TOTVS ON" },
  { ticker: "SBSP3.SA", name: "Sabesp ON" },
  { ticker: "TAEE11.SA", name: "Taesa Units" },
  { ticker: "CMIG4.SA", name: "Cemig PN" },
  { ticker: "VIVT3.SA", name: "Telefônica Brasil ON" },
  { ticker: "PRIO3.SA", name: "PRIO ON" },
  { ticker: "CPLE6.SA", name: "Copel PNB" },
  { ticker: "SUZB3.SA", name: "Suzano ON" },
  { ticker: "EMBR3.SA", name: "Embraer ON" },
  { ticker: "RAIL3.SA", name: "Rumo ON" },
  { ticker: "CSAN3.SA", name: "Cosan ON" },
  { ticker: "AZUL4.SA", name: "Azul PN" },
  { ticker: "GOLL4.SA", name: "Gol PN" },
];

const PERIODS = [
  { label: "1 ano", value: "1y", years: 1 },
  { label: "2 anos", value: "2y", years: 2 },
  { label: "5 anos", value: "5y", years: 5 },
  { label: "10 anos", value: "10y", years: 10 },
];

// ─── Utilities ──────────────────────────────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  return (value >= 0 ? "+" : "") + value.toFixed(2).replace(".", ",") + "%";
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function toDateBR(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── Compound SELIC growth from daily rates ─────────────────────────────────
function computeSelicGrowth(selicData, startDate, endDate, initial) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let factor = 1;
  const monthlyPoints = [];
  let lastMonth = null;

  selicData.forEach((entry) => {
    const [d, m, y] = entry.data.split("/");
    const dt = new Date(`${y}-${m}-${d}`);
    if (dt < start || dt > end) return;

    const dailyRate = parseFloat(entry.valor.replace(",", ".")) / 100;
    factor *= 1 + dailyRate;

    const monthKey = `${y}-${m}`;
    if (monthKey !== lastMonth) {
      monthlyPoints.push({ date: `${y}-${m}-${d}`, value: initial * factor });
      lastMonth = monthKey;
    }
  });

  return { points: monthlyPoints, finalFactor: factor };
}

// ─── Align stock & selic monthly arrays ────────────────────────────────────
function alignSeries(selicPoints, stockPrices, initial) {
  // build map from month key -> selic value
  const selicMap = {};
  selicPoints.forEach((p) => {
    const key = p.date.slice(0, 7);
    selicMap[key] = p.value;
  });

  // stock baseline is first available price
  const basePrice = stockPrices[0]?.close || 1;
  const stockMap = {};
  stockPrices.forEach((p) => {
    const key = p.date.slice(0, 7);
    stockMap[key] = (p.close / basePrice) * initial;
  });

  // union of all months
  const allMonths = Array.from(
    new Set([...Object.keys(selicMap), ...Object.keys(stockMap)])
  ).sort();

  const labels = [];
  const selicSeries = [];
  const stockSeries = [];

  let lastSelic = null;
  let lastStock = null;

  allMonths.forEach((m) => {
    if (selicMap[m] !== undefined) lastSelic = selicMap[m];
    if (stockMap[m] !== undefined) lastStock = stockMap[m];
    if (lastSelic !== null && lastStock !== null) {
      const [y, mo] = m.split("-");
      labels.push(`${mo}/${y}`);
      selicSeries.push(parseFloat(lastSelic.toFixed(2)));
      stockSeries.push(parseFloat(lastStock.toFixed(2)));
    }
  });

  return { labels, selicSeries, stockSeries };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Home() {
  const [tickerInput, setTickerInput] = useState("");
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [period, setPeriod] = useState("5y");
  const [initialAmount, setInitialAmount] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const dropdownRef = useRef(null);

  const filteredStocks = tickerInput.length > 0
    ? POPULAR_STOCKS.filter(
        (s) =>
          s.ticker.toLowerCase().includes(tickerInput.toLowerCase()) ||
          s.name.toLowerCase().includes(tickerInput.toLowerCase())
      )
    : POPULAR_STOCKS;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCompare = useCallback(async () => {
    if (!selectedTicker) {
      setError("Por favor, selecione uma ação da lista.");
      return;
    }
    if (!initialAmount || initialAmount < 1) {
      setError("O valor inicial deve ser maior que R$ 1,00.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const now = new Date();
      const periodData = PERIODS.find((p) => p.value === period);
      const startDate = addYears(now, periodData.years);
      const endDateBR = toDateBR(now);
      const startDateBR = toDateBR(startDate);

      // Fetch in parallel
      const [selicRes, stockRes] = await Promise.all([
        fetch(`/api/selic?startDate=${startDateBR}&endDate=${endDateBR}`),
        fetch(`/api/stock?ticker=${selectedTicker.ticker}&range=${period}`),
      ]);

      const selicData = await selicRes.json();
      const stockData = await stockRes.json();

      if (!selicRes.ok) throw new Error(selicData.error || "Erro ao buscar SELIC");
      if (!stockRes.ok) throw new Error(stockData.error || "Erro ao buscar ação");

      if (!Array.isArray(selicData) || selicData.length === 0) {
        throw new Error("Dados da SELIC não disponíveis para o período selecionado.");
      }
      if (!stockData.prices || stockData.prices.length === 0) {
        throw new Error("Dados da ação não disponíveis para o período selecionado.");
      }

      const { points: selicPoints, finalFactor } = computeSelicGrowth(
        selicData,
        startDate,
        now,
        initialAmount
      );

      const selicFinalValue = initialAmount * finalFactor;
      const selicReturn = ((finalFactor - 1) * 100);

      const stockPrices = stockData.prices;
      const basePrice = stockPrices[0].close;
      const lastPrice = stockPrices[stockPrices.length - 1].close;
      const stockFactor = lastPrice / basePrice;
      const stockFinalValue = initialAmount * stockFactor;
      const stockReturn = ((stockFactor - 1) * 100);

      const { labels, selicSeries, stockSeries } = alignSeries(
        selicPoints,
        stockPrices,
        initialAmount
      );

      setResult({
        labels,
        selicSeries,
        stockSeries,
        selicFinalValue,
        stockFinalValue,
        selicReturn,
        stockReturn,
        initial: initialAmount,
        period: periodData,
        stock: selectedTicker,
        stockName: stockData.shortName,
        startDateBR,
        endDateBR,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTicker, initialAmount, period]);

  // ─── Chart Config ───────────────────────────────────────────────────────
  const chartData = result
    ? {
        labels: result.labels,
        datasets: [
          {
            label: "SELIC",
            data: result.selicSeries,
            borderColor: "#06b6d4",
            backgroundColor: "rgba(6, 182, 212, 0.06)",
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.4,
          },
          {
            label: result.stock.ticker.replace(".SA", ""),
            data: result.stockSeries,
            borderColor: "#f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.06)",
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 5,
            fill: true,
            tension: 0.4,
          },
        ],
      }
    : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(11, 22, 40, 0.95)",
        borderColor: "rgba(99, 179, 237, 0.2)",
        borderWidth: 1,
        titleColor: "#94a3b8",
        bodyColor: "#f0f6ff",
        padding: 12,
        callbacks: {
          label: (ctx) =>
            ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: {
          color: "#4a6080",
          maxTicksLimit: 12,
          maxRotation: 0,
          font: { size: 11 },
        },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: {
          color: "#4a6080",
          font: { size: 11 },
          callback: (v) =>
            "R$" +
            (v >= 1000
              ? (v / 1000).toFixed(1) + "k"
              : v.toFixed(0)),
        },
      },
    },
  };

  // ─── Winner logic ────────────────────────────────────────────────────────
  const winner = result
    ? result.selicFinalValue > result.stockFinalValue
      ? "SELIC"
      : result.stockFinalValue > result.selicFinalValue
      ? result.stock.ticker.replace(".SA", "")
      : "Empate"
    : null;

  const diff = result
    ? Math.abs(result.selicFinalValue - result.stockFinalValue)
    : 0;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Animated background */}
      <div className="bg-orbs" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <main className="app-wrapper">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-badge">
            <span className="dot" />
            Dados em tempo real
          </div>
          <h1>
            SELIC vs <em>Ações</em>
          </h1>
          <p>
            Compare o rendimento da renda fixa com ações da B3 e descubra qual
            investimento teria rentabilizado mais no período selecionado.
          </p>
        </header>

        {/* ── Controls ── */}
        <section className="glass-card" aria-label="Configurações da simulação">
          <div className="controls-grid">
            {/* Ticker selector */}
            <div className="control-group" ref={dropdownRef}>
              <label className="control-label" htmlFor="ticker-input">
                📊 Selecionar Ação (B3)
              </label>
              <div className="ticker-search-wrapper">
                <div className="input-wrapper">
                  <span className="input-icon">🔍</span>
                  <input
                    id="ticker-input"
                    type="text"
                    className="has-icon"
                    placeholder="Ex: PETR4, VALE3..."
                    value={tickerInput}
                    autoComplete="off"
                    onChange={(e) => {
                      setTickerInput(e.target.value);
                      setShowDropdown(true);
                      if (selectedTicker && e.target.value !== selectedTicker.ticker.replace(".SA", "")) {
                        setSelectedTicker(null);
                      }
                    }}
                    onFocus={() => setShowDropdown(true)}
                    aria-haspopup="listbox"
                    aria-expanded={showDropdown}
                    aria-autocomplete="list"
                  />
                </div>
                {showDropdown && filteredStocks.length > 0 && (
                  <div className="ticker-dropdown" role="listbox">
                    {filteredStocks.map((s) => (
                      <div
                        key={s.ticker}
                        className="ticker-option"
                        role="option"
                        aria-selected={selectedTicker?.ticker === s.ticker}
                        onClick={() => {
                          setSelectedTicker(s);
                          setTickerInput(s.ticker.replace(".SA", ""));
                          setShowDropdown(false);
                        }}
                      >
                        <span className="ticker-code">
                          {s.ticker.replace(".SA", "")}
                        </span>
                        <span className="ticker-name">{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedTicker && (
                <p className="info-note">
                  ✅ {selectedTicker.name}
                </p>
              )}
            </div>

            {/* Initial amount */}
            <div className="control-group">
              <label className="control-label" htmlFor="initial-amount">
                💰 Valor Inicial
              </label>
              <div className="input-wrapper">
                <span className="input-icon">R$</span>
                <input
                  id="initial-amount"
                  type="number"
                  className="has-icon"
                  min="1"
                  step="1000"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(parseFloat(e.target.value) || 0)}
                  placeholder="10000"
                />
              </div>
              <p className="info-note">
                Valor simulado: {formatCurrency(initialAmount)}
              </p>
            </div>

            {/* Period selector */}
            <div className="control-group">
              <label className="control-label">📅 Janela de Tempo</label>
              <div className="period-pills" role="group" aria-label="Selecione o período">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    className={`pill${period === p.value ? " active" : ""}`}
                    onClick={() => setPeriod(p.value)}
                    id={`period-${p.value}`}
                    aria-pressed={period === p.value}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            className="btn-compare"
            id="btn-compare"
            onClick={handleCompare}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Buscando dados…
              </>
            ) : (
              <>
                ⚡ Comparar Investimentos
              </>
            )}
          </button>

          {error && (
            <div className="error-banner" role="alert" aria-live="assertive">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <div>
                <strong>Erro:</strong> {error}
              </div>
            </div>
          )}
        </section>

        {/* ── Results ── */}
        {result && (
          <section className="results-section" aria-label="Resultados da simulação">
            {/* Winner banner */}
            <div className="winner-banner" role="status">
              <span className="winner-trophy" aria-hidden="true">
                {winner === "SELIC" ? "🏦" : winner === "Empate" ? "🤝" : "📈"}
              </span>
              <div className="winner-text">
                <h3>
                  {winner === "Empate"
                    ? "Empate técnico!"
                    : `${winner} foi o melhor investimento`}
                </h3>
                <p>
                  {winner !== "Empate" &&
                    `Diferença de ${formatCurrency(diff)} no período de ${result.period.label} (${result.startDateBR} a ${result.endDateBR})`}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="stats-grid">
              <div
                className="stat-card"
                style={{ "--card-accent": "var(--selic-color)" }}
              >
                <div className="stat-label">🏦 SELIC — Valor Final</div>
                <div className="stat-value text-cyan">
                  {formatCurrency(result.selicFinalValue)}
                </div>
                <div className="stat-sub">
                  Retorno:{" "}
                  <strong className={result.selicReturn >= 0 ? "text-green" : "text-red"}>
                    {formatPercent(result.selicReturn)}
                  </strong>
                </div>
              </div>

              <div
                className="stat-card"
                style={{ "--card-accent": "var(--stock-color)" }}
              >
                <div className="stat-label">
                  📈 {result.stock.ticker.replace(".SA", "")} — Valor Final
                </div>
                <div className="stat-value text-amber">
                  {formatCurrency(result.stockFinalValue)}
                </div>
                <div className="stat-sub">
                  Retorno:{" "}
                  <strong
                    className={result.stockReturn >= 0 ? "text-green" : "text-red"}
                  >
                    {formatPercent(result.stockReturn)}
                  </strong>
                </div>
              </div>

              <div
                className="stat-card"
                style={{ "--card-accent": "var(--accent-purple)" }}
              >
                <div className="stat-label">💰 Capital Inicial</div>
                <div className="stat-value text-purple">
                  {formatCurrency(result.initial)}
                </div>
                <div className="stat-sub">Período: {result.period.label}</div>
              </div>

              <div
                className="stat-card"
                style={{ "--card-accent": "var(--accent-green)" }}
              >
                <div className="stat-label">📊 Diferença de Rentabilidade</div>
                <div className="stat-value text-green">
                  {formatPercent(
                    Math.abs(result.selicReturn - result.stockReturn)
                  )}
                </div>
                <div className="stat-sub">
                  {winner !== "Empate"
                    ? `${winner} teve ${
                        result.selicReturn > result.stockReturn
                          ? formatPercent(result.selicReturn - result.stockReturn)
                          : formatPercent(result.stockReturn - result.selicReturn)
                      } a mais`
                    : "Ambos renderam igual"}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="chart-card">
              <div className="chart-card-header">
                <div>
                  <div className="chart-title">Evolução do Capital</div>
                  <div className="chart-subtitle">
                    {result.startDateBR} — {result.endDateBR} ·{" "}
                    {result.labels.length} pontos mensais
                  </div>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div
                      className="legend-dot"
                      style={{ background: "#06b6d4" }}
                    />
                    SELIC
                  </div>
                  <div className="legend-item">
                    <div
                      className="legend-dot"
                      style={{ background: "#f59e0b" }}
                    />
                    {result.stock.ticker.replace(".SA", "")}
                  </div>
                </div>
              </div>
              <div className="chart-wrapper">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            {/* Summary Table */}
            <div className="table-wrapper">
              <table aria-label="Tabela comparativa de investimentos">
                <thead>
                  <tr>
                    <th>Investimento</th>
                    <th>Capital Inicial</th>
                    <th>Valor Final</th>
                    <th>Rentabilidade Total</th>
                    <th>Lucro Bruto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>🏦 SELIC (CDI)</td>
                    <td>{formatCurrency(result.initial)}</td>
                    <td
                      className={
                        result.selicFinalValue >= result.stockFinalValue
                          ? "winner"
                          : ""
                      }
                    >
                      {formatCurrency(result.selicFinalValue)}
                      {result.selicFinalValue > result.stockFinalValue && " 🏆"}
                    </td>
                    <td
                      className={result.selicReturn >= 0 ? "text-green" : "text-red"}
                    >
                      {formatPercent(result.selicReturn)}
                    </td>
                    <td>
                      {formatCurrency(result.selicFinalValue - result.initial)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      📈 {result.stockName || result.stock.name} (
                      {result.stock.ticker.replace(".SA", "")})
                    </td>
                    <td>{formatCurrency(result.initial)}</td>
                    <td
                      className={
                        result.stockFinalValue > result.selicFinalValue
                          ? "winner"
                          : ""
                      }
                    >
                      {formatCurrency(result.stockFinalValue)}
                      {result.stockFinalValue > result.selicFinalValue && " 🏆"}
                    </td>
                    <td
                      className={result.stockReturn >= 0 ? "text-green" : "text-red"}
                    >
                      {formatPercent(result.stockReturn)}
                    </td>
                    <td>
                      {formatCurrency(result.stockFinalValue - result.initial)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="footer">
          <p>
            Dados da SELIC:{" "}
            <a
              href="https://www.bcb.gov.br"
              target="_blank"
              rel="noopener noreferrer"
            >
              Banco Central do Brasil
            </a>{" "}
            · Dados de ações:{" "}
            <a
              href="https://finance.yahoo.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Yahoo Finance
            </a>
          </p>
          <p>
            ⚠️ Esta ferramenta é de caráter educativo. Rentabilidade passada não
            garante retorno futuro.
          </p>
        </footer>
      </main>
    </>
  );
}
