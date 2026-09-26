# services/issuer-service/Dockerfile
# FROM node:20-alpine
# WORKDIR /app
# COPY package.json package-lock.json* ./
# RUN npm install --production
# COPY . .
# EXPOSE 3000
# CMD ["node", "app.js"]

# Base image
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production

# Copy rest of the code
COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
