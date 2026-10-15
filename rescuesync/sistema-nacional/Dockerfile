FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Solo dependencias de producción (sin eslint/prettier). node-pg-migrate es
# dependencia normal porque las migraciones corren al arrancar.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# No correr como root dentro del contenedor.
USER node

EXPOSE 5000

# Aplica migraciones pendientes, crea/actualiza la cuenta de integración y
# levanta la API. Render inyecta PORT y el resto de las variables.
CMD ["npm", "run", "start:prod"]
