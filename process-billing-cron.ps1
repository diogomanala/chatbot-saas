# Script de execuÃ§Ã£o do cron para processamento de billing
$LogFile = "$PSScriptRoot\logs\cron-billing.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    Add-Content -Path $LogFile -Value "[$Timestamp] Iniciando processamento automÃ¡tico..."
    
    # Executar o endpoint de processamento
    $Response = Invoke-WebRequest -Uri "http://localhost:3000/api/cron/process-billing" `
        -Headers @{"x-cron-secret"="billing-cron-secret-2024"} `
        -Method GET `
        -TimeoutSec 30
    
    $Content = $Response.Content | ConvertFrom-Json
    Add-Content -Path $LogFile -Value "[$Timestamp] Sucesso: $($Content.message)"
    Add-Content -Path $LogFile -Value "[$Timestamp] Mensagens processadas: $($Content.data.messagesProcessed)"
    Add-Content -Path $LogFile -Value "[$Timestamp] CrÃ©ditos cobrados: $($Content.data.creditsCharged)"
    
} catch {
    Add-Content -Path $LogFile -Value "[$Timestamp] Erro: $($_.Exception.Message)"
}
