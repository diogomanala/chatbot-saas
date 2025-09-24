const fs = require('fs');
const path = require('path');

console.log('🔧 CORRIGINDO VARIÁVEIS DE AMBIENTE EM TODOS OS SCRIPTS...\n');

// Lista de arquivos para corrigir
const scriptsToFix = [
    'check-instance-status.js',
    'check-webhook-config.js', 
    'set-webhook-local.js',
    'set-webhook-production.js'
];

// Mapeamento de correções
const corrections = {
    'EVOLUTION_URL': 'EVOLUTION_API_URL',
    'EVOLUTION_KEY': 'EVOLUTION_API_KEY'
};

scriptsToFix.forEach(scriptName => {
    const scriptPath = path.join(__dirname, scriptName);
    
    if (fs.existsSync(scriptPath)) {
        console.log(`📝 Corrigindo ${scriptName}...`);
        
        let content = fs.readFileSync(scriptPath, 'utf8');
        let modified = false;
        
        // Aplicar correções
        Object.keys(corrections).forEach(oldVar => {
            const newVar = corrections[oldVar];
            const regex = new RegExp(`process\\.env\\.${oldVar}`, 'g');
            
            if (content.includes(`process.env.${oldVar}`)) {
                content = content.replace(regex, `process.env.${newVar}`);
                modified = true;
                console.log(`  ✅ ${oldVar} → ${newVar}`);
            }
        });
        
        if (modified) {
            fs.writeFileSync(scriptPath, content);
            console.log(`  💾 ${scriptName} atualizado!\n`);
        } else {
            console.log(`  ℹ️  ${scriptName} já está correto\n`);
        }
    } else {
        console.log(`  ⚠️  ${scriptName} não encontrado\n`);
    }
});

console.log('✅ Correção concluída!');