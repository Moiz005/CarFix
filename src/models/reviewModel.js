const db = require('../config/dbConfig');

class ReviewModel {
    static async addReview({ mechanic_id, userId, rating, review_text, booking_id }) {
        const query = 'INSERT INTO Reviews (mechanic_id, user_id, booking_id, rating, review_text, created_at) VALUES (?, ?, ?, ?, ?, NOW())';
        return new Promise((resolve, reject) => {
            db.query(query, [mechanic_id, userId, booking_id, rating, review_text], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }

    static async checkExistingReview(userId, mechanic_id) {
        const query = 'SELECT review_id FROM Reviews WHERE user_id = ? AND mechanic_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [userId, mechanic_id], (err, results) => {
                if (err) reject(err);
                else resolve(results.length > 0);
            });
        });
    }

    static async getReviewsByMechanic(mechanicId) {
        const query = 'SELECT review_text, created_at FROM Reviews WHERE mechanic_id = ?';
        return new Promise((resolve, reject) => {
            db.query(query, [mechanicId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }
}

module.exports = ReviewModel;