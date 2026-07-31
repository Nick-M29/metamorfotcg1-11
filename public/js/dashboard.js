requireSession();

function setMessage(text, type) {
  const msg = document.getElementById('avatar-message');
  if (!msg) return;
  msg.className = 'message' + (type ? ' ' + type : '');
  msg.textContent = text;
}

async function loadProfile() {
  try {
    const profile = await apiRequest('/users/me');
    const user = getUser();

    if (user && user.role === 'admin') {
      document.getElementById('admin-btn').style.display = 'inline-flex';
    }

    document.getElementById('profile').innerHTML = `
      <div class="stats-row">
        <div class="xp-readout">
          <div class="xp-readout__label">XP disponible</div>
          <div class="xp-readout__value">${profile.xp}</div>
        </div>
        <div class="xp-readout">
          <div class="xp-readout__label">XP historico</div>
          <div class="xp-readout__value">${profile.xp_historical}</div>
        </div>
        <div class="xp-readout">
          <div class="xp-readout__label">Referidos</div>
          <div class="xp-readout__value">${profile.referral_count}</div>
        </div>
      </div>

      <div class="card profile-card">
        <img id="avatar-preview" class="avatar" src="${profile.avatar_url || '/img/avatar-placeholder.svg'}" alt="Foto de perfil">

        <div class="profile-card__info">
          <h3 style="margin-bottom:0.15rem;">${profile.first_name} ${profile.last_name}</h3>
          <p class="card__meta" style="margin:0 0 0.5rem;">@${profile.username}</p>

          <p style="margin:0.3rem 0;">
            <span class="badge badge-accent" style="font-size:0.85rem;">${profile.invitation_code}</span>
            <span class="card__meta" style="margin-left:0.4rem;">tu codigo de invitacion</span>
          </p>

          <p style="margin:0.6rem 0 0.3rem; color:var(--text-primary); font-weight:600;">TCGs favoritos</p>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
            ${
              profile.favorite_tcgs.length
                ? profile.favorite_tcgs
                    .map(
                      (t) => `
                <span class="badge" style="display:flex; align-items:center; gap:0.4rem; padding:0.25rem 0.6rem;">
                  <img class="tcg-thumb" style="width:20px;height:20px;" src="${t.image_url || '/img/tcg-placeholder.svg'}" alt="">
                  ${t.name}
                </span>`
                    )
                    .join('')
                : '<span class="empty-state">Ninguno</span>'
            }
          </div>

          <div class="file-field" style="margin-top:1rem;">
            <input id="avatar-input" type="file" accept="image/*">
            <button class="btn btn-secondary" onclick="uploadAvatar()">Cambiar foto</button>
          </div>
          <p id="avatar-message" class="message"></p>
        </div>
      </div>
    `;
  } catch (err) {
    document.getElementById('profile').innerHTML = `<p class="message error">Error: ${err.message}</p>`;
  }
}

async function uploadAvatar() {
  const input = document.getElementById('avatar-input');
  if (!input.files[0]) {
    setMessage('Selecciona antes una imagen.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('avatar', input.files[0]);

  try {
    const result = await apiUpload('/users/me/avatar', formData);
    document.getElementById('avatar-preview').src = result.avatar_url;
    setMessage('Foto de perfil actualizada.', 'success');
  } catch (err) {
    setMessage('Error: ' + err.message, 'error');
  }
}

loadProfile();
