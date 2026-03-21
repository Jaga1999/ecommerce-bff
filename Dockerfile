# Base image
FROM node:22-alpine AS development

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production image
FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY --from=development /usr/src/app/dist ./dist

# Start the server with a wait-for-db check
CMD ["sh", "-c", "echo 'Waiting for database connection...' && until nc -z $DB_HOST $DB_PORT; do echo 'Waiting...'; sleep 2; done; echo 'Database connected! Starting application and running migrations...' && node dist/main"]
