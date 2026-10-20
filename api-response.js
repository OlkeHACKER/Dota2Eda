window.apiUrl = function apiUrl(path) {
  const port = Number(window.location.port);
  const isLiveServerPort = Number.isInteger(port) && port >= 5500 && port <= 5599;
  const backendOrigin = isLiveServerPort
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : '';
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  return `${backendOrigin}${apiPath}`;
};

window.readApiResponse = async function readApiResponse(response, fallbackMessage = 'Не удалось выполнить запрос') {
  const text = await response.text();
  let data = null;

  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      const message = text.trim();
      if (!response.ok && message && !message.startsWith('<')) {
        throw new Error(`${message.slice(0, 300)} (HTTP ${response.status})`);
      }
      throw new Error(`Сервер вернул некорректный ответ (HTTP ${response.status})`);
    }
  }

  if (!response.ok) {
    const validationMessage = data?.errors?.map((error) => error.msg).join('. ');
    throw new Error(validationMessage || data?.error || `${fallbackMessage} (HTTP ${response.status})`);
  }

  return data;
};
