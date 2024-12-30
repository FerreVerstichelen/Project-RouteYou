// Import required modules
const fs = require('fs'); // File system module for handling file operations
const path = require('path'); // Module for handling file paths
const axios = require('axios'); // Module for making HTTP requests

// Define the path for the reference file and its URL, as well as the columns needed
const dataDir = path.join(__dirname, 'data', 'input'); // Directory where data will be stored
const municipalities_file = path.join(dataDir, 'municipalities_wgs84.json'); // Path to the local municipalities file
const municipalities_url = 'https://geo.api.vlaanderen.be/VRBG/wfs'; // URL for the municipalities data API

// If the file "municipalities.json" doesn't exist at the expected location, 
// it will be downloaded using a GET request.
if (!fs.existsSync(municipalities_file)) {
    // Check if the data directory exists, if not, create it
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const crs = 'EPSG:4326'; // Coordinate Reference System (CRS)
    const payload = {
        request: 'GetFeature',
        typeNames: 'VRBG:Refgem', // Type of feature to retrieve
        srsName: crs, // Set the CRS for the request
        outputFormat: 'json' // Output format of the response
    };
    const headers = {
        accept: '*/*', // Specify that any content type is acceptable
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit' // Provide a user-agent header for identification
    };

    // Make a GET request to download the municipalities data
    axios.get(municipalities_url, { params: payload, headers: headers })
        .then(response => {
            // After sending the request, save the response as JSON
            fs.writeFileSync(municipalities_file, JSON.stringify(response.data));
            console.log('Gemeentereferentiebestand is gedownload.'); // Log success message
        })
        .catch(error => {
            console.error('Error downloading municipalities file:', error); // Log error if request fails
        });
}
