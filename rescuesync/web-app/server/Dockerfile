FROM node:20-alpine

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
RUN npm install

COPY server/ .
COPY shared/ /shared/

EXPOSE 4000

CMD ["npm", "run", "dev"]
