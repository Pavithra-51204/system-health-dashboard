# System Health Dashboard
> A full-stack DevOps assessment project — CI/CD pipeline, IaC, containerisation, and cloud deployment.

**Live Demo:** https://system-health.duckdns.org
**Jenkins:** http://jenkins-health.duckdns.org:8080

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

---

## Architecture

```
Developer → GitHub (main branch)
                ↓ webhook
           Jenkins CI/CD (on EC2)
                ↓
    ┌─────────────────────────┐
    │   Stage 1: Build & Test │  → Coverage report archived
    │   Stage 2: Docker Build │  → Backend + Frontend images
    │   Stage 3: Push to ECR  │  → Private registry
    │   Stage 4: Deploy       │  → Containers on EC2
    └─────────────────────────┘
                ↓
         EC2 (t3.small)
         ┌────────────────────────────┐
         │  Nginx (port 80)           │
         │    ↓ /api/*  → Express     │
         │    ↓ /health → Express     │
         │    ↓ /       → React       │
         │  Express (port 3000)       │
         │    ↓                       │
         │  RDS PostgreSQL            │
         └────────────────────────────┘
```

---

## Repository Structure

```
system-health-dashboard/
├── app/
│   ├── backend/
│   │   ├── index.js          # Express API
│   │   ├── Dockerfile        # Multi-stage, non-root user
│   │   ├── package.json
│   │   └── tests/
│   │       └── health.test.js
│   └── frontend/
│       ├── src/
│       │   ├── App.jsx       # React dashboard
│       │   └── main.jsx
│       ├── Dockerfile        # Multi-stage with Nginx
│       └── package.json
├── nginx/
│   └── nginx.conf            # Reverse proxy config
├── terraform/
│   ├── main.tf               # EC2, RDS, ECR, IAM, SG
│   ├── variables.tf
│   ├── outputs.tf
│   └── backend.tf            # S3 remote state
├── Jenkinsfile               # 4-stage pipeline
├── docker-compose.yml        # Local development
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | App status |
| GET | `/health` | Health check — DB connectivity |
| GET | `/api/metrics` | Runtime metrics (uptime, memory, CPU) |
| GET | `/api/deployments` | Deployment history |
| POST | `/api/deployments` | Log a deployment record |

---

## CI/CD Pipeline

The Jenkins pipeline is triggered automatically on every push to the `main` branch via GitHub webhook.

### Stage 1 — Build & Test
- Runs inside a `node:20-alpine` Docker container
- Executes `npm ci` and `npm test --coverage`
- Publishes HTML coverage report as a build artefact

### Stage 2 — Docker Build
- Authenticates to AWS ECR using IAM role (no static credentials)
- Builds backend image with multi-stage Dockerfile (non-root user)
- Builds frontend image with Vite production build + Nginx
- Injects `VITE_API_URL` as build argument

### Stage 3 — Push to ECR
- Pushes both images to AWS ECR private registry
- Tags images with Jenkins build number
- Archives `deploy.env` with image digests as build artefact

### Stage 4 — Deploy
- Pulls latest images from ECR
- Stops and removes existing containers
- Starts backend container with RDS environment variables
- Starts frontend container linked to backend
- Post-deploy health check: `curl /health` must return 200

---

## Infrastructure (Terraform)

All AWS resources are provisioned via Terraform. No manual console setup.

### Resources created
- `aws_ecr_repository` — private container registry
- `aws_default_vpc` — default VPC
- `aws_security_group` (app-sg) — ports 22, 80, 3000, 8080
- `aws_security_group` (rds-sg) — port 5432 from app-sg only
- `aws_db_instance` — PostgreSQL 15 on db.t3.micro
- `aws_iam_role` — EC2 role for ECR access
- `aws_iam_instance_profile` — attached to EC2
- `aws_instance` — t3.small with Docker + Jenkins

### Remote state
Terraform state is stored in S3 (not local) — enabling team collaboration and state locking.

### Usage

```bash
cd terraform

# Initialise with S3 backend
terraform init

# Preview changes
terraform plan

# Apply
terraform apply -auto-approve

