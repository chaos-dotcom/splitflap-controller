# Stage 1: Build the application
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
# Ensure backend/.dockerignore excludes node_modules, dist, etc. from this copy
RUN npm ci

# Copy the shared types directory from the root context first
# The path ../src/types is relative to the backend build context (.)
COPY ../src/types ./types

# Copy the rest of the backend application source code
COPY . .

# Run the build script (tsc -b) defined in package.json
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Set NODE_ENV to production for the final stage
ENV NODE_ENV=production

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the compiled code from the build stage
COPY --from=build /app/dist ./dist

# Copy runtime assets like scenes (if not mounted as a volume)
# Adjust this if your scenes are in a different location or handled by volumes
COPY ./scenes ./scenes

# Make port 3000 available
EXPOSE 3000

# List files for debugging before starting
RUN ls -la /app && ls -la /app/dist

# Define the command to run the compiled app
CMD ["npm", "start"]
