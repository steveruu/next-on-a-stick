# next.js on docker (read‑only filesystem guide)

this repo shows one way to deploy a next.js app on docker when the image filesystem is read‑only. the trick is to run the app from a writable directory (`/data`) and keep the image itself immutable.

## why read‑only matters

- **next.js writes at runtime**: `.next` (build id, cache, isr) needs writes
- **databases need storage**: sqlite file, prisma migrations
- **immutable images are safer**: fewer surprises; persistent data lives in a volume

## dockerfile ❓

the dockerfile uses a 3‑stage build to keep the final image small and secure:

1. **deps** (install dependencies)
   - picks your package manager based on the lockfile
   - installs production deps in a clean layer

2. **builder** (compile app)
   - copies source
   - runs `npx prisma generate` (so prisma client matches your schema)
   - builds next.js with `output: "standalone"` so the server can run without the whole repo

3. **runner** (minimal runtime)
   - creates a non‑root user `nextjs`
   - prepares a writable directory `/data/.next`
   - copies built bits:
     - `/.next/standalone` → `/app/standalone` (server code)
     - `/.next` → `/app/next_build` (full build artifacts)
     - `/node_modules` → `/app/node_modules` (fallback if standalone misses anything)
   - sets runtime envs `PORT=8080`, `HOSTNAME=0.0.0.0`, and a default `DATABASE_URL=file:/data/database.db`
   - switches to user `nextjs`, sets `WORKDIR /data`, and delegates startup to the entrypoint

the container exposes port `8080` and starts with `node server.js` (after the entrypoint finishes preparing files in `/data`).

## entrypoint ❓

the script `docker-entrypoint.sh` makes sure everything the app needs is in a writable place:

1. creates `/data/.next` (writable)
2. on first run (no `/data/server.js` yet):
   - copies the standalone app from `/app/standalone` to `/data`
   - copies `public/` and `prisma/` so they’re available at runtime
   - if needed, copies the full `/app/node_modules` into `/data` (standalone fallback, prisma binaries, etc.)
3. syncs build artifacts: copies `/app/next_build` → `/data/.next` if newer or missing
4. checks required files exist: `server.js` and `.next/BUILD_ID`
5. finally `exec`s the container command (`node server.js`), inheriting signals properly

result: the app actually runs from `/data` (a volume), while the image stays read‑only.

## deploy: build and run

build the image:

```bash
docker build -t nextjs-rofs .
```

run it (ephemeral data):

```bash
docker run --rm \
  -p 8080:8080 \
  -e DATABASE_URL="file:/data/database.db" \
  nextjs-rofs
```

run it with persistent data volume:

bash/zsh:

```bash
mkdir -p ./data
docker run --rm \
  -p 8080:8080 \
  -e DATABASE_URL="file:/data/database.db" \
  -v "$(pwd)/data:/data" \
  nextjs-rofs
```

windows powershell:

```powershell
mkdir data -ea 0
docker run --rm `
  -p 8080:8080 `
  -e DATABASE_URL="file:/data/database.db" `
  -v "${pwd}/data:/data" `
  nextjs-rofs
```

open `http://localhost:8080`.

## environment

- `DATABASE_URL` → use `file:/data/database.db` for sqlite stored in the mounted `/data` volume
- `PORT` → defaults to `8080` in the image

set envs with `-e VAR=value` on `docker run` or via your orchestrator.

## prisma and migrations (optional)

the entrypoint includes a commented example to run prisma at startup. if you want automatic schema sync:

1. uncomment the lines in `docker-entrypoint.sh` that run `prisma db push`
2. ensure `node_modules/.bin/prisma` is available in `/data` (the script already copies required prisma bits if needed)

for manual runs:

```bash
docker exec -it <container-id> sh -lc "./node_modules/.bin/prisma db push"
```

## troubleshooting

- **cannot find module 'next'**
  - the entrypoint copies full `node_modules` into `/data` if the standalone bundle is missing something

- **read‑only file system**
  - the app runs from `/data`. don’t override the entrypoint; mount a volume to `/data` if you need persistence

- **404 on routes**
  - ensure `.next` artifacts are present under `/data/.next` (the entrypoint copies from `/app/next_build`)

## todo

- this project still NEEDS to be TESTED properly and thoroughly
- check node_modules copying
- prisma migrations are basically untested

## notes

- the image uses a non‑root user and a writable volume to keep runtime safe and predictable
- next.js standalone output plus a tiny entrypoint is a good fit for immutable images
