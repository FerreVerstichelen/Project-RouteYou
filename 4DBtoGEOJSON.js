const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// PostGIS connection details
const pgConfig = {
  user: "ferre",
  host: "localhost",
  database: "gis",
  password: "wachtwoord",
  port: 5432, // default port for PostgreSQL
};

// Create a new pool with the connection details
const pool = new Pool(pgConfig);

// Query to retrieve GeoJSON data
const query = `
  SELECT
    json_build_object(
      'type', 'FeatureCollection',
      'features', json_agg(ST_AsGeoJSON(t.*)::json)
    ) AS geojson
  FROM
    gemeente AS t
`;

// Connect to the database and execute the query
pool.query(query, (err, result) => {
  if (err) {
    console.error("Error executing query:", err);
    pool.end(); // Close the pool
    return;
  }

  // Extract the GeoJSON string from the result
  const geojsonString = JSON.stringify(result.rows[0].geojson, null, 2);

  // Define the file path
  const filePath = path.join(__dirname, "public", "gemFromDB.geojson");

  // Write the GeoJSON string to a file
  fs.writeFile(filePath, geojsonString, (err) => {
    if (err) {
      console.error("Error writing GeoJSON file:", err);
      pool.end(); // Close the pool
      return;
    }

    console.log("GeoJSON file saved successfully at", filePath);
    pool.end(); // Close the pool

    // Set the Content-Type header to 'application/json'
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error("Error reading GeoJSON file:", err);
        return;
      }
    });
  });
});
