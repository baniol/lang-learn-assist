# Infrastructure

Cloud infrastructure with Terraform for provider flexibility. Starting with Hetzner for dev.

---

## Quick Start

### 1. Local Development (do this first)
```bash
cd web
docker-compose up -d        # Postgres + backend
# Visit http://localhost:8080/health
```

### 2. Deploy to Cloud (after local works)
```bash
cd web/infra/terraform/environments/dev
terraform init && terraform apply
# Then push to main → GitHub Actions deploys
```

---

## Provider Comparison

### Compute (VPS)

| Provider | Instance | Specs | Monthly | Terraform | Notes |
|----------|----------|-------|---------|-----------|-------|
| **Hetzner** | CX22 | 2 vCPU, 4GB, 40GB | €3.79 | Excellent | Cheapest, EU |
| **Hetzner** | CAX11 (ARM) | 2 vCPU, 4GB, 40GB | €3.79 | Excellent | ARM option |
| DigitalOcean | Basic | 1 vCPU, 512MB, 10GB | $4 | Excellent | Simple DX |
| Scaleway | DEV1-S | 2 vCPU, 2GB, 20GB | ~€4 | Good | EU, pay-as-you-go |
| Fly.io | shared-1x | Shared, 256MB | ~$2 | Limited | No free tier |

### Object Storage (S3-compatible)

| Provider | Base Price | Included | Extra Storage | Extra Egress |
|----------|------------|----------|---------------|--------------|
| **Hetzner** | €4.99/mo | 1TB + 1TB egress | €0.0067/GB-hr | €1/TB |
| DigitalOcean | $5/mo | 250GB + 1TB egress | $0.02/GB | $0.01/GB |
| Scaleway | €0.012/GB/mo | 750GB free (90 days) | €0.012/GB | varies |

### Managed PostgreSQL

| Provider | Smallest | Specs | Monthly |
|----------|----------|-------|---------|
| **Hetzner** | Basic | TBD | €4.90 |
| Scaleway | DB-DEV-S | 2GB RAM, 20GB | €6.99 |
| DigitalOcean | Basic | 1GB RAM, 10GB | $15 |

**Alternative:** Postgres in Docker on VPS (€0 extra, good for dev)

---

## Voice Services

### TTS (Text-to-Speech) - ElevenLabs

For generating phrase audio pronunciation.

| Plan | Price | Credits/month | Notes |
|------|-------|---------------|-------|
| Free | $0 | Limited | Non-commercial only |
| Starter | $5/mo | ~30k chars | Good for dev |
| Creator | $22/mo | More | Production |
| Pro | $99/mo | ~500k chars | High volume |

- 1 character = 1 credit (standard models)
- Turbo models = 0.5 credits/char
- Users select voice in settings

### STT (Speech-to-Text) - AWS Transcribe

For voice recognition in speaking practice mode.

| Tier | Volume | Price/minute |
|------|--------|--------------|
| Tier 1 | 0-250K min | $0.024 |
| Tier 2 | 250K-1M min | $0.015 |
| Tier 3 | 1M-5M min | $0.0102 |

- Free tier: 60 min/month (12 months)
- Billed per second (15 sec minimum)
- Dev usage: effectively free
- **Reference:** See `~/projects/voice-notes-app` for implementation patterns

---

## Current Setup (Dev Starter)

Using Hetzner to start - can switch providers via Terraform modules.

| Component | Provider | Specs | Cost/month |
|-----------|----------|-------|------------|
| VPS | Hetzner CX22 | 2 vCPU, 4GB RAM, 40GB SSD | €3.79 |
| Object Storage | Hetzner | 1TB storage, 1TB egress | €4.99 |
| Database | Docker on VPS | Postgres container | €0 |
| TTS | ElevenLabs | Starter plan | $5 |
| STT | AWS Transcribe | Free tier | $0 |
| **Total** | | | **~€14/mo** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Cloud Provider (Hetzner)                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              VPS (CX22)                              │    │
│  │  ┌─────────────────┐    ┌─────────────────┐         │    │
│  │  │  Backend        │    │  Postgres       │         │    │
│  │  │  (Docker)       │◄──►│  (Docker)       │         │    │
│  │  │  :8080          │    │  :5432          │         │    │
│  │  └─────────────────┘    └─────────────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Object Storage (S3-compatible)          │    │
│  │              - Audio files                           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                ┌─────────────────┐
│  ElevenLabs     │                │  AWS Transcribe │
│  (TTS API)      │                │  (STT API)      │
└─────────────────┘                └─────────────────┘
```

---

## Terraform Structure

```
web/infra/terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   └── prod/
└── modules/
    ├── compute/
    │   ├── hetzner/          # Current
    │   │   ├── main.tf
    │   │   ├── variables.tf
    │   │   └── outputs.tf
    │   ├── digitalocean/     # Alternative
    │   └── scaleway/         # Alternative
    ├── storage/
    │   ├── hetzner/
    │   ├── digitalocean/
    │   └── scaleway/
    └── database/
        ├── docker/           # Self-hosted (current)
        ├── hetzner/          # Managed
        └── scaleway/         # Managed
