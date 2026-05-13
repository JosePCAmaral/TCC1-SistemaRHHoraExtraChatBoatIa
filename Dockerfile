FROM node:20-alpine
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy full project into the image
COPY . .

# Ensure TypeScript cache is clean and build inside the image
RUN rm -f tsconfig.tsbuildinfo || true && npm run build

EXPOSE 5000

CMD ["npm", "run", "start:dev"]
