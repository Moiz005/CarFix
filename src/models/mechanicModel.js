const db = require('../config/dbConfig');
const bcrypt = require('bcrypt');

class MechanicModel {
    static async getMechanicById(mechanicId) {
        const query = 'SELECT * FROM Mechanics WHERE mechanic_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [mechanicId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    static async getAllMechanics() {
        const query = 'SELECT * FROM Mechanics';
        return new Promise((resolve, reject) => {
            db.query(query, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    static async addMechanic({ name, email, phone_number, location, experience_years, password, service_ids }) {
        console.log('addMechanic received service_ids:', service_ids);
        const hashedPassword = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            db.beginTransaction(async (err) => {
                if (err) {
                    console.error('Transaction start error:', err);
                    return reject(err);
                }
                try {
                    // Insert into Mechanics
                    const mechanicQuery = `
                        INSERT INTO Mechanics (name, email, phone_number, location, experience_years, password, status)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending')
                    `;
                    const mechanicResult = await new Promise((res, rej) => {
                        db.query(mechanicQuery, [name, email, phone_number, location, experience_years, hashedPassword], (e, r) => {
                            if (e) {
                                console.error('Mechanic insert error:', e);
                                rej(e);
                            } else {
                                res(r);
                            }
                        });
                    });
                    const mechanicId = mechanicResult.insertId;
                    console.log('Inserted mechanic with ID:', mechanicId);

                    // Insert into Mechanic_Services
                    if (service_ids && Array.isArray(service_ids) && service_ids.length > 0) {
                        const serviceQuery = `
                            INSERT INTO Mechanic_Services (mechanic_id, service_id)
                            VALUES ?
                        `;
                        const serviceValues = service_ids.map(service_id => [mechanicId, service_id]);
                        console.log('Mechanic_Services values:', serviceValues);
                        await new Promise((res, rej) => {
                            db.query(serviceQuery, [serviceValues], (e, r) => {
                                if (e) {
                                    console.error('Mechanic_Services insert error:', e);
                                    rej(e);
                                } else {
                                    console.log('Mechanic_Services insert result:', r);
                                    res(r);
                                }
                            });
                        });
                    } else {
                        console.log('No service_ids provided or invalid format, skipping Mechanic_Services insert');
                    }

                    db.commit((err) => {
                        if (err) {
                            console.error('Commit error:', err);
                            throw err;
                        }
                        console.log('Transaction committed successfully');
                        resolve(mechanicResult);
                    });
                } catch (e) {
                    db.rollback(() => {
                        console.error('Transaction rolled back due to error:', e);
                        reject(e);
                    });
                }
            });
        });
    }

    static async updateMechanic(mechanicId, { name, email, phone_number, location, experience_years }) {
        const query = 'UPDATE Mechanics SET name = ?, email = ?, phone_number = ?, location = ?, experience_years = ?, updated_at = CURRENT_TIMESTAMP WHERE mechanic_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [name, email, phone_number, location, experience_years, mechanicId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async getMechanicDetails(mechanicId) {
        const query = `
      SELECT m.mechanic_id, m.name, m.location, m.experience_years,
             GROUP_CONCAT(ms.service_id) as skills,
             AVG(r.rating) as rating
      FROM Mechanics m
      LEFT JOIN Mechanic_Services ms ON m.mechanic_id = ms.mechanic_id
      LEFT JOIN Reviews r ON m.mechanic_id = r.mechanic_id
      WHERE m.mechanic_id = ? AND m.status = 'approved'
      GROUP BY m.mechanic_id, m.name, m.location, m.experience_years
    `;
        return new Promise((resolve, reject) => {
            db.query(query, [mechanicId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    static async getCertifications(mechanicId) {
        const query = 'SELECT * FROM Mechanic_Certifications WHERE mechanic_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [mechanicId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    static async deleteMechanic(mechanicId) {
        return new Promise((resolve, reject) => {
            db.beginTransaction(async (err) => {
                if (err) return reject(err);
                try {
                    // Check for active bookings
                    const bookings = await new Promise((res, rej) => {
                        db.query('SELECT COUNT(*) as count FROM Bookings WHERE mechanic_id = ?', [mechanicId], (e, r) => {
                            if (e) rej(e);
                            else res(r[0].count);
                        });
                    });

                    if (bookings > 0) {
                        throw new Error('Cannot delete mechanic with active bookings');
                    }

                    // Delete from Mechanic_Services
                    await new Promise((res, rej) => {
                        db.query('DELETE FROM Mechanic_Services WHERE mechanic_id = ?', [mechanicId], (e, r) => {
                            if (e) rej(e);
                            else res(r);
                        });
                    });

                    // Delete from Mechanics
                    await new Promise((res, rej) => {
                        db.query('DELETE FROM Mechanics WHERE mechanic_id = ?', [mechanicId], (e, r) => {
                            if (e) rej(e);
                            else res(r);
                        });
                    });

                    db.commit((err) => {
                        if (err) throw err;
                        resolve();
                    });
                } catch (e) {
                    db.rollback(() => reject(e));
                }
            });
        });
    }
}

module.exports = MechanicModel;