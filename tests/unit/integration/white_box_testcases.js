const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/dbConfig');
const stripe = require('stripe');
const bcrypt = require('bcrypt');
const MechanicModel = require('../src/models/mechanicModel');
const BookingModel = require('../src/models/bookingModel');
const UserModel = require('../src/models/userModel');
const ReviewModel = require('../src/models/reviewModel');
const ServiceModel = require('../src/models/serviceModel');
const AuthController = require('../src/controllers/authController');
const BookingController = require('../src/controllers/bookingController');
const MechanicController = require('../src/controllers/mechanicController');
const UserController = require('../src/controllers/userController');
const AdminController = require('../src/controllers/adminController');

// Mock dependencies
jest.mock('../src/config/dbConfig', () => ({
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
}));

jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: jest.fn(),
            retrieve: jest.fn(),
        },
    }));
});

jest.mock('bcrypt', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

// Setup mock session middleware for integration tests
const mockSession = (userId, role) => ({
    userId,
    role,
    destroy: jest.fn((callback) => callback(null)),
});

// US-001: Register a User Account
describe('US-001: Register a User Account - AuthController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should register a user with valid details', async () => {
        const req = {
            body: {
                email: 'test@example.com',
                name: 'Test User',
                phone_number: '1234567890',
                password: 'Pass123',
                confirmPassword: 'Pass123',
                role: 'user',
                make: 'Toyota',
                model: 'Camry',
                year: '2020',
            },
        };
        const res = {
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        bcrypt.hash.mockResolvedValue('hashedPassword');
        db.query
            .mockResolvedValueOnce({ insertId: 1 }) // Insert into Users
            .mockResolvedValueOnce({ affectedRows: 1 }); // Insert into Cars

        await AuthController.register(req, res);

        expect(db.query).toHaveBeenCalledWith(
            'INSERT INTO Users (email, password, name, phone_number) VALUES (?, ?, ?, ?)',
            ['test@example.com', 'hashedPassword', 'Test User', '1234567890']
        );
        expect(db.query).toHaveBeenCalledWith(
            'INSERT INTO Cars (user_id, make, model, year) VALUES (?, ?, ?, ?)',
            [1, 'Toyota', 'Camry', '2020']
        );
        expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('should fail if passwords do not match', async () => {
        const req = {
            body: {
                email: 'test@example.com',
                password: 'Pass123',
                confirmPassword: 'Pass456',
                role: 'user',
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await AuthController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith('Passwords do not match');
    });

    it('should handle duplicate email error', async () => {
        const req = {
            body: {
                email: 'test@example.com',
                name: 'Test User',
                phone_number: '1234567890',
                password: 'Pass123',
                confirmPassword: 'Pass123',
                role: 'user',
                make: 'Toyota',
                model: 'Camry',
                year: '2020',
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        bcrypt.hash.mockResolvedValue('hashedPassword');
        db.query.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

        await AuthController.register(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith('Internal Server Error');
    });
});

// US-002: Log in to the System
describe('US-002: Log in to the System - AuthController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should log in a user with valid credentials', async () => {
        const req = {
            body: {
                email: 'test@example.com',
                password: 'Pass123',
                role: 'user',
            },
            session: {},
        };
        const res = {
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        db.query.mockResolvedValueOnce([{ user_id: 1, password: 'hashedPassword' }]);
        bcrypt.compare.mockResolvedValue(true);

        await AuthController.login(req, res);

        expect(req.session.userId).toBe(1);
        expect(req.session.role).toBe('user');
        expect(res.redirect).toHaveBeenCalledWith('/user-home');
    });

    it('should fail with invalid password', async () => {
        const req = {
            body: {
                email: 'test@example.com',
                password: 'WrongPass',
                role: 'user',
            },
            session: {},
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        db.query.mockResolvedValueOnce([{ user_id: 1, password: 'hashedPassword' }]);
        bcrypt.compare.mockResolvedValue(false);

        await AuthController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith('Invalid password');
    });

    it('should fail with non-existent email', async () => {
        const req = {
            body: {
                email: 'fake@example.com',
                password: 'Pass123',
                role: 'user',
            },
            session: {},
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        db.query.mockResolvedValueOnce(undefined);

        await AuthController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith('Invalid email');
    });
});

// US-003: View Mechanic Profiles
describe('US-003: View Mechanic Profiles - UserController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should fetch all mechanics for user', async () => {
        const req = {
            session: { role: 'user' },
        };
        const res = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        db.query.mockResolvedValueOnce([
            { mechanic_id: 1, name: 'Mechanic 1' },
            { mechanic_id: 2, name: 'Mechanic 2' },
        ]);

        await UserController.getMechanics(req, res);

        expect(res.render).toHaveBeenCalledWith('view-mechanics', {
            mechanics: expect.arrayContaining([
                expect.objectContaining({ mechanic_id: 1 }),
                expect.objectContaining({ mechanic_id: 2 }),
            ]),
            userRole: 'user',
        });
    });

    it('should handle forbidden access', async () => {
        const req = {
            session: { role: 'guest' },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await UserController.getMechanics(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.send).toHaveBeenCalledWith('Forbidden');
    });
});

// US-004: Book a Mechanic Appointment
describe('US-004: Book a Mechanic Appointment - BookingController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should book an appointment with valid details', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: {
                mechanic_id: 1,
                service_id: 1,
                car_id: 1,
                booking_date_time: '2025-05-01 10:00:00',
                client_secret: 'pi_secret',
            },
        };
        const res = {
            redirect: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        stripe().paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded' });
        db.query
            .mockResolvedValueOnce([{ count: 0 }]) // checkAvailability
            .mockResolvedValueOnce({ insertId: 1 }) // createBooking
            .mockResolvedValueOnce([{ estimated_cost: 50 }]) // get service cost
            .mockResolvedValueOnce({ affectedRows: 1 }); // insert payment

        await BookingController.bookAppointment(req, res);

        expect(db.query).toHaveBeenCalledWith(
            'SELECT COUNT(*) as count FROM Bookings WHERE mechanic_id = ? AND booking_date_time = ? AND status NOT IN ("canceled")',
            [1, '2025-05-01 10:00:00']
        );
        expect(db.query).toHaveBeenCalledWith(
            'INSERT INTO Bookings (user_id, mechanic_id, car_id, service_id, booking_date_time, status) VALUES (?, ?, ?, ?, ?, "pending")',
            [1, 1, 1, 1, '2025-05-01 10:00:00']
        );
        expect(res.redirect).toHaveBeenCalledWith('/user-home?message=Booking and payment successful!');
    });

    it('should fail if time slot is booked', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: {
                mechanic_id: 1,
                service_id: 1,
                car_id: 1,
                booking_date_time: '2025-05-01 10:00:00',
                client_secret: 'pi_secret',
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        stripe().paymentIntents.retrieve.mockResolvedValue({ status: 'succeeded' });
        db.query.mockResolvedValueOnce([{ count: 1 }]); // checkAvailability

        await BookingController.bookAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith('This time slot is already booked.');
    });

    it('should fail if payment is not completed', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: {
                mechanic_id: 1,
                service_id: 1,
                car_id: 1,
                booking_date_time: '2025-05-01 10:00:00',
                client_secret: 'pi_secret',
            },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        stripe().paymentIntents.retrieve.mockResolvedValue({ status: 'requires_payment_method' });

        await BookingController.bookAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith('Payment not completed.');
    });
});

// US-005: Select Car Repair Services
describe('US-005: Select Car Repair Services - BookingController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should render booking page with services', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
        };
        const res = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        db.query
            .mockResolvedValueOnce([
                { service_id: 1, service_name: 'Oil Change', estimated_cost: 50 },
                { service_id: 2, service_name: 'Brake Repair', estimated_cost: 150 },
            ]) // getAllServices
            .mockResolvedValueOnce([]) // get user cars
            .mockResolvedValueOnce([]) // getAllMechanics
            .mockResolvedValueOnce({ user_id: 1 }); // getUserById

        await BookingController.getBookAppointments(req, res);

        expect(res.render).toHaveBeenCalledWith('book-appointments', {
            services: expect.arrayContaining([
                expect.objectContaining({ service_name: 'Oil Change', estimated_cost: 50 }),
                expect.objectContaining({ service_name: 'Brake Repair', estimated_cost: 150 }),
            ]),
            cars: [],
            mechanics: [],
            user: expect.objectContaining({ user_id: 1 }),
            booking: null,
            isReschedule: false,
        });
    });
});

