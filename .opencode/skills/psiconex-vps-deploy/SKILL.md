---
name: psiconex-vps-deploy
description: Deploy Psiconex to the production VPS. Use ONLY when the user explicitly asks to deploy, publish, update, or change the VPS/production environment.
---

# Psiconex VPS Deployment

## Production Access

- SSH alias: `psiconex-vps` (`root@72.60.59.142`)
- Repository checkout: `/srv/psiconex-docker/current`
- Git mirror: `/srv/psiconex-docker/repository.git`
- Local Git remote: `vps` (`ssh://psiconex-vps/srv/psiconex-docker/repository.git`)
- Compose file: `docker-compose.prod.yml`
- Production environment file: `/srv/psiconex-docker/shared/.env`, linked as `current/.env`
- Local production environment source: `.env.production`

Never print, commit, copy into source files, or expose values from either
environment file. Never delete Docker volumes or databases.

## Deployment Policy

Deploy only when the user explicitly requests it. A normal implementation,
review, investigation, or local test must not publish changes automatically.

Before deployment, inspect `git status`, `git diff`, and recent commits. Stage
only files required by the requested task. Do not stage unrelated existing work
or use destructive Git commands to clean the worktree.

## Required Workflow

1. Run the relevant local tests or build checks. Report blockers before
   deploying if they are caused by the requested change.
2. Commit the intended files, push the commit to `origin/main`, then push the
   same commit to `vps/main`.
3. Compare the SHA-256 hashes of local `.env.production` and the shared VPS
   `.env`. If they differ, atomically replace the VPS file with the local
   source using mode `600`. Do not use `rsync --delete` for environment files.
4. Over SSH, confirm the VPS checkout is on `main`, clean, and can fast-forward.
   Its `origin` is the VPS Git mirror; update it with
   `git pull --ff-only origin main`.
5. Validate production Compose with
   `docker compose -p psiconex -f docker-compose.prod.yml config --quiet`.
6. Deploy with
   `docker compose -p psiconex -f docker-compose.prod.yml up -d --build --remove-orphans`.
   The backend startup command applies migrations and collects static files.
7. Reload Caddy after the Compose update with
   `docker compose -p psiconex -f docker-compose.prod.yml exec -T app_gateway caddy reload --config /etc/caddy/Caddyfile`.
8. Verify the deployed Git SHA matches the pushed commit, inspect
   `docker compose -p psiconex -f docker-compose.prod.yml ps`, request the local gateway,
   and review recent backend, frontend, and Celery logs for failures.

## Safety Checks

- Stop if the VPS checkout has uncommitted changes, points to another branch,
  or cannot fast-forward. Report the state instead of overwriting it.
- Stop if `.env.production` is missing when an environment update is needed.
- Stop before any destructive or irreversible database operation. Schema
  migrations are allowed only through the normal backend startup process.
- The initial migration backup is stored at
  `/srv/psiconex-docker/backups/bootstrap-20260814-114712`.
- If a deployment fails, preserve diagnostic output and ask before rolling back.
  A rollback may not reverse applied database migrations.
