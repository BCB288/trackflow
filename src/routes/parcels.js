const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const { getDb } = require('../models/database');
const { generateTrackingCode, generateQRCode } = require('../services/qrcode');
const { authenticate, requireMinRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, requireMinRole('admin'), async (req, res) => {
  try {
    const {
      senderName, senderPhone, senderEmail,
      recipientName, recipientPhone, recipientEmail,
      origin, destination, weightKg, description,
    } = req.body;

    if (!senderName || !recipientName || !recipientPhone || !origin || !destination) {
      return res.status(400).json({ error: 'Missing required fields: senderName, recipientName, recipientPhone, origin, destination' });
    }

    const id = uuidv4();
    const trackingCode = generateTrackingCode();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { qrDataUrl } = await generateQRCode(trackingCode, baseUrl);

    const db = getDb();
    db.prepare(`
      INSERT INTO parcels (id, tracking_code, qr_code_data, sender_name, sender_phone, sender_email,
        recipient_name, recipient_phone, recipient_email, origin, destination, weight_kg, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'registered')
    `).run(id, trackingCode, qrDataUrl, senderName, senderPhone || null, senderEmail || null,
      recipientName, recipientPhone, recipientEmail || null, origin, destination, weightKg || null, description || null);

    db.prepare(`
      INSERT INTO tracking_events (id, parcel_id, status, location, notes)
      VALUES (?, ?, 'registered', ?, 'Colis enregistré dans le système')
    `).run(uuidv4(), id, origin);

    res.status(201).json({
      id,
      trackingCode,
      qrCodeDataUrl: qrDataUrl,
      status: 'registered',
    });
  } catch (err) {
    console.error('[API] Create parcel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticate, requireMinRole('operator'), (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const db = getDb();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM parcels';
  const params = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const parcels = db.prepare(query).all(...params);

  res.json({
    parcels,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

router.get('/:trackingCode', (req, res) => {
  const db = getDb();
  const parcel = db.prepare('SELECT * FROM parcels WHERE tracking_code = ?').get(req.params.trackingCode);
  if (!parcel) return res.status(404).json({ error: 'Parcel not found' });

  const events = db.prepare('SELECT * FROM tracking_events WHERE parcel_id = ? ORDER BY created_at ASC').all(parcel.id);
  res.json({ ...parcel, events });
});

module.exports = router;
