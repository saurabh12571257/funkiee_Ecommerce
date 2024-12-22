FROM node:18-slim AS builder

WORKDIR /app

COPY package*.json ./

# Install dependencies (this will be cached unless package.json changes)
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]