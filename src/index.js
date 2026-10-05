require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const prisma = require('./prisma');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes = require('./routes/orders');

if (!process.env.DATABASE_URL) {
  throw new Error('Не задан DATABASE_URL. Заполните файл .env.');
}

if (process.env.DATABASE_URL.includes('USER:PASSWORD@HOST')) {
  throw new Error('Замените шаблон DATABASE_URL в файле .env на строку подключения PostgreSQL.');
}

if (!process.env.JWT_SECRET) {
  throw new Error('Не задан JWT_SECRET. Заполните файл .env.');
}

if (process.env.JWT_SECRET.includes('замените-на-длинную')) {
  throw new Error('Замените шаблон JWT_SECRET в файле .env на случайную строку.');
}

const app = express();
const projectRoot = path.join(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use((req, res, next) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    req.body = {};
  }
  next();
});

app.get('/api/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'connected' });
});

app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(projectRoot, 'register.html'));
});

app.get(['/style.css', '/script.js', '/auth.js'], (req, res, next) => {
  const fileName = path.basename(req.path);
  res.sendFile(path.join(projectRoot, fileName), (error) => {
    if (error) next(error);
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Такого эндпоинта нет' });
});

app.use((err, req, res, next) => {
  console.error('Ошибка запроса:', err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  res.status(status).json({
    error: status === 400 ? 'Некорректный JSON в запросе' : 'Внутренняя ошибка сервера',
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
