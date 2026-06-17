$env:PORT="4000"
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/devops_observatory"
$env:OBSERVATORY_DEMO_MODE="true"
Start-Process node -ArgumentList "--enable-source-maps `"artifacts/api-server/dist/index.mjs`"" -WindowStyle Hidden
