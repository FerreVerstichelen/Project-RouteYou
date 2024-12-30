const fs = require("fs");
const axios = require("axios");
const path = require("path");

// Download the most recent version of the "fietsknooppuntennetwerk" from the API
async function fetchRoutes() {
    const url =
        "https://geodata.toerismevlaanderen.be/geoserver/routes/wfs?request=GetFeature&typeName=routes:traject_fiets&outputFormat=application/json&srsName=EPSG:4326";
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            const json = response.data;
            const dataFolderPath = path.join(__dirname, "public");
            const filePath = path.join(dataFolderPath, "routes.json");
            if (!fs.existsSync(dataFolderPath)) {
                fs.mkdirSync(dataFolderPath);
            }
            fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
            console.log("JSON data has been written to routes.json in the public folder.");
        } else {
            console.error("Failed to fetch routes:", response.statusText);
        }
    } catch (error) {
        console.error("Error fetching routes:", error.message);
    }
}
module.exports = fetchRoutes;