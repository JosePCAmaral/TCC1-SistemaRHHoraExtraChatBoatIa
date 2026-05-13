FROM node:20-alpine
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy full project into the image
COPY . .

# Clean cache and build using TypeScript compiler
RUN rm -rf dist tsconfig.tsbuildinfo && \
    ./node_modules/.bin/tsc

EXPOSE 5000

CMD ["npm", "run", "start:dev"]
