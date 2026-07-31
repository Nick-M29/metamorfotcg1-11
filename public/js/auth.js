// Si estamos en la pagina de registro, cargamos el listado de TCGs como checkboxes con imagen
if (document.getElementById('tcg-list')) {
  apiRequest('/tcgs')
    .then((tcgs) => {
      const container = document.getElementById('tcg-list');
      container.innerHTML = tcgs
        .map(
          (t) => `
        <label>
          <input type="checkbox" name="tcg" value="${t.id}">
          <img class="tcg-thumb" src="${t.image_url || '/img/tcg-placeholder.svg'}" alt="">
          ${t.name}
        </label>`
        )
        .join('');
    })
    .catch((err) => {
      document.getElementById('tcg-list').innerHTML = `<p class="message error">No se pudieron cargar los TCGs: ${err.message}</p>`;
    });
}

async function doRegister() {
  const first_name = document.getElementById('first_name').value;
  const last_name = document.getElementById('last_name').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const invitation_code_used = document.getElementById('invitation_code_used').value || undefined;

  const tcg_ids = Array.from(document.querySelectorAll('input[name="tcg"]:checked')).map((el) =>
    parseInt(el.value, 10)
  );

  const msg = document.getElementById('message');
  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: { first_name, last_name, username, password, tcg_ids, invitation_code_used },
    });
    msg.className = 'message success';
    msg.textContent = 'Cuenta creada. Ya puedes iniciar sesion.';
    setTimeout(() => (window.location.href = '/login.html'), 1000);
  } catch (err) {
    msg.className = 'message error';
    msg.textContent = 'Error: ' + err.message;
  }
}

async function doLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('message');

  try {
    const { token, user } = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setSession(token, user);
    window.location.href = '/dashboard.html';
  } catch (err) {
    msg.className = 'message error';
    msg.textContent = 'Error: ' + err.message;
  }
}
