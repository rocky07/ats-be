FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first to leverage Docker caching
COPY package*.json ./
RUN npm ci --only=production

# Copy remaining application code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]