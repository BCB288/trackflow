const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const parcelsRouter = require('./routes/parcels');
const scanRouter = require('./routes/scan');
const authRouter = require('./routes/auth');
const { authenticate, requireMinRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/auth', authRouter);
app.use('/api/parcels', parcelsRouter);
app.use('/api/scan', authenticate, requireMinRole('operator'), scanRouter);

app.get('/track/:code', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'trackflow', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TrackFlow server running on port ${PORT}`);
});

module.exports = app;
