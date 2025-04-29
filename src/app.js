const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'config', '.env') });

console.log('STRIPE_SECRET_KEY in app.js:', process.env.STRIPE_SECRET_KEY); // Debug log

const express = require('express');
const session = require('express-session');
const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

function isAuthenticated(req, res, next) {
    if (req.session.userId && req.session.role) return next();
    res.redirect('/');
}

app.use((req, res, next) => {
    console.log(`Request URL: ${req.originalUrl}, Session:`, req.session);
    if (req.session.userId) {
        // Redirect only for root path or empty path
        if (req.path === '/' || req.path === '') {
            if (req.session.role === 'admin') return res.redirect('/admin');
            if (req.session.role === 'user') return res.redirect('/user-home');
            if (req.session.role === 'mechanic') return res.redirect('/mechanic-home');
        }
        // Allow other routes to proceed
        return next();
    }
    if (req.path === '/' || req.path === '') return res.render('login');
    next();
});

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const mechanicRoutes = require('./routes/mechanicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', mechanicRoutes);
app.use('/', adminRoutes);
app.use('/', bookingRoutes);

// 404 Handler
app.use((req, res) => {
    console.log('404 for URL:', req.originalUrl);
    res.status(404).render('404');
});

module.exports = app;