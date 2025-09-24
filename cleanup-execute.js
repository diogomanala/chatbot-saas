const fs = require('fs');
const path = require('path');
const { REMOVABLE_PATTERNS, ESSENTIAL_FILES } = require('./cleanup-analysis.js');

function removeUnnecessaryFiles() {
  console.log('🧹 Iniciando limpeza do projeto...');
  
  const projectRoot = process.cwd();
  const allFiles = fs.readdirSync(projectRoot);
  
  let removedCount = 0;
  let totalSizeRemoved = 0;
  const removedItems = [];
  
  // Remover arquivos
  allFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      // Verificar se o arquivo está na lista de removíveis
      let shouldRemove = false;
      let category = '';
      
      Object.keys(REMOVABLE_PATTERNS).forEach(cat => {
        if (REMOVABLE_PATTERNS[cat].includes(file)) {
          shouldRemove = true;
          category = cat;
        }
      });
      
      // Verificar se NÃO é um arquivo essencial
      if (shouldRemove && !ESSENTIAL_FILES.includes(file)) {
        try {
          fs.unlinkSync(filePath);
          removedItems.push({ name: file, size: stats.size, type: 'file', category });
          totalSizeRemoved += stats.size;
          removedCount++;
          console.log(`🗑️  Removido: ${file} (${formatBytes(stats.size)})`);
        } catch (error) {
          console.error(`❌ Erro ao remover ${file}:`, error.message);
        }
      }
    } else if (stats.isDirectory()) {
      // Remover pastas removíveis
      if (REMOVABLE_PATTERNS.removable_folders.includes(file)) {
        try {
          const folderSize = getFolderSize(filePath);
          fs.rmSync(filePath, { recursive: true, force: true });
          removedItems.push({ name: file, size: folderSize, type: 'folder', category: 'removable_folders' });
          totalSizeRemoved += folderSize;
          removedCount++;
          console.log(`🗑️  Removida pasta: ${file} (${formatBytes(folderSize)})`);
        } catch (error) {
          console.error(`❌ Erro ao remover pasta ${file}:`, error.message);
        }
      }
    }
  });
  
  // Relatório final
  console.log('\n✅ LIMPEZA CONCLUÍDA!');
  console.log('=' .repeat(50));
  console.log(`Total de itens removidos: ${removedCount}`);
  console.log(`Espaço liberado: ${formatBytes(totalSizeRemoved)}`);
  
  // Agrupar por categoria
  const categorySummary = {};
  removedItems.forEach(item => {
    if (!categorySummary[item.category]) {
      categorySummary[item.category] = { count: 0, size: 0 };
    }
    categorySummary[item.category].count++;
    categorySummary[item.category].size += item.size;
  });
  
  console.log('\n📊 RESUMO POR CATEGORIA:');
  Object.keys(categorySummary).forEach(category => {
    const summary = categorySummary[category];
    console.log(`  ${category.toUpperCase().replace('_', ' ')}: ${summary.count} itens (${formatBytes(summary.size)})`);
  });
  
  // Verificar arquivos restantes
  console.log('\n📁 ARQUIVOS RESTANTES NO PROJETO:');
  const remainingFiles = fs.readdirSync(projectRoot);
  remainingFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const stats = fs.statSync(filePath);
    const type = stats.isDirectory() ? '[DIR]' : '[FILE]';
    console.log(`  ${type} ${file}`);
  });
  
  return {
    removedCount,
    totalSizeRemoved,
    removedItems,
    remainingFiles: remainingFiles.length
  };
}

function getFolderSize(folderPath) {
  let size = 0;
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getFolderSize(filePath);
      } else {
        size += stats.size;
      }
    });
  } catch (error) {
    console.warn(`Erro ao calcular tamanho da pasta ${folderPath}:`, error.message);
  }
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

if (require.main === module) {
  // Confirmar antes de executar
  console.log('⚠️  ATENÇÃO: Este script irá remover permanentemente arquivos do projeto!');
  console.log('Pressione Ctrl+C para cancelar ou Enter para continuar...');
  
  process.stdin.once('data', () => {
    removeUnnecessaryFiles();
  });
}

module.exports = { removeUnnecessaryFiles };