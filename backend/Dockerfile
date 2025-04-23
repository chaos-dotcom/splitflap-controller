# Stage 1: Build the application using composite project structure
FROM node:20-alpine AS build

# Set the working directory to /app (representing project root inside container)
WORKDIR /app

# --- Dependency Installation ---
# Copy root package files first
COPY package.json package-lock.json ./
# Install root dependencies (needed for typescript, etc.)
RUN npm ci

# Copy backend package files into a subdirectory
COPY backend/package.json backend/package-lock.json ./backend/
# Install backend dependencies
RUN cd backend && npm ci

# --- Source Code & Config Copying ---
# Copy all tsconfig files maintaining structure relative to /app
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY backend/tsconfig.json ./backend/
COPY src/types/tsconfig.json ./src/types/

# Copy all source code needed for the build
COPY src ./src
COPY backend/src ./backend/src

# --- Build ---
# Run the composite build command from the project root (/app)
# This builds src/types first, then backend based on references
RUN npx tsc -b backend/tsconfig.json

# List files after build for debugging
RUN echo "--- Build Stage /app ---" && ls -la /app && \
    echo "--- Build Stage /app/src/types/dist ---" && ls -la /app/src/types/dist && \
    echo "--- Build Stage /app/backend/dist ---" && ls -la /app/backend/dist

# Stage 2: Create the final production image
FROM node:20-alpine

# Set working directory inside the backend folder for the final image
WORKDIR /app/backend

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies for the backend
RUN npm ci --only=production

# Copy the compiled backend code from the build stage
# Source path is relative to build stage WORKDIR (/app)
# Destination path is relative to final stage WORKDIR (/app/backend)
COPY --from=build /app/backend/dist ./dist

# Copy runtime assets like scenes from the original source location
# Source path is relative to build context root
# Destination path is relative to final stage WORKDIR (/app/backend)
COPY backend/scenes ./scenes

# Expose the port the backend server listens on (ensure this matches server.ts)
EXPOSE 3001

# List files for debugging before starting
RUN echo "--- Final Stage /app/backend ---" && ls -la && \
    echo "--- Final Stage /app/backend/dist ---" && ls -la ./dist

# Define the command to run the compiled app (runs from /app/backend)
# This uses the "start" script defined in backend/package.json
CMD ["npm", "start"]
