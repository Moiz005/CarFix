const express = require('express');
const BookingController = require('../controllers/bookingController');
const router = express.Router();

router.get('/booking', BookingController.getBooking);
router.post('/create-appointment', BookingController.createAppointment);
router.get('/book-appointments', BookingController.getBookAppointments);
router.post('/book-appointments', BookingController.bookAppointment);
router.post('/booking/cancel', BookingController.cancelBooking);
router.get('/booking/reschedule/:booking_id', BookingController.getRescheduleAppointment);
router.post('/booking/reschedule', BookingController.rescheduleAppointment);
router.get('/booking/mechanics-by-service/:service_id', BookingController.getMechanicsByService);
router.post('/booking/create-payment-intent', BookingController.createPaymentIntent);

module.exports = router;