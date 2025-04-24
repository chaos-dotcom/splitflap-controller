# Stage 1: Build the backend application
FROM node:20-alpine AS build

# Set base working directory for the build context
WORKDIR /build_context

# Copy backend package files into a 'backend' subdirectory
COPY backend/package.json backend/package-lock.json ./backend/

# Copy backend tsconfig into 'backend' subdirectory
COPY backend/tsconfig.json ./backend/

# Copy backend source code into 'backend/src' subdirectory
COPY backend/src ./backend/src/

# Copy shared types source code into 'src/types' subdirectory (relative to build_context)
COPY src/types ./src/types/

# Set working directory to the backend subdirectory for npm commands
WORKDIR /build_context/backend

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Run the build command (tsc) from the /build_context/backend directory
# This uses ./tsconfig.json (which has rootDir: "..", include: ["backend/src/**/*"])
# It should correctly find ./src and ../src/types relative to the tsconfig location and rootDir
# Output will be in ./dist (/build_context/backend/dist)
RUN npm run build

# --- Diagnostics: List the build output ---
RUN echo "--- Build Stage: Contents of /build_context/backend/dist ---" && ls -R ./dist || echo "--- Build Stage: ./dist not found or empty ---"

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV to production for the final image
ENV NODE_ENV=production

# Copy backend package files again for production install (to /app)
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies for the backend
RUN npm ci --omit=dev --ignore-scripts

# Copy the compiled backend code from the build stage's /build_context/backend/dist to the final /app/dist
COPY --from=build /build_context/backend/dist ./dist

# Copy runtime assets like scenes (from host's backend/scenes to /app/scenes)
COPY backend/scenes ./scenes

# Expose the port the backend server listens on
EXPOSE 3001

# --- Diagnostics: List the final contents of /app/dist ---
RUN echo "--- Final Stage: Contents of /app/dist ---" && ls -R ./dist || echo "--- Final Stage: /app/dist not found or empty ---"

# Define the command to run the compiled app (runs from /app)
# Assumes backend/package.json "start" script points to "node dist/server.js"
CMD ["npm", "start"]
