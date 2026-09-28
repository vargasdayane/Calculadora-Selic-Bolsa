export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate'); // DD/MM/YYYY
  const endDate = searchParams.get('endDate');     // DD/MM/YYYY

  try {
    // BCB Serie 11 = Taxa SELIC diária (% ao dia)
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json&dataInicial=${startDate}&dataFinal=${endDate}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }, // cache por 1h
    });

    if (!res.ok) {
      return Response.json({ error: 'Erro ao buscar dados da SELIC no BCB' }, { status: 502 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
