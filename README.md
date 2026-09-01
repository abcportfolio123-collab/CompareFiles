# DiffChecker Convert Server

This is a small backend that converts Word/PowerPoint/Excel files to PDF
using LibreOffice. The DiffChecker HTML tool calls it to enable true
highlighted comparison **across different file types** (e.g. Word vs
PowerPoint) — both files get converted to PDF here, then compared with
real position-accurate highlighting.

You only need this if you want cross-format comparison. Same-format
comparison (Word vs Word, PDF vs PDF, etc.) already works without this
server, entirely in the browser.

## Deploying to Render (free tier)

1. Put these files in a GitHub repo (or a new one): `server.js`,
   `package.json`, `Dockerfile`, `.dockerignore`.
2. On Render: **New +** → **Web Service** → connect that repo.
3. Render should auto-detect the `Dockerfile`. If asked, set:
   - **Environment**: Docker
   - **Instance type**: Free
   - Leave the build/start commands blank (the Dockerfile handles both).
4. Deploy. The first build will take a few minutes (installing
   LibreOffice). Render will give you a URL like
   `https://your-service.onrender.com`.
5. Open the DiffChecker HTML file, click **Conversion server settings**
   at the bottom of the comparison screen, paste that URL in, and click
   **Save**, then **Test** to confirm it's reachable.

## Notes on the free tier

- **512MB RAM**: a single conversion uses roughly 150–250MB. The server
  processes one conversion at a time (queued) specifically so it never
  tries to run two LibreOffice instances at once and risk an
  out-of-memory crash. If several people compare files at the same
  moment, later requests simply wait their turn rather than failing.
- **Spin-down**: Render's free web services sleep after a period of no
  traffic, and the next request wakes it back up (can take 30–60
  seconds for that first request). This is normal Render free-tier
  behavior, not a bug in this server.
- **File size limit**: capped at 25MB per file in `server.js`
  (`limits.fileSize`) — adjust if you need larger files, but keep the
  512MB ceiling in mind.

## Endpoints

- `GET /health` — returns `{ok:true}` if the server is up.
- `POST /convert` — multipart form upload, field name `file`. Accepts
  `.docx .pptx .xlsx .xls .doc .ppt`. Returns the converted file as
  `application/pdf`.

## Running locally to test before deploying

Requires Node.js and LibreOffice (`soffice`) installed locally.

```
npm install
node server.js
```

Then test it:
```
curl -X POST -F "file=@yourfile.docx" http://localhost:3000/convert -o out.pdf
```
