const { Client } = require("pg");
const fs = require("fs");

// PostgreSQL connection configuration
const pgConfig = {
  user: "ferre", // Username for database access
  host: "localhost", // Hostname where the database server is running
  database: "gis", // Name of the database
  password: "wachtwoord", // Password for database access
  port: 5432, // Port number for PostgreSQL (default is 5432)
};

// Create a new Client instance
const client = new Client(pgConfig);

// Function to insert features into the database
async function insertFeatures(features, client) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("Inserting features into the database: ", features.length);

      // Connect to the PostgreSQL server
      await client.connect();
      console.log("Connected to PostgreSQL server successfully.");

      // Drop the features table if it exists
      await client.query(`DROP TABLE IF EXISTS feature`);
      console.log("Table feature dropped successfully");

      // Create a new table to store features
      await client.query(`
                CREATE TABLE feature (
                    id SERIAL PRIMARY KEY,
                    knoopnr INT,
                    geometry GEOMETRY(Point, 4326)
                )
            `);
      console.log("Table feature created successfully", features.length);

      // Insert features into the new table
      const insertPromises = features.map(async (feature) => {
        const knoopnr = feature.properties.knoopnr;
        const Lambert72Coords = feature.geometry.coordinates;
        console.log(
          "Inserting feature with knoopnr:",
          knoopnr,
          "and coordinates:",
          Lambert72Coords
        );
        console.log(
          "knooppunt:",
          knoopnr,
          "coords:",
          Lambert72Coords[0],
          Lambert72Coords[1]
        );
        // Transform coordinates from Lambert72 to WGS84
        const query = `
                    INSERT INTO feature (knoopnr, geometry)
                    VALUES ($1, ST_Transform(ST_SetSRID(ST_MakePoint($2, $3), 31370), 4326))
                `;
        const params = [knoopnr, Lambert72Coords[0], Lambert72Coords[1]];
        await client.query(query, params);
      });

      await Promise.all(insertPromises);
      resolve(); // Resolve the promise when all inserts are completed
    } catch (error) {
      reject(error); // Reject the promise if any error occurs
    } finally {
      // Close the client connection
      await client.end();
      console.log("Disconnected from PostgreSQL server.");
    }
  });
}

// Function to filter features based on the geometry of a specific item in the "gemeentetest" table
async function filterFeaturesByGeometry(gemeenteName, client) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("Filtering features for", gemeenteName);

      // Connect to the PostgreSQL server
      await client.connect();
      console.log("Connected to PostgreSQL server successfully.");

      // Delete features that do not meet the filter requirement
      const result = await client.query(
        `
              DELETE FROM feature
              WHERE id NOT IN (
                  SELECT f.id
                  FROM feature f
                  INNER JOIN gemeente g ON ST_Contains(g.geom, f.geometry)
                  WHERE g.naam = $1
              )
          `,
        [gemeenteName]
      );

      console.log(
        "Features that do not meet the filter requirement have been dropped."
      );
      resolve(); // Resolve the promise when filtering is successful
    } catch (error) {
      console.error("Error filtering features:", error);
      reject(error); // Reject the promise if there's an error during filtering
    } finally {
      // Close the client connection
      try {
        await client.end();
        console.log("Disconnected from PostgreSQL server.");
      } catch (error) {
        console.error("Error disconnecting from PostgreSQL server:", error);
      }
    }
  });
}

// Function to filter features based on the top 5 knoopnrs
async function filterFeaturesByTop5(top5, client) {
  return new Promise(async (resolve, reject) => {
    console.log(typeof top5);
    console.log("Filtering features for top 5", top5);
    try {
      // Connect to the PostgreSQL server
      await client.connect();
      console.log("Connected to PostgreSQL server successfully.");
      for (const element of top5) {
        // Find the index of the first dot
        const firstDotIndex = element.indexOf(".");
        if (firstDotIndex === -1) {
          console.error("Invalid input string format: no dots found", element);
          continue;
        }
        // Find the index of the second dot
        const secondDotIndex = element.indexOf(".", firstDotIndex + 1);
        if (secondDotIndex === -1) {
          console.error(
            "Invalid input string format: only one dot found",
            top5
          );
          continue;
        }
        // Extract the number between the first and second dot
        const puntNr = element.substring(firstDotIndex + 1, secondDotIndex);
        // Extract the substring starting after the second dot
        const coordinates = element.substring(secondDotIndex + 1);
        // Split the coordinates on the comma
        const [longitude, latitude] = coordinates.split(",");

        // Delete features that meet the filter requirement
        try {
          const result = await client.query(
            `
            DELETE FROM feature
            WHERE ROUND(ST_X(geometry)::numeric, 3) = $1 AND ROUND(ST_Y(geometry)::numeric, 3) = $2 AND knoopnr = $3
            `,
            [parseFloat(longitude), parseFloat(latitude), parseInt(puntNr)]
          );
          console.log(`Deleted ${result.rowCount} rows for coordinates ${longitude},${latitude} and puntNr ${puntNr}.`);
        } catch (queryError) {
          console.error(`Error executing query for coordinates ${longitude},${latitude} and puntNr ${puntNr}:`, queryError);
          continue;
        }
      }

      console.log(
        "Features that do not meet the filter requirement have been dropped."
      );
      resolve(); // Resolve the promise when filtering is successful
    } catch (error) {
      console.error("Error filtering features:", error);
      reject(error); // Reject the promise if there's an error during filtering
    } finally {
      // Close the client connection
      try {
        await client.end();
        console.log("Disconnected from PostgreSQL server.");
      } catch (error) {
        console.error("Error disconnecting from PostgreSQL server:", error);
      }
    }
  });
}

