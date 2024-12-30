// Import necessary modules
const fs = require("fs"); // Module for file system operations
const { Client } = require("pg"); // PostgreSQL client module

// PostgreSQL connection configuration
const pgConfig = {
  user: "ferre", // Username for database access
  host: "localhost", // Hostname where the database server is running
  database: "gis", // Name of the database
  password: "wachtwoord", // Password for database access
  port: 5432, // Port number for PostgreSQL (default is 5432)
};

// Create a new PostgreSQL client instance
const client = new Client(pgConfig);

// Asynchronous function to perform main operations
async function main() {
  try {
    // Connect to the PostgreSQL database
    await client.connect();
    console.log("Connected to PostgreSQL");

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
    console.log("Table created or already exists");

    // Read the GeoJSON file
    const geojsonData = await fs.promises.readFile(
      "./data/input/municipalities_wgs84.json",
      "utf8"
    );
    const geojson = JSON.parse(geojsonData);

    // Check if the GeoJSON is valid
    if (geojson.type !== "FeatureCollection") {
      throw new Error("Invalid GeoJSON format. Expecting a FeatureCollection.");
    }

    // Iterate through each feature and insert into PostgreSQL
    for (const feature of geojson.features) {
      if (feature.type !== "Feature") {
        console.log(`Skipping feature with unknown type: ${feature.type}`);
        continue; // Skip to the next feature
      }

      const id = feature.id; // Extract ID of the feature
      const naam = feature.properties && feature.properties.NAAM; // Extract name of the feature
      const geometry = JSON.stringify(feature.geometry); // Convert geometry to string
      const bboxCoordinates = feature.bbox; // Extract bounding box coordinates

      // Construct min and max points representing the bounding box
      const bboxMin = `ST_SetSRID(ST_MakePoint(${bboxCoordinates[0]}, ${bboxCoordinates[1]}), 4326)`;
      const bboxMax = `ST_SetSRID(ST_MakePoint(${bboxCoordinates[2]}, ${bboxCoordinates[3]}), 4326)`;

      // Insert the feature into the database
      await client.query(
        `INSERT INTO gemeente (refgem, naam, geom, bbox_min, bbox_max) VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), ${bboxMin}, ${bboxMax})`,
        [id, naam, geometry]
      );
      console.log(`Feature with ID ${id} inserted into PostgreSQL`);
    }

    console.log("All features inserted successfully");
  } catch (error) {
    // Catch and log any errors that occur during execution
    console.error("Error:", error);
  } finally {
    // Close the connection to the PostgreSQL database
    await client.end();
    console.log("PostgreSQL connection closed");
  }
}

// Call the main function to start the script execution
main();
