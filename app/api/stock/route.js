export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '10y';

  if (!ticker) {
    return Response.json({ error: 'ticker é obrigatório' }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&range=${range}&includePrePost=false`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return Response.json({ error: `Ticker não encontrado: ${ticker}` }, { status: 404 });
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return Response.json({ error: 'Dados não disponíveis para este ticker' }, { status: 404 });
    }

    const timestamps = result.timestamp;
    const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close;
    const currency = result.meta?.currency || 'BRL';
    const shortName = result.meta?.shortName || ticker;

    // Filtra nulos e monta array de {date, close}
    const prices = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        close: closes[i],
      }))
      .filter(p => p.close != null);

    return Response.json({ ticker, shortName, currency, prices });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
