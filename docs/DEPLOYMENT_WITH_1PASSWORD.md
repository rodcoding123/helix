# Docker Deployment with 1Password

This guide explains how to deploy Helix in Docker with secure 1Password integration.

## Overview

Instead of mounting .env files (insecure) or hardcoding secrets (insecure), we use:

1. 1Password Service Account (machine authentication)
2. 1Password Connect Server (local secret caching)
3. Docker integration

## Option 1: Simple - Using 1Password Service Account

### Create a Service Account in 1Password

1. Go to 1Password admin console
2. Create a Service Account
3. Grant vault access to "Helix"
4. Copy the access token

### Docker Run with Service Account

```bash
docker run \
  --name helix \
  --env OP_SERVICE_ACCOUNT_TOKEN=ops_abcdef123456... \
  --env HELIX_SECRETS_SOURCE=1password \
  --rm \
  helix-app:latest
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  helix:
    image: helix-app:latest
    environment:
      OP_SERVICE_ACCOUNT_TOKEN: ${OP_SERVICE_ACCOUNT_TOKEN}
      HELIX_SECRETS_SOURCE: 1password
      HELIX_ENVIRONMENT: production
    volumes:
      - helix-data:/app/data
    ports:
      - '3000:3000'
    restart: unless-stopped

volumes:
  helix-data:
```

**To run:**

```bash
export OP_SERVICE_ACCOUNT_TOKEN=ops_abcdef123456...
docker-compose up -d
```

## Option 2: Production - Using 1Password Connect Server

This is more complex but provides better security and local caching.

### Step 1: Set Up 1Password Connect Server

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # 1Password Connect Server - manages secret access
  op-connect:
    image: 1password/connect-api:latest
    environment:
      OP_BUS_PEERS: 'op-connect-sync:8423'
    volumes:
      - op-connect-data:/home/opuser/.op/data
    ports:
      - '8080:8080'
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8080/health']
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # 1Password Connect Sync - syncs credentials
  op-connect-sync:
    image: 1password/connect-sync:latest
    environment:
      OP_BUS_PEERS: 'op-connect-api:8423'
      OP_BUS_PORT: 8423
      OP_SESSION: ${OP_SESSION} # Credentials from 1Password
    volumes:
      - op-connect-data:/home/opuser/.op/data
    ports:
      - '8423:8423'
    restart: unless-stopped

  # Helix Application
  helix:
    image: helix-app:latest
    environment:
      OP_CONNECT_TOKEN: ${OP_CONNECT_TOKEN}
      OP_CONNECT_HOST: http://op-connect:8080
      HELIX_ENVIRONMENT: production
    depends_on:
      op-connect:
        condition: service_healthy
    volumes:
      - helix-data:/app/data
    ports:
      - '3000:3000'
    restart: unless-stopped

volumes:
  op-connect-data:
  helix-data:
```

### Step 2: Get 1Password Credentials

```bash
# On your local machine, authenticated with 1Password
op connect token create \
  --vault Helix \
  --label "Docker Deployment" \
  --output raw
```

This outputs a token to use as `OP_CONNECT_TOKEN`.

### Step 3: Update secrets-loader.ts for Connect Server

Add Connect Server support to `src/lib/secrets-loader.ts`:

```typescript
/**
 * Load secret from 1Password Connect Server
 * (cached, no rate limits)
 */
