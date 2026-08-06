# Remote deploy via git (run from your PC after git push)
# Usage: .\deploy.ps1 [-Server admin@47.82.233.199]
param(
    [string]$Server = "admin@47.82.233.199",
    [string]$RepoDir = "~/craft"
)

$ErrorActionPreference = "Stop"

Write-Host "Deploying on $Server via git pull + build..."
ssh $Server "cd $RepoDir && git pull origin main && bash deploy/deploy.sh"

Write-Host "Done. Visit http://craft.rafter.com.cn/"
