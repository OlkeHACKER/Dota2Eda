const API_URL = '/api';

function showError(errorId, isValid) {
  const errorElement = document.getElementById(errorId);
  if (errorElement) errorElement.style.display = isValid ? 'none' : 'block';
}

function showMessage(messageId, message) {
  const messageElement = document.getElementById(messageId);
  if (messageElement) messageElement.textContent = message;
}

async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    const validationMessage = data.errors?.map((error) => error.msg).join('. ');
    throw new Error(validationMessage || data.error || 'Не удалось выполнить запрос');
  }
  return data;
}

function saveSession(data) {
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.user.role);
  localStorage.setItem('user', JSON.stringify(data.user));
}

const roleSelect = document.getElementById('role');
const restaurantFields = document.getElementById('restaurant-fields');

if (roleSelect && restaurantFields) {
  const updateRestaurantFields = () => {
    const isRestaurant = roleSelect.value === 'RESTAURANT_ADMIN';
    restaurantFields.hidden = !isRestaurant;
    document.getElementById('restaurantName').required = isRestaurant;
    document.getElementById('cuisine').required = isRestaurant;
  };
  roleSelect.addEventListener('change', updateRestaurantFields);
  updateRestaurantFields();
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 6;

    showError('emailError', emailValid);
    showError('passwordError', passwordValid);
    showMessage('loginMessage', '');
    if (!emailValid || !passwordValid) return;

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      saveSession(await readResponse(response));
      window.location.href = 'index.html';
    } catch (error) {
      showMessage('loginMessage', error.message || 'Сервер недоступен. Попробуйте ещё раз.');
    }
  });
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const restaurantName = document.getElementById('restaurantName')?.value.trim() || '';
    const cuisine = document.getElementById('cuisine')?.value.trim() || '';
    const nameValid = name.length > 0;
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordValid = password.length >= 6;
    const restaurantNameValid = role !== 'RESTAURANT_ADMIN' || restaurantName.length > 0;
    const cuisineValid = role !== 'RESTAURANT_ADMIN' || cuisine.length > 0;

    showError('nameError', nameValid);
    showError('emailError', emailValid);
    showError('passwordError', passwordValid);
    showMessage('registerMessage', '');
    if (!nameValid || !emailValid || !passwordValid || !restaurantNameValid || !cuisineValid) {
      if (!restaurantNameValid) showMessage('registerMessage', 'Укажите название ресторана');
      else if (!cuisineValid) showMessage('registerMessage', 'Укажите кухню ресторана');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, restaurantName, cuisine }),
      });
      saveSession(await readResponse(response));
      window.location.href = 'index.html';
    } catch (error) {
      showMessage('registerMessage', error.message || 'Сервер недоступен. Попробуйте ещё раз.');
    }
  });
}
