/**
 * Alpaca Market Data Service (free data tier)
 * Docs: https://docs.alpaca.markets/reference/stocklatestquote-1
 */

const ALPACA_DATA_BASE = 'https://data.alpaca.markets/v2';

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET || '',
    'Content-Type': 'application/json',
  };
}

/**
 * Fetch the latest quote + trade for a single symbol.
 * Returns { symbol, price, bid, ask, volume, change, changePercent, timestamp }
 */
async function getQuote(symbol) {
  const sym = symbol.toUpperCase();

  // Fetch latest quote (bid/ask) and latest trade (price/volume) in parallel
  const [quoteRes, tradeRes, prevRes] = await Promise.all([
    fetch(`${ALPACA_DATA_BASE}/stocks/${sym}/quotes/latest`, { headers: alpacaHeaders() }),
    fetch(`${ALPACA_DATA_BASE}/stocks/${sym}/trades/latest`, { headers: alpacaHeaders() }),
    fetch(`${ALPACA_DATA_BASE}/stocks/${sym}/bars?timeframe=1Day&limit=2`, { headers: alpacaHeaders() }),
  ]);

  if (!quoteRes.ok && !tradeRes.ok) {
    const errText = await quoteRes.text();
    throw new Error(`Alpaca API error for ${sym}: ${errText}`);
  }

  const quoteData = quoteRes.ok ? await quoteRes.json() : null;
  const tradeData = tradeRes.ok ? await tradeRes.json() : null;
  const prevData = prevRes.ok ? await prevRes.json() : null;

  const latestPrice = tradeData?.trade?.p ?? quoteData?.quote?.ap ?? null;
  const bid = quoteData?.quote?.bp ?? null;
  const ask = quoteData?.quote?.ap ?? null;
  const volume = tradeData?.trade?.s ?? null;
  const timestamp = tradeData?.trade?.t ?? quoteData?.quote?.t ?? null;

  // Compute change from previous close if daily bars available
  let previousClose = null;
  let change = null;
  let changePercent = null;
  const bars = prevData?.bars ?? [];
  if (bars.length >= 2) {
    previousClose = bars[bars.length - 2]?.c ?? null;
  } else if (bars.length === 1) {
    previousClose = bars[0]?.o ?? null;
  }

  if (latestPrice !== null && previousClose !== null) {
    change = parseFloat((latestPrice - previousClose).toFixed(4));
    changePercent = parseFloat(((change / previousClose) * 100).toFixed(2));
  }

  return {
    symbol: sym,
    price: latestPrice,
    bid,
    ask,
    volume,
    previousClose,
    change,
    changePercent,
    timestamp,
    source: 'alpaca',
  };
}

/**
 * Fetch quotes for multiple symbols at once using Alpaca batch endpoint.
 * Returns an array of quote objects.
 */
async function getBatchQuotes(symbols) {
  const syms = symbols.map(s => s.toUpperCase());
  const symbolsParam = syms.join(',');

  const [quotesRes, tradesRes] = await Promise.all([
    fetch(`${ALPACA_DATA_BASE}/stocks/quotes/latest?symbols=${encodeURIComponent(symbolsParam)}`, { headers: alpacaHeaders() }),
    fetch(`${ALPACA_DATA_BASE}/stocks/trades/latest?symbols=${encodeURIComponent(symbolsParam)}`, { headers: alpacaHeaders() }),
  ]);

  const quotesData = quotesRes.ok ? await quotesRes.json() : { quotes: {} };
  const tradesData = tradesRes.ok ? await tradesRes.json() : { trades: {} };

  const quotes = quotesData.quotes ?? {};
  const trades = tradesData.trades ?? {};

  return syms.map(sym => {
    const q = quotes[sym];
    const t = trades[sym];
    const price = t?.p ?? q?.ap ?? null;
    const bid = q?.bp ?? null;
    const ask = q?.ap ?? null;
    const volume = t?.s ?? null;
    const timestamp = t?.t ?? q?.t ?? null;

    return {
      symbol: sym,
      price,
      bid,
      ask,
      volume,
      change: null,
      changePercent: null,
      timestamp,
      source: 'alpaca',
    };
  });
}

module.exports = { getQuote, getBatchQuotes };
