// src/controllers/plan.controller.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPlan = async (req, res) => {
    try {
        const { name, price, duration, daily_roi } = req.body;

        const plan = await prisma.plans.create({
            data: {
                name,
                price,
                duration,
                daily_roi,
            },
        });

        res.status(201).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const editPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const { name, price, duration, daily_roi } = req.body;

        const plan = await prisma.plans.update({
            where: {
                id: parseInt(planId),
            },
            data: {
                name,
                price,
                duration,
                daily_roi
            },
        });

        res.status(200).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

const getAll = async (req, res) => {
    try {
        const plans = await prisma.plans.findMany();

        res.status(200).json(plans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
}

const deletePlan = async (req, res) => {
    try {
        const { planId } = req.params;

        const plan = await prisma.plans.delete({
            where: {
                id: parseInt(planId),
            },
        });

        res.status(200).json(plan);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createPlan,
    editPlan,
    deletePlan,
    getAll
};