$env:PORT="3000"
$env:BASE_PATH="/"
$env:VITE_API_PROXY_TARGET="http://localhost:4000"
Start-Process pnpm -ArgumentList 'dev' -WindowStyle Hidden
