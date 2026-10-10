const API_URL = '/api';
const cartStorageKey = 'foodexpress-cart';
const formatPrice = new Intl.NumberFormat('ru-RU');
let availableMenu = new Map();
let menuRestaurants = [];
let activeRestaurantId = null;
let currentLanguage = localStorage.getItem('foodexpress-language') || 'ru';
let menuExchangeRate = null;

function uiText(key, fallback) {
  return window.foodText?.(key) || fallback;
}

function renderExchangeRateNote() {
  const rateNote = document.getElementById('menu-rate-note');
  rateNote.textContent = menuExchangeRate
    ? `${uiText('rateNote', 'Курс для пересчёта цен:')} 1 $ = ${formatPrice.format(Number(menuExchangeRate.usdToKztRate))} ₸ (${uiText('rateSource', 'Нацбанк Казахстана')}, ${new Date(menuExchangeRate.rateDate).toLocaleDateString(currentLanguage === 'kk' ? 'kk-KZ' : currentLanguage === 'en' ? 'en-US' : 'ru-RU')}).`
    : '';
}

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
    ? uiText('oldCart', 'В корзине есть блюда из старого меню. Удалите их перед заказом.')
    : cart.length ? '' : uiText('cartEmpty', 'Корзина пуста');
  checkoutButton.disabled = cart.length === 0 || hasUnavailableItems;

  cart.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'cart__item';
    const description = document.createElement('span');
    const unavailable = availableMenu.size && availableMenu.get(item.dishId) !== item.restaurantId;
    description.textContent = `${item.name} × ${item.qty} — ${formatPrice.format(item.price * item.qty)} ₸${unavailable ? ` (${uiText('unavailable', 'больше недоступно')})` : ''}`;
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'cart__remove';
    removeButton.textContent = uiText('remove', 'Убрать');
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
    if (!window.confirm(uiText('clearOldCart', 'В корзине есть блюда из старого меню. Очистить недоступные блюда?'))) return;
    cart = cart.filter((item) => availableMenu.get(item.dishId) === item.restaurantId);
  }

  if (cart.length && cart[0].restaurantId !== restaurantId) {
    window.alert(uiText('singleRestaurant', 'За один заказ можно выбрать блюда только из одного ресторана.'));
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
  const dishTranslation = dish.translations?.[currentLanguage] || {};
  name.textContent = dishTranslation.name || dish.name;
  const description = document.createElement('p');
  description.className = 'dish-card__description';
  description.textContent = dishTranslation.description || dish.description || '';
  const price = document.createElement('p');
  price.className = 'price';
  price.textContent = dish.priceUsd == null
    ? `${formatPrice.format(dish.price)} ₸`
    : `${formatPrice.format(dish.price)} ₸ · $${formatPrice.format(dish.priceUsd)}`;
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'btn btn--add';
  addButton.textContent = uiText('addToCart', 'Добавить в корзину');
  addButton.addEventListener('click', () => addToCart(dish, restaurant.id));

  const detailButton = document.createElement('button');
  detailButton.type = 'button';
  detailButton.className = 'dish-card__link';
  detailButton.textContent = uiText('dishDetails', 'Вино · происхождение · история');
  detailButton.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('foodexpress:dish-select', { detail: { dish, restaurant } }));
    document.getElementById('experience').scrollIntoView({ behavior: 'smooth' });
  });
  const view3dButton = document.createElement('button');
  view3dButton.type = 'button';
  view3dButton.className = 'dish-card__link';
  view3dButton.textContent = uiText('view3d', 'Крутить 3D-тарелку');
  view3dButton.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('foodexpress:3d-view', { detail: { dish, restaurant } }));
  });

  content.append(restaurantLabel, rating, name, description, price, addButton, detailButton, view3dButton);
  card.append(image, content);
  return card;
}

