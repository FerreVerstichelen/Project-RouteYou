// PostgreSQL connection configuration
const pg = require("pg");

const pgConfig = {
  user: "ferre",
  host: "localhost",
  database: "gis",
  password: "wachtwoord",
  port: 5432, // default port for PostgreSQL
};

async function getGemeenteTop5(naam) {
  const client = new pg.Client(pgConfig);

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database");

    // Query to fetch the top 5 entries with the most views from knooppunt table
    const query = `
      SELECT 
        ST_X(ST_Transform(at_geometry, 4326)) AS lng, 
        ST_Y(ST_Transform(at_geometry, 4326)) AS lat, 
        * 
      FROM 
        knooppunt
      WHERE 
        gem = $1 
      ORDER BY 
        view_count DESC 
      LIMIT 5
    `;

    // Execute the query and pass along the "gemeente" name as a parameter
    const result = await client.query(query, [naam]);
    const topEntries = result.rows;
    console.log("Top 5 entries with most views:", topEntries);

    return topEntries;
  } catch (err) {
    console.error("Error executing query:", err);
    throw err;
  } finally {
    await client.end();
    console.log("Disconnected from PostgreSQL database");
  }
}

module.exports = getGemeenteTop5;
