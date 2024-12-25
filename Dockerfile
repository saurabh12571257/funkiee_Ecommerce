# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM gcr.io/distroless/nodejs20
WORKDIR /app
COPY --from=builder /app ./

# Expose port
EXPOSE 3000

# Command to run the application
CMD ["index.js"]