function renderRestaurantTabs() {
  const tabsElement = document.getElementById('restaurant-tabs');
  tabsElement.replaceChildren();

  menuRestaurants.forEach((restaurant, index) => {
    const tab = document.createElement('button');
    const isActive = restaurant.id === activeRestaurantId;
    tab.type = 'button';
    tab.id = `restaurant-tab-${restaurant.id}`;
    tab.className = 'restaurant-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(isActive));
    tab.setAttribute('aria-controls', 'menu-grid');
    tab.tabIndex = isActive ? 0 : -1;
    tab.textContent = restaurant.translations?.[currentLanguage]?.name || restaurant.name;

    const meta = document.createElement('span');
    meta.className = 'restaurant-tab__meta';
    const rating = restaurant.rating ? ` · ${'★'.repeat(restaurant.rating)}` : '';
    meta.textContent = `${restaurant.country || restaurant.cuisine} · ${restaurant.dishes.length} ${uiText('dishCountSuffix', 'блюд')}${rating}`;
    tab.append(meta);

    tab.addEventListener('click', () => {
      activeRestaurantId = restaurant.id;
      renderRestaurantMenu();
    });
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const tabs = [...tabsElement.querySelectorAll('[role="tab"]')];
      const currentIndex = tabs.indexOf(tab);
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    });

    tabsElement.append(tab);
  });
}

function renderRestaurantMenu() {
  const restaurant = menuRestaurants.find((item) => item.id === activeRestaurantId);
  const grid = document.getElementById('menu-grid');
  const details = document.getElementById('restaurant-details');
  const name = document.getElementById('restaurant-name');
  const meta = document.getElementById('restaurant-meta');

  renderRestaurantTabs();
  if (!restaurant) {
    details.hidden = true;
    grid.replaceChildren();
    return;
  }

  details.hidden = false;
  name.textContent = restaurant.translations?.[currentLanguage]?.name || restaurant.name;
  meta.textContent = [
    restaurant.country || restaurant.cuisine,
    restaurant.rating ? `${'★'.repeat(restaurant.rating)}${'☆'.repeat(3 - restaurant.rating)}` : '',
    `${restaurant.dishes.length} ${uiText('menuCountSuffix', 'блюд в меню')}`,
  ].filter(Boolean).join(' · ');
  document.getElementById('restaurant-description').textContent =
    restaurant.translations?.[currentLanguage]?.description || restaurant.description || '';
  grid.setAttribute('role', 'tabpanel');
  grid.setAttribute('aria-labelledby', `restaurant-tab-${restaurant.id}`);
  grid.replaceChildren(...restaurant.dishes.map((dish) => createDishCard(dish, restaurant)));
  window.dispatchEvent(new CustomEvent('foodexpress:restaurant-select', { detail: { restaurant } }));
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
    if (!response.ok) throw new Error(restaurants.error || uiText('menuLoadError', 'Не удалось загрузить меню'));

    menuRestaurants = restaurants.filter((restaurant) => restaurant.dishes.length > 0);
    menuRestaurants.sort((left, right) => {
      const leftImported = left.importKey?.startsWith('pasted-menu-') ? 0 : 1;
      const rightImported = right.importKey?.startsWith('pasted-menu-') ? 0 : 1;
      return leftImported - rightImported ||
        (left.importKey || left.name).localeCompare(right.importKey || right.name, 'ru');
    });
    availableMenu = new Map(
      menuRestaurants.flatMap((restaurant) =>
        restaurant.dishes.map((dish) => [dish.id, restaurant.id])
      )
    );
    renderCart();
    menuExchangeRate = menuRestaurants.find((restaurant) => restaurant.usdToKztRate) || null;
    renderExchangeRateNote();
    message.textContent = menuRestaurants.length
      ? ''
      : uiText('noMenu', 'В меню пока нет блюд.');
    if (!menuRestaurants.some((restaurant) => restaurant.id === activeRestaurantId)) {
      activeRestaurantId = menuRestaurants[0]?.id ?? null;
    }
    renderRestaurantMenu();
  } catch (error) {
    message.textContent = `${error.message}. Проверьте, что сервер запущен и база данных доступна.`;
  }
}

const accountLink = document.getElementById('account-link');
if (localStorage.getItem('token')) {
  if (localStorage.getItem('role') === 'RESTAURANT_ADMIN') {
    accountLink.textContent = 'Панель ресторана';
    accountLink.href = 'admin.html';
  }
  const logoutLink = document.createElement('a');
  logoutLink.href = '#';
  logoutLink.textContent = 'Выйти';
  logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    window.location.reload();
  });
  accountLink.after(logoutLink);
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
window.setFoodLanguage = (language) => {
  currentLanguage = language;
  renderCart();
  renderExchangeRateNote();
  renderRestaurantMenu();
};
