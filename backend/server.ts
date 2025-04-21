import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

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

// Enable CORS for all origins (adjust for production later)
app.use(cors());

// Middleware to parse JSON bodies (though not strictly needed for this GET endpoint)
app.use(express.json());

// Define the /api/departures endpoint
app.get('/api/departures', (req: Request, res: Response) => {
  const fromStation = req.query.from as string | undefined;
  const toStation = req.query.to as string | undefined;

  console.log(`Received request for departures: from=${fromStation}, to=${toStation}`);

  // --- Mock Data Generation ---
  // Replace this with actual NRE API call later
  if (!fromStation) {
    return res.status(400).json({ error: "Missing 'from' station query parameter." });
  }

  // Simulate fetching data based on 'from' station
  // In a real scenario, you'd use fromStation and toStation in your NRE API call
  const mockData: Departure[] = [
      { id: '1', scheduledTime: '10:30', destination: 'Edinburgh', platform: '1', status: 'On time', estimatedTime: '10:30' },
      { id: '2', scheduledTime: '10:35', destination: 'Leeds', platform: '5', status: 'On time', estimatedTime: '10:35' },
      { id: '3', scheduledTime: '10:40', destination: 'Newcastle', platform: '8', status: 'Delayed', estimatedTime: '10:55' },
      { id: '4', scheduledTime: '10:45', destination: 'Glasgow C', status: 'Cancelled' }, // Shortened name
      { id: '5', scheduledTime: '10:50', destination: 'Aberdeen', platform: '2', status: 'On time', estimatedTime: '10:50' },
      { id: '6', scheduledTime: '11:00', destination: 'York', platform: '3', status: 'On time', estimatedTime: '11:00' },
      { id: '7', scheduledTime: '11:05', destination: 'Cambridge', platform: '11', status: 'Delayed', estimatedTime: '11:15' },
  ];

  // Simulate filtering if 'toStation' is provided (case-insensitive partial match)
  const filteredData = toStation
      ? mockData.filter(dep => dep.destination.toLowerCase().includes(toStation.toLowerCase()))
      : mockData;

  // Simulate a small delay
  setTimeout(() => {
    res.json(filteredData);
  }, 500); // 500ms delay

  // --- End Mock Data Generation ---
});

// Basic root route
app.get('/', (req: Request, res: Response) => {
  res.send('Split-Flap Backend Service is running');
});

// Start the server
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
