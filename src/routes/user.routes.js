const express = require('express');
const router = express.Router();
const { createUser, loginUser, getUser, getUsers, getBalance, buyPlan, getPlansFromUser } = require('../controllers/user.controller');

router.post('/register', createUser);
router.post('/login', loginUser);
router.get('/info/:userId', getUser);
router.get('/all', getUsers);
router.get('/balance', getBalance);
router.post('/buy-plan', buyPlan);
router.get('/plans/:userId', getPlansFromUser);

module.exports = router; 