# 1Password Integration for CI/CD Pipelines

Complete guide for setting up Helix with 1Password in automated environments (GitHub Actions, GitLab CI, CircleCI, etc.).

## Overview

Helix supports three modes of secret management:

| Mode | Location | Security | Best For |
|------|----------|----------|----------|
| **1Password** | 1Password Helix vault | ⭐⭐⭐ Excellent | Production, CI/CD |
| **Service Account** | 1Password via token | ⭐⭐⭐ Excellent | Automated deployments |
| **.env Fallback** | Local file | ⭐⭐ Good | Development only |

## Prerequisites

1. **1Password Business or Teams plan** (required for service accounts)
2. **1Password CLI v2.30+** installed
3. **Service account created** in your 1Password vault

## Step 1: Create a 1Password Service Account

### In 1Password Web Vault:

1. Go to **Settings** → **Integrations** → **Service Accounts**
2. Click **Create Service Account**
3. Name it: `Helix-CI`
4. Grant vault access to **Helix vault**
5. Click **Create**
6. **Copy the service account token** (you'll only see it once!)
   - Format: `ops_...`

### Save the Token Securely:

```bash
# Store in your CI/CD platform's secrets manager
# Never commit to git!
OP_SERVICE_ACCOUNT_TOKEN=ops_xxxxx...
```

## Step 2: Configure GitHub Actions

### Create `.github/workflows/deploy-helix.yml`:

```yaml
name: Deploy Helix with 1Password

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      # Install 1Password CLI
      - name: Install 1Password CLI
        run: |
          curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg
          echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | sudo tee /etc/apt/sources.list.d/1password.sources.list
          sudo apt-get update && sudo apt-get install -y 1password-cli

      # Set up Node
      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      # Install dependencies
      - run: npm ci

      # Run tests with 1Password secrets
      - name: Run tests with 1Password
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          HELIX_SECRETS_SOURCE: 1password
        run: npm run test

      # Build Docker image
      - name: Build Docker image
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
        run: |
          docker build -f openclaw-helix/Dockerfile.1password -t helix:latest .

      # Deploy (example: push to registry)
      - name: Push to container registry
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USER }}" --password-stdin
          docker tag helix:latest myregistry/helix:latest
          docker push myregistry/helix:latest
```

### Add Secrets to GitHub:

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `OP_SERVICE_ACCOUNT_TOKEN`
4. Value: `ops_xxxxx...` (from Step 1)
5. Click **Add secret**

## Step 3: Configure GitLab CI

### Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

variables:
  HELIX_SECRETS_SOURCE: "1password"

before_script:
  # Install 1Password CLI
  - curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | tee /etc/apt/sources.list.d/1password.sources.list
  - apt-get update && apt-get install -y 1password-cli

test:
  stage: test
  image: node:22
  script:
    - npm ci
    - npm run test
  env:
    OP_SERVICE_ACCOUNT_TOKEN: $OP_SERVICE_ACCOUNT_TOKEN

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -f openclaw-helix/Dockerfile.1password -t helix:latest .
    - docker tag helix:latest $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  env:
    OP_SERVICE_ACCOUNT_TOKEN: $OP_SERVICE_ACCOUNT_TOKEN
```

### Add Secrets to GitLab:

1. Go to project **Settings** → **CI/CD** → **Variables**
2. Click **Add variable**
3. Key: `OP_SERVICE_ACCOUNT_TOKEN`
4. Value: `ops_xxxxx...`
5. Protected: **Yes**
6. Masked: **Yes**
7. Click **Add variable**

## Step 4: Test Locally with Service Account

### Create a `.env` file (development only):

```bash
# .env (git ignored - for local testing only)
HELIX_SECRETS_SOURCE=1password
OP_SERVICE_ACCOUNT_TOKEN=ops_xxxxx...
```

### Test it works:

```bash
# Load environment
export $(cat .env | xargs)

# Verify authentication
op whoami
# Output: Helix-CI

# Run verification
npx ts-node scripts/verify-1password.ts

# Expected output:
# ✓ 1Password CLI 2.30.0+ detected
# ✓ Authenticated as service account
# ✓ Helix vault found
# ✓ All required secrets verified
```

## Step 5: Docker Deployment with 1Password

### Build with 1Password support:

```bash
# Local testing
docker build -f openclaw-helix/Dockerfile.1password -t helix:dev .

# Run with service account token
docker run \
  -e OP_SERVICE_ACCOUNT_TOKEN=ops_xxxxx... \
  -e HELIX_SECRETS_SOURCE=1password \
  helix:dev
```

### In Docker Swarm/Kubernetes:

```yaml
# kubernetes/helix-deployment.yaml
apiVersion: v1
kind: Secret
metadata:
  name: helix-1password
type: Opaque
stringData:
  OP_SERVICE_ACCOUNT_TOKEN: ops_xxxxx...

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: helix
spec:
  replicas: 1
  selector:
    matchLabels:
      app: helix
  template:
    metadata:
      labels:
        app: helix
    spec:
      containers:
      - name: helix
        image: helix:latest
        env:
        - name: OP_SERVICE_ACCOUNT_TOKEN
          valueFrom:
            secretKeyRef:
              name: helix-1password
              key: OP_SERVICE_ACCOUNT_TOKEN
        - name: HELIX_SECRETS_SOURCE
          value: "1password"
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Step 6: Environment Variables per Platform

### GitHub Actions:

```yaml
env:
  OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
  HELIX_SECRETS_SOURCE: "1password"
```

### GitLab CI:

```yaml
variables:
  OP_SERVICE_ACCOUNT_TOKEN: $OP_SERVICE_ACCOUNT_TOKEN
  HELIX_SECRETS_SOURCE: "1password"
```

### CircleCI:

```yaml
jobs:
  test:
    environment:
      OP_SERVICE_ACCOUNT_TOKEN: ${OP_SERVICE_ACCOUNT_TOKEN}
      HELIX_SECRETS_SOURCE: "1password"
```

### Jenkins:

```groovy
environment {
    OP_SERVICE_ACCOUNT_TOKEN = credentials('OP_SERVICE_ACCOUNT_TOKEN')
    HELIX_SECRETS_SOURCE = '1password'
}
```

## Troubleshooting

### `1Password CLI not found in Docker`:

```dockerfile
RUN curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | gpg --dearmor --output /usr/share/keyrings/1password-archive-keyring.gpg
RUN echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$(dpkg --print-architecture) stable main" | tee /etc/apt/sources.list.d/1password.sources.list
RUN apt-get update && apt-get install -y 1password-cli
```

### `OP_SERVICE_ACCOUNT_TOKEN not recognized`:

```bash
# Verify it's set
echo $OP_SERVICE_ACCOUNT_TOKEN

# Verify 1Password can read it
op whoami

# Check vault access
op vault list
```

### `Secrets not loading in CI`:

```bash
# Enable debug mode
export DEBUG=helix:*
export HELIX_SECRETS_SOURCE=1password

npx ts-node scripts/verify-1password.ts
```

### `Service account token expired`:

1. Regenerate in 1Password: **Settings** → **Service Accounts**
2. Update CI/CD secret
3. Re-deploy

## Security Best Practices

1. **Always use service account tokens** in CI/CD (never personal authentication)
2. **Mark CI/CD tokens as "Protected"** in GitHub/GitLab
3. **Rotate tokens quarterly**
4. **Never commit tokens** to git (use `.gitignore`)
5. **Use limited permissions** - grant only Helix vault access
6. **Audit service account usage** in 1Password logs
7. **Use separate tokens** for different environments (staging, production)

## Quick Reference

### Test if 1Password is working:

```bash
# In CI/CD environment
export OP_SERVICE_ACCOUNT_TOKEN=ops_xxxxx...
npx ts-node scripts/verify-1password.ts
```

### Check which secrets source is active:

```bash
npx ts-node scripts/test-secrets-loader.ts
# Shows: Using secret source: 1password (default)
```

### Force .env fallback (development):

```bash
export HELIX_SECRETS_SOURCE=env
npm run dev
```

---

## Next Steps

1. ✓ Create service account in 1Password
2. ✓ Add token to CI/CD secrets
3. ✓ Update pipeline YAML configuration
4. ✓ Test locally with service account
5. ✓ Deploy and monitor logs
6. ✓ Set up token rotation schedule

For support: See `scripts/verify-1password.ts` for detailed diagnostics.
