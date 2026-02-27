import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { readBotRuntimePhone } from '../shared/botRuntimeState.js';

// Importar rutas
import authRoutes from './routes/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('📲 BotNum desde la config: ',process.env.BOT_NUM)

const app = express();
const PORT =  process.env.WEB_PORT || process.env.PORT || 3002;
const webHost = process.env.WEB_HOST || 'localhost';

app.get('/config', async (req, res) => {
    const runtime = await readBotRuntimePhone();
    const numBot = runtime?.phone || process.env.BOT_NUM || '';

    res.json({
        numBot,
        source: runtime?.source || 'env',
        updatedAt: runtime?.updatedAt || null,
    });
})

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use('/api/auth', authRoutes);

// Ruta principal - redirige al login
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Rutas de páginas
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/consentimiento', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'consentimiento.html'));
});

app.get('/sociodemografico', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sociodemografico.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/tratamientodatos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'tratamientodatos.html'))
})

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);

    // Verificar si la respuesta ya ha sido enviada o si no es un objeto de respuesta Express válido
    if (res.headersSent || typeof res.status !== 'function') {
        console.error('Error después de que la respuesta fue enviada o respuesta inválida');
        return next(err);
    }

    res.status(500).json({ error: 'Algo salió mal!' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🌐 Servidor web corriendo en http://${webHost}:${PORT}`);
});

export default app;
