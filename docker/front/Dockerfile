# The GitHub Actions job runs `npm ci && npm run build` before this, so the
# standalone output already exists in the build context. Copying only that
# keeps the runtime image small and the pod start fast, which is what lets the
# HPA add capacity quickly enough to matter.
FROM node:20-alpine

# dumb-init reaps zombies and, more importantly here, forwards SIGTERM to the
# Next server. Without a real init, `node server.js` as PID 1 ignores SIGTERM
# and every scale-down waits out terminationGracePeriodSeconds before being
# SIGKILLed mid-request.
RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production
# Next's standalone server binds to localhost by default, which is unreachable
# from outside the pod — the kubelet's probes and the Service both fail.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# .next/standalone carries server.js plus the traced node_modules; static
# assets and public/ are not traced and have to be copied alongside it.
COPY --chown=node:node .next/standalone ./
COPY --chown=node:node .next/static ./.next/static
COPY --chown=node:node public ./public

USER node
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
