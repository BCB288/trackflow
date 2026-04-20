const SMS_PROVIDER = process.env.SMS_PROVIDER || 'console';
const MAX_RETRIES = parseInt(process.env.SMS_MAX_RETRIES || '2', 10);
const RETRY_DELAY_MS = parseInt(process.env.SMS_RETRY_DELAY_MS || '1000', 10);

async function sendSMS(phoneNumber, message) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = SMS_PROVIDER === 'twilio'
        ? await sendViaTwilio(phoneNumber, message)
        : await sendViaConsole(phoneNumber, message);
      if (result.success) return result;
      lastError = result.error;
    } catch (err) {
      lastError = err.message;
    }
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  console.error(`[SMS] All ${MAX_RETRIES + 1} attempts failed for ${phoneNumber}: ${lastError}`);
  return { success: false, error: lastError };
}

async function sendViaTwilio(phoneNumber, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error('[SMS] Twilio credentials not configured');
    return { success: false, error: 'Twilio not configured' };
  }

  const client = require('twilio')(accountSid, authToken);
  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to: phoneNumber,
  });
  console.log(`[SMS] Sent to ${phoneNumber}: SID=${result.sid}`);
  return { success: true, sid: result.sid };
}

async function sendViaConsole(phoneNumber, message) {
  console.log(`[SMS-CONSOLE] To: ${phoneNumber}`);
  console.log(`[SMS-CONSOLE] Message: ${message}`);
  return { success: true, provider: 'console' };
}

function buildArrivalMessage(recipientName, trackingCode, destination, lang) {
  if (lang === 'en') {
    return (
      `Hello ${recipientName}, your parcel ${trackingCode} has arrived at ${destination}. ` +
      `It is ready for pickup. Thank you! - TrackFlow`
    );
  }
  return (
    `Bonjour ${recipientName}, votre colis ${trackingCode} est arrivé à ${destination}. ` +
    `Il est disponible pour retrait. Merci de votre confiance ! - TrackFlow`
  );
}

function buildStatusUpdateMessage(recipientName, trackingCode, status, location, lang) {
  const statusLabels = lang === 'en'
    ? {
        registered: 'registered',
        picked_up: 'picked up',
        in_transit: 'in transit',
        at_hub: 'at hub',
        out_for_delivery: 'out for delivery',
        arrived: 'arrived at destination',
        delivered: 'delivered',
      }
    : {
        registered: 'enregistré',
        picked_up: 'collecté',
        in_transit: 'en transit',
        at_hub: 'au hub',
        out_for_delivery: 'en cours de livraison',
        arrived: 'arrivé à destination',
        delivered: 'livré',
      };
  const label = statusLabels[status] || status;
  return (
    `TrackFlow: ${lang === 'en' ? 'Parcel' : 'Colis'} ${trackingCode} - ` +
    `${lang === 'en' ? 'Status' : 'Statut'}: ${label}. ` +
    `${lang === 'en' ? 'Location' : 'Localisation'}: ${location}. ` +
    `${lang === 'en' ? 'Track' : 'Suivi'}: trackflow.app/track/${trackingCode}`
  );
}

function detectLanguage(phoneNumber) {
  if (!phoneNumber) return 'fr';
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.startsWith('1') || cleaned.startsWith('44')) return 'en';
  return 'fr';
}

module.exports = { sendSMS, buildArrivalMessage, buildStatusUpdateMessage, detectLanguage };
