# Supreme Sales Command - Fullstack Deployment
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app (frontend + backend)
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the production server
CMD ["npm", "start"]
