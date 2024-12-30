const { Client } = require('pg');
const fs = require('fs');

// PostgreSQL connection configuration
const pgConfig = {
  user: "ferre",
  host: "localhost",
  database: "gis",
  password: "wachtwoord",
  port: 5432, // default port for PostgreSQL
};

// Create a new PostgreSQL client with the provided configuration
const client = new Client(pgConfig);

// Path to your GeoJSON file
const geoJsonFilePath = '../public/gemFromDB.geojson';

async function setupDatabase() {
  try {
    // Connect to the database
    await client.connect();

    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS gemeente (
        id SERIAL PRIMARY KEY,
        refgem TEXT,
        naam TEXT,
        viewCount DOUBLE PRECISION DEFAULT 0,
        total_views INT DEFAULT 0,
        route_count INT DEFAULT 0,
        geom geometry(Geometry, 4326),
        bbox_min geometry(POINT, 4326),
        bbox_max geometry(POINT, 4326)
      );
    `);

    console.log('Table created successfully!');

    // Read the GeoJSON file
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonFilePath, 'utf8'));

    console.log('GeoJSON Data:', geoJsonData);

    // Iterate through each feature and insert into the database
    for (const feature of geoJsonData.features) {
      const properties = feature.properties;

      const insertQuery = `
        INSERT INTO gemeente (geom, refgem, naam, viewcount, total_views, route_count, bbox_min, bbox_max)
        VALUES (ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), ST_SetSRID(ST_MakePoint($9, $10), 4326));
      `;

      // Execute the query
      await client.query(insertQuery, [
        JSON.stringify(feature.geometry),
        properties.refgem,
        properties.naam,
        properties.viewcount,
        properties.total_views,
        properties.route_count,
        properties.bbox_min.coordinates[0],
        properties.bbox_min.coordinates[1],
        properties.bbox_max.coordinates[0],
        properties.bbox_max.coordinates[1]
      ]);
    }

    console.log('GeoJSON features inserted successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database connection
    await client.end();
  }
}

// Call the function to set up the database
setupDatabase();