// US-006: Cancel a Booking
describe('US-006: Cancel a Booking - BookingController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should cancel a booking', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: { booking_id: 1 },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query.mockResolvedValueOnce({ affectedRows: 1 }); // cancelBooking

        await BookingController.cancelBooking(req, res);

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE Bookings SET status = "canceled", updated_at = NOW() WHERE booking_id = ? AND user_id = ? AND status IN ("pending", "confirmed")',
            [1, 1]
        );
        expect(res.redirect).toHaveBeenCalledWith('/user-home?message=Booking canceled successfully!');
    });

    it('should fail to cancel non-existent booking', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: { booking_id: 999 },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query.mockResolvedValueOnce({ affectedRows: 0 }); // cancelBooking

        await BookingController.cancelBooking(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/user-home?message=Could not cancel booking.');
    });
});

// US-007: Reschedule an Appointment
describe('US-007: Reschedule an Appointment - BookingController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should reschedule an appointment', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: {
                booking_id: 1,
                mechanic_id: 1,
                service_id: 1,
                car_id: 1,
                booking_date_time: '2025-05-02 11:00:00',
            },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query
            .mockResolvedValueOnce([{ mechanic_id: 1 }]) // Check booking
            .mockResolvedValueOnce([{ count: 0 }]) // checkAvailability
            .mockResolvedValueOnce({ affectedRows: 1 }); // rescheduleBooking

        await BookingController.rescheduleAppointment(req, res);

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE Bookings SET mechanic_id = ?, service_id = ?, car_id = ?, booking_date_time = ?, updated_at = NOW() WHERE booking_id = ? AND user_id = ? AND status IN ("pending", "confirmed")',
            [1, 1, 1, '2025-05-02 11:00:00', 1, 1]
        );
        expect(res.redirect).toHaveBeenCalledWith('/user-home?message=Booking rescheduled successfully!');
    });

    it('should fail if time slot is unavailable', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: {
                booking_id: 1,
                mechanic_id: 1,
                service_id: 1,
                car_id: 1,
                booking_date_time: '2025-05-02 11:00:00',
            },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query
            .mockResolvedValueOnce([{ mechanic_id: 1 }]) // Check booking
            .mockResolvedValueOnce([{ count: 1 }]); // checkAvailability

        await BookingController.rescheduleAppointment(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/user-home?message=This time slot is already booked.');
    });
});