async function loadSecretFromConnectServer(itemName: string, field: SecretField): Promise<string> {
  const connectHost = process.env.OP_CONNECT_HOST || 'http://localhost:8080';
  const connectToken = process.env.OP_CONNECT_TOKEN;

  if (!connectToken) {
    throw new Error('OP_CONNECT_TOKEN not set');
  }

  try {
    const response = await fetch(`${connectHost}/v1/vaults/Helix/items?filter=title:${itemName}`, {
      headers: {
        Authorization: `Bearer ${connectToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const items = await response.json();
    if (!items[0]) {
      throw new Error(`Item "${itemName}" not found`);
    }

    const item = items[0];
    const fieldData = item.fields?.find((f: any) => f.type === field);

    if (!fieldData) {
      throw new Error(`Field "${field}" not found`);
    }

    return fieldData.value;
  } catch (error) {
    throw new Error(`Failed to load from Connect Server: ${error}`);
  }
}
```

### Step 4: Build Helix Docker Image

Create `Dockerfile`:

```dockerfile
FROM node:22-slim

WORKDIR /app

# Install 1Password CLI (optional, for debugging)
RUN apt-get update && \
    apt-get install -y curl && \
    curl https://downloads.1password.com/linux/keys/1password.asc | gpg --import && \
    apt-get install -y 1password && \
    rm -rf /var/lib/apt/lists/*

# Copy dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application
COPY . .

# Build TypeScript
RUN npm run build

# Create non-root user
RUN useradd -m -u 1000 helix && \
    chown -R helix:helix /app

USER helix

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

EXPOSE 3000

CMD ["npm", "start"]
```

### Step 5: Deploy

```bash
# Set credentials
export OP_SESSION=$(op signin --account my.1password.com --raw)
export OP_CONNECT_TOKEN=$(op connect token create --vault Helix --label Docker --output raw)

# Start services
docker-compose up -d

# Check status
docker-compose logs -f helix

# Verify health
curl http://localhost:3000/health
```

## Option 3: Kubernetes with 1Password Integration

For advanced deployments:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: op-connect-token
type: Opaque
stringData:
  token: ops_abcdef123456...

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: helix
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: helix
          image: helix-app:latest
          env:
            - name: OP_CONNECT_HOST
              value: http://op-connect:8080
            - name: OP_CONNECT_TOKEN
              valueFrom:
                secretKeyRef:
                  name: op-connect-token
                  key: token
            - name: HELIX_ENVIRONMENT
              value: production
```

## Security Best Practices

### Do's

✅ Store `OP_CONNECT_TOKEN` in Docker Secrets or Kubernetes Secret
✅ Use least privilege (Service Account with minimal vault access)
✅ Rotate tokens regularly
✅ Use HTTPS for Connect Server in production
✅ Network-isolate Connect Server (internal only)
✅ Monitor Connect Server health
✅ Log secret access (1Password does this automatically)

### Don'ts

❌ Commit tokens to git
❌ Pass tokens as plaintext in docker run
❌ Use Connect Server password (use token instead)
❌ Expose Connect Server to public internet
❌ Share tokens between environments
❌ Use personal 1Password account for production

## Troubleshooting

### Service Account Rate Limits

```
Error: Rate limited (50,000/hour)
```

Solution: Use Connect Server instead (unlimited local access after initial fetch)

### Connect Server Not Responding

```bash
# Check service health
curl http://localhost:8080/health

# Check logs
docker logs op-connect

# Verify credentials
echo $OP_SESSION
```

### Secret Not Found

```bash
# Verify vault contains secret
op item list --vault Helix

# Check item name matches exactly
op item get "Discord Webhook - Commands" --vault Helix
```

## Performance

| Method           | Speed         | Rate Limit | Best For            |
| ---------------- | ------------- | ---------- | ------------------- |
| CLI (op command) | Slow (300ms)  | 50k/hour   | Development         |
| Service Account  | Medium (50ms) | 50k/hour   | Single instances    |
| Connect Server   | Fast (5ms)    | Unlimited  | Production, scaling |

For Helix:

- **Dev:** CLI or Service Account
- **Prod:** Connect Server

## Next Steps

1. Create Service Account in 1Password
2. Add `OP_CONNECT_TOKEN` to deployment secrets
3. Update `secrets-loader.ts` to use Connect Server
4. Build and test Docker image locally
5. Deploy to production with docker-compose
6. Monitor secret access in 1Password

## References

- [1Password Connect Server Documentation](https://developer.1password.com/docs/connect/)
- [Service Accounts](https://developer.1password.com/docs/service-accounts/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)
