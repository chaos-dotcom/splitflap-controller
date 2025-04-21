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

// NRE LDBWS Endpoint (for POST requests) - Use the latest version endpoint
const NRE_LDBWS_ENDPOINT = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb12.asmx';
// Namespaces needed for the SOAP request
const SOAP_ENV_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const TOKEN_TYPES_NS = 'http://thalesgroup.com/RTTI/2013-11-28/Token/types';
const LDB_NS = 'http://thalesgroup.com/RTTI/2021-11-01/ldb/'; // Use the latest LDB namespace version

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

    // --- Construct SOAP Request Body ---
    const soapRequestBody = `
        <soapenv:Envelope xmlns:soapenv="${SOAP_ENV_NS}" xmlns:typ="${TOKEN_TYPES_NS}" xmlns:ldb="${LDB_NS}">
           <soapenv:Header>
              <typ:AccessToken>
                 <typ:TokenValue>${apiToken}</typ:TokenValue>
              </typ:AccessToken>
           </soapenv:Header>
           <soapenv:Body>
              <ldb:GetDepartureBoardRequest>
                 <ldb:numRows>${numRows}</ldb:numRows>
                 <ldb:crs>${fromStation}</ldb:crs>
                 <!-- Optional: Add filterCrs (toStation) and other parameters here if needed -->
                 ${toStation ? `<ldb:filterCrs>${toStation}</ldb:filterCrs><ldb:filterType>to</ldb:filterType>` : ''}
              </ldb:GetDepartureBoardRequest>
           </soapenv:Body>
        </soapenv:Envelope>
    `.trim(); // Use trim() to remove leading/trailing whitespace

    // --- NRE API Call ---
    try {
        // Log the request body (masking token) for debugging
        const maskedRequestBody = soapRequestBody.replace(apiToken, '********-****-****-****-************');
        console.log(`Calling NRE LDBWS via POST for station: ${fromStation}\nRequest Body:\n${maskedRequestBody}`);

        const requestHeaders = {
            'Content-Type': 'text/xml;charset=UTF-8',
            // Use the LDB namespace declared for the body + Operation Name
            'SOAPAction': `${LDB_NS}GetDepartureBoard`,
            'Accept-Encoding': 'identity', // Explicitly state we don't want compressed responses
        };
        console.log('Request Headers:', requestHeaders); // Log headers

        const apiResponse = await axios.post(NRE_LDBWS_ENDPOINT, soapRequestBody, {
            headers: requestHeaders,
            // Axios might automatically parse XML if content-type indicates it,
            // but we'll parse manually for robustness.
            responseType: 'text' // Get the raw XML string
        });

        // --- Parse Response (Assuming XML for now, as JSON isn't guaranteed) ---
        // Check content type, default to XML parsing
        console.log("Received XML response from NRE, parsing...");
        const parsedXml = await parseStringPromise(apiResponse.data, {
            explicitArray: false, // Simplify structure
            tagNameProcessors: [(name) => name.replace('ldb:', '')] // Remove namespace prefix from tags
        });
        // Navigate through the SOAP structure
        const stationBoardResult = parsedXml?.['soap:Envelope']?.['soap:Body']?.GetDepartureBoardResponse?.GetStationBoardResult;


        if (!stationBoardResult) {
            console.error('Could not find GetStationBoardResult in NRE response structure:', JSON.stringify(parsedXml, null, 2));
            // Check for SOAP Fault
            const soapFault = parsedXml?.['soap:Envelope']?.['soap:Body']?.['soap:Fault'];
            if (soapFault) {
                 const faultString = soapFault.faultstring || 'Unknown SOAP Fault';
                 console.error('Received SOAP Fault:', faultString);
                 throw new Error(`NRE API Fault: ${faultString}`);
            }
            throw new Error('Unexpected response structure from NRE API.');
        }

        // --- Map Data ---
        // Adjust path based on tagNameProcessors removing 'ldb:' prefix
        const trainServices = stationBoardResult.stationBoard?.trainServices?.service;
        const departures: Departure[] = [];

        if (trainServices) {
            // Ensure trainServices is always an array, even if only one result
            const servicesArray = Array.isArray(trainServices) ? trainServices : [trainServices];

            servicesArray.forEach((service: any) => {
                // Extract data carefully, checking for existence
                const destination = service.destination?.location;
                // Destination can be an array if there are multiple via points
                const destinationName = Array.isArray(destination)
                    ? destination[0]?.locationName || 'Unknown' // Take the first one
                    : destination?.locationName || 'Unknown';

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
        if (axios.isAxiosError(error)) {
            console.error('Axios Error Status:', error.response?.status);
            console.error('Axios Error Response:', error.response?.data);
            errorMessage = `API Request Failed (${error.response?.status || 'Network Error'}).`;
            // Check for specific NRE error messages within error.response.data if XML/JSON
             // Attempt to parse SOAP fault from error response data
             if (error.response?.data) {
                try {
                    const parsedErrorXml = await parseStringPromise(error.response.data, { explicitArray: false, ignoreAttrs: true });
                    const faultString = parsedErrorXml?.['soap:Envelope']?.['soap:Body']?.['soap:Fault']?.faultstring;
                    if (faultString) {
                        errorMessage = `NRE API Error: ${faultString}`;
                    }
                } catch (parseErr) { /* Ignore if error response isn't parseable XML */ }
             }

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
