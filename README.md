# System Health Dashboard
> A full-stack DevOps assessment project — CI/CD pipeline, IaC, containerisation, and cloud deployment.

**Live Demo:** https://system-health.duckdns.org
**Jenkins CI/CD:** http://jenkins-health.duckdns.org:8080
**GitHub:** https://github.com/Pavithra-51204/system-health-dashboard

---

## Overview

A real-time system health monitoring dashboard built to demonstrate a complete DevOps workflow. The application monitors API health, runtime metrics, and deployment history — making it a DevOps tool in itself.

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL 15 (AWS RDS) |
| Container Registry | AWS ECR (private) |
| Infrastructure | AWS EC2 (t3.small) + RDS + ECR |
| IaC | Terraform with S3 remote state |
| CI/CD | Jenkins (hosted on EC2) |
| Reverse Proxy | Nginx |
| Containerisation | Docker (multi-stage, non-root user) |
| DNS | DuckDNS (custom domain) |
| SSL | Let's Encrypt (auto-renewing HTTPS) |
| Notifications | Slack (post-deploy alerts) |

---

## Architecture

```
Developer → GitHub (main branch)
                ↓ webhook
           Jenkins CI/CD (jenkins-health.duckdns.org:8080)
                ↓
    ┌─────────────────────────────────────┐
    │   Stage 1: Build & Test             │  → Coverage report archived
    │   Stage 2: Docker Build             │  → Backend + Frontend images
    │   Stage 3: Push to ECR             │  → Private registry
    │   Stage 4: Deploy + Log to DB      │  → Containers on EC2
    └─────────────────────────────────────┘
                ↓
         EC2 (t3.small · 20GB EBS)
         ┌──────────────────────────────────┐
         │  Nginx (port 80 → 443 redirect)  │
         │  Nginx (port 443 SSL)            │
         │    ↓ /api/*  → Express :3000     │
         │    ↓ /health → Express :3000     │
         │    ↓ /       → React static      │
         │  Express API (port 3000)         │
         │    ↓                             │
         │  RDS PostgreSQL (private)        │
         └──────────────────────────────────┘
                ↓
    User → https://system-health.duckdns.org
                ↓
    Slack → #deployments notification
```

---

## Repository Structure

```
system-health-dashboard/
├── app/
│   ├── backend/
│   │   ├── index.js              # Express API (5 endpoints)
│   │   ├── Dockerfile            # Multi-stage, non-root user
│   │   ├── .dockerignore
│   │   ├── init.sql              # DB schema
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   └── tests/
│   │       └── health.test.js
│   └── frontend/
│       ├── src/
│       │   ├── App.jsx           # React dashboard
│       │   └── main.jsx
│       ├── index.html
│       ├── Dockerfile            # Multi-stage with Nginx
│       ├── .dockerignore
│       ├── package.json
│       └── package-lock.json
├── nginx/
│   └── nginx.conf                # Reverse proxy + HTTPS + HTTP redirect
├── terraform/
│   ├── main.tf                   # EC2, RDS, ECR, IAM, SG
│   ├── variables.tf
│   ├── outputs.tf
│   ├── backend.tf                # S3 remote state
│   └── terraform.tfvars          # gitignored — secrets
├── Jenkinsfile                   # 4-stage pipeline
├── docker-compose.yml            # Local development
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | App status |
| GET | `/health` | Health check — DB connectivity via `SELECT 1` |
| GET | `/api/metrics` | Runtime metrics (uptime, memory, CPU) |
| GET | `/api/deployments` | Deployment history (last 20 records) |
| POST | `/api/deployments` | Log a deployment record |

---

## CI/CD Pipeline

The Jenkins pipeline triggers automatically on every push to the `main` branch via GitHub webhook.

### Stage 1 — Build & Test
- Runs inside a `node:20-alpine` Docker container
- Executes `npm ci` and `npm test --coverage`
- Publishes HTML coverage report as a build artefact

### Stage 2 — Docker Build
- Authenticates to AWS ECR using EC2 IAM instance profile — no static credentials
- Builds backend image with multi-stage Dockerfile (non-root user `appuser`)
- Builds frontend image with Vite production build + Nginx
- Injects `VITE_API_URL=https://system-health.duckdns.org` as build argument

