ARG POLLYCAR_NODE_IMAGE_DIGEST
FROM ${POLLYCAR_NODE_IMAGE_DIGEST}

WORKDIR /app

COPY state/server-bundle/ ./
COPY entrypoint.sh /usr/local/bin/pollycar-production-readiness

RUN chmod 755 /usr/local/bin/pollycar-production-readiness

ENTRYPOINT ["/usr/local/bin/pollycar-production-readiness"]

CMD ["node", "dist/http/run-production-readiness.js"]
