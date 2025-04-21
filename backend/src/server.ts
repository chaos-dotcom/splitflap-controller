import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios'; // Import axios
import { parseStringPromise } from 'xml2js'; // Import xml2js parser

// Load environment variables from .env file
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001; // Use port from .env or default to 3001

// Define the structure for departure data (matching frontend)
interface Departure {
  id: string;
  scheduledTime: string;
  destination: string;
  platform?: string;
  status: string;
  estimatedTime?: string;
}

// NRE LDBWS Base URL
const NRE_LDBWS_BASE_URL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb11.asmx';

// Enable CORS for all origins (adjust for production later)
app.use(cors());

// Middleware to parse JSON bodies (though not strictly needed for this GET endpoint)
app.use(express.json());

// API endpoint for departures
app.get('/api/departures', async (req: Request, res: Response) => {
    const fromStation = req.query.from as string;
    const toStation = req.query.to as string | undefined; // We'll ignore this for GetDepartureBoard initially
    const numRows = 10; // Number of departures to fetch

    console.log(`Received request for departures: From=${fromStation}, To=${toStation || 'any'}`);

    // --- Validation ---
    if (!fromStation || fromStation.length !== 3) {
        console.error('Invalid or missing "from" station CRS code.');
        return res.status(400).json({ error: "Invalid or missing 'From' station CRS code (must be 3 letters)." });
    }

    const apiToken = process.env.NRE_API_TOKEN;
    if (!apiToken) {
        console.error('NRE_API_TOKEN not found in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: API token missing.' });
    }

    // --- NRE API Call ---
    try {
        const apiUrl = `${NRE_LDBWS_BASE_URL}/GetDepartureBoard?numRows=${numRows}&crs=${fromStation}&accessToken=${apiToken}`;
        // If filtering by destination (toStation) is needed later, you'd use GetDepBoardWithDetails or filter results here.

        console.log(`Calling NRE API: ${apiUrl.replace(apiToken, '********')}`); // Log URL without token

        const apiResponse = await axios.get(apiUrl, {
            headers: {
                // NRE LDBWS uses SOAP but can often be called via GET for simple requests like this.
                // If using SOAP directly, headers would be different (Content-Type: text/xml, SOAPAction)
                'Accept': 'application/json' // Request JSON if available, otherwise default is XML
            },
            // Some versions might require explicit XML parsing setup if JSON isn't returned
        });

        // --- Parse Response (Assuming XML for now, as JSON isn't guaranteed) ---
        // Check content type, default to XML parsing
        const contentType = apiResponse.headers['content-type'];
        let stationBoardResult: any;

        if (contentType && contentType.includes('application/json')) {
             // If NRE ever provides a direct JSON endpoint for this simple GET
             stationBoardResult = apiResponse.data?.GetStationBoardResult;
             console.log("Received JSON response from NRE.");
        } else {
            // Default to parsing XML
            console.log("Received XML response from NRE, parsing...");
            const parsedXml = await parseStringPromise(apiResponse.data, {
                explicitArray: false, // Simplify structure
                ignoreAttrs: true     // Ignore XML attributes
            });
            // Navigate through the typical SOAP structure
            stationBoardResult = parsedXml?.['soap:Envelope']?.['soap:Body']?.GetStationBoardResponse?.GetStationBoardResult;
        }


        if (!stationBoardResult) {
            console.error('Could not find GetStationBoardResult in NRE response.');
            throw new Error('Unexpected response structure from NRE API.');
        }

        // --- Map Data ---
        const trainServices = stationBoardResult.trainServices?.service; // Path might vary slightly based on exact response
        const departures: Departure[] = [];

        if (trainServices) {
            // Ensure trainServices is always an array, even if only one result
            const servicesArray = Array.isArray(trainServices) ? trainServices : [trainServices];

            servicesArray.forEach((service: any) => {
                // Extract data carefully, checking for existence
                const destinationName = service.destination?.location?.locationName || 'Unknown';
                const status = service.etd === 'On time' ? 'On time' : service.etd || service.std || 'Unknown'; // etd can be 'Delayed', 'Cancelled', or a time

                const departure: Departure = {
                    id: service.serviceID, // Unique ID for the service run
                    scheduledTime: service.std || '??:??', // Scheduled time of departure
                    destination: destinationName,
                    platform: service.platform || undefined, // Platform might be missing
                    status: status,
                    estimatedTime: (service.etd && service.etd !== 'On time' && service.etd !== 'Cancelled' && service.etd !== 'Delayed') ? service.etd : undefined, // Only set if it's an actual time
                };
                departures.push(departure);
            });
        } else {
            console.log(`No train services found for ${fromStation} in the response.`);
            // Check for specific messages like "No services found" if the API provides them
            if (stationBoardResult.nrccMessages?.message) {
                 // Handle informational messages if needed, maybe return them?
                 console.log("NRCC Messages:", stationBoardResult.nrccMessages.message);
            }
        }

        console.log(`Successfully fetched and mapped ${departures.length} departures for ${fromStation}.`);
        res.json(departures); // Send the mapped data to the frontend

    } catch (error: any) {
        console.error('Error fetching or processing NRE data:', error);
        // Provide more specific error messages if possible
        let errorMessage = 'Failed to fetch train data.';
        if (axios.isAxiosError(error) && error.response) {
            console.error('NRE API Error Status:', error.response.status);
            console.error('NRE API Error Data:', error.response.data); // Log the raw error data
            errorMessage = `NRE API Error (${error.response.status}). Check station code and API token.`;
            // Check for specific NRE error messages within error.response.data if XML/JSON
             try {
                const parsedErrorXml = await parseStringPromise(error.response.data, { explicitArray: false, ignoreAttrs: true });
                const faultString = parsedErrorXml?.['soap:Envelope']?.['soap:Body']?.['soap:Fault']?.faultstring;
                if (faultString) {
                    errorMessage = `NRE API Error: ${faultString}`;
                }
            } catch (parseErr) { /* Ignore if error response isn't parseable XML */ }

        } else if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({ error: errorMessage });
    }
});

// Basic root route
app.get('/', (req: Request, res: Response) => {
  res.send('Split-Flap Backend Service is running');
});

// Start the server
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
