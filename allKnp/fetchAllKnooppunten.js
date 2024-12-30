const fs = require("fs");
const axios = require("axios");
const transformation = require("transform-coordinates");
// Define the WFS URL
const wfsUrl = "https://geodata.toerismevlaanderen.be/geoserver/routes/wfs";

// Define the function to fetch and save features within the bounding box
const fetchAndSaveFeaturesWithinBoundingBox = (bboxCoordinates) => {
    // Wrap the entire content of the function in a Promise
  return new Promise(async (resolve, reject) => {
      const typeName = "routes:knoop_fiets";
      const fileName = "./data/knoop.json"; //bestand voor de knooppunten binnen bbox
      // Delete the file if it already exists
      try {
        fs.unlinkSync(fileName);
        console.log(`File ${fileName} has been deleted.`);
      } catch (error) {
        console.error(`Error deleting file ${fileName}:`, error.message);
      }
      // Try to fetch and save the features within the bounding box
      try {
          const transform = transformation("EPSG:4326", "EPSG:31370");
          console.log("bbox coordinates (fetchscript):", bboxCoordinates);
          // Transforming the bounding box coordinates
          // Parse bboxCoordinates if it's a string
          let [minLon, minLat, maxLon, maxLat] =
              typeof bboxCoordinates === "string"
                  ? bboxCoordinates.split(",").map(parseFloat)
                  : bboxCoordinates;
          console.log(
              "minLon, minLat, maxLon, maxLat:",
              minLon,
              minLat,
              maxLon,
              maxLat
          );
          // Transform the coordinates
          const transformedMin = transform.forward({ x: minLon, y: minLat });
          const transformedMax = transform.forward({ x: maxLon, y: maxLat });

          console.log("Transformed coordinates:", transformedMin, transformedMax);

          // Check the transformed coordinates
          if (
              typeof transformedMin.x !== "number" ||
              typeof transformedMin.y !== "number" ||
              typeof transformedMax.x !== "number" ||
              typeof transformedMax.y !== "number"
          ) {
              console.error(
                  "Invalid transformed coordinates:",
                  transformedMin,
                  transformedMax
              );
              reject("Invalid transformed coordinates");
              return;
          }
          // Create a new bounding box array with the transformed coordinates
          const transformedBbox = [
              transformedMin.x,
              transformedMin.y,
              transformedMax.x,
              transformedMax.y,
          ];
          console.log("Transformed bbox:", transformedBbox);
          // Define the URL parameters
          const params = new URLSearchParams({
              service: "WFS",
              version: "2.0.0",
              request: "GetFeature",
              typeName,
              srsName: "EPSG:31370", // Use Lambert72 CRS
              outputFormat: "application/json",
              bbox: transformedBbox.join(","),
          });

          console.log(
              `Fetching features for ${
                  typeName
              } within bounding box: ${transformedBbox.join(",")}`
          );
          console.log(`Request URL: ${wfsUrl}?${params}`); // Log request URL
          // Fetch the features within the bounding box
          const response = await axios.get(wfsUrl + "?" + params);
          // Check if the response status is 200
          if (response.status === 200) {
              if (response.data.features.length > 0) {
                  const featuresData = {
                      type: "FeatureCollection",
                      features: response.data.features,
                      totalFeatures: response.data.totalFeatures,
                      numberMatched: response.data.numberMatched,
                      numberReturned: response.data.numberReturned,
                      timeStamp: new Date().toISOString(),
                      crs: {
                          type: "name",
                          properties: {
                              name: "urn:ogc:def:crs:EPSG::31370", // Set CRS to Lambert72
                          },
                      },
                  };
                  // Save the features within the bounding box to a JSON file
                  fs.writeFileSync(fileName, JSON.stringify(featuresData, null, 2)); // Pretty print JSON
                  console.log(
                      `Features within bounding box saved to ${fileName}`
                  );
                  resolve();
              } else {
                  console.log(`No features found within the bounding box.`);
                  resolve();
              }
          } else {
              console.log(
                  `Failed to fetch features for ${typeName}. Status code: ${response.status}`
              );
              reject(`Failed to fetch features. Status code: ${response.status}`);
          }
      } catch (error) {
          console.error(
              `Error fetching features for ${typeName}:`,
              error.message
          );
          reject(error.message);
      }
  });
};
// Define the function to fetch all Knooppunten
function fetchAllKnooppunten(bbox) {
    // Wrap the entire content of the function in a Promise
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch and save features within the bounding box
      await fetchAndSaveFeaturesWithinBoundingBox(bbox);
      resolve(); // Resolve the promise if the operation succeeds
    } catch (error) {
      console.error("Error fetching features:", error);
      reject(error); // Reject the promise if an error occurs
    }
  });
}
// Export the function
module.exports = fetchAllKnooppunten;