# Outputs
terraform output
# ec2_public_ip = "54.161.207.110"
# rds_endpoint  = "health-dashboard-db.c496qquuyrh9.us-east-1.rds.amazonaws.com:5432"
# ecr_url       = "811825121504.dkr.ecr.us-east-1.amazonaws.com/system-health-dashboard"
```

---

## Docker

### Backend Dockerfile highlights
- Multi-stage build (deps stage + run stage)
- Runs as non-root user (`appuser`) — security requirement
- Production dependencies only in final image

### Frontend Dockerfile highlights
- Multi-stage build (Vite build stage + Nginx serve stage)
- Accepts `VITE_API_URL` as build argument for environment-specific API URL
- Custom Nginx config for SPA routing + API proxying

### Local development with Docker Compose

```bash
# Start all services locally
docker-compose up --build

# Access
# Frontend: http://localhost
# Backend:  http://localhost:3000
# Health:   http://localhost/health
```

---

## Nginx Configuration

Nginx runs as a reverse proxy on port 80:

- `GET /` → serves React static files
- `GET /api/*` → proxied to Express on port 3000
- `GET /health` → proxied to Express on port 3000

Config file: `nginx/nginx.conf`

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- Docker Desktop
- AWS CLI configured

### Run backend locally

```bash
cd app/backend
cp .env.example .env   # fill in DB credentials
npm install
npm start
```

### Run frontend locally

```bash
cd app/frontend
echo "VITE_API_URL=http://localhost:3000" > .env
npm install
npm run dev
```

### Run tests

```bash
cd app/backend
npm test
# Coverage report generated in coverage/lcov-report/index.html
```

---

## Rollback Strategy

### Immediate rollback (under 2 minutes)

Every successful build pushes a Docker image tagged with the Jenkins build number to ECR. To rollback to any previous build:

**Step 1 — SSH into EC2:**
```bash
ssh -i ~/.ssh/health-dashboard-key.pem ec2-user@54.161.207.110
```

**Step 2 — Stop current container:**
```bash
docker stop backend && docker rm backend
```

**Step 3 — Pull and run previous image (replace BUILD_NUMBER):**
```bash
ECR=811825121504.dkr.ecr.us-east-1.amazonaws.com/system-health-dashboard
BUILD_NUMBER=10   # replace with the build number to roll back to

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR

docker pull $ECR:$BUILD_NUMBER

docker run -d --name backend \
  -e DB_HOST=health-dashboard-db.c496qquuyrh9.us-east-1.rds.amazonaws.com \
  -e DB_PORT=5432 \
  -e DB_NAME=healthdb \
  -e DB_USER=postgres \
  -e DB_PASSWORD=YOUR_PASSWORD \
  -e PORT=3000 \
  --restart unless-stopped \
  $ECR:$BUILD_NUMBER
```

**Step 4 — Verify:**
```bash
curl http://54.161.207.110/health
```

### Database rollback

RDS automated backups are enabled with 7-day retention. To restore:

```bash
# Via AWS CLI — restore to point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier health-dashboard-db \
  --target-db-instance-identifier health-dashboard-db-restored \
  --restore-time 2026-05-14T10:00:00Z \
  --region us-east-1
```

### Infrastructure rollback

Terraform state is versioned in S3. To roll back infrastructure:

```bash
# List previous state versions in S3
aws s3api list-object-versions \
  --bucket health-dashboard-tfstate-811825121504 \
  --prefix health-dashboard/terraform.tfstate

# Restore a previous version by version ID
aws s3api get-object \
  --bucket health-dashboard-tfstate-811825121504 \
  --key health-dashboard/terraform.tfstate \
  --version-id YOUR_VERSION_ID \
  terraform.tfstate
```

---

## Bonus Features Implemented

| Bonus | Status |
|---|---|
| Test coverage report archived as build artefact | ✅ |
| Docker image digest archived (`deploy.env`) | ✅ |
| Rollback strategy documented | ✅ |
| Pipeline triggers only on `main` branch | ✅ |
| Health check after deploy (`curl /health → 200`) | ✅ |
| Terraform remote state (S3) | ✅ |

---

## Security Notes

- RDS is not publicly accessible — only reachable from EC2 via security group
- EC2 uses IAM role for ECR access — no static AWS credentials in pipeline
- Docker containers run as non-root user
- `.env` files are gitignored — secrets managed via Jenkins credentials
- RDS connection uses SSL (`rejectUnauthorized: false` for self-signed cert)

---

