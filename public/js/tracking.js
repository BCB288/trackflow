const STATUS_LABELS = {
  registered: 'Enregistré',
  picked_up: 'Collecté',
  in_transit: 'En transit',
  at_hub: 'Au hub',
  out_for_delivery: 'En livraison',
  arrived: 'Arrivé',
  delivered: 'Livré',
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'Z');
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function searchParcel(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('tracking-input');
  const code = input.value.trim();
  if (!code) return;

  const resultDiv = document.getElementById('tracking-result');
  resultDiv.innerHTML = '<div class="loading">Recherche en cours...</div>';

  try {
    const res = await fetch(`/api/parcels/${encodeURIComponent(code)}`);
    if (!res.ok) {
      resultDiv.innerHTML = '<div class="error-box">Colis non trouvé. Vérifiez votre numéro de suivi.</div>';
      return;
    }

    const parcel = await res.json();
    renderTracking(parcel, resultDiv);
  } catch (err) {
    resultDiv.innerHTML = '<div class="error-box">Erreur de connexion. Réessayez.</div>';
  }
}

function renderTracking(parcel, container) {
  const events = (parcel.events || []).slice().reverse();

  container.innerHTML = `
    <div class="tracking-result">
      <div class="tracking-header">
        <h3>Suivi de votre colis</h3>
        <div class="tracking-code">${parcel.tracking_code}</div>
      </div>
      <div class="tracking-info">
        <div class="row">
          <div><span class="label">Statut</span><br><span class="status-badge status-${parcel.status}">${STATUS_LABELS[parcel.status] || parcel.status}</span></div>
          <div><span class="label">Destinataire</span><br><span class="value">${parcel.recipient_name}</span></div>
        </div>
        <div class="row">
          <div><span class="label">Origine</span><br><span class="value">${parcel.origin}</span></div>
          <div><span class="label">Destination</span><br><span class="value">${parcel.destination}</span></div>
        </div>
        ${parcel.weight_kg ? `<div class="row"><div><span class="label">Poids</span><br><span class="value">${parcel.weight_kg} kg</span></div></div>` : ''}
      </div>
      <div class="timeline">
        <h4>Historique du suivi</h4>
        ${events.map((ev, i) => `
          <div class="timeline-item">
            <div class="timeline-dot">${events.length - i}</div>
            <div class="timeline-content">
              <div class="event-status">${STATUS_LABELS[ev.status] || ev.status}</div>
              <div class="event-location">${ev.location}</div>
              <div class="event-time">${formatDate(ev.created_at)}</div>
              ${ev.notes ? `<div class="event-notes">${ev.notes}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      ${parcel.qr_code_data ? `
        <div class="qr-section">
          <p style="font-size:0.85rem;color:var(--gray-500);margin-bottom:8px;">QR Code du colis</p>
          <img src="${parcel.qr_code_data}" alt="QR Code ${parcel.tracking_code}">
        </div>
      ` : ''}
    </div>
  `;
}

const path = window.location.pathname;
if (path.startsWith('/track/') && path.length > 7) {
  window.addEventListener('DOMContentLoaded', () => {
    const code = decodeURIComponent(path.slice(7));
    document.getElementById('tracking-input').value = code;
    searchParcel();
  });
}
