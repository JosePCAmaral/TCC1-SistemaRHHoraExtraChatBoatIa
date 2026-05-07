FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
RUN npm install --legacy-peer-deps
RUN npm install @google/generative-ai --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
