# Stage 1: Build the React application
FROM node:20-alpine AS build
WORKDIR /app
# Set NODE_ENV to production for build stage
# ENV NODE_ENV=production # Removed: devDependencies (like typescript) are needed for build

# Copy package files and install dependencies
COPY frontend/package.json frontend/package-lock.json ./
# Use ci for clean installs, ensure it includes devDependencies needed for build
RUN npm ci

# Copy the rest of the application source code
COPY frontend/ ./

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
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Adjust permissions for Nginx runtime directories and content.
# The Nginx process will run as UID/GID 3000 (due to 'user: "3000"' in docker-compose.yml).
# The base image's entrypoint script will create a user with this UID/GID if it doesn't exist
# and configure Nginx to use it.
# We need to ensure this user has write access to cache directories and read access to content/config.
RUN chown -R 3000:3000 /var/cache/nginx && \
    chown -R 3000:3000 /usr/share/nginx/html && \
    chown -R 3000:3000 /etc/nginx/conf.d
    # The entrypoint script handles /run/nginx for PID files.
    # Logs are typically symlinked to stdout/stderr in nginx:alpine, so /var/log/nginx itself
    # usually doesn't need chowning if it's just symlinks.

# Expose port 80
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
