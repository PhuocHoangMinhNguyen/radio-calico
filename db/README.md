# Database Maintenance

## Error Logs Cleanup

Error logs are automatically deleted after 30 days to prevent unbounded database growth. This cleanup is performed by a scheduled cron job.

### Setup Cron Job

#### Linux/macOS

Add the following line to your crontab (`crontab -e`):

```bash
# Run cleanup daily at 2:00 AM
0 2 * * * PGPASSWORD=your_password psql -U postgres -d radio_calico -f /path/to/radio-calico/db/cleanup-old-logs.sql >> /var/log/radio-calico-cleanup.log 2>&1
```

**Using environment variables (.env file):**

```bash
# Run cleanup daily at 2:00 AM using .env file
0 2 * * * cd /path/to/radio-calico && export $(cat .env | xargs) && psql -U $PGUSER -d $PGDATABASE -f db/cleanup-old-logs.sql >> /var/log/radio-calico-cleanup.log 2>&1
```

#### Docker

If running in Docker, add the cron job inside the `db` container:

**Option 1: Use host cron to execute in Docker container**

Add to host crontab:

```bash
# Run cleanup daily at 2:00 AM
0 2 * * * docker exec radio_calico-db-1 psql -U postgres -d radio_calico -c "DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days'; VACUUM ANALYZE error_logs;" >> /var/log/radio-calico-cleanup.log 2>&1
```

**Option 2: Install cron inside the db container**

Create `docker-compose.override.yml`:

```yaml
services:
  db:
    volumes:
      - ./db/cleanup-old-logs.sql:/docker-entrypoint-initdb.d/cleanup-old-logs.sql:ro
      - ./db/crontab:/etc/cron.d/radio-calico:ro
    command: >
      bash -c "
        apt-get update && apt-get install -y cron &&
        cron &&
        docker-entrypoint.sh postgres
      "
```

Create `db/crontab`:

```
0 2 * * * postgres psql -U postgres -d radio_calico -f /docker-entrypoint-initdb.d/cleanup-old-logs.sql >> /var/log/radio-calico-cleanup.log 2>&1
```

#### Windows (Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task: "Radio Calico Log Cleanup"
3. Trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `psql.exe`
   - Arguments: `-U postgres -d radio_calico -f C:\path\to\radio-calico\db\cleanup-old-logs.sql`
   - Add environment variable: `PGPASSWORD=your_password`

#### Kubernetes CronJob

Create `k8s/cronjob-cleanup.yaml`:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: radio-calico-cleanup
spec:
  schedule: "0 2 * * *"  # Daily at 2:00 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cleanup
            image: postgres:16
            env:
            - name: PGHOST
              value: "postgres-service"
            - name: PGDATABASE
              value: "radio_calico"
            - name: PGUSER
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: username
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
            command:
            - psql
            - -c
            - "DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days'; VACUUM ANALYZE error_logs;"
          restartPolicy: OnFailure
```

Apply with: `kubectl apply -f k8s/cronjob-cleanup.yaml`

### Manual Cleanup

To manually run the cleanup:

```bash
# Local
PGPASSWORD=your_password psql -U postgres -d radio_calico -f db/cleanup-old-logs.sql

# Docker
docker exec radio_calico-db-1 psql -U postgres -d radio_calico -f /docker-entrypoint-initdb.d/cleanup-old-logs.sql

# Kubernetes
kubectl exec -it postgres-pod -- psql -U postgres -d radio_calico -c "DELETE FROM error_logs WHERE created_at < NOW() - INTERVAL '30 days'; VACUUM ANALYZE error_logs;"
```

### Customizing Retention Period

To change the 30-day retention period, edit `db/cleanup-old-logs.sql` and update the `INTERVAL '30 days'` value.

### Monitoring

Check the cron log to verify cleanup is running:

```bash
# Linux/macOS
tail -f /var/log/radio-calico-cleanup.log

# Docker
docker logs radio_calico-db-1 | grep cleanup

# Systemd journal (if using systemd)
journalctl -u cron -f | grep radio-calico
```

Check the error_logs table size:

```sql
SELECT
  COUNT(*) as total_logs,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log,
  pg_size_pretty(pg_total_relation_size('error_logs')) as table_size
FROM error_logs;
```
