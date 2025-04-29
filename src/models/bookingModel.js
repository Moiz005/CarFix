const db = require('../config/dbConfig');

class BookingModel {
    static async createBooking({ userId, mechanic_id, car_id, service_id, booking_date_time }) {
        const query = 'INSERT INTO Bookings (user_id, mechanic_id, car_id, service_id, booking_date_time, status) VALUES (?, ?, ?, ?, ?, "pending")';
        return new Promise((resolve, reject) => {
            db.query(query, [userId, mechanic_id, car_id, service_id, booking_date_time], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async checkAvailability(mechanic_id, booking_date_time) {
        const query = 'SELECT COUNT(*) as count FROM Bookings WHERE mechanic_id = ? AND booking_date_time = ? AND status NOT IN ("canceled")';
        return new Promise((resolve, reject) => {
            db.query(query, [mechanic_id, booking_date_time], (err, result) => {
                if (err) reject(err);
                else resolve(result[0].count);
            });
        });
    }

    static async cancelBooking(booking_id, userId) {
        const query = 'UPDATE Bookings SET status = "canceled", updated_at = NOW() WHERE booking_id = ? AND user_id = ? AND status IN ("pending", "confirmed")';
        return new Promise((resolve, reject) => {
            db.query(query, [booking_id, userId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async rescheduleBooking(booking_id, userId, mechanic_id, service_id, car_id, booking_date_time) {
        const query = `
            UPDATE Bookings 
            SET mechanic_id = ?, service_id = ?, car_id = ?, booking_date_time = ?, updated_at = NOW()
            WHERE booking_id = ? AND user_id = ? AND status IN ("pending", "confirmed")
        `;
        return new Promise((resolve, reject) => {
            db.query(query, [mechanic_id, service_id, car_id, booking_date_time, booking_id, userId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async completeOrder(booking_id, mechanicId) {
        const query = 'UPDATE Bookings SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE booking_id = ? AND mechanic_id = ? AND status = "pending"';
        return new Promise((resolve, reject) => {
            db.query(query, [booking_id, mechanicId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async getMechanicOrders(mechanicId) {
        const query = `
      SELECT b.booking_id, b.booking_date_time, b.status, u.name AS customer_name, u.phone_number AS customer_phone,
             s.service_name, s.estimated_cost, c.make AS car_make, c.model AS car_model, c.year AS car_year
      FROM Bookings b
      LEFT JOIN Users u ON b.user_id = u.user_id
      LEFT JOIN Services s ON b.service_id = s.service_id
      LEFT JOIN Cars c ON b.car_id = c.car_id
      WHERE b.mechanic_id = ?
      ORDER BY CASE b.status WHEN "pending" THEN 1 WHEN "confirmed" THEN 2 WHEN "completed" THEN 3 WHEN "canceled" THEN 4 ELSE 5 END, b.booking_date_time ASC
    `;
        return new Promise((resolve, reject) => {
            db.query(query, [mechanicId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    static async getUserBookings(userId) {
        const currentQuery = `
      SELECT b.booking_id, b.booking_date_time, b.status, m.name AS mechanic_name, s.service_name
      FROM Bookings b
      LEFT JOIN Mechanics m ON b.mechanic_id = m.mechanic_id
      LEFT JOIN Services s ON b.service_id = s.service_id
      WHERE b.user_id = ? AND b.status IN ("pending", "confirmed")
      ORDER BY b.booking_date_time ASC
    `;
        const historyQuery = `
      SELECT b.booking_date_time, b.status, m.name AS mechanic_name, s.service_name
      FROM Bookings b
      LEFT JOIN Mechanics m ON b.mechanic_id = m.mechanic_id
      LEFT JOIN Services s ON b.service_id = s.service_id
      WHERE b.user_id = ? AND b.status IN ("completed", "canceled")
      ORDER BY b.booking_date_time DESC
      LIMIT 5
    `;
        return Promise.all([
            new Promise((resolve, reject) => {
                db.query(currentQuery, [userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            }),
            new Promise((resolve, reject) => {
                db.query(historyQuery, [userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            })
        ]);
    }

    static async getAllBookings() {
        const query = 'SELECT booking_id, user_id, booking_date_time FROM Bookings';
        return new Promise((resolve, reject) => {
            db.query(query, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    static async assignMechanic(booking_id, mechanic_id) {
        const query = 'UPDATE Bookings SET mechanic_id = ? WHERE booking_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [mechanic_id, booking_id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
}

module.exports = BookingModel;