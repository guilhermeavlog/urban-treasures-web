import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query('SELECT name, lat, lng, description, photo_url FROM murals')
  const murals = rows.map(r => ({
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    description: r.description,
    photoUrl: r.photo_url,
  }))
  return Response.json(murals)
}