```

### Switching Providers

```hcl
# environments/dev/main.tf

# Switch compute by changing module source
module "compute" {
  # source = "../../modules/compute/hetzner"      # Current
  source = "../../modules/compute/digitalocean"   # Alternative

  instance_size = var.instance_size
  region        = var.region
}

# Switch storage
module "storage" {
  source = "../../modules/storage/hetzner"
  # source = "../../modules/storage/scaleway"
}
```

---

## Local Development

### Docker Compose

```yaml
# web/docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/langlearn
      - RUST_LOG=debug
      - AUTH_ENABLED=false
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: langlearn
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### Commands

```bash
cd web
docker-compose up -d              # Start
docker-compose logs -f backend    # Logs
docker-compose down -v            # Reset DB

# Run backend outside Docker (faster iteration)
cd backend
DATABASE_URL=postgres://postgres:postgres@localhost:5432/langlearn cargo run
```

---

## CI/CD Pipeline

### CI (on every push)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, web]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-action@stable
      - run: cargo fmt --check
        working-directory: web/backend
      - run: cargo clippy -- -D warnings
        working-directory: web/backend
      - run: cargo test
        working-directory: web/backend
```

### CD (deploy on push to main)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v5
        with:
          context: web/backend
          push: true
          tags: ghcr.io/${{ github.repository }}/backend:latest

      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_IP }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /app
            docker-compose pull
            docker-compose up -d
```

---

## Environment Variables

```bash
# .env.example
DATABASE_URL=postgres://user:pass@localhost:5432/langlearn
RUST_LOG=info

# Object Storage (S3-compatible)
S3_ENDPOINT=https://fsn1.your-objectstorage.com
S3_BUCKET=langlearn-audio
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=fsn1

# TTS - ElevenLabs
ELEVENLABS_API_KEY=...
TTS_PROVIDER=elevenlabs

# STT - AWS Transcribe
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-central-1
STT_PROVIDER=transcribe

# Auth (disabled in dev)
AUTH_ENABLED=false
DEV_USER_ID=00000000-0000-0000-0000-000000000001

# AI Provider
AI_PROVIDER=openai
AI_API_KEY=...
AI_MODEL=gpt-4o-mini
```

---

## Setup Checklist

### Phase 0a: Local Dev (do first)
- [ ] Create `web/backend/` Cargo project
- [ ] Add Axum with `/health` endpoint
- [ ] Create `Dockerfile`
- [ ] Create `docker-compose.yml`
- [ ] Verify `docker-compose up` works
- [ ] `/health` returns OK

### Phase 0b: CI Pipeline
- [ ] Create `.github/workflows/ci.yml`
- [ ] Verify CI runs on push

### Phase 0c: Deployment (after local works)
- [ ] Create Hetzner Cloud account
- [ ] Generate API token
- [ ] Create Object Storage bucket
- [ ] Set up Terraform modules
- [ ] Add GitHub secrets
- [ ] Create `.github/workflows/deploy.yml`
- [ ] First deploy

### GitHub Secrets
```
HCLOUD_TOKEN          # Hetzner API token (or other provider)
SERVER_IP             # VPS IP (after terraform apply)
SSH_PRIVATE_KEY       # For deployment
DB_PASSWORD           # Postgres password
S3_ENDPOINT           # Object Storage endpoint
S3_ACCESS_KEY
S3_SECRET_KEY
ELEVENLABS_API_KEY    # TTS
AWS_ACCESS_KEY_ID     # STT (Transcribe)
AWS_SECRET_ACCESS_KEY
```

---

## Upgrade Path

- **Switch provider**: Change Terraform module source
- **Managed Postgres**: Add managed DB module, update DATABASE_URL
- **More compute**: Upgrade instance size or add load balancer
- **CDN**: Cloudflare in front (free tier)
- **Kubernetes**: k3s if complexity warrants

---

## Sources

- [Hetzner Cloud](https://www.hetzner.com/cloud) - €3.79/mo VPS
- [Hetzner Object Storage](https://www.hetzner.com/storage/object-storage) - €4.99/mo
- [DigitalOcean Pricing](https://www.digitalocean.com/pricing/droplets)
- [Scaleway Pricing](https://www.scaleway.com/en/pricing/)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing/api) - TTS
- [AWS Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/) - STT
