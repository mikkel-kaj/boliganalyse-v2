# Minimal Postfix image for receiving inbound broker mail and piping each
# message to the FastAPI inbound-email webhook.
#
# Outbound delivery is intentionally not configured — this MTA only accepts
# mail and hands it to the pipe transport.
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        postfix \
        ca-certificates \
        tini \
        python3 \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /etc/postfix/tls /var/spool/postfix /var/log/postfix

# Configuration is layered on top of the package defaults.
COPY main.cf       /etc/postfix/main.cf
COPY master.cf     /etc/postfix/master.cf
COPY virtual-regex /etc/postfix/virtual-regex
COPY sender_access /etc/postfix/sender_access

# Pipe transport delivers each accepted message to this script as user `nobody`.
COPY inbound.py /usr/local/bin/inbound.py
RUN chmod 0755 /usr/local/bin/inbound.py

# Hash-table form is required by Postfix for `hash:` maps.
RUN postmap /etc/postfix/sender_access

EXPOSE 25

# tini reaps the children Postfix forks for each delivery; postfix start-fg
# keeps master in the foreground so docker tracks its lifecycle.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["postfix", "start-fg"]
