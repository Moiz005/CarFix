const express = require('express');
const MechanicController = require('../controllers/mechanicController');
const router = express.Router();

router.get('/mechanic-home', MechanicController.getHome);
router.get('/mechanic-orders', MechanicController.getOrders);
router.post('/mechanic/complete-order', MechanicController.completeOrder);
router.get('/edit-mechanic-profile', MechanicController.getEditProfile);
router.post('/edit-mechanic-profile/update', MechanicController.updateProfile);

module.exports = router;