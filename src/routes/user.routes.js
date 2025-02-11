const express = require('express');
const router = express.Router();
const { createUser, loginUser, getUser, getUsers, getBalance } = require('../controllers/user.controller');

router.post('/register', createUser);
router.post('/login', loginUser);
router.get('/info/:userId', getUser);
router.get('/all', getUsers);
router.get('/balance', getBalance);

module.exports = router; 