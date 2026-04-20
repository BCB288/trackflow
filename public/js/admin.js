async function loadDashboard() {
  try {
    const res = await fetch('/api/parcels?limit=100');
    const data = await res.json();
    const parcels = data.parcels || [];

    const counts = { registered: 0, picked_up: 0, in_transit: 0, at_hub: 0, out_for_delivery: 0, arrived: 0, delivered: 0 };
    parcels.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });

    document.getElementById('stats').innerHTML = `
      <div class="stat-card"><div class="stat-number">${parcels.length}</div><div class="stat-label">Total colis</div></div>
      <div class="stat-card"><div class="stat-number">${counts.in_transit + counts.at_hub + counts.out_for_delivery}</div><div class="stat-label">En cours</div></div>
      <div class="stat-card"><div class="stat-number">${counts.arrived + counts.delivered}</div><div class="stat-label">Livrés</div></div>
      <div class="stat-card"><div class="stat-number">${counts.registered}</div><div class="stat-label">En attente</div></div>
    `;

    const tbody = document.getElementById('parcels-table');
    tbody.innerHTML = parcels.map(p => `
      <tr>
        <td><a href="/track/${p.tracking_code}" style="color:var(--primary);font-weight:600;">${p.tracking_code}</a></td>
        <td>${p.recipient_name}</td>
        <td>${p.origin} → ${p.destination}</td>
        <td><span class="status-badge status-${p.status}">${p.status}</span></td>
        <td>${new Date(p.created_at + 'Z').toLocaleDateString('fr-FR')}</td>
      </tr>
    `).join('');
  } catch (err) {
    document.getElementById('stats').innerHTML = '<div class="error-box">Erreur de chargement</div>';
  }
}

async function createParcel(e) {
  e.preventDefault();
  const form = e.target;
  const resultDiv = document.getElementById('create-result');

  const payload = {
    senderName: form.senderName.value.trim(),
    senderPhone: form.senderPhone.value.trim() || undefined,
    recipientName: form.recipientName.value.trim(),
    recipientPhone: form.recipientPhone.value.trim(),
    recipientEmail: form.recipientEmail.value.trim() || undefined,
    origin: form.origin.value.trim(),
    destination: form.destination.value.trim(),
    weightKg: form.weightKg.value ? parseFloat(form.weightKg.value) : undefined,
    description: form.description.value.trim() || undefined,
  };

  try {
    const res = await fetch('/api/parcels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      resultDiv.innerHTML = `<div class="error-box">${data.error}</div>`;
      return;
    }

    resultDiv.innerHTML = `
      <div class="card" style="border-left: 4px solid var(--success);">
        <h3 style="color: var(--success);">Colis créé</h3>
        <p><strong>Code de suivi:</strong> <a href="/track/${data.trackingCode}">${data.trackingCode}</a></p>
        <div style="text-align:center;margin-top:12px;">
          <img src="${data.qrCodeDataUrl}" alt="QR Code" style="max-width:200px;">
        </div>
      </div>
    `;

    form.reset();
    loadDashboard();
  } catch (err) {
    resultDiv.innerHTML = '<div class="error-box">Erreur de connexion</div>';
  }
}

window.addEventListener('DOMContentLoaded', loadDashboard);
