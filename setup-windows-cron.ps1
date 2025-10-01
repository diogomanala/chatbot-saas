# Script para configurar processamento automático de mensagens pendentes no Windows
# Este script cria uma tarefa agendada que executa a cada 5 minutos

# Configurações
$TaskName = "SaaS-Chatbot-Billing-Process"
$ScriptPath = "$PSScriptRoot\process-billing-cron.ps1"
$LogPath = "$PSScriptRoot\logs\cron-billing.log"

# Criar diretório de logs se não existir
if (!(Test-Path "$PSScriptRoot\logs")) {
    New-Item -ItemType Directory -Path "$PSScriptRoot\logs" -Force
}

# Verificar se a tarefa já existe
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "Tarefa '$TaskName' já existe. Removendo..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Criar o script de execução do cron
$CronScript = @'
# Script de execução do cron para processamento de billing
$LogFile = "$PSScriptRoot\logs\cron-billing.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    Add-Content -Path $LogFile -Value "[$Timestamp] Iniciando processamento automático..."
    
    # Executar o endpoint de processamento
    $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/process-billing" `
        -Headers @{"x-cron-secret"="billing-cron-secret-2024"} `
        -Method GET `
        -TimeoutSec 30
    
    $Content = $Response.Content | ConvertFrom-Json
    Add-Content -Path $LogFile -Value "[$Timestamp] Sucesso: $($Content.message)"
    Add-Content -Path $LogFile -Value "[$Timestamp] Mensagens processadas: $($Content.data.messagesProcessed)"
    Add-Content -Path $LogFile -Value "[$Timestamp] Créditos cobrados: $($Content.data.creditsCharged)"
    
} catch {
    Add-Content -Path $LogFile -Value "[$Timestamp] Erro: $($_.Exception.Message)"
}
'@

# Salvar o script de execução
Set-Content -Path $ScriptPath -Value $CronScript -Encoding UTF8

# Criar a ação da tarefa
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$ScriptPath`""

# Criar o gatilho (a cada 5 minutos)
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)

# Configurações da tarefa
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Registrar a tarefa
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Processamento automático de mensagens pendentes do SaaS Chatbot"

Write-Host "✅ Tarefa agendada '$TaskName' criada com sucesso!" -ForegroundColor Green
Write-Host "📋 A tarefa executará a cada 5 minutos" -ForegroundColor Cyan
Write-Host "📁 Logs serão salvos em: $LogPath" -ForegroundColor Cyan
Write-Host "" 
Write-Host "Para verificar o status da tarefa:" -ForegroundColor Yellow
Write-Host "Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor White
Write-Host ""
Write-Host "Para ver os logs:" -ForegroundColor Yellow
Write-Host "Get-Content '$LogPath' -Tail 20" -ForegroundColor White
Write-Host ""
Write-Host "Para remover a tarefa:" -ForegroundColor Yellow
Write-Host "Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor White