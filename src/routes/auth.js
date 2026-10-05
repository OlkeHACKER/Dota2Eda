const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const prisma = require('../prisma');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Укажите имя'),
    body('email').isEmail().normalizeEmail().withMessage('Некорректный email'),
    body('password').isLength({ min: 6 }).withMessage('Пароль минимум 6 символов'),
    body('role')
      .optional()
      .isIn(['CUSTOMER', 'RESTAURANT_ADMIN'])
      .withMessage('Некорректная роль'),
    body('restaurantName').custom((value, { req }) => {
      if (req.body.role === 'RESTAURANT_ADMIN' && !String(value || '').trim()) {
        throw new Error('Укажите название ресторана');
      }
      return true;
    }),
    body('cuisine').custom((value, { req }) => {
      if (req.body.role === 'RESTAURANT_ADMIN' && !String(value || '').trim()) {
        throw new Error('Укажите кухню ресторана');
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const name = req.body.name.trim();
    const email = req.body.email.toLowerCase();
    const { password } = req.body;
    const role = req.body.role || 'CUSTOMER';

    const passwordHash = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          ...(role === 'RESTAURANT_ADMIN'
            ? {
                restaurant: {
                  create: {
                    name: req.body.restaurantName.trim(),
                    cuisine: req.body.cuisine.trim(),
                  },
                },
              }
            : {}),
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
      throw error;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Некорректный email'),
    body('password').notEmpty().withMessage('Введите пароль'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }
);

module.exports = router;