### Stage 3 — Push to ECR
- Pushes both images tagged with Jenkins build number
- Archives `deploy.env` with image URLs and build number as artefact

### Stage 4 — Deploy
- Pulls latest images from ECR
- Stops and removes existing containers
- Starts backend container with RDS environment variables
- Starts frontend container with SSL certificates mounted from EC2 host
- Waits 10 seconds, logs deployment record to RDS via `docker exec`
- Post-deploy: `curl https://system-health.duckdns.org/health` must return 200
- Post-deploy: Slack notification to `#deployments`

---

## Infrastructure (Terraform)

All AWS resources provisioned via Terraform. No manual console setup.

### Resources created

| Resource | Purpose |
|---|---|
| `aws_ecr_repository` | Private Docker image registry |
| `aws_default_vpc` | Network boundary |
| `aws_security_group` (app-sg) | Ports 22, 80, 443, 3000, 8080 |
| `aws_security_group` (rds-sg) | Port 5432 from app-sg only |
| `aws_db_instance` | PostgreSQL 15, db.t3.micro, not publicly accessible |
| `aws_iam_role` | EC2 role with ECR full access |
| `aws_iam_instance_profile` | Attaches IAM role to EC2 |
| `aws_instance` | t3.small, 20GB gp3, Docker + Jenkins via user_data |

### Remote state
Terraform state stored in versioned S3 bucket — safe, team-accessible, rollback-capable.

### Usage

```bash
cd terraform
terraform init
terraform plan
terraform apply -auto-approve
terraform output
```

**Outputs:**
```
ec2_public_ip = "54.161.207.110"
rds_endpoint  = "health-dashboard-db.c496qquuyrh9.us-east-1.rds.amazonaws.com:5432"
ecr_url       = "811825121504.dkr.ecr.us-east-1.amazonaws.com/system-health-dashboard"
```

---

## Docker

### Backend Dockerfile
- Multi-stage build — deps stage installs production packages, run stage is minimal
- Non-root user `appuser` — security best practice
- CMD exec form — Node receives OS signals as PID 1

### Frontend Dockerfile
- Multi-stage build — Vite build stage + Nginx serve stage
- `VITE_API_URL` injected as build argument — baked into JavaScript bundle
- Final image: zero Node.js, just Nginx + static files

### Local development

```bash
docker-compose up --build
# Dashboard : http://localhost
# Backend   : http://localhost:3000
# Health    : http://localhost/health
```

---

## Nginx Configuration

`nginx/nginx.conf` — committed to repository and versioned with code.

- Port 80 → permanent 301 redirect to HTTPS
- Port 443 → HTTPS with Let's Encrypt certificate
- `/` → serves React static files with SPA fallback
- `/api/*` → proxied to Express :3000
- `/health` → proxied to Express :3000
- TLS 1.2 and 1.3 only

---

## HTTPS Setup

Free SSL certificate from Let's Encrypt. Obtained via Docker to bypass OS compatibility issues:

```bash
docker stop frontend
docker run --rm -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d system-health.duckdns.org \
  --email your@email.com --agree-tos --non-interactive
docker start frontend
```

Auto-renewal cron (3am daily):
```
0 3 * * * docker stop frontend && docker run --rm -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot renew --quiet && docker start frontend
```

---

## Custom Domain

| Subdomain | Purpose |
|---|---|
| `system-health.duckdns.org` | Live application |
| `jenkins-health.duckdns.org:8080` | Jenkins CI/CD |

Both point to `54.161.207.110` via DuckDNS free DNS.

---

## Slack Notifications

Post-deploy alerts sent to `#deployments` via Slack incoming webhook (stored in Jenkins credentials).