// US-008: Submit Feedback for a Mechanic
describe('US-008: Submit Feedback for a Mechanic - ReviewModel', () => {
    afterEach(() => jest.clearAllMocks());

    it('should add a review for a mechanic', async () => {
        const reviewData = {
            mechanic_id: 1,
            userId: 1,
            rating: 4,
            review_text: 'Great service!',
            booking_id: 1,
        };

        db.query.mockResolvedValueOnce({ insertId: 1 });

        const result = await ReviewModel.addReview(reviewData);

        expect(db.query).toHaveBeenCalledWith(
            'INSERT INTO Reviews (mechanic_id, user_id, booking_id, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [1, 1, 1, 4, 'Great service!']
        );
        expect(result.insertId).toBe(1);
    });

    it('should check for existing review', async () => {
        db.query.mockResolvedValueOnce([{ review_id: 1 }]);

        const exists = await ReviewModel.checkExistingReview(1, 1);

        expect(db.query).toHaveBeenCalledWith(
            'SELECT review_id FROM Reviews WHERE user_id = ? AND mechanic_id = ?',
            [1, 1]
        );
        expect(exists).toBe(true);
    });
});

// US-010: View Past Booking History
describe('US-010: View Past Booking History - UserController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should fetch user bookings', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
        };
        const res = {
            render: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        db.query
            .mockResolvedValueOnce([
                { booking_id: 1, status: 'pending', service_name: 'Oil Change' },
            ]) // Current bookings
            .mockResolvedValueOnce([
                { booking_id: 2, status: 'completed', service_name: 'Brake Repair' },
            ]); // History

        await UserController.getHome(req, res);

        expect(res.render).toHaveBeenCalledWith('user-home', {
            currentBookings: expect.arrayContaining([
                expect.objectContaining({ booking_id: 1, status: 'pending' }),
            ]),
            appointmentHistory: expect.arrayContaining([
                expect.objectContaining({ booking_id: 2, status: 'completed' }),
            ]),
            message: undefined,
        });
    });
});

// US-011: Search Mechanics by Service Type
describe('US-011: Search Mechanics by Service Type - BookingController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should fetch mechanics by service', async () => {
        const req = {
            params: { service_id: 1 },
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        db.query.mockResolvedValueOnce([
            { mechanic_id: 1, name: 'Mechanic 1' },
        ]);

        await BookingController.getMechanicsByService(req, res);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('SELECT m.mechanic_id, m.name, m.location FROM Mechanics m INNER JOIN Mechanic_Services ms ON m.mechanic_id = ms.mechanic_id'),
            [1]
        );
        expect(res.json).toHaveBeenCalledWith([
            expect.objectContaining({ mechanic_id: 1, name: 'Mechanic 1' }),
        ]);
    });
});

