# PaginaAuto - Inyector de errores de prueba
# Envia errores directamente al backend Node y verifica que se persistan.

$ErrorActionPreference = 'Continue'
$api = 'http://localhost:4000'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' PAGINAAUTO - Inyector de errores de prueba' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

# 1) Health check
Write-Host '[1/3] Comprobando backend...' -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod -Uri "$api/health" -TimeoutSec 3
    Write-Host ('       Backend OK. MySQL=' + $h.db) -ForegroundColor Green
    if (-not $h.db) {
        Write-Host '       [!] MySQL no responde. Asegura WAMP encendido y corre migrar-db.bat' -ForegroundColor Red
        Read-Host 'Pulsa ENTER para salir'
        exit 1
    }
} catch {
    Write-Host '       [X] Backend no responde en :4000.' -ForegroundColor Red
    Write-Host '       Lanza vigilancia.bat primero y vuelve a probar.' -ForegroundColor Red
    Read-Host 'Pulsa ENTER para salir'
    exit 1
}

# 2) Conteo previo
$beforeCount = 0
try {
    $rows = Invoke-RestMethod -Uri "$api/previews" -TimeoutSec 5
    $beforeCount = @($rows).Count
} catch {}
Write-Host ('       Errores en BD antes: ' + $beforeCount) -ForegroundColor Gray

# 3) Definir muestras
$samples = @(
    @{ label='Vercel - timeout funcion';       body=@{ source='js'; message='FUNCTION_INVOCATION_TIMEOUT - la funcion /api/checkout supero los 10s'; file='api/checkout.ts'; line=42; stack='at handler (api/checkout.ts:42:10)'; extra=@{ app='shop-prueba'; page='https://shop-prueba.vercel.app/checkout'; deployer='vercel' } } }
    @{ label='Heroku - H12 timeout';           body=@{ source='js'; message='H12 Request timeout - service responded after 30s'; file='dyno/web.1'; line=0; extra=@{ app='api-legacy'; page='https://api-legacy.herokuapp.com/users'; deployer='heroku' } } }
    @{ label='Heroku - H10 app crashed';       body=@{ source='js'; message='H10 App crashed - process exited with code 1'; file='dyno/web.1'; line=0; extra=@{ app='api-legacy'; page='https://api-legacy.herokuapp.com/'; deployer='heroku' } } }
    @{ label='Cloudflare - 1101 worker';       body=@{ source='js'; message='Error 1101: Worker threw exception while handling request'; file='worker.js'; line=15; extra=@{ app='edge-cache'; page='https://edge-cache.pages.dev/api/get'; deployer='cloudflare' } } }
    @{ label='Cloudflare - 522 timeout origin';body=@{ source='js'; message='Error 522: Connection timed out (origin not responding)'; file=''; line=0; extra=@{ app='proxy-test'; page='https://proxy-test.workers.dev/'; deployer='cloudflare' } } }
    @{ label='Netlify - build failed';         body=@{ source='js'; message='Build failed: command exited with code 2'; file='netlify.toml'; line=0; extra=@{ app='static-site'; page='https://static-site.netlify.app/'; deployer='netlify' } } }
    @{ label='GitHub Pages - build failed';    body=@{ source='js'; message='Page build failed: invalid jekyll configuration'; file='_config.yml'; line=8; extra=@{ app='blog'; page='https://usuario.github.io/blog/'; deployer='github' } } }
    @{ label='Firebase - function timeout';    body=@{ source='js'; message='Function execution took 60001 ms, response timeout'; file='functions/index.js'; line=120; extra=@{ app='firebase-app'; page='https://firebase-app.web.app/'; deployer='firebase' } } }
    @{ label='Render - servicio unhealthy';    body=@{ source='js'; message='Health check failed: service unhealthy on /healthz'; file='server.js'; line=0; extra=@{ app='render-svc'; page='https://render-svc.onrender.com/'; deployer='render' } } }
    @{ label='GA - bloqueado por adblocker';   body=@{ source='js'; message='analytics blocked: net::ERR_BLOCKED_BY_CLIENT'; file='analytics.js'; line=1; extra=@{ app='shop'; page='https://shop.example.com/'; deployer='google-analytics' } } }
)

Write-Host ''
Write-Host ('[2/3] Inyectando ' + $samples.Count + ' errores...') -ForegroundColor Yellow
Write-Host ''

$ok = 0
$fail = 0
$results = @()

foreach ($s in $samples) {
    $json = $s.body | ConvertTo-Json -Depth 8 -Compress
    try {
        $resp = Invoke-RestMethod -Uri "$api/report" -Method Post -ContentType 'application/json' -Body $json -TimeoutSec 5
        $dep = if ($resp.deployer) { $resp.deployer } else { '-' }
        $cod = if ($resp.catalog_code) { $resp.catalog_code } else { '-' }
        $line = '  [OK] {0,-32} id={1}  deployer={2,-18} code={3}' -f $s.label, $resp.preview_id, $dep, $cod
        Write-Host $line -ForegroundColor Green
        $ok++
        $results += [PSCustomObject]@{ label=$s.label; ok=$true; deployer=$resp.deployer; code=$resp.catalog_code; id=$resp.preview_id }
    } catch {
        Write-Host ('  [X]  ' + $s.label + ' -> ' + $_.Exception.Message) -ForegroundColor Red
        $fail++
        $results += [PSCustomObject]@{ label=$s.label; ok=$false; error=$_.Exception.Message }
    }
    Start-Sleep -Milliseconds 200
}

# 4) Verificar persistencia
Start-Sleep -Milliseconds 500
$afterCount = 0
$matchedDeployers = 0
$matchedCodes = 0
try {
    $rows = Invoke-RestMethod -Uri "$api/previews" -TimeoutSec 5
    $afterCount = @($rows).Count
    $matchedDeployers = @($rows | Where-Object { $_.deployer }).Count
    $matchedCodes = @($rows | Where-Object { $_.catalog_code }).Count
} catch {}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' RESULTADO FINAL' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ('  Enviados al backend:     ' + $ok + ' OK  /  ' + $fail + ' fallaron') -ForegroundColor White
Write-Host ('  Errores en BD antes:     ' + $beforeCount) -ForegroundColor Gray
Write-Host ('  Errores en BD ahora:     ' + $afterCount + '  (delta: +' + ($afterCount - $beforeCount) + ')') -ForegroundColor Gray
Write-Host ('  Con plataforma detectada: ' + $matchedDeployers + ' / ' + $afterCount) -ForegroundColor Gray
Write-Host ('  Con codigo de catalogo:   ' + $matchedCodes + ' / ' + $afterCount) -ForegroundColor Gray
Write-Host ''

if ($fail -eq 0 -and ($afterCount - $beforeCount) -ge $ok) {
    Write-Host '  [TODO OK] Los errores se persistieron correctamente.' -ForegroundColor Green
    Write-Host '  Abre http://localhost:4000/panel para verlos.' -ForegroundColor Green
} elseif (($afterCount - $beforeCount) -lt $ok) {
    Write-Host '  [ATENCION] Algunos errores no se persistieron en BD.' -ForegroundColor Yellow
    Write-Host '  Revisa la ventana del backend Node por errores SQL.' -ForegroundColor Yellow
} else {
    Write-Host '  [FALLOS] Algunas peticiones POST fallaron.' -ForegroundColor Red
}
Write-Host ''
Read-Host 'Pulsa ENTER para cerrar'
