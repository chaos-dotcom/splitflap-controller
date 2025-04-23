# Stage 1: Build the backend application
FROM node:20-alpine AS build

# Set working directory for the build stage
WORKDIR /build_context

# Copy backend package files and install ALL dependencies (incl. dev)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Copy backend tsconfig
COPY backend/tsconfig.json ./backend/

# Copy backend source code
COPY backend/src ./backend/src/

# Copy shared types source code needed for the build
# The path alias in backend/tsconfig.json expects it at ../src/types
COPY src/types ./src/types/

# Run the build command from within the backend directory context
# This uses backend/tsconfig.json which resolves 'types' via paths
WORKDIR /build_context/backend
RUN npm run build

# List files after build for debugging
RUN echo "--- Build Stage /build_context/backend ---" && ls -la && \
    echo "--- Build Stage /build_context/backend/dist ---" && ls -la ./dist

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./

# Install only production dependencies for the backend
RUN npm ci --only=production

# Copy the compiled backend code from the build stage
COPY --from=build /build_context/backend/dist ./dist

# Copy runtime assets like scenes
COPY backend/scenes ./scenes

# Expose the port the backend server listens on
EXPOSE 3001

# List files for debugging before starting
RUN echo "--- Final Stage /app ---" && ls -la && \
    echo "--- Final Stage /app/dist ---" && ls -la ./dist

# Define the command to run the compiled app (runs from /app)
# Assumes backend/package.json "start" script points to "dist/server.js"
CMD ["npm", "start"]
