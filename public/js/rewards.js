requireSession();
const user = getUser();
if (user && user.role === 'admin') {
  document.getElementById('create-product-box').style.display = 'block';
  apiRequest('/tcgs').then((tcgs) => {
    document.getElementById('pr-tcg').innerHTML = tcgs.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  });
}

function setMessage(text, type) {
  const msg = document.getElementById('message');
  msg.className = 'message' + (type ? ' ' + type : '');
  msg.textContent = text;
}

async function loadProducts() {
  try {
    const products = await apiRequest('/rewards');
    const container = document.getElementById('products-list');

    if (products.length === 0) {
      container.innerHTML = '<p class="empty-state">Aun no hay productos en el catalogo.</p>';
      return;
    }

    container.innerHTML = products
      .map(
        (p) => `
        <div class="card">
          <img class="card__image" src="${p.image_url || '/img/product-placeholder.svg'}" alt="${p.name}">
          <h3 class="card__title">${p.name}</h3>
          <p class="card__meta">${p.tcg_name} · ${p.expansion_set || 'Sin coleccion'} · ${p.rarity || 'Sin rareza'}</p>
          <p class="card__stats">Stock: ${p.stock}</p>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.75rem;">
            <span class="badge badge-accent">${p.price_xp} XP</span>
            <button class="btn btn-primary" ${p.stock === 0 ? 'disabled' : ''} onclick="redeem(${p.id})">
              ${p.stock === 0 ? 'Sin stock' : 'Canjear'}
            </button>
          </div>
        </div>`
      )
      .join('');
  } catch (err) {
    document.getElementById('products-list').innerHTML = `<p class="message error">Error: ${err.message}</p>`;
  }
}

async function loadOrders() {
  try {
    const orders = await apiRequest('/rewards/orders/mine');
    const container = document.getElementById('orders-list');
    if (orders.length === 0) {
      container.innerHTML = '<p class="empty-state">Aun no has canjeado nada.</p>';
      return;
    }
    container.innerHTML = orders
      .map(
        (o) => `
        <div class="card" style="margin-bottom:0.75rem;">
          <p class="card__meta">Canje #${o.id} · ${new Date(o.created_at).toLocaleString()}</p>
          <p class="card__stats">Total: <span class="badge badge-accent">${o.total_xp_spent} XP</span></p>
          <ul style="color:var(--text-secondary); margin:0.4rem 0 0; padding-left:1.1rem;">
            ${o.items.map((i) => `<li>${i.quantity} x ${i.product_name} (${i.xp_at_claim} XP c/u)</li>`).join('')}
          </ul>
        </div>`
      )
      .join('');
  } catch (err) {
    document.getElementById('orders-list').innerHTML = `<p class="message error">Error: ${err.message}</p>`;
  }
}

async function redeem(productId) {
  const quantity = parseInt(prompt('¿Cuantas unidades quieres canjear?', '1'), 10) || 1;
  try {
    await apiRequest(`/rewards/${productId}/redeem`, { method: 'POST', body: { quantity } });
    setMessage('Canje realizado con exito.', 'success');
    loadProducts();
    loadOrders();
  } catch (err) {
    setMessage('Error: ' + err.message, 'error');
  }
}

async function createProduct() {
  const imageInput = document.getElementById('pr-image');
  const formData = new FormData();
  formData.append('name', document.getElementById('pr-name').value);
  formData.append('tcg_id', document.getElementById('pr-tcg').value);
  formData.append('expansion_set', document.getElementById('pr-set').value);
  formData.append('rarity', document.getElementById('pr-rarity').value);
  formData.append('price_xp', document.getElementById('pr-price').value);
  formData.append('stock', document.getElementById('pr-stock').value);
  if (imageInput.files[0]) formData.append('image', imageInput.files[0]);

  try {
    await apiUpload('/rewards', formData);
    setMessage('Producto creado.', 'success');
    imageInput.value = '';
    loadProducts();
  } catch (err) {
    setMessage('Error: ' + err.message, 'error');
  }
}

loadProducts();
loadOrders();
