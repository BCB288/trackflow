const QRCode = require('qrcode');
const { randomUUID: uuidv4 } = require('crypto');

function generateTrackingCode() {
  const prefix = 'TF';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().split('-')[0].toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

async function generateQRCode(trackingCode, baseUrl) {
  const trackingUrl = `${baseUrl}/track/${trackingCode}`;
  const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
  return { qrDataUrl, trackingUrl };
}

async function generateQRCodeBuffer(trackingCode, baseUrl) {
  const trackingUrl = `${baseUrl}/track/${trackingCode}`;
  const buffer = await QRCode.toBuffer(trackingUrl, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'H',
  });
  return buffer;
}

module.exports = { generateTrackingCode, generateQRCode, generateQRCodeBuffer };
