import dotenv from 'dotenv';
import path from 'path';
import { PROJECT_ROOT } from './paths.js';

// Lê o arquivo de variáveis da RAIZ do projeto, não da pasta de onde o processo foi
// iniciado (pm2/systemd costumam iniciar de outro lugar). Variáveis que o servidor já
// definiu (ecosystem do pm2, painel da hospedagem) têm prioridade sobre o arquivo.
dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });
