require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const authMiddleware = require('./middleware/auth');
const lettersRoutes = require('./routes/letters.routes');
const numbersRoutes = require('./routes/numbers.routes');
const officersRoutes = require('./routes/officers.routes');
const linksRoutes = require('./routes/links.routes');
const subjectOfficerRoutes = require('./routes/subject-officer.routes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/auth/login', authMiddleware.login);
app.post('/api/auth/logout', authMiddleware.logout);

app.use('/api/letters', lettersRoutes);
app.use('/api/numbers', numbersRoutes);
app.use('/api/officers', officersRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/subject-officer', subjectOfficerRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Letter Management System listening on http://localhost:${PORT}`);
});
