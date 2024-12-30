// Required modules
const fs = require("fs");
const http = require("http");
const path = require("path");

// Specify the number of route dumps to download (will be met approximately: usually +3 extra)
const num_route_dumps = 20000;
// Specify the minimum date for route creation (format: YYYY-MM-DD)
const minDate = "2020-01-01";

// Set the directory to save the files
const output_directory = "./data/input";
const publicDirectory = "./public";
// Path to the file storing the last route ID processed
const lastRouteIdFilePath = path.join(output_directory, 'last_route_id.txt');
const siteInfoFilePath = path.join(publicDirectory, 'site_info.txt');
// Starting route ID and file counter
let min_route_id = 0;
let file_counter = 1;

// Counter to track how many files have been processed
let filesProcessed = 0;

// If the last_route_id.txt file exists, retrieve the last processed route ID and file counter
if (fs.existsSync(lastRouteIdFilePath)) {
    console.log('last_route_id.txt exists');
    try {
        const [lastIdStr, lastCounterStr] = fs.readFileSync(lastRouteIdFilePath, 'utf8').split(',');
        lastRouteId = parseInt(lastIdStr.trim());
        file_counter = parseInt(lastCounterStr.trim());
        console.log('Last Route ID:', lastRouteId);
        console.log('Last File Counter:', file_counter);
        min_route_id = lastRouteId + 1;
    } catch (error) {
        console.error('Error reading last_route_id.txt:', error.message);
    }
}

// Class to interact with the RouteYou API
class RouteYou_Json_Client {
    constructor(service, version, token = null) {
        // URL format for API requests
        this.url = "http://api.routeyou.com/%version%/json/%service%/k-%key%/worker";
        // API key for authorization
        this.key = RouteYou_Json_Client.key;
        this.token = token;
        // Service and version for API requests
        this._service = service;
        this._version = version;
    }

    // Method to execute API calls
    async _executeCall(method, params, retry = false) {
        // Construct the URL for the API request
        let url = this.url
            .replace("%service%", this._service)
            .replace("%version%", this._version)
            .replace("%key%", this.key);

        // If a session token is provided, replace the key with the session token
        if (this.token !== null) {
            url = url
                .replace("/k-" + this.key, "/%session%")
                .replace("%session%", this.token);
        }

        // Generate a unique request ID
        const id = Math.floor(Math.random() * 1000) + 1;
        // Construct the request data
        const data = {
            jsonrpc: "2.0",
            id: id,
            method: method,
            params: params,
        };

        // Configure request options
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
        };

        // Return a promise to handle the asynchronous request
        return new Promise((resolve, reject) => {
            // Create the HTTP request
            const req = http.request(url, options, (res) => {
                let responseBody = "";

                // Concatenate response data chunks
                res.on("data", (chunk) => {
                    responseBody += chunk;
                });

                // Resolve promise when response is complete
                res.on("end", () => {
                    // Check response status code
                    if (res.statusCode === 200) {
                        // Parse JSON response and resolve promise
                        resolve(JSON.parse(responseBody));
                    } else {
                        // Reject promise with error message
                        reject(new Error(`HTTP request failed with status code ${res.statusCode}`));
                    }
                });
            });

            // Handle request error
            req.on("error", (err) => {
                console.error(`HTTP request error: ${err}`);
                reject(err);
            });

            // Send request data
            req.write(JSON.stringify(data));
            req.end();
        });
    }

    // Method to perform advanced search for routes
    async searchAdvanced(conditions, orderBy, limit = 10) {
        return await this._executeCall("searchAdvanced", [
            conditions,
            orderBy,
            limit,
        ]);
    }

    // Method to retrieve full details of specified route IDs
    async getFull(routeIds, _, options) {
        return await this._executeCall("getFull", [routeIds, _, options]);
    }
}

// Set the API key
RouteYou_Json_Client.key = "[API KEY]";

// Initialize the RouteYou API client
const routeService = new RouteYou_Json_Client("Route", "2.0");

// Main loop to fetch and process route dumps
(async () => {
    while (filesProcessed < num_route_dumps) {
        // Conditions for route search
        // indien je meer routes wil ophalen, kan je de 
        // createdDate.min aanpassen naar een vroegere datum
        const conditions = {
            "characteristic.id": 43,
            "id.min": min_route_id,
            "createdDate.min": minDate,
            "type.id": [1, 5, 6, 7, 47] // Add the condition for type.id so that only bike routes are fetched
        };
        try {
            // Perform advanced search for routes
            const result = await routeService.searchAdvanced(conditions, "id ASC", 10);
            const routeIds = [];

            // Extract route IDs from search results
            for (const r of result.result.routes) {
                if (!r) continue;
                routeIds.push(r.id);
                min_route_id = r.id + 1;
            }

            // If route IDs are found, fetch full details
            if (routeIds.length) {
                const params = [routeIds];
                const routes = await routeService.getFull(...params, null, {
                    pois: false,
                    instructions: true,
                });

                // Process each route's data
                for (const [route_id, route_data] of Object.entries(routes.result)) {
                    // Filter routes by specific criteria
                    // Only routes in Belgium for this project
                    if (!route_data.breadcrumbRegions.some((region) => region.flag === "be")) continue;
                    // Only routes with views and downloads
                    if (route_data.viewCount === 0 || route_data.downloadCount === 0) continue;

                    // Save route data to JSON file
                    console.log(file_counter, route_id);
                    const file_path = `${output_directory}/route_dump_${file_counter}.json`;
                    fs.writeFileSync(file_path, JSON.stringify(route_data, null, 4));
                    file_counter++;
                    filesProcessed++;

                    // Update the last processed route ID in a text file
                    const routeIdFilePath = `${output_directory}/last_route_id.txt`;
                    fs.writeFileSync(routeIdFilePath, `${route_id}, ${file_counter}`);

                    // Update the last processed route ID in a text file
                    
                    fs.writeFileSync(siteInfoFilePath, `${file_counter}, ${minDate}`);
                }
            }
        } catch (error) {
            console.error('Error in main loop:', error.message);
            break; // Exit loop on error
        }
    }
    // Output completion message when loop exits
    console.log('Script completed.');
    return;
})();
