FROM node:20-slim

# LibreOffice provides the --headless --convert-to pdf capability this
# service depends on. fonts-dejavu + fonts-liberation reduce font-substitution
# artifacts when converting Office files that use common Windows fonts.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libreoffice \
        fonts-dejavu \
        fonts-liberation && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
