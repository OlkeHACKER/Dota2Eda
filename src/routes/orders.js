const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ORDER_STATUSES = ['CREATED', 'ACCEPTED', 'COOKING', 'DELIVERING', 'DELIVERED'];

router.post('/', requireAuth, async (req, res) => {
  const restaurantId = Number(req.body.restaurantId);
  const { items } = req.body;

  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор ресторана' });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({ error: 'Корзина пуста' });
  }

  const quantities = new Map();
  for (const item of items) {
    const dishId = Number(item?.dishId);
    const qty = Number(item?.qty);
    if (!Number.isSafeInteger(dishId) || dishId < 1 || !Number.isSafeInteger(qty) || qty < 1 || qty > 99) {
      return res.status(400).json({ error: 'Некорректное блюдо или количество' });
    }
    const combinedQty = (quantities.get(dishId) || 0) + qty;
    if (combinedQty > 99) {
      return res.status(400).json({ error: 'Количество одного блюда не может превышать 99' });
    }
    quantities.set(dishId, combinedQty);
  }

  const dishIds = [...quantities.keys()];
  const dishes = await prisma.dish.findMany({ where: { id: { in: dishIds } } });

  if (dishes.length !== dishIds.length || dishes.some((dish) => dish.restaurantId !== restaurantId)) {
    return res.status(400).json({ error: 'Одно или несколько блюд не найдены в этом ресторане' });
  }

  const orderItemsData = dishes.map((dish) => ({
    dishId: dish.id,
    qty: quantities.get(dish.id),
    price: dish.price,
  }));
  const total = orderItemsData.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (total > 2147483647) {
    return res.status(400).json({ error: 'Сумма заказа слишком большая' });
  }

  const order = await prisma.order.create({
    data: {
      customerId: req.user.id,
      restaurantId,
      total,
      items: { create: orderItemsData },
    },
    include: { items: { include: { dish: true } } },
  });

  res.status(201).json(order);
});

router.get('/my', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { customerId: req.user.id },
    include: { items: { include: { dish: true } }, restaurant: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

router.get('/:id', requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор заказа' });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { dish: true } },
      restaurant: { include: { owner: { select: { id: true } } } },
    },
  });

  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  const isCustomer = order.customerId === req.user.id;
  const isRestaurantOwner = order.restaurant.owner?.id === req.user.id;
  if (!isCustomer && !isRestaurantOwner) {
    return res.status(403).json({ error: 'Нет доступа к этому заказу' });
  }
  delete order.restaurant.owner;
  res.json(order);
});

router.get('/restaurant/:restaurantId', requireAuth, requireRole('RESTAURANT_ADMIN'), async (req, res) => {
  const restaurantId = Number(req.params.restaurantId);
  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор ресторана' });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { ownerId: true },
  });
  if (!restaurant || restaurant.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Это не ваш ресторан' });
  }

  const orders = await prisma.order.findMany({
    where: { restaurantId },
    include: {
      items: { include: { dish: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

router.patch('/:id/status', requireAuth, requireRole('RESTAURANT_ADMIN'), async (req, res) => {
  const orderId = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isSafeInteger(orderId) || orderId < 1 || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Некорректный заказ или статус' });
  }

  const orderToUpdate = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { ownerId: true } } },
  });
  if (!orderToUpdate) return res.status(404).json({ error: 'Заказ не найден' });
  if (orderToUpdate.restaurant.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Это не ваш заказ' });
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  res.json(order);
});

module.exports = router;
