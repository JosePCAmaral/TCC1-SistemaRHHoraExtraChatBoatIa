FROM node:20-alpine
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy full project into the image
COPY . .

# Ensure TypeScript cache is clean and build using tsc directly
RUN rm -f tsconfig.tsbuildinfo tsconfig.build.tsbuildinfo || true && \
    ./node_modules/.bin/tsc -p tsconfig.build.json

EXPOSE 5000

CMD ["npm", "run", "start:dev"]
