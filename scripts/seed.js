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
    // Las Vegas
    { name: 'Carson Kitchen Mural', lat: 36.1679129, lng: -115.1406508, description: 'Mural created for Life is Beautiful 2016, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'World Cow – D.J. Barry', lat: 36.1545618, lng: -115.154136, description: '"We\'re all spots on the same cow" — Vermont artist D.J. Barry created this piece celebrating unity.', city: 'lasvegas' },
    { name: 'Downtown Cocktail Room Mural', lat: 36.1688736, lng: -115.1406997, description: 'Mural created for Life is Beautiful 2015, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Plaza Hotel Poolside Mural', lat: 36.1718879, lng: -115.1466453, description: 'Located at Plaza Hotel & Casino poolside.', city: 'lasvegas' },
    { name: 'Mark Drew – Ogden Ave', lat: 36.1697208, lng: -115.1374392, description: 'Australian artist Mark Drew, based in Tokyo, co-founder of China Heights gallery in Sydney.', city: 'lasvegas' },
    { name: 'Frida Kahlo – Main St', lat: 36.1573321, lng: -115.1538202, description: 'Frida Kahlo portrait on South Main Street.', city: 'lasvegas' },
    { name: 'Felipe Pantone Wall', lat: 36.1697529, lng: -115.1375286, description: 'Located on the side of the Felipe Pantone piece on North 7th Street.', city: 'lasvegas' },
    { name: 'Life Is Beautiful 2017 – 7th St', lat: 36.168116, lng: -115.1386229, description: 'Mural created for Life Is Beautiful 2017, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Homeland Roots Mural', lat: 36.1660297, lng: -115.1147758, description: 'Our homeland is rooted in the heart, our pride runs in our veins and the future in our smile.', city: 'lasvegas' },
    { name: 'The 211 Apartments Mural', lat: 36.169409, lng: -115.135883, description: 'Mural created for Life is Beautiful 2015, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Whitney Recreation Center', lat: 36.0958809, lng: -115.0479818, description: 'A mural depicting people and activities in the Whitney Recreation Center.', city: 'lasvegas' },
    { name: 'Mechan X – Tyler Fuqua', lat: 36.1677942, lng: -115.1368821, description: 'Mechan X was created by Tyler Fuqua Creations — their second giant fallen robot, built for the 2018 festival.', city: 'lasvegas' },
    { name: 'Bicicleta Sem Freio – Life is Beautiful', lat: 36.1698471, lng: -115.138083, description: 'Brazilian duo Bicicleta Sem Freio piece in downtown Las Vegas for Life is Beautiful 2017, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Life is Beautiful – 7th & Fremont', lat: 36.1683927, lng: -115.1380377, description: 'Mural created for Life Is Beautiful, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Corporate Subsidy Commentary', lat: 36.1688201, lng: -115.1395158, description: 'Created for Life is Beautiful 2016 — a comment on corporate subsidy, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Life is Beautiful 2016 – 7th St', lat: 36.1697096, lng: -115.1375822, description: 'Created for Life is Beautiful 2016, curated by Just Kids, on North 7th Street.', city: 'lasvegas' },
    { name: 'Aware Indecline – 7th St', lat: 36.1701891, lng: -115.1378175, description: 'Created by Aware Indecline for Life is Beautiful 2018, curated by Just Kids.', city: 'lasvegas' },
    { name: 'Sebastián Velasco – First US Mural', lat: 36.170103, lng: -115.1358564, description: 'Spanish artist Sebastián Velasco\'s first piece in the USA, a striking photorealistic mural for Life is Beautiful.', city: 'lasvegas' },
    { name: "Writer's Block Mural", lat: 36.1667895, lng: -115.134375, description: 'Mural created for Life is Beautiful 2017, curated by JUST KIDS, at The Writer\'s Block on Fremont Street.', city: 'lasvegas' },
    { name: 'Life is Beautiful 2017 – 7th & Ogden', lat: 36.1702466, lng: -115.1372389, description: 'Done for Life is Beautiful 2017, curated by Just Kids, located on 7th between Ogden and Stewart.', city: 'lasvegas' },
    { name: 'Mau Lencinas – Fremont St', lat: 36.1672543, lng: -115.1360802, description: 'Mau Lencinas created this three-piece mural for Life is Beautiful 2017, curated by Just Kids.', city: 'lasvegas' },
    { name: 'Hope Koi – Stencil Artista', lat: 36.1864478, lng: -115.1364115, description: 'Hope Koi by local Las Vegas artist The Stencil Artista, curated by The RAH Project for Life is Beautiful.', city: 'lasvegas' },
    { name: 'Carson Ave & Las Vegas Blvd Mural', lat: 36.1682199, lng: -115.1417021, description: 'Corner of Carson Ave & Las Vegas Blvd, done for Life is Beautiful 2017, curated by Just Kids.', city: 'lasvegas' },
    { name: 'Wild Wild Waste – Bordalo II', lat: 36.1703497, lng: -115.1371123, description: 'Site-specific installation by Portuguese activist and ecologist Artur Bordalo, known as Bordalo II.', city: 'lasvegas' },
    { name: 'Life is Beautiful 2013 – 7th St', lat: 36.1700821, lng: -115.1379578, description: 'Mural created for Life is Beautiful 2013 on North 7th Street.', city: 'lasvegas' },
    { name: 'André Saraiva – Mr. A Alley', lat: 36.1682345, lng: -115.1376753, description: "Paris-bred graffiti artist André Saraiva's iconic alter-ego Mr. A spans an entire two-block alley.", city: 'lasvegas' },
    { name: 'Life is Beautiful – Fremont Murals', lat: 36.1683412, lng: -115.1384406, description: 'Murals created for Life Is Beautiful, curated by JUST KIDS, on Fremont Street.', city: 'lasvegas' },
    { name: 'ROA – Horned Lizard', lat: 36.1711281, lng: -115.13809, description: 'ROA Horned Lizard mural, part of Life is Beautiful 2014, curated by JUST KIDS.', city: 'lasvegas' },
    { name: 'Big Rig Jig Sculpture', lat: 36.1667324, lng: -115.1342494, description: 'Constructed from two discarded tanker trucks, serving as both sculpture and architectural space.', city: 'lasvegas' },
    { name: 'Joakim Ojanen – First US Mural', lat: 36.170584, lng: -115.1369289, description: 'The first U.S. mural by Swedish artist Joakim Ojanen, for Life is Beautiful 2018, curated by Just Kids.', city: 'lasvegas' },
    { name: 'Broken Fingaz – Ogden Ave', lat: 36.169216, lng: -115.1369922, description: 'Located on Ogden Ave between 7th & 8th, next to the Broken Fingaz mural.', city: 'lasvegas' },
    { name: '#TheFutureIsColorful – M!SCRE8', lat: 36.1276127, lng: -115.1682242, description: 'Created by Las Vegas artist M!SCRE8, commissioned by Fashion Show Mall.', city: 'lasvegas' },
    { name: '7th & Ogden Corner Mural', lat: 36.1695068, lng: -115.1376884, description: 'Located at the corner of 7th & Ogden in downtown Las Vegas.', city: 'lasvegas' },
    { name: 'Life is Beautiful 2013 – Fremont', lat: 36.1687129, lng: -115.139557, description: 'One of the oldest Life is Beautiful murals from the 2013 festival, curated by Just Kids.', city: 'lasvegas' },
    { name: 'Heal the World – Recycled Propaganda', lat: 36.1663205, lng: -115.1339089, description: 'Created by Las Vegas stencil artist Recycled Propaganda for Life is Beautiful 2018.', city: 'lasvegas' },
    { name: 'Broken Fingaz Crew', lat: 36.1692791, lng: -115.1369749, description: 'Created by Broken Fingaz crew for Life is Beautiful 2018, curated by Just Kids.', city: 'lasvegas' },
    { name: '7th Street Mural', lat: 36.1683927, lng: -115.1380377, description: 'Located on 7th Street between Fremont and Ogden.', city: 'lasvegas' },
    { name: 'Plaza Hotel Back Mural', lat: 36.1718879, lng: -115.1466453, description: 'Located at Plaza Hotel & Casino back side, done for Life is Beautiful 2017, curated by Just Kids.', city: 'lasvegas' },
    { name: 'Dulk & Doze – Stewart Ave', lat: 36.1705324, lng: -115.1369063, description: 'Located on 7th & Stewart Ave, featuring work by Dulk and Doze.', city: 'lasvegas' },
    { name: 'Plaza Hotel Casino Mural', lat: 36.1718879, lng: -115.1466453, description: 'Mural at Plaza Hotel & Casino in downtown Las Vegas.', city: 'lasvegas' },
  ]

  for (const m of murals) {
    await pool.query(
      'INSERT INTO murals (name, lat, lng, description, city) VALUES ($1, $2, $3, $4, $5)',
      [m.name, m.lat, m.lng, m.description, m.city]
    )
  }

  const cities = {}
  murals.forEach(m => { cities[m.city] = (cities[m.city] || 0) + 1 })
  const summary = Object.entries(cities).map(([c, n]) => `${n} ${c}`).join(', ')
  console.log(`Seed complete: murals table created with ${murals.length} rows (${summary})`)
  await pool.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
