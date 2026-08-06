# Deploy to craft.rafter.com.cn
# Usage: .\deploy.ps1 -Server user@your-server
param(
    [Parameter(Mandatory = $true)]
    [string]$Server,
    [string]$RemotePath = "/var/www/craft.rafter.com.cn/"
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Uploading to ${Server}:${RemotePath}..."
ssh $Server "mkdir -p $RemotePath"
scp -r dist/* "${Server}:${RemotePath}"

Write-Host "Done. Visit http://craft.rafter.com.cn/"
