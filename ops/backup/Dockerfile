# Small scheduler image that periodically backs up Postgres (pg_dump) and
# the object-storage bucket (mc mirror), verifies each backup, prunes old
# ones past retention, and writes a status file apps/api's /backups
# endpoint reads (see docs/backup-restore.md). Based on postgres:16-alpine
# so pg_dump/pg_restore exactly match the server image used everywhere else
# in this stack (docker-compose.yml, docker-compose.prod.yml) - a
# version-mismatched pg_dump/pg_restore is a real, easy-to-hit
# restore-time failure mode.
FROM minio/mc:latest AS mc

FROM postgres:16-alpine
RUN apk add --no-cache bash coreutils findutils
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
WORKDIR /app
COPY lib.sh backup-postgres.sh backup-storage.sh verify-postgres-backup.sh verify-storage-backup.sh restore-postgres.sh restore-storage.sh entrypoint.sh ./
RUN chmod +x ./*.sh
ENTRYPOINT ["/app/entrypoint.sh"]