```
✅ DEPLOY SUCCESS — Build #22 — https://system-health.duckdns.org
❌ DEPLOY FAILED  — Build #22 — console link
```

---

## Deployment Logging

Every pipeline run inserts a record into RDS:
```sql
INSERT INTO deployments (version, status) VALUES ('v1.0-build-22', 'success');
```

Displayed live in the dashboard's Deployment History card.

---

## Database Schema

```sql
CREATE TABLE deployments (
  id          SERIAL PRIMARY KEY,
  version     VARCHAR(50) NOT NULL,
  status      VARCHAR(20) NOT NULL,
  deployed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE health_logs (
  id         SERIAL PRIMARY KEY,
  status     VARCHAR(20) NOT NULL,
  db_status  VARCHAR(20),
  checked_at TIMESTAMP DEFAULT NOW()
);
```

---

## Local Development Setup

```bash
# Backend
cd app/backend && npm install && npm start

# Frontend
cd app/frontend
echo "VITE_API_URL=http://localhost:3000" > .env
npm install && npm run dev

# Tests
cd app/backend && npm test
```

---

## Rollback Strategy

### Application rollback (under 2 minutes)

```bash
ssh -i ~/.ssh/health-dashboard-key.pem ec2-user@54.161.207.110

docker stop backend && docker rm backend

ECR=811825121504.dkr.ecr.us-east-1.amazonaws.com/system-health-dashboard
BUILD_NUMBER=21   # build to roll back to

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR

docker pull $ECR:$BUILD_NUMBER

docker run -d --name backend \
  -e DB_HOST=health-dashboard-db.c496qquuyrh9.us-east-1.rds.amazonaws.com \
  -e DB_PORT=5432 -e DB_NAME=healthdb \
  -e DB_USER=postgres -e DB_PASSWORD=YOUR_PASSWORD \
  -e PORT=3000 --restart unless-stopped \
  $ECR:$BUILD_NUMBER

curl https://system-health.duckdns.org/health
```

### Database rollback

RDS automated backups with 7-day retention:

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier health-dashboard-db \
  --target-db-instance-identifier health-dashboard-db-restored \
  --restore-time 2026-05-14T10:00:00Z \
  --region us-east-1
```

### Infrastructure rollback

Terraform state is versioned in S3:

```bash
aws s3api list-object-versions \
  --bucket health-dashboard-tfstate-811825121504 \
  --prefix health-dashboard/terraform.tfstate

aws s3api get-object \
  --bucket health-dashboard-tfstate-811825121504 \
  --key health-dashboard/terraform.tfstate \
  --version-id YOUR_VERSION_ID \
  terraform.tfstate
```

---

## Bonus Features

| Bonus | Status |
|---|---|
| Test coverage report archived as build artefact | ✅ |
| Docker image digest archived (`deploy.env`) | ✅ |
| Rollback strategy documented | ✅ |
| Pipeline triggers only on `main` branch | ✅ |
| Health check: `curl /health → 200` after deploy | ✅ |
| Post-deploy Slack notification | ✅ |
| Terraform remote state (S3 with versioning) | ✅ |


---

## Security Notes

- RDS not publicly accessible — reachable only from EC2 via security group
- EC2 uses IAM instance profile — zero static AWS credentials stored anywhere
- Docker containers run as non-root user (`appuser`)
- `.env` files gitignored — secrets in Jenkins credentials store only
- RDS connections use SSL (`rejectUnauthorized: false` for AWS self-signed cert)
- HTTPS enforced — HTTP permanently redirected
- TLS 1.0 and 1.1 disabled
- SSL certificates mounted read-only into Nginx container

---

## Live URLs

| Resource | URL |
|---|---|
| Application | https://system-health.duckdns.org |
| Health check | https://system-health.duckdns.org/health |
| Metrics | https://system-health.duckdns.org/api/metrics |
| Deployments | https://system-health.duckdns.org/api/deployments |
| Jenkins | http://jenkins-health.duckdns.org:8080 |