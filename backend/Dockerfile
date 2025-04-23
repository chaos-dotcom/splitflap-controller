# Use an official Node runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install only production dependencies using npm ci
RUN npm ci --only=production

# Copy the rest of the application code (including compiled JS in dist)
# Ensure your .dockerignore file excludes node_modules, .git, etc.
COPY . .

# Make port 3000 available (ensure this matches the port in your server.ts)
EXPOSE 3000

# Define the command to run your compiled app using the start script from package.json
# This will execute "node dist/server.js"
CMD ["npm", "start"]
