import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createClientAsync, Client } from 'soap'; // Import soap client

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

// NRE LDBWS WSDL URL - Use the latest version
const NRE_LDBWS_WSDL_URL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2021-11-01';

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

    // --- NRE API Call using 'soap' library ---
    try {
        console.log(`Creating SOAP client for WSDL: ${NRE_LDBWS_WSDL_URL}`);
        const client: Client = await createClientAsync(NRE_LDBWS_WSDL_URL);

        // Add the AccessToken SOAP header
        // The namespace 'http://thalesgroup.com/RTTI/2013-11-28/Token/types' is typically associated with 'typ' or similar prefix in examples.
        const soapHeader = {
            'AccessToken': {
                'TokenValue': apiToken
            }
        };
        // Provide the namespace explicitly for the AccessToken element. The prefix ('typ') is arbitrary here but helps clarity.
        client.addSoapHeader(soapHeader, '', 'typ', 'http://thalesgroup.com/RTTI/2013-11-28/Token/types');

        // Prepare arguments for the GetDepartureBoard operation
        const args = {
            numRows: numRows,
            crs: fromStation,
            // Add filterCrs and filterType if toStation is provided
            ...(toStation && { filterCrs: toStation, filterType: 'to' })
        };

        console.log(`Calling GetDepartureBoardAsync for station: ${fromStation} with args:`, args);

        // Call the SOAP method (method name usually matches WSDL operation + 'Async')
        // The library handles the POST request, SOAPAction header, and XML construction/parsing.
        // The result is typically the first element of the returned array.
        const [result, rawResponse, soapHeaderResponse, rawRequest] = await client.GetDepartureBoardAsync(args);

        console.log("Received response from NRE.");
        // console.log("Raw Response Body:", rawResponse); // Uncomment for deep debugging

        // --- Process Response ---
        // The 'soap' library parses the response into a JavaScript object.
        // Navigate the object structure based on the WSDL/XML response.
        const stationBoardResult = result?.GetStationBoardResult;

        if (!stationBoardResult) {
            console.error('Could not find GetStationBoardResult in NRE response structure:', JSON.stringify(result, null, 2));
            // Note: SOAP Faults are typically thrown as errors by the library, caught in the catch block.
            throw new Error('Unexpected response structure from NRE API.');
        }

        // --- Map Data ---
        // Access data directly from the parsed JavaScript object.
        const trainServices = stationBoardResult.stationBoard?.trainServices?.service;
        const departures: Departure[] = [];

        if (trainServices) {
            // Ensure trainServices is an array, even if only one service is returned
            const servicesArray = Array.isArray(trainServices) ? trainServices : [trainServices];

            servicesArray.forEach((service: any) => {
                // Access properties directly, assuming 'soap' library parsed correctly
                const destination = service.destination?.location;
                // Destination can sometimes be an array if there are multiple via points, take the first/primary.
                const destinationName = Array.isArray(destination)
                    ? destination[0]?.locationName || 'Unknown'
                    : destination?.locationName || 'Unknown';

                // Determine status: etd can be 'On time', 'Delayed', 'Cancelled', or an estimated time.
                let status = 'Unknown';
                let estimatedTime: string | undefined = undefined;
                if (service.etd === 'On time') {
                    status = 'On time';
                } else if (service.etd === 'Delayed') {
                    status = 'Delayed';
                } else if (service.etd === 'Cancelled') {
                    status = 'Cancelled';
                } else if (service.etd) { // It's an estimated time
                    status = 'On time'; // Or potentially 'Delayed' if etd > std, but API usually handles this
                    estimatedTime = service.etd;
                } else { // No etd, rely on std
                    status = 'On time'; // Assume on time if no other info
                }


                const departure: Departure = {
                    id: service.serviceID, // Unique ID for the service run
                    scheduledTime: service.std || '??:??', // Scheduled time of departure
                    destination: destinationName,
                    platform: service.platform || undefined, // Platform might be missing
                    status: status,
                    estimatedTime: estimatedTime,
                };
                departures.push(departure);
            });
        } else if (stationBoardResult.stationBoard) { // Check if stationBoard exists but services are missing
            console.log(`No train services found for ${fromStation} in the response.`);
            // Check for informational messages from NRCC
            if (stationBoardResult.nrccMessages?.message) {
                 const messages = Array.isArray(stationBoardResult.nrccMessages.message) ? stationBoardResult.nrccMessages.message : [stationBoardResult.nrccMessages.message];
                 messages.forEach((msg: any) => console.log("NRCC Message:", typeof msg === 'string' ? msg : JSON.stringify(msg)));
            }
        }

        console.log(`Successfully fetched and mapped ${departures.length} departures for ${fromStation}.`);
        res.json(departures); // Send the mapped data to the frontend

    } catch (error: any) {
        console.error('Error calling NRE LDBWS:', error);
        let errorMessage = 'Failed to fetch train data.';
        // Check if it's a SOAP Fault returned by the 'soap' library
        if (error.Fault) {
            console.error('SOAP Fault:', error.Fault);
            errorMessage = `NRE API Fault: ${error.Fault.faultstring || error.Fault.reason || 'Unknown SOAP Fault'}`;
        } else if (error.message) {
            // General error (network, WSDL parsing, etc.)
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
