FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
RUN npm run prisma:generate
COPY . .
RUN npm run build && test -f dist/main.js

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Prisma CLI/config + ts-node retained for explicit migrate/seed jobs, never automatic seeding.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/register-paths.cjs ./register-paths.cjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start:prod"]
