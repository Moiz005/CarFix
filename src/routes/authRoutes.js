const express = require('express');
const AuthController = require('../controllers/authController');
const router = express.Router();

router.post('/login', AuthController.login);
router.get('/register', AuthController.getRegister);
router.post('/register', AuthController.register);
router.get('/logout', AuthController.logout);

module.exports = router;