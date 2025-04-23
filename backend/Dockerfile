# Stage 1: Build the application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files from backend directory
COPY backend/package.json backend/package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy tsconfig from backend directory to /app
COPY backend/tsconfig.json ./

# Copy shared types from root src to /app/types
COPY src/types ./types/

# Copy backend source code to /app/src
COPY backend/src ./src/

# Run the build script (tsc will use tsconfig.json in /app)
RUN npm run build

# List files after build for debugging
RUN ls -la /app && ls -la /app/dist

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV to production for the final stage
ENV NODE_ENV=production

# Copy package files from backend directory
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the compiled code from the build stage
COPY --from=build /app/dist ./dist

# Copy runtime assets like scenes from the backend directory
COPY backend/scenes ./scenes

# Make port 3000 available
EXPOSE 3000

# List files for debugging before starting
RUN ls -la /app && ls -la /app/dist

# Define the command to run the compiled app (runs from /app)
CMD ["npm", "start"]
