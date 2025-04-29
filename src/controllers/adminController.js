const MechanicModel = require('../models/mechanicModel');
const ServiceModel = require('../models/serviceModel');
const UserModel = require('../models/userModel');
const BookingModel = require('../models/bookingModel');

class AdminController {
    static async getDashboard(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        try {
            const mechanicsCount = await MechanicModel.getAllMechanics().then(mechanics => mechanics.length);
            const servicesCount = await ServiceModel.getAllServices().then(services => services.length);
            const customersCount = await UserModel.getAllUsers().then(users => users.length);
            const ordersCount = await BookingModel.getAllBookings().then(bookings => bookings.length);
            const stats = {
                totalMechanics: mechanicsCount,
                totalServices: servicesCount,
                totalCustomers: customersCount,
                totalOrders: ordersCount
            };
            res.render('admin', { stats });
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async getAddMechanic(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        try {
            const services = await ServiceModel.getAllServices();
            res.render('addmechanic', { services, message: req.query.message });
        } catch (err) {
            console.error('Error fetching services for add mechanic:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async addMechanic(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        const { name, email, phone_number, location, experience_years, password, service_ids } = req.body;
        console.log('Received form data:', { name, email, phone_number, location, experience_years, service_ids });
        if (!name || !email || !phone_number || !location || !experience_years || !password) {
            return res.redirect('/add-mechanic?message=All fields are required');
        }
        try {
            let validServiceIds = [];
            if (service_ids) {
                const services = await ServiceModel.getAllServices();
                const serviceIdSet = new Set(services.map(s => s.service_id.toString()));
                validServiceIds = (Array.isArray(service_ids) ? service_ids : [service_ids])
                    .filter(id => serviceIdSet.has(id.toString()));
                console.log('Valid service_ids after validation:', validServiceIds);
            }
            await MechanicModel.addMechanic({
                name,
                email,
                phone_number,
                location,
                experience_years,
                password,
                service_ids: validServiceIds
            });
            res.redirect('/mechanic?message=Mechanic added successfully!');
        } catch (err) {
            console.error('Error adding mechanic:', err);
            res.redirect('/add-mechanic?message=Error occurred while adding mechanic');
        }
    }

    static async getServices(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        try {
            const services = await ServiceModel.getAllServices();
            res.render('Service', { services, message: req.query.message });
        } catch (err) {
            console.error('Error fetching services:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async addService(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        const { service_name, service_type, estimated_cost } = req.body;
        if (!service_name || !service_type || !estimated_cost) {
            return res.redirect('/Service?message=All fields are required');
        }
        try {
            await ServiceModel.addService({ service_name, service_type, estimated_cost });
            res.redirect('/Service?message=Service added successfully!');
        } catch (err) {
            console.error('Error adding service:', err);
            res.redirect('/Service?message=Error adding service');
        }
    }

    static async getCustomers(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        try {
            const customers = await UserModel.getAllUsers();
            res.render('customers', { customers });
        } catch (err) {
            console.error('Error fetching customers:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async getMechanics(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        try {
            const mechanics = await MechanicModel.getAllMechanics();
            const services = await ServiceModel.getAllServices();
            res.render('mechanic', { mechanic: mechanics, message: req.query.message });
        } catch (err) {
            console.error('Error fetching mechanics:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async getOrders(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        try {
            const orders = await BookingModel.getAllBookings();
            const mechanics = await MechanicModel.getAllMechanics(); // Fetch mechanics
            res.render('orders', { orders, mechanics, message: req.query.message });
        } catch (err) {
            console.error('Error fetching orders:', err);
            res.status(500).send('Internal Server Error');
        }
    }

    static async assignMechanic(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        const { booking_id, mechanic_id } = req.body;
        if (!booking_id || !mechanic_id) return res.redirect('/orders?message=Error: Missing booking or mechanic ID.');
        try {
            await BookingModel.assignMechanic(booking_id, mechanic_id);
            res.redirect('/orders?message=Mechanic assigned successfully!');
        } catch (err) {
            console.error('Error assigning mechanic:', err);
            res.redirect('/orders?message=Error assigning mechanic.');
        }
    }

    static async dropMechanic(req, res) {
        if (req.session.role !== 'admin') return res.status(403).send('Forbidden');
        const { mechanic_id } = req.params;
        try {
            await MechanicModel.deleteMechanic(mechanic_id);
            res.redirect('/mechanic?message=Mechanic deleted successfully!');
        } catch (err) {
            console.error('Error deleting mechanic:', err);
            const message = err.message === 'Cannot delete mechanic with active bookings'
                ? 'Cannot delete mechanic because they have active bookings'
                : 'Error deleting mechanic';
            res.redirect(`/mechanic?message=${encodeURIComponent(message)}`);
        }
    }
}

module.exports = AdminController;