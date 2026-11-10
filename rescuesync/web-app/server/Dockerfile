FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Contexto de build = web-app/ (ver docker-compose.yml: build.context: .),
# no web-app/server/, para poder copiar también web-app/shared/ dentro de
# la imagen — si no, el server no puede resolver
# `../../shared/emergency-validation.js` (ver validate-emergency.js) en
# ningún entorno que no use los bind mounts de desarrollo (docker-compose
# monta ./shared:/shared:ro solo para hot-reload en dev; sin esta copia
# explícita, una imagen "de verdad" sin esos volumes se rompía con
# ERR_MODULE_NOT_FOUND).
COPY server/package*.json ./
# Imagen de producción: sin devDependencies (eslint, prettier, node-pg-migrate).
RUN npm ci --omit=dev

COPY server/ .
COPY shared/ /shared/

EXPOSE 4000

# Producción por defecto; el modo desarrollo (node --watch) lo pide
# docker-compose.yml con `command: npm run dev`.
CMD ["npm", "start"]
