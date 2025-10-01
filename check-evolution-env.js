require('dotenv').config();

console.log('EVOLUTION_API_URL:', process.env.EVOLUTION_API_URL);
console.log('EVOLUTION_API_KEY:', process.env.EVOLUTION_API_KEY ? 'SET' : 'NOT SET');
console.log('Construindo URL de teste...');

const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77';
const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`;

console.log('URL construída:', url);
console.log('URL válida?', url.startsWith('http'));

// Verificar se há caracteres especiais na URL
console.log('Caracteres especiais na URL:', /[^\w\-\.\/\:\?&=]/.test(url));
console.log('URL length:', url.length);