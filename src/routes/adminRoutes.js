const express = require('express');
const AdminController = require('../controllers/adminController');
const router = express.Router();

router.get('/admin', AdminController.getDashboard);
router.get('/add-mechanic', AdminController.getAddMechanic);
router.post('/add-mechanic', AdminController.addMechanic);
router.get('/Service', AdminController.getServices);
router.post('/Service', AdminController.addService);
router.get('/customers', AdminController.getCustomers);
router.get('/mechanic', AdminController.getMechanics);
router.get('/orders', AdminController.getOrders);
router.post('/assign-mechanic', AdminController.assignMechanic);
router.post('/mechanics/drop/:mechanic_id', AdminController.dropMechanic);

module.exports = router;