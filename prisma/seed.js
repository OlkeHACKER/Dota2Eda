// Заполняет базу тестовыми данными для разработки.
// Запуск: node prisma/seed.js
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const owner = await prisma.user.create({
    data: {
      name: 'Владелец ресторана Угли',
      email: 'owner@ugli.kz',
      passwordHash,
      role: 'RESTAURANT_ADMIN',
    },
  });

  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Угли',
      cuisine: 'Гриль, стейки',
      cover: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
      ownerId: owner.id,
      dishes: {
        create: [
          { name: 'Лосось на углях', price: 2400, image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80' },
          { name: 'Тартар из говядины', price: 1800, image: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600&q=80' },
          { name: 'Овощи гриль', price: 1200, image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80' },
        ],
      },
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: 'Тестовый клиент',
      email: 'client@test.kz',
      passwordHash,
      role: 'CUSTOMER',
    },
  });

  console.log('База заполнена тестовыми данными:');
  console.log('— Владелец ресторана:', owner.email, '/ пароль: password123');
  console.log('— Клиент:', customer.email, '/ пароль: password123');
  console.log('— Ресторан:', restaurant.name, 'создан с 3 блюдами');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
