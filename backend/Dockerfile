# Stage 1: Build the backend application
FROM node:20-alpine AS build

# Set working directory consistently to /app
WORKDIR /app

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy backend tsconfig
COPY backend/tsconfig.json ./

# Copy backend source code into /app/src
COPY backend/src ./src/

# Copy shared types source code into /app/src/types
# This location is now expected by the updated tsconfig.json path: ../src/types relative to baseUrl .
COPY src/types ./src/types/

# Run the build command (tsc) from the /app directory
# Outputs to ./dist (/app/dist) based on tsconfig.json
RUN npm run build

# --- Diagnostics: List the build output ---
RUN echo "--- Build Stage: Contents of /app/dist ---" && ls -R /app/dist || echo "--- Build Stage: /app/dist not found or empty ---"

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV to production for the final image
ENV NODE_ENV=production

# Copy backend package files again for production install
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies for the backend
# Using --omit=dev instead of --only=production as recommended by npm v7+
RUN npm ci --omit=dev --ignore-scripts

# Copy the compiled backend code from the build stage's /app/dist to the final /app/dist
# Ensure the source directory exists before copying
COPY --from=build /app/dist ./dist

# Copy runtime assets like scenes
COPY backend/scenes ./scenes

# Expose the port the backend server listens on
EXPOSE 3001

# --- Diagnostics: List the final contents of /app/dist ---
RUN echo "--- Final Stage: Contents of /app/dist ---" && ls -R /app/dist || echo "--- Final Stage: /app/dist not found or empty ---"

# Define the command to run the compiled app (runs from /app)
# Assumes backend/package.json "start" script points to "node dist/server.js"
CMD ["npm", "start"]
