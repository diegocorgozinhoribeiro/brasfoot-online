# Imagem minima Node 20 alpine para o relay WebSocket
FROM node:20-alpine

WORKDIR /app

# instala dependencias primeiro para aproveitar cache do Docker
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# copia o codigo
COPY relay.js ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# usuario sem privilegios
USER node

CMD ["node", "relay.js"]
