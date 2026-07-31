requireSession();
const user = getUser();
const isAdmin = user && user.role === 'admin';

if (isAdmin) {
  document.getElementById('create-event-box').style.display = 'block';
}

function setMessage(text, type) {
  const msg = document.getElementById('message');
  msg.className = 'message' + (type ? ' ' + type : '');
  msg.textContent = text;
}

async function loadEvents() {
  try {
    const events = await apiRequest('/events');
    const container = document.getElementById('events-list');

    if (events.length === 0) {
      container.innerHTML = '<p class="empty-state">Todavia no hay eventos creados.</p>';
      return;
    }

    container.innerHTML = events
      .map((e) => {
        const dateStr = new Date(e.date_realization).toLocaleString();
        const full = e.current_players >= e.max_players;
        let actions = e.finalized
          ? '<span class="badge badge-success">Finalizado</span>'
          : `<button class="btn btn-primary" ${full ? 'disabled' : ''} onclick="registerToEvent(${e.id})">
              ${full ? 'Completo' : 'Inscribirme'}
            </button>`;
        if (isAdmin && !e.finalized) {
          actions += ` <button class="btn btn-secondary" onclick="showFinalizePanel(${e.id})">Gestionar</button>`;
        }
        return `
          <div class="card">
            <h3 class="card__title">${e.title}</h3>
            <p class="card__meta">${e.description || 'Sin descripcion'}</p>
            <p class="card__meta">${dateStr}</p>
            <p class="card__stats">Plazas: ${e.current_players} / ${e.max_players}</p>
            <p class="card__stats">
              +${e.participation_xp} participar &nbsp;|&nbsp; +${e.winner_xp} ganar &nbsp;|&nbsp;
              -${e.loser_xp} perder &nbsp;|&nbsp; -${e.no_show_xp} no-show
            </p>
            <div style="margin-top:0.75rem;">${actions}</div>
            <div id="finalize-panel-${e.id}" style="margin-top:0.75rem;"></div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    document.getElementById('events-list').innerHTML = `<p class="message error">Error: ${err.message}</p>`;
  }
}

async function registerToEvent(eventId) {
  try {
    await apiRequest(`/events/${eventId}/register`, { method: 'POST' });
    setMessage('Inscripcion realizada.', 'success');
    loadEvents();
  } catch (err) {
    setMessage('Error: ' + err.message, 'error');
  }
}

async function createEvent() {
  const body = {
    title: document.getElementById('ev-title').value,
    description: document.getElementById('ev-description').value,
    date_realization: document.getElementById('ev-date').value,
    max_players: parseInt(document.getElementById('ev-max').value, 10),
    participation_xp: parseInt(document.getElementById('ev-participation').value, 10),
    winner_xp: parseInt(document.getElementById('ev-winner').value, 10),
    loser_xp: parseInt(document.getElementById('ev-loser').value, 10),
    no_show_xp: parseInt(document.getElementById('ev-noshow').value, 10),
  };

  try {
    await apiRequest('/events', { method: 'POST', body });
    setMessage('Evento creado.', 'success');
    loadEvents();
  } catch (err) {
    setMessage('Error: ' + err.message, 'error');
  }
}

async function showFinalizePanel(eventId) {
  const panel = document.getElementById(`finalize-panel-${eventId}`);
  try {
    const attendees = await apiRequest(`/events/${eventId}/attendees`);
    if (attendees.length === 0) {
      panel.innerHTML = '<p class="empty-state">No hay inscritos.</p>';
      return;
    }

    panel.innerHTML = `
      <table>
        <tr><th>Usuario</th><th>Asistio</th><th>Gano</th></tr>
        ${attendees
          .map(
            (a) => `
          <tr>
            <td>${a.username}</td>
            <td><input type="checkbox" id="att-${a.user_id}" checked></td>
            <td><input type="checkbox" id="win-${a.user_id}"></td>
          </tr>`
          )
          .join('')}
      </table>
      <button class="btn btn-primary" style="margin-top:0.6rem;" onclick="finalizeEvent(${eventId}, [${attendees
        .map((a) => a.user_id)
        .join(',')}])">
        Confirmar y repartir XP
      </button>
    `;
  } catch (err) {
    panel.innerHTML = `<p class="message error">Error: ${err.message}</p>`;
  }
}

async function finalizeEvent(eventId, userIds) {
  const results = userIds.map((uid) => ({
    user_id: uid,
    attended: document.getElementById(`att-${uid}`).checked,
    is_winner: document.getElementById(`win-${uid}`).checked,
  }));

  try {
    await apiRequest(`/events/${eventId}/finalize`, { method: 'POST', body: { results } });
    setMessage('Evento finalizado, XP repartido.', 'success');
    loadEvents();
  } catch (err) {
    setMessage('Error: ' + err.message, 'error');
  }
}

loadEvents();
