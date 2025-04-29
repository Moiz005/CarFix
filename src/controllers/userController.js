const UserModel = require('../models/userModel');
const BookingModel = require('../models/bookingModel');
const MechanicModel = require('../models/mechanicModel');

class UserController {
    static async getHome(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const userId = req.session.userId;
        try {
            const [currentBookings, appointmentHistory] = await BookingModel.getUserBookings(userId);
            res.render('user-home', { currentBookings, appointmentHistory, message: req.query.message });
        } catch (err) {
            console.error('Error fetching user home:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async getProfile(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const userId = req.session.userId;
        try {
            const user = await UserModel.getUserById(userId);
            if (!user) {
                req.session.destroy();
                return res.redirect('/');
            }
            res.render('user-profile', { user, message: req.query.message });
        } catch (err) {
            console.error('Error fetching user profile:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async updateProfile(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        const userId = req.session.userId;
        const { name, email, phone_number } = req.body;
        if (!name || !email || !phone_number) return res.redirect('/user-profile?message=All fields are required.');
        try {
            const result = await UserModel.updateUser(userId, { name, email, phone_number });
            if (result.affectedRows === 0) return res.redirect('/user-profile?message=User not found.');
            res.redirect('/user-profile?message=Profile updated successfully!');
        } catch (err) {
            console.error('Error updating profile:', err);
            if (err.code === 'ER_DUP_ENTRY') return res.redirect('/user-profile?message=Email already in use.');
            res.redirect('/user-profile?message=Error updating profile.');
        }
    }

    static async getMechanics(req, res) {
        if (req.session.role !== 'user') return res.status(403).send('Forbidden');
        try {
            const mechanics = await MechanicModel.getAllMechanics();
            res.render('view-mechanics', { mechanics: Array.isArray(mechanics) ? mechanics : [], userRole: req.session.role });
        } catch (err) {
            console.error('Error fetching mechanics:', err);
            res.status(500).send('Internal Server Error');
        }
    }
}

module.exports = UserController;