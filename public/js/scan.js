const STATUS_OPTIONS = [
  { value: 'picked_up', label: 'Collecté' },
  { value: 'in_transit', label: 'En transit' },
  { value: 'at_hub', label: 'Au hub' },
  { value: 'out_for_delivery', label: 'En livraison' },
  { value: 'arrived', label: 'Arrivé à destination' },
  { value: 'delivered', label: 'Livré' },
];

async function submitScan(e) {
  e.preventDefault();
  const form = e.target;
  const resultDiv = document.getElementById('scan-result');

  const payload = {
    trackingCode: form.trackingCode.value.trim(),
    status: form.status.value,
    location: form.location.value.trim(),
    scannedBy: form.scannedBy.value.trim() || undefined,
    notes: form.notes.value.trim() || undefined,
  };

  if (!payload.trackingCode || !payload.status || !payload.location) {
    resultDiv.innerHTML = '<div class="error-box">Veuillez remplir tous les champs obligatoires.</div>';
    return;
  }

  resultDiv.innerHTML = '<div class="loading">Enregistrement du scan...</div>';

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      resultDiv.innerHTML = `<div class="error-box">${data.error || 'Erreur lors du scan'}</div>`;
      return;
    }

    resultDiv.innerHTML = `
      <div class="card" style="border-left: 4px solid var(--success);">
        <h3 style="color: var(--success);">Scan enregistré</h3>
        <p><strong>Code:</strong> ${data.trackingCode}</p>
        <p><strong>Statut:</strong> ${data.currentStatus}</p>
        <p><strong>Lieu:</strong> ${data.location}</p>
        <p style="font-size:0.85rem;color:var(--gray-500);margin-top:8px;">${data.events.length} événement(s) enregistré(s)</p>
      </div>
    `;

    form.trackingCode.value = '';
    form.notes.value = '';
  } catch (err) {
    resultDiv.innerHTML = '<div class="error-box">Erreur de connexion. Réessayez.</div>';
  }
}
