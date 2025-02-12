const express = require('express');
const router = express.Router();
const { createUser, loginUser, getUser, getUsers, getBalance, buyPlan, getPlansFromUser, getDeposits, getWithdrawals, updateUser } = require('../controllers/user.controller');

router.post('/register', createUser);
router.post('/login', loginUser);
router.get('/info/:userId', getUser);
router.put('/update/:userId', updateUser);
router.get('/all', getUsers);
router.get('/balance', getBalance);
router.post('/buy-plan', buyPlan);
router.get('/plans/:userId', getPlansFromUser);
router.get('/deposits/:userId', getDeposits);
router.get('/withdrawals/:userId', getWithdrawals);

module.exports = router; 