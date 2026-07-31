// Pequeña capa de utilidades para hablar con la API desde HTML+JS plano.

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// Redirige a login si no hay sesion. Llamar al principio de cada pagina privada.
function requireSession() {
  if (!getToken()) {
    window.location.href = '/login.html';
  }
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error en la peticion');
  }
  return data;
}

// Igual que apiRequest, pero para enviar archivos (multipart/form-data).
// No fijamos Content-Type a mano: el navegador añade el boundary correcto.
async function apiUpload(path, formData, method = 'POST') {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Error en la peticion');
  }
  return data;
}
