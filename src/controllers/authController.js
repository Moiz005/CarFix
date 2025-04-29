const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');

class AuthController {
    static async login(req, res) {
        const { email, password, role } = req.body;
        try {
            const user = await UserModel.findUserByEmail(email, role);
            // console.log(`Request URL: ${req.originalUrl}, Session:`, req.session);
            if (!user) return res.status(401).send('Invalid email');
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                req.session.userId = user[`${role}_id`];
                req.session.role = role;
                const redirectPath = role === 'admin' ? '/admin' : role === 'user' ? '/user-home' : '/mechanic-home';
                console.log('Redirecting to:', redirectPath);
                res.redirect(redirectPath);
            } else {
                res.status(401).send('Invalid password');
            }
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static getRegister(req, res) {
        res.render('register');
    }

    static async register(req, res) {
        const { email, name, phone_number, password, confirmPassword, role, make, model, year } = req.body;
        if (password !== confirmPassword) return res.status(400).send('Passwords do not match');
        try {
            await UserModel.createUser({ email, name, phone_number, password, role, make, model, year });
            res.redirect('/');
        } catch (err) {
            console.error('Registration error:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/');
        });
    }
}

module.exports = AuthController;