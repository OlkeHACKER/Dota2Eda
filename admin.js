const API_URL = '/api';
const token = localStorage.getItem('token');
const messageElement = document.getElementById('admin-message');
let restaurant;
let creatingDish = false;

async function request(url, options = {}) {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    const details = data.errors?.map((error) => error.msg).join('. ');
    throw new Error(details || data.error || 'Не удалось выполнить запрос');
  }
  return data;
}

function setMessage(text, error = false) {
  messageElement.textContent = text;
  messageElement.classList.toggle('is-error', error);
}

function fillJson(form, field, value) {
  form.elements[field].value = value ? JSON.stringify(value, null, 2) : '';
}

function parseJson(form, field, fallback) {
  const value = form.elements[field].value.trim();
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Проверьте JSON в поле «${field}»`);
  }
}

function renderStats() {
  const items = [
    ['Блюд', restaurant._count.dishes],
    ['Заказов', restaurant._count.orders],
    ['Бронирований', restaurant._count.reservations],
    ['Столиков', restaurant.tables.length],
  ];
  const container = document.getElementById('admin-stats');
  container.replaceChildren(...items.map(([label, value]) => {
    const card = document.createElement('article');
    card.className = 'admin-stat';
    const number = document.createElement('strong');
    number.textContent = String(value);
    const caption = document.createElement('span');
    caption.textContent = label;
    card.append(number, caption);
    return card;
  }));
}

function fillRestaurantForm() {
  const form = document.getElementById('restaurant-form');
  for (const field of ['name', 'cuisine', 'country', 'description', 'chefName', 'chefVideoUrl']) {
    form.elements[field].value = restaurant[field] || '';
  }
  fillJson(form, 'translations', restaurant.translations);
}

function fillDishForm() {
  const form = document.getElementById('admin-dish-form');
  document.getElementById('delete-dish-button').hidden = creatingDish;
  form.querySelector('[type="submit"]').textContent = creatingDish ? 'Создать блюдо' : 'Сохранить блюдо';
  if (creatingDish) {
    form.reset();
    return;
  }
  const dish = restaurant.dishes.find((item) => item.id === Number(document.getElementById('dish-picker').value));
  if (!dish) return;
  for (const field of ['name', 'description', 'price', 'priceUsd', 'image', 'story', 'chefVideoUrl', 'season', 'dayPeriod']) {
    form.elements[field].value = dish[field] ?? '';
  }
  fillJson(form, 'translations', dish.translations);
  fillJson(form, 'winePairings', dish.winePairings);
  fillJson(form, 'origins', dish.origins.map(({ ingredient, region, country, supplier, story, latitude, longitude }) =>
    ({ ingredient, region, country, supplier, story, latitude, longitude })
  ));
}

function renderTables() {
  const plan = document.getElementById('admin-table-plan');
  plan.replaceChildren();
  restaurant.tables.forEach((table) => {
    const marker = document.createElement('div');
    marker.className = 'table-marker';
    marker.style.left = `${table.x}%`;
    marker.style.top = `${table.y}%`;
    marker.textContent = `${table.name} · ${table.seats}`;
    marker.title = `${table.name}, ${table.location}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Удалить ${table.name}`);
    remove.addEventListener('click', async () => {
      if (!window.confirm(`Удалить ${table.name}?`)) return;
      try {
        await request(`/admin/tables/${table.id}`, { method: 'DELETE' });
        await refreshAdmin();
      } catch (error) {
        setMessage(error.message, true);
      }
    });
    marker.append(remove);
    plan.append(marker);
  });
}

function renderTimeline() {
  const list = document.getElementById('admin-timeline');
  list.replaceChildren(...restaurant.timeline.map((event) => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = `${event.time} — ${event.title}${event.description ? `: ${event.description}` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-remove';
    remove.textContent = 'Удалить';
    remove.addEventListener('click', async () => {
      try {
        await request(`/admin/timeline/${event.id}`, { method: 'DELETE' });
        await refreshAdmin();
      } catch (error) {
        setMessage(error.message, true);
      }
    });
    item.append(text, remove);
    return item;
  }));
}

async function renderReservations() {
  const list = document.getElementById('admin-reservations-list');
  const reservations = await request('/admin/reservations');
  if (!reservations.length) {
    list.textContent = 'Бронирований пока нет.';
    return;
  }
  list.replaceChildren(...reservations.map((reservation) => {
    const card = document.createElement('article');
    card.className = 'admin-list-card';
    const info = document.createElement('p');
    info.textContent = `${new Date(reservation.startsAt).toLocaleString('ru-RU')} · ${reservation.user.name} · ${reservation.guests} гостей · ${reservation.table.name} (${reservation.table.location})`;
    const status = document.createElement('select');
    ['CONFIRMED', 'CANCELLED', 'COMPLETED'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = reservation.status === value;
      status.append(option);
    });
    status.addEventListener('change', async () => {
      try {
        await request(`/admin/reservations/${reservation.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: status.value }),
        });
        setMessage('Статус бронирования обновлён');
      } catch (error) {
        setMessage(error.message, true);
      }
    });
    card.append(info, status);
    return card;
  }));
}

async function renderOrders() {
  const list = document.getElementById('admin-orders-list');
  const orders = await request('/admin/orders');
  if (!orders.length) {
    list.textContent = 'Заказов пока нет.';
    return;
  }
  list.replaceChildren(...orders.map((order) => {
    const card = document.createElement('article');
    card.className = 'admin-list-card';
    const info = document.createElement('p');
    const items = order.items.map((item) => `${item.dish.name} × ${item.qty}`).join(', ');
    info.textContent = `Заказ №${order.id} · ${order.customer.name} · ${new Date(order.createdAt).toLocaleString('ru-RU')} · ${items} · ${order.total} ₸`;
    const status = document.createElement('select');
    ['CREATED', 'ACCEPTED', 'COOKING', 'DELIVERING', 'DELIVERED'].forEach((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = order.status === value;
      status.append(option);
    });
    status.addEventListener('change', async () => {
      try {
        await request(`/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: status.value }),
        });
        setMessage(`Статус заказа №${order.id} обновлён`);
      } catch (error) {
        setMessage(error.message, true);
      }
    });
    card.append(info, status);
    return card;
  }));
}

