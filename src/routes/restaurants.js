const express = require('express');
const QRCode = require('qrcode');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/mine', requireAuth, requireRole('RESTAURANT_ADMIN'), async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { ownerId: req.user.id },
    include: { dishes: true },
  });
  if (!restaurant) {
    return res.status(404).json({ error: 'У вашего аккаунта пока нет ресторана' });
  }
  res.json(restaurant);
});

router.get('/', async (req, res) => {
  const restaurants = await prisma.restaurant.findMany({
    include: {
      dishes: { include: { winePairings: true, origins: true } },
      timeline: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
    },
  });
  res.json(restaurants);
});

router.get('/:id/qr.svg', async (req, res) => {
  const restaurantId = Number(req.params.id);
  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор ресторана' });
  }
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true },
  });
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const url = new URL('/index.html', `${req.protocol}://${req.get('host')}`);
  url.searchParams.set('restaurant', String(restaurantId));
  const svg = await QRCode.toString(url.toString(), {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 240,
  });
  res.type('image/svg+xml').send(svg);
});

// Один ресторан с меню (для страницы ресторана)
router.get('/:id', async (req, res) => {
  const restaurantId = Number(req.params.id);
  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор ресторана' });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      dishes: { include: { winePairings: true, origins: true } },
      timeline: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
    },
  });

  if (!restaurant) {
    return res.status(404).json({ error: 'Ресторан не найден' });
  }
  res.json(restaurant);
});

router.post('/:id/dishes', requireAuth, requireRole('RESTAURANT_ADMIN'), async (req, res) => {
  const restaurantId = Number(req.params.id);
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const price = Number(req.body.price);

  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор ресторана' });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant || restaurant.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Это не ваш ресторан' });
  }

  if (!name || !Number.isSafeInteger(price) || price < 1 || price > 2147483647) {
    return res.status(400).json({ error: 'Укажите название блюда и цену больше нуля' });
  }

  const image = typeof req.body.image === 'string' && req.body.image.trim()
    ? req.body.image.trim()
    : null;
  const dish = await prisma.dish.create({
    data: { name, price, image, restaurantId },
  });

  res.status(201).json(dish);
});

module.exports = router;
