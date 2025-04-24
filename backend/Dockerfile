# Stage 1: Build the backend application
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package.json backend/package-lock.json ./

# Copy tsconfig
COPY backend/tsconfig.json ./

# Copy source code
COPY backend/src ./src/

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Run the build command
RUN npm run build

# --- Diagnostics: List the build output ---
RUN echo "--- Build Stage: Contents of /app/dist ---" && ls -R ./dist || echo "--- Build Stage: ./dist not found or empty ---"

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV to production for the final image
ENV NODE_ENV=production

# Copy package files for production install
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies and explicitly add js-yaml globally
RUN npm ci --ignore-scripts && npm install -g js-yaml
# Create a symlink to ensure the module is found
RUN mkdir -p /app/node_modules && ln -s /usr/local/lib/node_modules/js-yaml /app/node_modules/js-yaml

# Copy the compiled code from the build stage
COPY --from=build /app/dist ./dist

# Copy runtime assets like scenes
COPY backend/scenes ./scenes

# Expose the port the backend server listens on
EXPOSE 3001

# --- Diagnostics: List the final contents of /app/dist ---
RUN echo "--- Final Stage: Contents of /app/dist ---" && ls -R ./dist || echo "--- Final Stage: /app/dist not found or empty ---"

# Expose the port the app listens on
ENV PORT=3000
EXPOSE 3000

# Define the command to run the compiled app (runs from /app)
# Assumes backend/package.json "start" script points to "node dist/server.js"
CMD ["npm", "start"]
