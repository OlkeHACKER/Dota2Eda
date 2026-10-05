require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const menu = require('./menu-data.json');

const prisma = new PrismaClient();

async function main() {
  const menuWrites = menu.restaurants.map((restaurant) => {
    const key = `pasted-menu-${String(restaurant.number).padStart(2, '0')}`;
    const restaurantData = {
      name: restaurant.name,
      cuisine: restaurant.country,
      country: restaurant.country,
      rating: restaurant.rating,
      usdToKztRate: menu.usdToKztRate,
      rateDate: new Date(`${menu.rateDate}T00:00:00.000Z`),
    };
    const dishes = restaurant.dishes.map((dish, index) => ({
      importKey: `${key}-dish-${String(index + 1).padStart(2, '0')}`,
      name: dish.name,
      description: dish.description,
      priceUsd: dish.priceUsd,
      price: Math.round(dish.priceUsd * menu.usdToKztRate),
    }));

    return prisma.restaurant.upsert({
      where: { importKey: key },
      update: {
        ...restaurantData,
        dishes: {
          createMany: { data: dishes, skipDuplicates: true },
        },
      },
      create: {
        ...restaurantData,
        importKey: key,
        dishes: {
          createMany: { data: dishes },
        },
      },
    });
  });

  await prisma.$transaction(menuWrites, { timeout: 120000 });

  const importedRestaurants = await prisma.restaurant.findMany({
    where: { importKey: { startsWith: 'pasted-menu-' } },
    include: { _count: { select: { dishes: true } } },
  });
  const dishCount = importedRestaurants.reduce((total, restaurant) => total + restaurant._count.dishes, 0);

  if (importedRestaurants.length !== menu.restaurants.length || dishCount !== menu.restaurants.length * 20) {
    throw new Error(`Проверка импорта не пройдена: ${importedRestaurants.length} ресторанов, ${dishCount} блюд`);
  }

  console.log(`Импортировано ${importedRestaurants.length} ресторанов и ${dishCount} блюд.`);
  console.log(`Цены рассчитаны по курсу 1 USD = ${menu.usdToKztRate} KZT на ${menu.rateDate}.`);
}

main()
  .catch((error) => {
    console.error('Не удалось импортировать меню:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
