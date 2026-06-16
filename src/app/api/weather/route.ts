export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  if (!lat || !lon) return Response.json({ error: "missing params" }, { status: 400 });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`,
    { next: { revalidate: 1800 } }
  );
  const data = await res.json();
  return Response.json(data);
}
