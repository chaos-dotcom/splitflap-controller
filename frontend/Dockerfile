# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app
# Set NODE_ENV to production for build stage
# ENV NODE_ENV=production # Removed: devDependencies (like typescript) are needed for build

# Copy package files and install dependencies
COPY package.json package-lock.json ./
# Use ci for clean installs, ensure it includes devDependencies needed for build
RUN npm ci

# Copy the rest of the application source code
COPY ./ ./

# Build the application (uses vite build as defined in package.json)
RUN npm run build

# Stage 2: Serve the application with Nginx
# Use a specific stable version
FROM nginx:1.25-alpine
WORKDIR /usr/share/nginx/html

# Remove default Nginx static assets
RUN rm -rf ./*

# Copy static assets from builder stage's dist directory
COPY --from=build /app/dist .

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
