# 🚉 Split-Flap Display Controller

A modern web application for controlling split-flap displays via MQTT. This project consists of a React frontend and Node.js backend that work together to provide various display modes including:

- Text input mode
- Train timetable display
- Scene sequence playback
- Clock display
- Stopwatch functionality
- Timer functionality

## 📁 Project Structure

- `/frontend` - React TypeScript application built with Vite
- `/backend` - Node.js server with Socket.IO and MQTT integration
- `/backend/scenes` - YAML files defining scene sequences for playback

## 🚀 Getting Started

### 📋 Prerequisites

- Node.js (v16+)
- npm or yarn
- MQTT broker (for physical display control)
- National Rail Enquiries API token (optional, for train timetable functionality)

### ⚙️ Configuration

1. Copy environment template files and configure them:

   **For the frontend:**
   ```
   cp .env.template .env
   ```

   Edit `.env` to set:
   - `VITE_API_BASE_URL` - URL of your backend server

   **For the backend:**
   ```
   cp backend/.env.template backend/.env
   ```

   Edit `backend/.env` to set:
   - `PORT` - Backend server port
   - `NODE_ENV` - Environment (development/production)
   - `NRE_API_TOKEN` - National Rail Enquiries API token (for train mode)
   - MQTT broker details for your physical display:
     - `DISPLAY_MQTT_BROKER_URL`
     - `DISPLAY_MQTT_TOPIC`
     - `DISPLAY_MQTT_USERNAME` (if required)
     - `DISPLAY_MQTT_PASSWORD` (if required)

### 💻 Development Setup

1. Clone the repository
2. Install dependencies:
   ```
   # Backend
   cd backend
   npm install

   # Frontend
   cd frontend
   npm install
   ```
3. Start the development servers:
   ```
   # Backend
   cd backend
   npm run dev

   # Frontend
   cd frontend
   npm run dev
   ```

### 🐳 Docker Deployment

The project includes Docker configuration for easy deployment:

```
docker-compose up -d
```

This will:
- Build and start both frontend and backend containers
- Make the frontend available at http://localhost:8080
- Connect the backend to the frontend via an internal Docker network
- Mount the `backend/scenes` directory for persistence
- Restart containers automatically unless explicitly stopped

## ✨ Features

### 🖥️ Display Modes

- **Text Mode**: Directly input and send text to the display
- **Train Timetable**: Show real-time train departure information
- **Sequence Mode**: Create, edit and play sequences of text with timing
- **Clock Mode**: Display the current time
- **Stopwatch Mode**: Count up from zero
- **Timer Mode**: Count down from a set time

### 📡 MQTT Integration

The application connects to an MQTT broker to control physical split-flap displays. Configure the connection settings in the Settings panel of the application or via environment variables.

## 📝 Scene Files

Scene sequences are stored as YAML files in the `backend/scenes` directory. When using Docker, this directory is mounted as a volume for persistence.