// Function to retrieve all content of the features table
async function getKnpFromDB(client) {
  return new Promise(async (resolve, reject) => {
    try {
      // Connect to the PostgreSQL server
      await client.connect();
      console.log("Connected to PostgreSQL server successfully.");

      // Query to select all content from the features table
      const query = `SELECT f.knoopnr,
                            ST_X(f.geometry) AS lon,
                            ST_Y(f.geometry) AS lat,
                            k.view_count
                      FROM feature f
                      LEFT JOIN knooppunt k ON
                           ROUND(ST_X(f.geometry)::numeric, 3) = ROUND(ST_X(k.at_geometry)::numeric, 3)
                           AND ROUND(ST_Y(f.geometry)::numeric, 3) = ROUND(ST_Y(k.at_geometry)::numeric, 3);
                    `;

      // Execute the query
      const result = await client.query(query);

      // Log the retrieved content
      console.log("Retrieved content of the features table:", result.rows);
      resolve(result.rows);
    } catch (error) {
      console.error("Error retrieving features:", error);
      reject(error);
    } finally {
      // Close the client connection
      try {
        await client.end();
        console.log("Disconnected from PostgreSQL server.");
      } catch (error) {
        console.error("Error disconnecting from PostgreSQL server:", error);
      }
    }
  });
}

async function insertAllKnooppunten(naam, top5) {
  return new Promise(async (resolve, reject) => {
    // Split the top5 string into an array of integers
    console.log("Top 5 knooppunten:", top5);
    console.log("Type van top5:", typeof top5);
    const top5Array = top5.split(/,(?=\D)/);
    console.log("Top 5 knooppunten:", top5Array);
    console.log(typeof top5Array);

    // Read the features from knoop.json file
    fs.readFile("./data/knoop.json", "utf8", async (err, data) => {
      if (err) {
        console.error("Error reading knoop.json:", err);
        reject(err); // Reject the promise if there's an error reading the file
        return;
      }
      console.log("Data read from knoop.json:", data.length);
      let features;
      try {
        const jsonData = JSON.parse(data);
        features = jsonData.features;
      } catch (error) {
        console.error("Error parsing JSON data:", error);
        reject(error); // Reject the promise if there's an error parsing JSON
        return;
      }
      // Check if the parsed data is an array
      if (!Array.isArray(features)) {
        console.error(
          "Parsed data does not contain an array of features:",
          features
        );
        reject(new Error("Parsed data is not an array")); // Reject the promise if parsed data is not an array
        return;
      }
      console.log("Features read from knoop.json:", features.length);
      try {
        // Insert features into the database
        await insertFeatures(features, new Client(pgConfig));

        // Filter out the features that already appear in the top 5
        console.log("Type van NAAM: ", typeof naam);
        await filterFeaturesByGeometry(naam, new Client(pgConfig));

        // Filter out the features based on the top 5
        //console.log("Type van Top5: ", typeof top5Array);
        await filterFeaturesByTop5(top5Array, new Client(pgConfig));

        // Fetch and save features within the bounding box
        const knpFromDB = await getKnpFromDB(new Client(pgConfig));
        console.log("TYPE OF response", typeof knpFromDB);
        console.log("response", knpFromDB);
        console.log(Array.isArray(knpFromDB));
        console.log("LENGTE VAN ANTWOORD: ", knpFromDB.length);
        // Resolve the promise with knpFromDB
        resolve(knpFromDB);
      } catch (error) {
        console.error("An error occurred:", error);
        reject(error); // Reject the promise if there's an error during any operation
      }
    });
  });
}
// Export the function
module.exports = insertAllKnooppunten;
