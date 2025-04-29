const express = require('express');
const UserController = require('../controllers/userController');
const router = express.Router();

router.get('/user-home', UserController.getHome);
router.get('/user-profile', UserController.getProfile);
router.post('/user-profile/update', UserController.updateProfile);
router.get('/view-mechanics', UserController.getMechanics);

module.exports = router;