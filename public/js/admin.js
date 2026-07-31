requireSession();
const user = getUser();
if (!user || user.role !== 'admin') {
  window.location.href = '/dashboard.html';
}

function setMessage(elId, text, type) {
  const msg = document.getElementById(elId);
  msg.className = 'message' + (type ? ' ' + type : '');
  msg.textContent = text;
}

let cachedUsers = [];

async function loadUsers() {
  try {
    cachedUsers = await apiRequest('/users');

    document.getElementById('users-list').innerHTML = `
      <table>
        <tr>
          <th>Id</th><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Comprador</th>
          <th>XP</th><th>XP historico</th><th>Referidos</th><th>Accion</th>
        </tr>
        ${cachedUsers
          .map(
            (u) => `
          <tr>
            <td>${u.id}</td>
            <td>${u.first_name} ${u.last_name}</td>
            <td>${u.username}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-accent' : ''}">${u.role}</span></td>
            <td><span class="badge ${u.is_buyer ? 'badge-success' : ''}">${u.is_buyer ? 'Si' : 'No'}</span></td>
            <td style="font-family:var(--font-mono)">${u.xp}</td>
            <td style="font-family:var(--font-mono)">${u.xp_historical}</td>
            <td>${u.referral_count}</td>
            <td><button class="btn btn-secondary" onclick="toggleBuyer(${u.id}, ${!u.is_buyer})">
              ${u.is_buyer ? 'Quitar comprador' : 'Marcar comprador'}
            </button></td>
          </tr>`
          )
          .join('')}
      </table>
    `;

    const select = document.getElementById('grant-user-select');
    select.innerHTML = cachedUsers
      .map((u) => `<option value="${u.id}">${u.username} (${u.first_name} ${u.last_name})</option>`)
      .join('');
  } catch (err) {
    document.getElementById('users-list').innerHTML = `<p class="message error">Error: ${err.message}</p>`;
  }
}

async function toggleBuyer(userId, newValue) {
  try {
    await apiRequest(`/users/${userId}/buyer-status`, { method: 'PATCH', body: { is_buyer: newValue } });
    loadUsers();
  } catch (err) {
    setMessage('message', 'Error: ' + err.message, 'error');
  }
}

async function grantXp() {
  const userId = document.getElementById('grant-user-select').value;
  const euros = document.getElementById('grant-euros').value;

  if (!userId) {
    setMessage('grant-message', 'Selecciona un usuario.', 'error');
    return;
  }

  try {
    const result = await apiRequest(`/users/${userId}/grant-xp`, { method: 'POST', body: { euros } });
    setMessage('grant-message', result.message, 'success');
    document.getElementById('grant-euros').value = '';
    loadUsers();
  } catch (err) {
    setMessage('grant-message', 'Error: ' + err.message, 'error');
  }
}

async function createTcg() {
  const name = document.getElementById('tcg-name').value;
  const imageInput = document.getElementById('tcg-image');

  const formData = new FormData();
  formData.append('name', name);
  if (imageInput.files[0]) formData.append('image', imageInput.files[0]);

  try {
    await apiUpload('/tcgs', formData);
    setMessage('message', 'TCG añadido.', 'success');
    document.getElementById('tcg-name').value = '';
    imageInput.value = '';
  } catch (err) {
    setMessage('message', 'Error: ' + err.message, 'error');
  }
}

loadUsers();
