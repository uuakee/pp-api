FROM node:18-alpine

WORKDIR /app

# Argumentos de build para variáveis de ambiente
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Copiar arquivos de dependências
COPY package*.json ./
COPY prisma ./prisma/


# Instalar dependências
RUN npm install

# Gerar cliente Prisma
RUN npx prisma generate

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 1994

# Comando para iniciar a aplicação
CMD ["node", "src/server-prod.js"] 