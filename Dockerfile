# Imagen base
FROM node:20-bookworm-slim

WORKDIR /app

# Paquetes necesarios para dependencias nativas (por si acaso)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Generar el cliente de Prisma dentro del contenedor
RUN npx prisma generate

# Configurar puerto 
ENV PORT=3000
EXPOSE 3000

# Ejecutar migraciones seguras y levantar backend principal
CMD sh -c "npx prisma migrate deploy && node src/app.js"
