const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const VIDEO_URL_PATTERN = /^https:\/\/(www\.)?(youtube\.com\/watch\?v=[\w-]{11}|youtu\.be\/[\w-]{11}|vimeo\.com\/\d+)$/;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const DAY_PERIODS = ['morning', 'afternoon', 'evening', 'night'];

router.use(requireAuth, requireRole('RESTAURANT_ADMIN'));

async function getOwnedRestaurant(userId) {
  return prisma.restaurant.findUnique({ where: { ownerId: userId } });
}

function isValidVideoUrl(value) {
  return value == null || value === '' || (typeof value === 'string' && VIDEO_URL_PATTERN.test(value));
}

function validTranslations(value) {
  if (value == null) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([language, translation]) =>
    ['ru', 'kk', 'en'].includes(language) &&
    translation &&
    typeof translation === 'object' &&
    !Array.isArray(translation) &&
    Object.values(translation).every((text) => typeof text === 'string')
  );
}

function reportValidationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ errors: errors.array() });
  return true;
}

router.get('/', async (req, res) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { ownerId: req.user.id },
    include: {
      dishes: { include: { winePairings: true, origins: true }, orderBy: { id: 'asc' } },
      tables: { orderBy: { name: 'asc' } },
      timeline: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      _count: { select: { orders: true, reservations: true, dishes: true } },
    },
  });
  if (!restaurant) return res.status(404).json({ error: 'У аккаунта нет ресторана для управления' });
  res.json(restaurant);
});

router.patch('/restaurant', [
  body('name').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('cuisine').optional().isString().trim().isLength({ min: 1, max: 120 }),
  body('country').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 3000 }),
  body('chefName').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
], async (req, res) => {
  if (reportValidationErrors(req, res)) return;
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const { name, cuisine, country, description, chefName, chefVideoUrl, translations } = req.body;
  if (!isValidVideoUrl(chefVideoUrl) || !validTranslations(translations)) {
    return res.status(400).json({ error: 'Проверьте ссылку на видео и переводы (ru, kk, en)' });
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(cuisine !== undefined ? { cuisine: cuisine.trim() } : {}),
      ...(country !== undefined ? { country: country || null } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(chefName !== undefined ? { chefName: chefName || null } : {}),
      ...(chefVideoUrl !== undefined ? { chefVideoUrl: chefVideoUrl || null } : {}),
      ...(translations !== undefined ? { translations } : {}),
    },
  });
  res.json(updated);
});

