const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const { sendSMS, buildArrivalMessage, buildStatusUpdateMessage, detectLanguage } = require('../services/sms');

const router = express.Router();

const VALID_STATUSES = ['registered', 'picked_up', 'in_transit', 'at_hub', 'out_for_delivery', 'arrived', 'delivered'];

router.post('/', async (req, res) => {
  try {
    const { trackingCode, status, location, scannedBy, notes } = req.body;

    if (!trackingCode || !status || !location) {
      return res.status(400).json({ error: 'Missing required fields: trackingCode, status, location' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    }

    const db = getDb();
    const parcel = db.prepare('SELECT * FROM parcels WHERE tracking_code = ?').get(trackingCode);
    if (!parcel) return res.status(404).json({ error: 'Parcel not found' });

    db.prepare(`
      INSERT INTO tracking_events (id, parcel_id, status, location, scanned_by, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), parcel.id, status, location, scannedBy || null, notes || null);

    db.prepare(`UPDATE parcels SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, parcel.id);

    if (status === 'arrived' && !parcel.sms_notified) {
      const lang = detectLanguage(parcel.recipient_phone);
      const message = buildArrivalMessage(parcel.recipient_name, parcel.tracking_code, parcel.destination, lang);
      const smsResult = await sendSMS(parcel.recipient_phone, message);
      if (smsResult.success) {
        db.prepare('UPDATE parcels SET sms_notified = 1 WHERE id = ?').run(parcel.id);
      }
    }

    const events = db.prepare('SELECT * FROM tracking_events WHERE parcel_id = ? ORDER BY created_at ASC').all(parcel.id);

    res.json({
      trackingCode: parcel.tracking_code,
      currentStatus: status,
      location,
      events,
    });
  } catch (err) {
    console.error('[API] Scan error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch', async (req, res) => {
  const { scans } = req.body;
  if (!Array.isArray(scans)) return res.status(400).json({ error: 'scans must be an array' });

  const results = [];
  for (const scan of scans) {
    try {
      const db = getDb();
      const parcel = db.prepare('SELECT * FROM parcels WHERE tracking_code = ?').get(scan.trackingCode);
      if (!parcel) {
        results.push({ trackingCode: scan.trackingCode, success: false, error: 'Not found' });
        continue;
      }

      db.prepare(`
        INSERT INTO tracking_events (id, parcel_id, status, location, scanned_by, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), parcel.id, scan.status, scan.location, scan.scannedBy || null, scan.notes || null);

      db.prepare(`UPDATE parcels SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(scan.status, parcel.id);

      if (scan.status === 'arrived' && !parcel.sms_notified) {
        const lang = detectLanguage(parcel.recipient_phone);
      const message = buildArrivalMessage(parcel.recipient_name, parcel.tracking_code, parcel.destination, lang);
        const smsResult = await sendSMS(parcel.recipient_phone, message);
        if (smsResult.success) {
          db.prepare('UPDATE parcels SET sms_notified = 1 WHERE id = ?').run(parcel.id);
        }
      }

      results.push({ trackingCode: scan.trackingCode, success: true, status: scan.status });
    } catch (err) {
      results.push({ trackingCode: scan.trackingCode, success: false, error: err.message });
    }
  }
  res.json({ results });
});

module.exports = router;
