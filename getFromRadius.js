// PostgreSQL connection configuration
const pg = require("pg");

const pgConfig = {
  user: "ferre",
  host: "localhost",
  database: "gis",
  password: "wachtwoord",
  port: 5432, // default port for PostgreSQL
};

async function getFromRadius(lat, lon, radius) {
  const client = new pg.Client(pgConfig);
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database");
    const coordinates = `${lon}, ${lat}`;
    console.log(coordinates);
    // Convert the radius from kilometers to meters, ready to be used in the query
    const radiusInMeters = radius * 1000;
    // Query to fetch the top 5 entries with the most views from knooppunt table
    const query = `
      WITH poi AS (
        SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326) AS point_of_interest
      )
      SELECT unique_code,
        view_count, 
        ST_X(ST_Transform(at_geometry, 4326)) AS lon, 
        ST_Y(ST_Transform(at_geometry, 4326)) AS lat 
      FROM knooppunt
      CROSS JOIN poi
      WHERE ST_Intersects(
            at_geometry,
            ST_Buffer(poi.point_of_interest::geography, $3)::geometry
      )
      AND NOT ST_Equals(at_geometry, poi.point_of_interest);
      `;

    // Execute the query
    const result = await client.query(query, [lon, lat, radiusInMeters]);
    const surroundingKnp = result.rows;
    console.log("Knooppunten binnen: ", radius, " km:");
    console.log(surroundingKnp);

    return surroundingKnp;
  } catch (err) {
    console.error("Error executing query:", err);
    throw err;
  } finally {
    await client.end();
    console.log("Disconnected from PostgreSQL database");
  }
}

module.exports = getFromRadius;
