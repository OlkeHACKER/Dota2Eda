const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const RESERVATION_DURATION_MS = 2 * 60 * 60 * 1000;

router.get('/restaurants/:restaurantId/tables', async (req, res) => {
  const restaurantId = Number(req.params.restaurantId);
  const startsAt = new Date(req.query.startsAt);
  const guests = Number(req.query.guests);
  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1 ||
      Number.isNaN(startsAt.getTime()) || !Number.isInteger(guests) || guests < 1 || guests > 20) {
    return res.status(400).json({ error: 'Укажите ресторан, дату и количество гостей (1–20)' });
  }

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId, seats: { gte: guests } },
    orderBy: { name: 'asc' },
  });
  const collisions = await prisma.reservation.findMany({
    where: {
      restaurantId,
      status: 'CONFIRMED',
      startsAt: {
        lt: new Date(startsAt.getTime() + RESERVATION_DURATION_MS),
        gt: new Date(startsAt.getTime() - RESERVATION_DURATION_MS),
      },
    },
    select: { tableId: true },
  });
  const reservedIds = new Set(collisions.map((reservation) => reservation.tableId));
  res.json(tables.map((table) => ({ ...table, available: !reservedIds.has(table.id) })));
});

router.post('/restaurants/:restaurantId/reservations', requireAuth, [
  body('tableId').isInt({ min: 1 }),
  body('startsAt').isISO8601({ strict: true }),
  body('guests').isInt({ min: 1, max: 20 }),
  body('note').optional({ nullable: true }).isString().isLength({ max: 500 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const restaurantId = Number(req.params.restaurantId);
  const tableId = Number(req.body.tableId);
  const startsAt = new Date(req.body.startsAt);
  const guests = Number(req.body.guests);
  if (!Number.isSafeInteger(restaurantId) || restaurantId < 1 ||
      startsAt <= new Date() || startsAt.getTime() % 60000 !== 0) {
    return res.status(400).json({ error: 'Выберите ресторан и дату бронирования в будущем' });
  }

  try {
    const reservation = await prisma.$transaction(async (tx) => {
      const table = await tx.restaurantTable.findFirst({
        where: { id: tableId, restaurantId, seats: { gte: guests } },
      }, { isolationLevel: 'Serializable' });
      if (!table) throw Object.assign(new Error('Столик не найден или не подходит по числу гостей'), { status: 400 });

      const conflict = await tx.reservation.findFirst({
        where: {
          tableId,
          status: 'CONFIRMED',
          startsAt: {
            lt: new Date(startsAt.getTime() + RESERVATION_DURATION_MS),
            gt: new Date(startsAt.getTime() - RESERVATION_DURATION_MS),
          },
        },
      });
      if (conflict) throw Object.assign(new Error('Этот столик уже забронирован на выбранное время'), { status: 409 });

      return tx.reservation.create({
        data: {
          restaurantId,
          tableId,
          userId: req.user.id,
          startsAt,
          guests,
          note: req.body.note?.trim() || null,
        },
        include: { table: true },
      });
    });
    res.status(201).json(reservation);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === 'P2034') {
      return res.status(409).json({ error: 'Столик только что забронировали. Выберите другое место.' });
    }
    throw error;
  }
});

module.exports = router;
