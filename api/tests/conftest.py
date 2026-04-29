import os

# Disable testcontainers' Ryuk reaper. On Docker-Desktop-via-WSL the Ryuk
# container's port mapping never materialises, so PostgresContainer.start()
# fails with "Port mapping for container ... and port 8080 is not available".
# Must be set before testcontainers is imported.
os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")
