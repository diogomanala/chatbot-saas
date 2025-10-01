require('dotenv').config();

const url = process.env.EVOLUTION_API_URL;
console.log('EVOLUTION_API_URL:', JSON.stringify(url));
console.log('Comprimento:', url?.length);
console.log('Caracteres especiais:');

for (let i = 0; i < (url?.length || 0); i++) {
  const char = url[i];
  const code = char.charCodeAt(0);
  if (code < 32 || code > 126) {
    console.log(`Posição ${i}: '${char}' (código: ${code})`);
  }
}

console.log('URL construída:', `${url}/message/sendText/test`);

// Verificar se há aspas no meio
if (url && url.includes('"')) {
  console.log('⚠️ PROBLEMA: URL contém aspas!');
  console.log('Posições das aspas:');
  for (let i = 0; i < url.length; i++) {
    if (url[i] === '"') {
      console.log(`Aspas na posição ${i}`);
    }
  }
}