import pool from '@/lib/db'

export async function GET() {
  try {
    // Auto-create table if it doesn't exist (handles fresh Railway deploys)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS murals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        description TEXT,
        photo_url TEXT
      )
    `)

    const { rows } = await pool.query('SELECT name, lat, lng, description, photo_url FROM murals')
    const murals = rows.map(r => ({
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      description: r.description,
      photoUrl: r.photo_url,
    }))
    return Response.json(murals)
  } catch (err) {
    console.error('Failed to fetch murals:', err)
    return Response.json({ error: 'Failed to load murals' }, { status: 500 })
  }
}
