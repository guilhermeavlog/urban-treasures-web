import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://guilhermeloges@localhost:5433/urban_treasures',
})

async function seed() {
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

  // Clear existing rows so seed is idempotent
  await pool.query('DELETE FROM murals')

  await pool.query(`
    INSERT INTO murals (name, lat, lng, description, photo_url) VALUES
      ('Test Mural', 40.01879, -105.26128, 'A vibrant street mural celebrating local culture and community.', 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,h_643,q_75,w_857/v1/clients/chapelhill/Mural_at_TABLE_by_Sweet_Peas_1__22aa7d65-9c58-4026-ad5e-cb1ba997b61b.jpg'),
      ('Sunset Bloom', 40.01494, -105.26898, 'A colorful explosion of wildflowers and hummingbirds spanning two stories.', 'https://assets.simpleviewinc.com/simpleview/image/upload/c_fill,h_643,q_75,w_857/v1/clients/chapelhill/Mural_at_TABLE_by_Sweet_Peas_1__22aa7d65-9c58-4026-ad5e-cb1ba997b61b.jpg')
  `)

  console.log('Seed complete: murals table created with 2 rows')
  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
