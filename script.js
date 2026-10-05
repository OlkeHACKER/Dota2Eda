const API_URL = '/api';
const cartStorageKey = 'foodexpress-cart';
const formatPrice = new Intl.NumberFormat('ru-RU');
let availableMenu = new Map();

function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item) =>
      Number.isSafeInteger(item.dishId) &&
      Number.isSafeInteger(item.restaurantId) &&
      Number.isSafeInteger(item.price) &&
      Number.isSafeInteger(item.qty) &&
      typeof item.name === 'string' &&
      item.dishId > 0 &&
      item.restaurantId > 0 &&
      item.price > 0 &&
      item.qty > 0
    );
  } catch (error) {
    console.warn('Не удалось прочитать корзину из браузера:', error);
    return [];
  }
}

let cart = loadCart();

function saveCart() {
  localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const itemsElement = document.getElementById('cart-items');
  const countElement = document.getElementById('cart-count');
  const totalElement = document.getElementById('cart-total');
  const messageElement = document.getElementById('cart-message');
  const checkoutButton = document.getElementById('checkout-button');
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const hasUnavailableItems = cart.some(
    (item) => availableMenu.size && availableMenu.get(item.dishId) !== item.restaurantId
  );

  itemsElement.replaceChildren();
  countElement.textContent = String(itemCount);
  totalElement.textContent = `${formatPrice.format(total)} ₸`;
  messageElement.textContent = hasUnavailableItems
    ? 'В корзине есть блюда из старого меню. Удалите их перед заказом.'
    : cart.length ? '' : 'Корзина пуста';
  checkoutButton.disabled = cart.length === 0 || hasUnavailableItems;

  cart.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'cart__item';
    const description = document.createElement('span');
    const unavailable = availableMenu.size && availableMenu.get(item.dishId) !== item.restaurantId;
    description.textContent = `${item.name} × ${item.qty} — ${formatPrice.format(item.price * item.qty)} ₸${unavailable ? ' (больше недоступно)' : ''}`;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'cart__remove';
    removeButton.textContent = 'Убрать';
    removeButton.addEventListener('click', () => {
      cart = cart.filter((cartItem) => cartItem.dishId !== item.dishId);
      saveCart();
    });
    row.append(description, removeButton);
    itemsElement.append(row);
  });
}

function addToCart(dish, restaurantId) {
  if (cart.some((item) => availableMenu.get(item.dishId) !== item.restaurantId)) {
    if (!window.confirm('В корзине есть блюда из старого меню. Очистить недоступные блюда?')) return;
    cart = cart.filter((item) => availableMenu.get(item.dishId) === item.restaurantId);
  }

  if (cart.length && cart[0].restaurantId !== restaurantId) {
    window.alert('За один заказ можно выбрать блюда только из одного ресторана.');
    return;
  }

  const existingItem = cart.find((item) => item.dishId === dish.id);
  if (existingItem) {
    existingItem.qty += 1;
  } else {
    cart.push({
      dishId: dish.id,
      restaurantId,
      name: dish.name,
      price: dish.price,
      qty: 1,
    });
  }
  saveCart();
}

function createDishCard(dish, restaurant) {
  const card = document.createElement('article');
  card.className = 'dish-card';
  const image = document.createElement('img');
  image.alt = dish.name;
  image.loading = 'lazy';
  if (dish.image) image.src = dish.image;
  else image.hidden = true;

  const content = document.createElement('div');
  content.className = 'dish-card__body';
  const restaurantLabel = document.createElement('span');
  restaurantLabel.className = 'badge--open';
  restaurantLabel.textContent = `${restaurant.name} · ${restaurant.country || restaurant.cuisine}`;
  const rating = document.createElement('span');
  rating.className = 'dish-card__rating';
  rating.textContent = restaurant.rating ? `${'★'.repeat(restaurant.rating)}${'☆'.repeat(3 - restaurant.rating)}` : '';
  const name = document.createElement('h3');
  name.textContent = dish.name;
  const description = document.createElement('p');
  description.className = 'dish-card__description';
  description.textContent = dish.description || '';
  const price = document.createElement('p');
  price.className = 'price';
  price.textContent = dish.priceUsd == null
    ? `${formatPrice.format(dish.price)} ₸`
    : `${formatPrice.format(dish.price)} ₸ · $${formatPrice.format(dish.priceUsd)}`;
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'btn btn--add';
  addButton.textContent = 'Добавить в корзину';
  addButton.addEventListener('click', () => addToCart(dish, restaurant.id));

  content.append(restaurantLabel, rating, name, description, price, addButton);
  card.append(image, content);
  return card;
}

async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data;
}