async function refreshAdmin() {
  restaurant = await request('/admin');
  document.getElementById('admin-title').textContent = restaurant.name;
  document.getElementById('admin-content').hidden = false;
  document.getElementById('admin-menu-link').href = `index.html?restaurant=${restaurant.id}#menu`;
  renderStats();
  fillRestaurantForm();
  renderTables();
  renderTimeline();
  const picker = document.getElementById('dish-picker');
  const selectedId = Number(picker.value);
  picker.replaceChildren(...restaurant.dishes.map((dish) => {
    const option = document.createElement('option');
    option.value = String(dish.id);
    option.textContent = dish.name;
    return option;
  }));
  if (restaurant.dishes.some((dish) => dish.id === selectedId)) picker.value = String(selectedId);
  fillDishForm();
  await Promise.all([renderReservations(), renderOrders()]);
}

if (!token || localStorage.getItem('role') !== 'RESTAURANT_ADMIN') {
  window.location.replace('login.html');
} else {
  document.getElementById('dish-picker').addEventListener('change', fillDishForm);
  document.getElementById('new-dish-button').addEventListener('click', () => {
    creatingDish = true;
    fillDishForm();
    document.getElementById('admin-dish-form').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('restaurant-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const payload = Object.fromEntries(['name', 'cuisine', 'country', 'description', 'chefName', 'chefVideoUrl']
        .map((field) => [field, form.elements[field].value.trim() || null]));
      payload.translations = parseJson(form, 'translations', null);
      await request('/admin/restaurant', { method: 'PATCH', body: JSON.stringify(payload) });
      await refreshAdmin();
      setMessage('Настройки ресторана сохранены');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  document.getElementById('admin-dish-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const dishId = Number(document.getElementById('dish-picker').value);
    const wasCreating = creatingDish;
    try {
      const payload = Object.fromEntries(['name', 'description', 'price', 'priceUsd', 'image', 'story', 'chefVideoUrl', 'season', 'dayPeriod']
        .map((field) => [field, ['price', 'priceUsd'].includes(field)
          ? (form.elements[field].value ? Number(form.elements[field].value) : null)
          : (form.elements[field].value.trim() || null)]));
      payload.translations = parseJson(form, 'translations', null);
      payload.winePairings = parseJson(form, 'winePairings', []);
      payload.origins = parseJson(form, 'origins', []);
      if (creatingDish) {
        await request('/admin/dishes', { method: 'POST', body: JSON.stringify(payload) });
        creatingDish = false;
      } else {
        await request(`/admin/dishes/${dishId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      await refreshAdmin();
      setMessage(wasCreating ? 'Блюдо создано' : 'Блюдо и его рекомендации сохранены');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  document.getElementById('delete-dish-button').addEventListener('click', async () => {
    const dishId = Number(document.getElementById('dish-picker').value);
    const dish = restaurant.dishes.find((item) => item.id === dishId);
    if (!dish || !window.confirm(`Удалить «${dish.name}»?`)) return;
    try {
      await request(`/admin/dishes/${dishId}`, { method: 'DELETE' });
      await refreshAdmin();
      setMessage('Блюдо удалено');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  document.getElementById('table-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request('/admin/tables', {
        method: 'POST',
        body: JSON.stringify({
          name: form.elements.name.value.trim(),
          seats: Number(form.elements.seats.value),
          location: form.elements.location.value.trim(),
          x: Number(form.elements.x.value),
          y: Number(form.elements.y.value),
        }),
      });
      form.reset();
      await refreshAdmin();
      setMessage('Столик добавлен в план зала');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  document.getElementById('timeline-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request('/admin/timeline', {
        method: 'POST',
        body: JSON.stringify({
          time: form.elements.time.value,
          title: form.elements.title.value.trim(),
          description: form.elements.description.value.trim(),
          sortOrder: restaurant.timeline.length,
        }),
      });
      form.reset();
      await refreshAdmin();
      setMessage('Событие добавлено в таймлайн');
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  document.getElementById('admin-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    window.location.replace('login.html');
  });

  refreshAdmin().catch((error) => setMessage(error.message, true));
}
