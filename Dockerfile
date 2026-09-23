# Production image for the API + background workers
FROM node:24-slim

WORKDIR /app

# Install dependencies first (cached layer), without dev tools like nodemon
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the source code, migrations, scripts, corpus and eval set
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Apply database migrations, then start the API (workers start inside it)
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]