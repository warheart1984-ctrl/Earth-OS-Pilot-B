FROM node:22-alpine

WORKDIR /app

COPY federation/core/ ./federation/core/

WORKDIR /app/federation/core

RUN npm install && npm run build

CMD ["npm", "test"]