// US-013: Pay for Services Online
describe('US-013: Pay for Services Online - BookingController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should create a payment intent', async () => {
        const req = {
            body: { amount: 5000, currency: 'usd' },
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };

        stripe().paymentIntents.create.mockResolvedValue({ client_secret: 'pi_secret' });

        await BookingController.createPaymentIntent(req, res);

        expect(stripe().paymentIntents.create).toHaveBeenCalledWith({
            amount: 5000,
            currency: 'usd',
            payment_method_types: ['card'],
        });
        expect(res.json).toHaveBeenCalledWith({ clientSecret: 'pi_secret' });
    });
});

// US-015: Update User Profile
describe('US-015: Update User Profile - UserController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should update user profile', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: { name: 'Updated User', email: 'updated@example.com', phone_number: '0987654321' },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query.mockResolvedValueOnce({ affectedRows: 1 });

        await UserController.updateProfile(req, res);

        expect(db.query).toHaveBeenCalledWith(
            'UPDATE Users SET name = ?, email = ?, phone_number = ? WHERE user_id = ?',
            ['Updated User', 'updated@example.com', '0987654321', 1]
        );
        expect(res.redirect).toHaveBeenCalledWith('/user-profile?message=Profile updated successfully!');
    });

    it('should handle duplicate email', async () => {
        const req = {
            session: { role: 'user', userId: 1 },
            body: { name: 'Updated User', email: 'duplicate@example.com', phone_number: '0987654321' },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

        await UserController.updateProfile(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/user-profile?message=Email already in use.');
    });
});

// US-016: Manage Mechanic Accounts
describe('US-016: Manage Mechanic Accounts - AdminController', () => {
    afterEach(() => jest.clearAllMocks());

    it('should add a mechanic', async () => {
        const req = {
            session: { role: 'admin' },
            body: {
                name: 'New Mechanic',
                email: 'mechanic@example.com',
                phone_number: '1234567890',
                location: 'Downtown',
                experience_years: '5',
                password: 'Pass123',
                service_ids: ['1', '2'],
            },
        };
        const res = {
            redirect: jest.fn(),
        };

        bcrypt.hash.mockResolvedValue('hashedPassword');
        db.query
            .mockResolvedValueOnce([
                { service_id: 1 },
                { service_id: 2 },
            ]) // getAllServices
            .mockResolvedValueOnce({ insertId: 1 }) // Insert Mechanic
            .mockResolvedValueOnce({ affectedRows: 2 }); // Insert Mechanic_Services

        await AdminController.addMechanic(req, res);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO Mechanics (name, email, phone_number, location, experience_years, password, status) VALUES'),
            ['New Mechanic', 'mechanic@example.com', '1234567890', 'Downtown', '5', 'hashedPassword', 'pending']
        );
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO Mechanic_Services (mechanic_id, service_id) VALUES ?'),
            [[[1, '1'], [1, '2']]]
        );
        expect(res.redirect).toHaveBeenCalledWith('/mechanic?message=Mechanic added successfully!');
    });

    it('should drop a mechanic with no bookings', async () => {
        const req = {
            session: { role: 'admin' },
            params: { mechanic_id: 1 },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query
            .mockResolvedValueOnce([{ count: 0 }]) // No bookings
            .mockResolvedValueOnce({ affectedRows: 0 }) // Delete Mechanic_Services
            .mockResolvedValueOnce({ affectedRows: 1 }); // Delete Mechanics

        await AdminController.dropMechanic(req, res);

        expect(db.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM Bookings WHERE mechanic_id = ?', [1]);
        expect(db.query).toHaveBeenCalledWith('DELETE FROM Mechanic_Services WHERE mechanic_id = ?', [1]);
        expect(db.query).toHaveBeenCalledWith('DELETE FROM Mechanics WHERE mechanic_id = ?', [1]);
        expect(res.redirect).toHaveBeenCalledWith('/mechanic?message=Mechanic deleted successfully!');
    });

    it('should fail to drop a mechanic with active bookings', async () => {
        const req = {
            session: { role: 'admin' },
            params: { mechanic_id: 1 },
        };
        const res = {
            redirect: jest.fn(),
        };

        db.query.mockResolvedValueOnce([{ count: 1 }]); // Has bookings

        await AdminController.dropMechanic(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/mechanic?message=Cannot%20delete%20mechanic%20because%20they%20have%20active%20bookings');
    });
});