async function loadOwnerOrders(restaurantId) {
  const ordersElement = document.getElementById('owner-orders');
  const orders = await apiRequest(`/orders/restaurant/${restaurantId}`);
  ordersElement.replaceChildren();

  if (!orders.length) {
    ordersElement.textContent = 'Новых заказов пока нет.';
    return;
  }

  orders.forEach((order) => {
    const container = document.createElement('article');
    container.className = 'owner-order';
    const title = document.createElement('h4');
    title.textContent = `Заказ №${order.id} — ${order.customer.name}`;
    const items = document.createElement('p');
    items.textContent = order.items
      .map((item) => `${item.dish.name} × ${item.qty}`)
      .join(', ');
    const status = document.createElement('select');
    ['CREATED', 'ACCEPTED', 'COOKING', 'DELIVERING', 'DELIVERED'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = value === order.status;
      status.append(option);
    });
    const updateButton = document.createElement('button');
    updateButton.type = 'button';
    updateButton.className = 'btn btn--primary';
    updateButton.textContent = 'Обновить статус';
    updateButton.addEventListener('click', async () => {
      try {
        await apiRequest(`/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: status.value }),
        });
        document.getElementById('owner-message').textContent = `Статус заказа №${order.id} обновлён`;
      } catch (error) {
        document.getElementById('owner-message').textContent = error.message;
      }
    });
    container.append(title, items, status, updateButton);
    ordersElement.append(container);
  });
}

async function setupOwnerDashboard() {
  if (localStorage.getItem('role') !== 'RESTAURANT_ADMIN') return;

  const panel = document.getElementById('owner-panel');
  const message = document.getElementById('owner-message');
  panel.hidden = false;
  try {
    const restaurant = await apiRequest('/restaurants/mine');
    document.getElementById('owner-restaurant-name').textContent =
      `${restaurant.name} — ${restaurant.cuisine}`;

    document.getElementById('dish-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const nameInput = document.getElementById('dish-name');
      const priceInput = document.getElementById('dish-price');
      const imageInput = document.getElementById('dish-image');
      try {
        await apiRequest(`/restaurants/${restaurant.id}/dishes`, {
          method: 'POST',
          body: JSON.stringify({
            name: nameInput.value.trim(),
            price: Number(priceInput.value),
            image: imageInput.value.trim() || null,
          }),
        });
        nameInput.value = '';
        priceInput.value = '';
        imageInput.value = '';
        message.textContent = 'Блюдо добавлено в меню';
        await loadMenu();
      } catch (error) {
        message.textContent = error.message;
      }
    });
    await loadOwnerOrders(restaurant.id);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadMenu() {
  const grid = document.getElementById('menu-grid');
  const message = document.getElementById('menu-message');
  try {
    const response = await fetch(`${API_URL}/restaurants`);
    const restaurants = await response.json();
    if (!response.ok) throw new Error(restaurants.error || 'Не удалось загрузить меню');

    const menuRestaurants = restaurants.filter((restaurant) => restaurant.dishes.length > 0);
    availableMenu = new Map(
      menuRestaurants.flatMap((restaurant) =>
        restaurant.dishes.map((dish) => [dish.id, restaurant.id])
      )
    );
    renderCart();
    const exchangeRate = menuRestaurants.find((restaurant) => restaurant.usdToKztRate);
    const rateNote = document.getElementById('menu-rate-note');
    rateNote.textContent = exchangeRate
      ? `Курс для пересчёта цен: 1 $ = ${formatPrice.format(Number(exchangeRate.usdToKztRate))} ₸ (Нацбанк Казахстана, ${new Date(exchangeRate.rateDate).toLocaleDateString('ru-RU')}).`
      : '';
    const dishes = restaurants.flatMap((restaurant) =>
      restaurant.dishes.map((dish) => ({ restaurant, dish }))
    );
    grid.replaceChildren(...dishes.map(({ restaurant, dish }) => createDishCard(dish, restaurant)));
    message.textContent = dishes.length
      ? ''
      : 'В меню пока нет блюд.';
  } catch (error) {
    message.textContent = `${error.message}. Проверьте, что сервер запущен и база данных доступна.`;
  }
}

const accountLink = document.getElementById('account-link');
if (localStorage.getItem('token')) {
  accountLink.textContent = 'Выйти';
  accountLink.href = '#';
  accountLink.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    window.location.reload();
  });
}

document.getElementById('checkout-button').addEventListener('click', async (event) => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        restaurantId: cart[0].restaurantId,
        items: cart.map(({ dishId, qty }) => ({ dishId, qty })),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
      }
      throw new Error(data.error || 'Не удалось оформить заказ');
    }

    cart = [];
    saveCart();
    window.alert(`Заказ №${data.id} оформлен. Спасибо!`);
  } catch (error) {
    window.alert(`${error.message}. Проверьте подключение и попробуйте ещё раз.`);
  } finally {
    button.disabled = cart.length === 0;
  }
});

renderCart();
loadMenu();
setupOwnerDashboard();