router.patch('/dishes/:dishId', [
  body('name').optional().isString().trim().isLength({ min: 1, max: 160 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 3000 }),
  body('price').optional().isInt({ min: 1, max: 2147483647 }),
  body('priceUsd').optional({ nullable: true }).isInt({ min: 1, max: 2147483647 }),
  body('image').optional({ nullable: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
  body('story').optional({ nullable: true }).isString().isLength({ max: 5000 }),
  body('season').optional({ nullable: true }).isIn([...SEASONS, null]),
  body('dayPeriod').optional({ nullable: true }).isIn([...DAY_PERIODS, null]),
], async (req, res) => {
  if (reportValidationErrors(req, res)) return;
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const dishId = Number(req.params.dishId);
  if (!Number.isSafeInteger(dishId) || dishId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор блюда' });
  }
  const dish = await prisma.dish.findFirst({ where: { id: dishId, restaurantId: restaurant.id } });
  if (!dish) return res.status(404).json({ error: 'Блюдо не найдено в вашем ресторане' });

  const { name, description, price, priceUsd, image, story, chefVideoUrl, season, dayPeriod, translations, winePairings, origins } = req.body;
  if (!isValidVideoUrl(chefVideoUrl) || !validTranslations(translations)) {
    return res.status(400).json({ error: 'Проверьте ссылку на видео и переводы (ru, kk, en)' });
  }
  if (winePairings !== undefined && (!Array.isArray(winePairings) || winePairings.length > 10 ||
    winePairings.some((wine) => !wine || typeof wine.name !== 'string' || !wine.name.trim() ||
      !Number.isInteger(wine.intensity) || wine.intensity < 1 || wine.intensity > 5 ||
      (wine.producer != null && typeof wine.producer !== 'string') ||
      (wine.description != null && typeof wine.description !== 'string')))) {
    return res.status(400).json({ error: 'Укажите до 10 вин с названием и интенсивностью от 1 до 5' });
  }
  if (origins !== undefined && (!Array.isArray(origins) || origins.length > 20 ||
    origins.some((origin) => !origin || typeof origin.ingredient !== 'string' || !origin.ingredient.trim() ||
      typeof origin.region !== 'string' || !origin.region.trim() ||
      typeof origin.country !== 'string' || !origin.country.trim() ||
      (origin.supplier != null && typeof origin.supplier !== 'string') ||
      (origin.story != null && typeof origin.story !== 'string') ||
      (origin.latitude != null && (!Number.isFinite(origin.latitude) || origin.latitude < -90 || origin.latitude > 90)) ||
      (origin.longitude != null && (!Number.isFinite(origin.longitude) || origin.longitude < -180 || origin.longitude > 180)) ||
      ((origin.latitude == null) !== (origin.longitude == null))))) {
    return res.status(400).json({ error: 'Проверьте ингредиенты и координаты происхождения (широта/долгота)' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDish = await tx.dish.update({
      where: { id: dish.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(price !== undefined ? { price: Number(price) } : {}),
        ...(priceUsd !== undefined ? { priceUsd: priceUsd == null ? null : Number(priceUsd) } : {}),
        ...(image !== undefined ? { image: image || null } : {}),
        ...(story !== undefined ? { story: story || null } : {}),
        ...(chefVideoUrl !== undefined ? { chefVideoUrl: chefVideoUrl || null } : {}),
        ...(season !== undefined ? { season: season || null } : {}),
        ...(dayPeriod !== undefined ? { dayPeriod: dayPeriod || null } : {}),
        ...(translations !== undefined ? { translations } : {}),
      },
    });

    if (winePairings !== undefined) {
      await tx.winePairing.deleteMany({ where: { dishId: dish.id } });
      if (winePairings.length) {
        await tx.winePairing.createMany({
          data: winePairings.map((wine) => ({
            dishId: dish.id,
            name: wine.name.trim(),
            producer: wine.producer?.trim() || null,
            intensity: wine.intensity,
            description: wine.description?.trim() || null,
          })),
        });
      }
    }
    if (origins !== undefined) {
      await tx.ingredientOrigin.deleteMany({ where: { dishId: dish.id } });
      if (origins.length) {
        await tx.ingredientOrigin.createMany({
          data: origins.map((origin) => ({
            dishId: dish.id,
            ingredient: origin.ingredient.trim(),
            region: origin.region.trim(),
            country: origin.country.trim(),
            supplier: origin.supplier?.trim() || null,
            story: origin.story?.trim() || null,
            latitude: origin.latitude ?? null,
            longitude: origin.longitude ?? null,
          })),
        });
      }
    }
    return tx.dish.findUnique({
      where: { id: updatedDish.id },
      include: { winePairings: true, origins: true },
    });
  });
  res.json(updated);
});

router.post('/dishes', [
  body('name').isString().trim().isLength({ min: 1, max: 160 }),
  body('price').isInt({ min: 1, max: 2147483647 }),
  body('priceUsd').optional({ nullable: true }).isInt({ min: 1, max: 2147483647 }),
  body('image').optional({ nullable: true }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
], async (req, res) => {
  if (reportValidationErrors(req, res)) return;
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const dish = await prisma.dish.create({
    data: {
      restaurantId: restaurant.id,
      name: req.body.name.trim(),
      price: Number(req.body.price),
      priceUsd: req.body.priceUsd == null ? null : Number(req.body.priceUsd),
      image: req.body.image || null,
      description: typeof req.body.description === 'string' ? req.body.description.trim() || null : null,
    },
  });
  res.status(201).json(dish);
});

router.delete('/dishes/:dishId', async (req, res) => {
  const dishId = Number(req.params.dishId);
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const dish = await prisma.dish.findFirst({
    where: { id: dishId, restaurantId: restaurant.id },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!dish) return res.status(404).json({ error: 'Блюдо не найдено в вашем ресторане' });
  if (dish._count.orderItems) {
    return res.status(409).json({ error: 'Блюдо есть в заказах и не может быть удалено' });
  }
  await prisma.dish.delete({ where: { id: dish.id } });
  res.status(204).end();
});

router.post('/tables', [
  body('name').isString().trim().isLength({ min: 1, max: 40 }),
  body('seats').isInt({ min: 1, max: 20 }),
  body('location').isString().trim().isLength({ min: 1, max: 80 }),
  body('x').optional().isInt({ min: 5, max: 95 }),
  body('y').optional().isInt({ min: 5, max: 95 }),
], async (req, res) => {
  if (reportValidationErrors(req, res)) return;
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const table = await prisma.restaurantTable.create({
    data: {
      restaurantId: restaurant.id,
      name: req.body.name.trim(),
      seats: Number(req.body.seats),
      location: req.body.location.trim(),
      x: Number(req.body.x ?? 50),
      y: Number(req.body.y ?? 50),
    },
  });
  res.status(201).json(table);
});

router.delete('/tables/:tableId', async (req, res) => {
  const tableId = Number(req.params.tableId);
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, restaurantId: restaurant.id },
    include: { _count: { select: { reservations: true } } },
  });
  if (!table) return res.status(404).json({ error: 'Столик не найден' });
  if (table._count.reservations) {
    return res.status(409).json({ error: 'Столик связан с бронированиями и не может быть удалён' });
  }
  await prisma.restaurantTable.delete({ where: { id: table.id } });
  res.status(204).end();
});

router.post('/timeline', [
  body('time').matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('title').isString().trim().isLength({ min: 1, max: 120 }),
  body('description').optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body('sortOrder').optional().isInt({ min: 0, max: 1000 }),
], async (req, res) => {
  if (reportValidationErrors(req, res)) return;
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const event = await prisma.dinnerTimelineEvent.create({
    data: {
      restaurantId: restaurant.id,
      time: req.body.time,
      title: req.body.title.trim(),
      description: req.body.description?.trim() || null,
      sortOrder: Number(req.body.sortOrder ?? 0),
    },
  });
  res.status(201).json(event);
});

router.delete('/timeline/:eventId', async (req, res) => {
  const eventId = Number(req.params.eventId);
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const result = await prisma.dinnerTimelineEvent.deleteMany({
    where: { id: eventId, restaurantId: restaurant.id },
  });
  if (!result.count) return res.status(404).json({ error: 'Событие не найдено' });
  res.status(204).end();
});

router.get('/reservations', async (req, res) => {
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const reservations = await prisma.reservation.findMany({
    where: { restaurantId: restaurant.id },
    include: { table: true, user: { select: { name: true, email: true } } },
    orderBy: { startsAt: 'asc' },
    take: 100,
  });
  res.json(reservations);
});

router.patch('/reservations/:reservationId', [
  body('status').isIn(['CONFIRMED', 'CANCELLED', 'COMPLETED']),
], async (req, res) => {
  if (reportValidationErrors(req, res)) return;
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const reservationId = Number(req.params.reservationId);
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, restaurantId: restaurant.id },
  });
  if (!reservation) return res.status(404).json({ error: 'Бронирование не найдено' });
  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: req.body.status },
  });
  res.json(updated);
});

router.get('/orders', async (req, res) => {
  const restaurant = await getOwnedRestaurant(req.user.id);
  if (!restaurant) return res.status(404).json({ error: 'Ресторан не найден' });
  const orders = await prisma.order.findMany({
    where: { restaurantId: restaurant.id },
    include: {
      items: { include: { dish: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(orders);
});

module.exports = router;
