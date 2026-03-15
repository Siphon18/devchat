# DevChat on Render + Neon + Cloudflare Pages

## Architecture

- Backend: Render web service from [backend/Dockerfile](/d:/Project/backend/Dockerfile)
- Database: Neon PostgreSQL
- Frontend: Cloudflare Pages from [frontend/devchat-frontend](/d:/Project/frontend/devchat-frontend)

## Repo changes for Render

- [backend/entrypoint.sh](/d:/Project/backend/entrypoint.sh) now respects Render's `PORT` env var
- [render.yaml](/d:/Project/render.yaml) defines the backend service and env vars

## Render backend setup

1. Push this repo to GitHub.
2. In Render, create a new `Blueprint` from the repo, or create a Docker `Web Service`.
3. If using the Blueprint, Render will read [render.yaml](/d:/Project/render.yaml).
4. Set these required env vars:
   - `DATABASE_URL`
   - `FRONTEND_URL`
5. Optional env vars for OAuth:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

Use your Neon pooled connection string for `DATABASE_URL`.

## Cloudflare Pages frontend

Create a Pages project for [frontend/devchat-frontend](/d:/Project/frontend/devchat-frontend) with:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://your-render-service.onrender.com`

## Notes

- Render free services may sleep; paid plans are better for chat + WebSockets.
- Uploads still use local disk in the backend, so they are not durable across restarts.
- For production durability, move uploads to R2 or another object store.
