const app = require('./app');

console.log('STRIPE_SECRET_KEY in server.js:', process.env.STRIPE_SECRET_KEY); // Debug log

const port = 3001;

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});