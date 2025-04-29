const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const MechanicModel = require('../models/mechanicModel');
const UserModel = require('../models/userModel');
const db = require('../config/dbConfig');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class BookingController {
    static getBooking(req, res) {
        res.render('index');
    }

    static async createAppointment(req, res) {
        const { owner, brand, plate, date, time, issue } = req.body;
        const appointmentDateTime = `${date} ${time}`;
        try {
            const customerQuery = 'INSERT INTO customers (name, car_model, notes) VALUES (?, ?, ?)';
            const customerResult = await new Promise((resolve, reject) => {
                db.query(customerQuery, [owner, brand, issue], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            const customerId = customerResult.insertId;
            const appointmentQuery = 'INSERT INTO appointments (owner_name, car_brand, plate_number, appointment_date, customer_id, notes) VALUES (?, ?, ?, ?, ?, ?)';
            await new Promise((resolve, reject) => {
                db.query(appointmentQuery, [owner, brand, plate, appointmentDateTime, customerId, issue], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            res.render('appointment-successful');
        } catch (err) {
            console.error('Error creating appointment:', err);
            res.status(500).send('Error saving the appointment');
        }
    }

    static async getBookAppointments(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        try {
            const services = await ServiceModel.getAllServices();
            const cars = await new Promise((resolve, reject) => {
                db.query('SELECT car_id, make, model, year FROM Cars WHERE user_id = ?', [req.session.userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            const mechanics = await MechanicModel.getAllMechanics();
            const user = await UserModel.getUserById(req.session.userId);
            res.render('book-appointments', {
                services,
                cars,
                mechanics,
                user,
                booking: null,
                isReschedule: false
            });
        } catch (err) {
            console.error('Error fetching booking data:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async bookAppointment(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const { mechanic_id, service_id, car_id, booking_date_time, client_secret } = req.body;
        const userId = req.session.userId;
        try {
            // Verify payment
            const paymentIntent = await stripe.paymentIntents.retrieve(client_secret);
            if (paymentIntent.status !== 'succeeded') {
                return res.status(400).send('Payment not completed.');
            }

            // Check availability
            const count = await BookingModel.checkAvailability(mechanic_id, booking_date_time);
            if (count > 0) return res.status(400).send('This time slot is already booked.');

            // Create booking
            const bookingResult = await BookingModel.createBooking({ userId, mechanic_id, car_id, service_id, booking_date_time });

            // Store payment details
            const service = await new Promise((resolve, reject) => {
                db.query('SELECT estimated_cost FROM Services WHERE service_id = ?', [service_id], (err, results) => {
                    if (err) reject(err);
                    else resolve(results[0]);
                });
            });
            await new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO Payments (booking_id, user_id, amount, payment_method, payment_status, payment_date) VALUES (?, ?, ?, ?, ?, NOW())',
                    [bookingResult.insertId, userId, service.estimated_cost, 'Stripe (Test)', paymentIntent.status],
                    (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    }
                );
            });

            res.redirect('/user-home?message=Booking and payment successful!');
        } catch (err) {
            console.error('Error booking appointment:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async cancelBooking(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const userId = req.session.userId;
        const { booking_id } = req.body;
        if (!booking_id) return res.redirect('/user-home?message=Error: Invalid booking information.');
        try {
            const result = await BookingModel.cancelBooking(booking_id, userId);
            if (result.affectedRows === 0) return res.redirect('/user-home?message=Could not cancel booking.');
            res.redirect('/user-home?message=Booking canceled successfully!');
        } catch (err) {
            console.error('Error canceling booking:', err);
            res.redirect('/user-home?message=Error canceling the booking.');
        }
    }

    static async getRescheduleAppointment(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const userId = req.session.userId;
        const { booking_id } = req.params;
        try {
            const bookingQuery = `
                SELECT b.booking_id, b.mechanic_id, b.car_id, b.service_id, b.booking_date_time,
                       m.name AS mechanic_name, s.service_name, c.make, c.model, c.year,
                       m.location
                FROM Bookings b
                LEFT JOIN Mechanics m ON b.mechanic_id = m.mechanic_id
                LEFT JOIN Services s ON b.service_id = s.service_id
                LEFT JOIN Cars c ON b.car_id = c.car_id
                WHERE b.booking_id = ? AND b.user_id = ? AND b.status IN ('pending', 'confirmed')
            `;
            const [booking] = await new Promise((resolve, reject) => {
                db.query(bookingQuery, [booking_id, userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            if (!booking) {
                return res.redirect('/user-home?message=Invalid or unauthorized booking.');
            }
            const services = await ServiceModel.getAllServices();
            const cars = await new Promise((resolve, reject) => {
                db.query('SELECT car_id, make, model, year FROM Cars WHERE user_id = ?', [userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            const mechanics = await MechanicModel.getAllMechanics();
            const user = await UserModel.getUserById(userId);
            res.render('book-appointments', {
                services,
                cars,
                mechanics,
                user,
                booking,
                isReschedule: true
            });
        } catch (err) {
            console.error('Error fetching reschedule data:', err);
            res.redirect('/user-home?message=Error loading reschedule form.');
        }
    }

    static async rescheduleAppointment(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const userId = req.session.userId;
        const { booking_id, mechanic_id, service_id, car_id, booking_date_time } = req.body;
        if (!booking_id || !booking_date_time || !mechanic_id || !service_id || !car_id) {
            return res.redirect('/user-home?message=Error: Invalid booking information.');
        }
        try {
            const bookingQuery = 'SELECT mechanic_id FROM Bookings WHERE booking_id = ? AND user_id = ? AND status IN ("pending", "confirmed")';
            const [booking] = await new Promise((resolve, reject) => {
                db.query(bookingQuery, [booking_id, userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            if (!booking) {
                return res.redirect('/user-home?message=Invalid or unauthorized booking.');
            }
            const count = await BookingModel.checkAvailability(mechanic_id, booking_date_time);
            if (count > 0) {
                return res.redirect('/user-home?message=This time slot is already booked.');
            }
            const result = await BookingModel.rescheduleBooking(booking_id, userId, mechanic_id, service_id, car_id, booking_date_time);
            if (result.affectedRows === 0) {
                return res.redirect('/user-home?message=Could not reschedule booking.');
            }
            res.redirect('/user-home?message=Booking rescheduled successfully!');
        } catch (err) {
            console.error('Error rescheduling booking:', err);
            res.redirect('/user-home?message=Error rescheduling the booking.');
        }
    }

    static async getMechanicsByService(req, res) {
        const { service_id } = req.params;
        try {
            const query = `
                SELECT m.mechanic_id, m.name, m.location
                FROM Mechanics m
                INNER JOIN Mechanic_Services ms ON m.mechanic_id = ms.mechanic_id
                WHERE ms.service_id = ?
            `;
            const mechanics = await new Promise((resolve, reject) => {
                db.query(query, [service_id], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });
            res.json(mechanics);
        } catch (err) {
            console.error('Error fetching mechanics by service:', err);
            res.status(500).json({ error: 'Error fetching mechanics' });
        }
    }

    static async createPaymentIntent(req, res) {
        const { amount, currency } = req.body;
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount, // In cents
                currency,
                payment_method_types: ['card']
            });
            res.json({ clientSecret: paymentIntent.client_secret });
        } catch (err) {
            console.error('Error creating Payment Intent:', err);
            res.status(500).json({ error: 'Failed to create Payment Intent' });
        }
    }
}

module.exports = BookingController;