const express = require("express"); // Import express module
const app = express(); // Create an instance of express
const path = require("path"); // Import the path module
const getGemeenteTop5 = require("./getGemeenteTop5"); // Import getGemeenteTop5 function
const fetchAllKnooppunten = require("./allKnp/fetchAllKnooppunten"); // Import fetchAllKnooppunten function
const insertAllKnooppunten = require("./allKnp/insertAllKnooppunten"); // Import insertAllKnooppunten function
const getFromRadius = require("./getFromRadius"); // Import getFromRadius function
const fetchNetwerk = require("./fetchNetwerk"); // Import fetchNetwerk function

// Define the directory where your public files are located
const publicDirectoryPath = path.join(__dirname, "public");

// Define the root route
// index.html is shown by default
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html")); // Send the HTML file
});

// Serve static files from the public directory
app.use(express.static(publicDirectoryPath));

// Route to handle the HTTP request for fetching the knooppunt network
// This is a request to download the network data from the knooppunt API and save it to the public folder
app.get("/fetchNetwerk", (req, res) => {
  fetchNetwerk()
    .then(() => {
      res.send("Fetching knooppunt network data...");
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send('Error fetching knooppunt network data');
    });
});

// Route to handle the HTTP request for fetching top 5 knooppunten based on a "gemeente" name
app.get("/getGemeenteTop5", (req, res) => {
  const gemeenteName = req.query.naam; // Retrieve the name of the clicked polygon from the query parameters
  console.log(gemeenteName);
  getGemeenteTop5(gemeenteName)
    .then((data) => {
      res.json(data); // Send the fetched data back to the client
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal server error" });
    });
});

// Route to handle the HTTP request for fetching items excluding top 5 based on a gemeente name, top5 and bbox
app.get("/getGemNotTop5", async (req, res) => {
  const { naam, top5, bbox } = req.query;

  // Wrap the entire content of the function in a Promise
  // this is necessary because there was an issue where the table was 
  // being returned before all data was downloaded, added and filtered
  return new Promise(async (resolve, reject) => {
    try {
      // Call the functions from imported script files
      console.log("Executing fetchAllKnooppunten script");
      try {
        // This will download the "knooppunten" within the bbox from the API and save them to a JSON file
        await fetchAllKnooppunten(bbox);
        console.log("fetchAllKnooppunten script executed successfully");
      } catch (error) {
        console.error("Error executing fetchAllKnooppunten script:", error);
        reject(error); // Reject the promise if an error occurs
        return;
      }

      console.log("Executing insertAllKnooppunten script");
      try {
        // This will insert the "knooppunten" from the JSON file to the database 
        // and filter out the ones that are not within the "gemeente" or are in the top 5
        const output = await insertAllKnooppunten(naam, top5);
        console.log("insertAllKnooppunten script executed successfully");
        console.log("APP.JS Output TYPE:", typeof output);
        console.log("APP.JS Output:", output);
        res.send(output); // Send the response with the output from insertAllKnooppunten
      } catch (error) {
        console.error("Error executing insertAllKnooppunten script:", error);
        reject(error); // Reject the promise if an error occurs
        return;
      }
      resolve(); // Resolve the promise if all function calls are successful
    } catch (error) {
      console.error("Error executing scripts:", error);
      res.status(500).json({ error: "Internal server error" });
      reject(error); // Reject the promise if an error occurs
    }
  });
});

// Route to handle the HTTP request for fetching knooppunten within a specified radius
app.get("/getFromRadius", (req, res) => {
  const lat = req.query.lat; // Retrieve latitude from query parameters
  const lon = req.query.lon; // Retrieve longitude from query parameters
  const radius = req.query.radius; // Retrieve radius from query parameters
  console.log("APP.JS");
  console.log(lat, lon);
  console.log(radius);
  getFromRadius(lat, lon, radius)
    .then((data) => {
      res.json(data); // Send the fetched data back to the client
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal server error" });
    });
});

// Start the server and listen on port 3000
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// Route to handle 404 errors
app.get("/404", (req, res) => {
  res.status(404).sendFile(path.join(__dirname, "views", "404.html")); // Send the 404 error page
});

// Middleware to handle all other routes and redirect to 404 page
app.use((req, res, next) => {
  res.status(404).redirect("/404"); // Redirect to the 404 page
});
