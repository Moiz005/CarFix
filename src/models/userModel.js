const db = require('../config/dbConfig');
const bcrypt = require('bcrypt');

class UserModel {
    static async findUserByEmail(email, role) {
        let table;
        if (role === 'admin') table = 'Admins';
        else if (role === 'user') table = 'Users';
        else if (role === 'mechanic') table = 'Mechanics';
        else throw new Error('Invalid role');

        const query = `SELECT * FROM ${table} WHERE email = ?`;
        return new Promise((resolve, reject) => {
            db.query(query, [email], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    static async createUser({ email, name, phone_number, password, role, make, model, year }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        if (role === 'admin') {
            const query = 'INSERT INTO Admins (email, password, name) VALUES (?, ?, ?)';
            return new Promise((resolve, reject) => {
                db.query(query, [email, hashedPassword, name], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        } else if (role === 'user') {
            return new Promise((resolve, reject) => {
                db.beginTransaction(async (err) => {
                    if (err) return reject(err);
                    try {
                        const userQuery = 'INSERT INTO Users (email, password, name, phone_number) VALUES (?, ?, ?, ?)';
                        const userResult = await new Promise((res, rej) => {
                            db.query(userQuery, [email, hashedPassword, name, phone_number], (e, r) => {
                                if (e) rej(e);
                                else res(r);
                            });
                        });
                        const userId = userResult.insertId;
                        const carQuery = 'INSERT INTO Cars (user_id, make, model, year) VALUES (?, ?, ?, ?)';
                        await new Promise((res, rej) => {
                            db.query(carQuery, [userId, make, model, year || 0], (e, r) => {
                                if (e) rej(e);
                                else res(r);
                            });
                        });
                        db.commit((err) => {
                            if (err) throw err;
                            resolve(userResult);
                        });
                    } catch (e) {
                        db.rollback(() => reject(e));
                    }
                });
            });
        }
    }

    static async getUserById(userId) {
        const query = 'SELECT user_id, email, name, phone_number FROM Users WHERE user_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [userId], (err, results) => {
                if (err) reject(err);
                else resolve(results[0]);
            });
        });
    }

    static async updateUser(userId, { name, email, phone_number }) {
        const query = 'UPDATE Users SET name = ?, email = ?, phone_number = ? WHERE user_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [name, email, phone_number, userId], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async getAllUsers() {
        const query = 'SELECT * FROM Users';
        return new Promise((resolve, reject) => {
            db.query(query, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }
}

module.exports = UserModel;