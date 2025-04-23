# Stage 1: Build the application
FROM node:20-alpine AS build

WORKDIR /app

# Copy only package files first for better caching
COPY backend/package.json backend/package-lock.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy shared types needed for build
COPY src/types ./types/

# Copy the entire backend source into a subdirectory
COPY backend ./backend_src/

# Set working directory to the backend source
WORKDIR /app/backend_src

# Run the build script (tsc should resolve ../types relative to backend_src/tsconfig.json)
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV to production for the final stage
ENV NODE_ENV=production

# Copy package files for production dependencies
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the compiled code from the build stage's subdirectory
COPY --from=build /app/backend_src/dist ./dist

# Copy runtime assets like scenes from the original context's backend directory
COPY backend/scenes ./scenes

# Make port 3000 available
EXPOSE 3000

# List files for debugging before starting
RUN ls -la /app && ls -la /app/dist

# Define the command to run the compiled app (still runs from /app)
CMD ["npm", "start"]
