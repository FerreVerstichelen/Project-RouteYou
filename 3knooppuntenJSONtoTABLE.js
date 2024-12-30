const fs = require("fs");
const { Client } = require("pg");
const path = require("path"); // Import the path module for resolving paths

// KIES HIER HOEVEEL ROUTES JE WIL VERWERKEN
const numberOfJsons = 15362;
// PostgreSQL connection configuration
const pgConfig = {
  user: "ferre",
  host: "localhost",
  database: "gis",
  password: "wachtwoord",
  port: 5432, // default port for PostgreSQL
};

// Define the base directory for JSON files
const baseDirectory = path.join(__dirname, "data", "input");
// Define a global Map to store all processed gemeente names and their view counts
const gemeentesGlobal = new Map();
// Create a new PostgreSQL client
const client = new Client(pgConfig);

// Connect to the PostgreSQL database
client
  .connect()
  .then(() => {
    console.log("Connected to PostgreSQL");
    // Create table after connection is established;
    createTable();
  })
  .catch((err) => console.error("Error connecting to PostgreSQL", err));

// Function to create the table in PostgreSQL
async function createTable() {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS knooppunt (
          id SERIAL PRIMARY KEY,
          at_geometry GEOMETRY(Point, 4326),
          straat VARCHAR(255),
          puntnr INT,
          view_count DOUBLE PRECISION DEFAULT 0,
          download_count INT,
          gem VARCHAR(255) DEFAULT NULL,
          unique_code VARCHAR(255) UNIQUE,
          route_count INT DEFAULT 0,
          total_views INT DEFAULT 0
      )
    `);
    console.log("Table created or already exists");
    processJsonFiles(); // After table creation, start processing JSON files
  } catch (error) {
    console.error("Error creating table:", error);
  }
}

// Function to process JSON files and insert data into knooppunt table
async function processJsonFiles() {
  // Process only the first ... JSON files
  for (let i = 1; i <= numberOfJsons; i++) {
    const jsonFileName = `route_dump_${i}.json`;
    const jsonFilePath = path.join(baseDirectory, jsonFileName);

    // Check if the file exists
    if (fs.existsSync(jsonFilePath)) {
      // Read the JSON file
      const jsonData = fs.readFileSync(jsonFilePath, "utf8");

      try {
        // Parse JSON data
        const data = JSON.parse(jsonData);

        // Extract relevant information
        const viewCount = data.viewCount || "N/A";
        const downloadCount = data.downloadCount || "N/A";
        const instructions = data.instructions || [];

        // Assuming your JSON data is in a variable called `data`
        const creationDate = new Date(data.createdDate); // Parse the creation date
        const currentDate = new Date(); // Get the current date

        // Calculate the age of the route in days
        const routeAgeInDays = Math.floor(
          (currentDate - creationDate) / (1000 * 60 * 60 * 24)
        );
        
        // Calculate the relative view count
        const viewCountPerDay = viewCount / routeAgeInDays;
        console.log(`Route age in days: ${routeAgeInDays} AND views per day: ${viewCountPerDay}`);
        // Initialize a set to store processed instructions for this JSON file
        const processedUniqueCodes = new Set();
        // Initialize an array to store processed gemeente names for this JSON file
        const processedGemeenteNames = new Set();

        // Iterate through instructions
        for (const instruction of instructions) {
          // Check if "at" is not null and is a number
          if (instruction.at !== null && !isNaN(instruction.at)) {
            const atGeometry = instruction.atGeometry;
            const straat = instruction.using; // Use "using" as "straat"
            const puntnr = instruction.at; // Use "at" as "puntnr"
            const gemeenteName = await getGemeenteName(atGeometry);

            // Skip insertion if gemeenteName is null
            if (gemeenteName === null) {
              console.log(
               `Instruction skipped for file number ${i}: Does not fall within any Gemeente.`
              );
              continue; // Skip insertion
            }

            // Round the coordinates to 2 decimals
            const roundedCoordinates = roundCoordinates(atGeometry);
            const uniqueCode = `${gemeenteName}.${puntnr}.${roundedCoordinates}`;
            
            // Check if the unique code is already processed in this JSON file
            if (processedUniqueCodes.has(uniqueCode)) {
              console.log(
                `Duplicate instruction found in JSON file ${i}: ${uniqueCode}`
              );
              continue; // Skip this instruction
            }

            // Add gemeenteName to the processed gemeente names array if it's not already there
            if (!processedGemeenteNames.has(gemeenteName)) {
              processedGemeenteNames.add(gemeenteName);
              // Add the view count and increment the route count for gemeenteName in gemeentesGlobal
              if (gemeentesGlobal.has(gemeenteName)) {
                const { VC: currentViewCount, RC: currentRouteCount, VCD: currentViewCountPerDay } = gemeentesGlobal.get(gemeenteName);
                gemeentesGlobal.set(gemeenteName, {
                  VC: currentViewCount + viewCount,
                  RC: currentRouteCount + 1, // Increment route count by 1
                  VCD: currentViewCountPerDay + viewCountPerDay, // Increment view count per day
                });
              } else {
                // Initialize VC to the current viewCount value and set RC to 1
                gemeentesGlobal.set(gemeenteName, {
                  VC: viewCount,
                  RC: 1,
                  VCD: viewCountPerDay,
                });
              }
            }

            // Check if the unique code exists in the database
            const existingInstruction = await checkExistingInstruction(
              uniqueCode
            );

            if (existingInstruction) {
              console.log(
                `Duplicate instruction found in database: ${uniqueCode}`
              );
              // Update existing instruction's view and download counts
              await updateViewDownloadCounts(
                uniqueCode,
                viewCount,
                downloadCount,
                viewCountPerDay
              );
            } else {
              // Insert new instruction into database
              await insertInstruction(
                atGeometry,
                straat,
                puntnr,
                viewCount,
                downloadCount,
                gemeenteName,
                uniqueCode,
                viewCountPerDay
              );
              console.log(`Instruction added to table for file number ${i}`);
            }

            // Add the unique code to the processed unique codes set
            processedUniqueCodes.add(uniqueCode);
          } else {
            console.log(
              `Instruction skipped for file number ${i}: 'at' is null or not a number.`
            );
          }
        }

        console.log(
          `File number ${i} has been processed and inserted into the table`
        );
        console.log("Processed gemeente names:", processedGemeenteNames);
      } catch (error) {
        console.error(`Error parsing JSON file ${jsonFilePath}:`, error);
      }
    } else {
      // No file found, exit the loop
      break;
    }
  }
  try {
    // After processing JSON files, update view counts in the database
    await updateViewCountsGemeentes();
  } catch (error) {
    console.error("Error updating view counts in database:", error);
  }

  // Close the database connection after processing files
  client
    .end()
    .then(() => {
      console.log("PostgreSQL connection closed");
      // Print gemeentesGlobal
      printGemeentesGlobal();
    })
    .catch((err) => console.error("Error closing PostgreSQL connection:", err));
}

// Function to parse and round coordinates from the atGeometry property
function roundCoordinates(atGeometry) {
  // Extract coordinates from the atGeometry string
  //console.log("Original atGeometry:", atGeometry);
  const coordinates = atGeometry.substring(6, atGeometry.length - 1).split(' ');
  if (coordinates.length === 2) {
    // Parse and round coordinates to 3 decimals behind the comma
    const [longitude, latitude] = coordinates.map(coord => parseFloat(coord).toFixed(3));
    //console.log("Rounded coordinates:", `${longitude},${latitude}`);
    return `${longitude},${latitude}`;
  } else {
    console.error("Invalid atGeometry format:", atGeometry);
    return null;
  }
}


// Function to update view counts in the database for gemeentesGlobal entries
async function updateViewCountsGemeentes() {
  try {
    // Iterate over gemeentesGlobal
    for (const [gemeenteName, counts] of gemeentesGlobal.entries()) {
      const { VC: viewCount, RC: routeCount, VCD: viewCountPerDay } = counts;
      // Update the viewCount and routeCount columns for the current gemeente in the gemeente table
      const updateQuery = `
          UPDATE gemeente
          SET viewCount = viewCount + $1,
            route_count = route_count + $2,
            total_views = total_views + $3
          WHERE naam = $4
        `;
      const updateValues = [viewCountPerDay, routeCount, viewCount, gemeenteName];
      await client.query(updateQuery, updateValues);
      console.log("View and route counts updated for gemeente:", gemeenteName);
    }
  } catch (error) {
    console.error("Error updating view and route counts for gemeente:", error);
    throw error;
  }
}

// Function to print gemeentesGlobal
function printGemeentesGlobal() {
  console.log("Gemeentes Global:");
  for (const [gemeente, counts] of gemeentesGlobal.entries()) {
    const { VC: viewCount, RC: routeCount, VCD: viewCountPerDay } = counts;
    console.log(`${gemeente}: VC:${viewCount}, RC:${routeCount}, VCD:${viewCountPerDay}`);
  }
}

// Function to get the name of the municipality (gemeente) based on the geometry coordinates
async function getGemeenteName(geometry) {
  try {
    // Execute the SQL query to find the gemeente name based on the geometry
    const result = await client.query(
      `
      SELECT naam 
      FROM gemeente 
      WHERE ST_Contains(ST_Transform(geom, 4326), ST_SetSRID(ST_GeomFromText($1), 4326))
      `,
      [geometry]
    );

    if (result.rows.length > 0) {
      return result.rows[0].naam;
    } else {
      return null; // Return null if instruction does not fall within any Gemeente
    }
  } catch (error) {
    console.error("Error querying gemeente:", error);
    throw error;
  }
}

// Function to check if an instruction already exists in the database
async function checkExistingInstruction(uniqueCode) {
  try {
    const result = await client.query(
      `
      SELECT COUNT(*) AS count
      FROM knooppunt
      WHERE unique_code = $1
    `,
      [uniqueCode]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error("Error checking existing instruction:", error);
    throw error;
  }
}

// Function to insert a new instruction into the database
async function insertInstruction(
  atGeometry,
  straat,
  puntnr,
  viewCount,
  downloadCount,
  gemeenteName,
  uniqueCode,
  viewCountPerDay
) {
  try {
    const insertQuery = `
        INSERT INTO knooppunt (at_geometry, straat, puntnr, view_count, download_count, gem, unique_code, route_count, total_views) 
        VALUES (ST_SetSRID(ST_GeomFromText($1), 4326), $2, $3, $4, $5, $6, $7, 1, $8)
      `;
    const insertValues = [
      atGeometry,
      straat,
      puntnr,
      viewCountPerDay,
      downloadCount,
      gemeenteName,
      uniqueCode,
      viewCount
    ];
    await client.query(insertQuery, insertValues);
  } catch (error) {
    console.error("Error inserting instruction:", error);
    throw error;
  }
}

// Function to update view and download counts for an existing instruction in the database
async function updateViewDownloadCounts(uniqueCode, viewCount, downloadCount, viewCountPerDay) {
  try {
    const updateQuery = `
        UPDATE knooppunt
        SET view_count = view_count + $1,
            download_count = download_count + $2,
            route_count = route_count + 1,
            total_views = total_views + $3
        WHERE unique_code = $4
      `;
    const updateValues = [viewCountPerDay, downloadCount, viewCount, uniqueCode];
    await client.query(updateQuery, updateValues);
  } catch (error) {
    console.error("Error updating view and download counts:", error);
    throw error;
  }
}
