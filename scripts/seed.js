import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://guilhermeloges@localhost:5433/urban_treasures',
})

async function seed() {
  // Drop and recreate table to add city column
  await pool.query('DROP TABLE IF EXISTS murals')
  await pool.query(`
    CREATE TABLE murals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      description TEXT,
      photo_url TEXT,
      city TEXT
    )
  `)

  // Real mural data from Street Art Cities — Boulder + Denver, CO
  const murals = [
    { name: 'Cherry Creek Flood Wall', lat: 39.7541899, lng: -105.0087313, description: 'Cherry Creek flood wall at Confluence Park.', city: 'denver' },
    { name: 'CRUSH Walls RiNo – Blake St', lat: 39.7653821, lng: -104.9798601, description: "Painted during the annual street art festival CRUSH Walls in Denver's RiNo neighborhood by Spanish duo PichiAvo.", city: 'denver' },
    { name: 'Larimer Street Mural', lat: 39.75853, lng: -104.9848417, description: 'Street art on Larimer Street in Denver.', city: 'denver' },
    { name: 'Casey Kawaguchi – BOOZ Hall', lat: 39.7617021, lng: -104.9834724, description: "Painted by Denver-based artist Casey Kawaguchi, this towering piece is representative of his style of bold colors and Japanese-inspired imagery.", city: 'denver' },
    { name: 'Jason Garcia – Indigenous Patterns', lat: 39.7655157, lng: -104.9752797, description: 'Jason Garcia incorporates geometry, bold colors and indigenous-inspired patterns to create beautiful large-scale murals.', city: 'denver' },
    { name: 'Marion Street Sprout', lat: 39.7455039, lng: -104.9728832, description: 'Found sprouting through the gravel across the street, painted through a dramatic Denver rainstorm.', city: 'denver' },
    { name: 'Jaune – Construction Workers', lat: 39.769565, lng: -104.979296, description: "Belgian artist Jaune's clever construction workers at The Urban Cyclist Denver, painted during CRUSH Walls festival.", city: 'denver' },
    { name: 'CRUSH 2017 Warrior Collaboration', lat: 39.7652775, lng: -104.9791467, description: 'Painted during CRUSH 2017, this collaboration mural depicts a warrior figure at Improper City.', city: 'denver' },
    { name: 'Lorelei Cloud Portrait', lat: 40.0262059, lng: -105.2418726, description: 'Portrait of Lorelei Cloud, Water Rights Advocate and Vice Chair of the Southern Ute Clan in Boulder.', city: 'boulder' },
    { name: 'RiNo Larimer Mural', lat: 39.7624098, lng: -104.9797978, description: 'Street art in the RiNo Art District on Larimer Street.', city: 'denver' },
    { name: 'Sandra Fettingis – Dairy Block', lat: 39.7531094, lng: -104.9972788, description: "Sandra Fettingis' geometric pieces often take a cue from their surroundings for the color scheme and form.", city: 'denver' },
    { name: 'Larimer Street Art', lat: 39.7601835, lng: -104.983562, description: 'Mural on Larimer Street in Denver.', city: 'denver' },
    { name: 'DINKC – Lincoln Park Lounge', lat: 39.728791, lng: -105.0026595, description: "Three sides of the bar are painted by local Denver artist DINKC. Funded by Denver's Urban Arts Fund.", city: 'denver' },
    { name: 'Nick Napoletano – Reflections', lat: 39.7590893, lng: -104.9850141, description: "Reflections are a common theme in Nick Napoletano's work, painted during CRUSH Walls at Matchbox.", city: 'denver' },
    { name: 'CRUSH – Raquelitas Tortillas', lat: 39.763684, lng: -104.979198, description: "Painted during CRUSH in Denver's RiNo neighborhood at Raquelitas Tortillas on Larimer Street.", city: 'denver' },
    { name: 'Vyal One & Breeze – Crema', lat: 39.7611445, lng: -104.9817229, description: "During CRUSH, visiting artists Vyal One and Breeze worked on a full wall at Crema Coffee House.", city: 'denver' },
    { name: 'Diagonal Court Community Mural', lat: 40.0340839, lng: -105.254423, description: 'Painted on one of the buildings at Diagonal Court Community Housing, representing the diversity of the community.', city: 'boulder' },
    { name: 'Colfax Ave Mural', lat: 39.7403406, lng: -104.903911, description: 'Street art on East Colfax Avenue in Denver.', city: 'denver' },
    { name: 'Anna Charney – Colorado Ballet', lat: 39.7335077, lng: -104.9988637, description: "The first mural by Denver-based artist Anna Charney, influenced by illustration and folk art, on Santa Fe Drive.", city: 'denver' },
    { name: 'Larimer Street Piece', lat: 39.7602718, lng: -104.9834382, description: 'Mural at 2737 Larimer Street in Denver.', city: 'denver' },
    { name: "Bigsby's Folly Ground Mural", lat: 39.7699129, lng: -104.9763376, description: "Painted with spray paint on the ground outside a winery, showing the artist's love of pattern and color.", city: 'denver' },
    { name: 'Bella Phame – Brighton Blvd', lat: 39.7647122, lng: -104.9854371, description: 'Created by Portuguese artist duo Bella Phame during CRUSH Walls street art festival in Denver.', city: 'denver' },
    { name: 'Esic – Four Elements', lat: 39.762901, lng: -104.979225, description: 'Denver-based artist Esic incorporates the visualization of the four elements — water, earth, fire and air.', city: 'denver' },
    { name: 'Pedro Barrios & Jaime Molina', lat: 39.749327, lng: -104.9992252, description: 'Denver painting duo Pedro Barrios and Jaime Molina can be seen in every neighborhood with their collaborative style.', city: 'denver' },
    { name: 'Bannock Street Mural', lat: 39.7355544, lng: -104.9899844, description: 'Street art at 1200 Bannock Street in Denver.', city: 'denver' },
  ]

  for (const m of murals) {
    await pool.query(
      'INSERT INTO murals (name, lat, lng, description, city) VALUES ($1, $2, $3, $4, $5)',
      [m.name, m.lat, m.lng, m.description, m.city]
    )
  }

  console.log(`Seed complete: murals table created with ${murals.length} rows (${murals.filter(m => m.city === 'boulder').length} Boulder, ${murals.filter(m => m.city === 'denver').length} Denver)`)
  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
