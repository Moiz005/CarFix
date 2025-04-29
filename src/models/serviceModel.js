const db = require('../config/dbConfig');

class ServiceModel {
    static async getAllServices() {
        const query = 'SELECT * FROM Services';
        return new Promise((resolve, reject) => {
            db.query(query, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    static async addService({ service_name, service_type, estimated_cost }) {
        const query = 'INSERT INTO Services (service_name, service_type, estimated_cost) VALUES (?, ?, ?)';
        return new Promise((resolve, reject) => {
            db.query(query, [service_name, service_type, estimated_cost], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    }
}

module.exports = ServiceModel;