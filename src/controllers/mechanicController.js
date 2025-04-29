const MechanicModel = require('../models/mechanicModel');
const BookingModel = require('../models/bookingModel');

class MechanicController {
    static async getHome(req, res) {
        if (req.session.role !== 'mechanic') return res.status(403).send('Forbidden');
        const mechanicId = req.session.userId;
        try {
            const mechanic = await MechanicModel.getMechanicById(mechanicId);
            if (!mechanic) {
                req.session.destroy();
                return res.status(404).send('Mechanic profile not found. Please log in again.');
            }
            const appointmentCount = await BookingModel.getMechanicOrders(mechanicId).then(orders => orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length);
            res.render('mechanic-home', { mechanic, appointmentCount });
        } catch (err) {
            console.error('Error fetching mechanic home:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async getOrders(req, res) {
        if (req.session.role !== 'mechanic') return res.status(403).send('Forbidden');
        const mechanicId = req.session.userId;
        try {
            const mechanic = await MechanicModel.getMechanicById(mechanicId);
            const orders = await BookingModel.getMechanicOrders(mechanicId);
            res.render('mechanic-orders', { mechanic, orders, message: req.query.message });
        } catch (err) {
            console.error('Error fetching mechanic orders:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async completeOrder(req, res) {
        if (req.session.role !== 'mechanic') return res.status(403).send('Forbidden');
        const mechanicId = req.session.userId;
        const { booking_id } = req.body;
        if (!booking_id) return res.redirect('/mechanic-orders?message=Error: Missing booking ID.');
        try {
            const result = await BookingModel.completeOrder(booking_id, mechanicId);
            if (result.affectedRows === 0) return res.redirect('/mechanic-orders?message=Could not complete order.');
            res.redirect('/mechanic-orders?message=Order marked as completed successfully!');
        } catch (err) {
            console.error('Error completing order:', err);
            res.redirect('/mechanic-orders?message=Error updating booking status.');
        }
    }

    static async getEditProfile(req, res) {
        if (req.session.role !== 'mechanic') return res.status(403).send('Forbidden');
        const mechanicId = req.session.userId;
        try {
            const mechanic = await MechanicModel.getMechanicById(mechanicId);
            if (!mechanic) {
                req.session.destroy();
                return res.redirect('/?message=Profile not found.');
            }
            res.render('edit-mechanic-profile', { mechanic, message: req.query.message });
        } catch (err) {
            console.error('Error fetching mechanic profile:', err);
            res.redirect('/mechanic-home?message=Error loading profile.');
        }
    }

    static async updateProfile(req, res) {
        if (req.session.role !== 'mechanic') return res.status(403).send('Forbidden');
        const mechanicId = req.session.userId;
        const { name, email, phone_number, location, experience_years } = req.body;
        if (!name || !email || !phone_number || !location || experience_years == null) {
            return res.redirect('/edit-mechanic-profile?message=All fields are required.');
        }
        try {
            const result = await MechanicModel.updateMechanic(mechanicId, { name, email, phone_number, location, experience_years: parseInt(experience_years) || 0 });
            if (result.affectedRows === 0) return res.redirect('/edit-mechanic-profile?message=Error: Could not find profile to update.');
            res.redirect('/edit-mechanic-profile?message=Profile updated successfully!');
        } catch (err) {
            console.error('Error updating mechanic profile:', err);
            if (err.code === 'ER_DUP_ENTRY') return res.redirect('/edit-mechanic-profile?message=Error: Email address is already in use.');
            res.redirect('/edit-mechanic-profile?message=Error updating profile.');
        }
    }
}

module.exports = MechanicController;