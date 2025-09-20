# next.js task manager — docker how‑to

this is a small next.js + prisma + sqlite app. this guide shows you how to run it with docker and how to work on it locally. everything here is written as simple, step‑by‑step instructions.

## what you’ll need
- **docker** installed
- **git** to clone the repo
- **node 20+** only if you want to run it locally (not needed for docker)

## quick start (docker)
1) clone the repo
```bash
git clone <your-repo-url>
cd dockertest
```

2) build the image
```bash
docker build -t task-manager-app .
```

3) run the container
```bash
docker run --rm \
  -p 8080:8080 \
  -e DATABASE_URL="file:/data/database.db" \
  task-manager-app
```

4) open the app
- go to `http://localhost:8080`

optional (persist data across runs):
```bash
mkdir -p ./data
docker run --rm \
  -p 8080:8080 \
  -e DATABASE_URL="file:/data/database.db" \
  -v "${PWD}/data:/data" \
  task-manager-app
```

## quick start (local dev)
use this if you want to edit code without docker.

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

app will start on `http://localhost:3000`.

## environment variables
- **DATABASE_URL**: for docker use `file:/data/database.db`

you can set envs with `-e VAR=value` on `docker run`, or with a `.env` file if your platform supports it.

## how the docker image works (in plain words)
- **multi‑stage build** keeps the runtime image small and secure
  - `deps`: installs production dependencies
  - `builder`: copies source, builds next.js (standalone output), generates prisma client
  - `runner`: contains only what’s needed to run
- **entrypoint** prepares a writable place at `/data` (because container filesystems are read‑only by default), then:
  - copies the built app to `/data`
  - copies `.next` artifacts to `/data/.next`
  - copies full `node_modules` so everything resolves correctly
  - starts the server with `node server.js`

## common docker commands
```bash
# build
docker build -t task-manager-app .

# run (ephemeral)
docker run --rm -p 8080:8080 -e DATABASE_URL="file:/data/database.db" task-manager-app

# run with persistent data
mkdir -p ./data
docker run --rm -p 8080:8080 -e DATABASE_URL="file:/data/database.db" -v "${PWD}/data:/data" task-manager-app

# tail logs
docker logs <container-id>
```

## troubleshooting
- **"cannot find module 'next'"**
  - use the provided docker image/entrypoint; it copies full `node_modules` into `/data` so runtime has everything it needs

- **"read‑only file system"**
  - the app runs from `/data`, which is writable; make sure you’re not overriding the entrypoint and that `/data` exists (use `-v ${PWD}/data:/data` if you want persistence)

- **"404 on routes"**
  - ensure `.next` build artifacts are copied into `/data/.next` (the default entrypoint does this for you)

## project layout (what matters)
```
dockertest/
├── app/                   # next.js (app router)
│   ├── lib/
│   │   └── db.ts         # prisma client
│   └── page.tsx          # main page
├── prisma/
│   └── schema.prisma     # database schema
├── Dockerfile            # multi‑stage build
├── docker-entrypoint.sh  # startup script (handles writable /data)
├── next.config.ts        # next.js config (standalone output)
└── package.json
```

## tips
- prefer the docker workflow in production; it’s preconfigured for a read‑only filesystem and persistent volumes
- for local hacking, run `npm run dev` and iterate fast

that’s it — you’re ready to build and ship.