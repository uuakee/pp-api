// src/controllers/plan.controller.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPlan = async (req, res) => {
    try {
        const { 
            name, 
            price, 
            duration, 
            daily_roi,
            image, 
            loops,
            vip_needed 
        } = req.body;

        if (!image) {
            return res.status(400).json({ 
                message: 'URL da imagem é obrigatória' 
            });
        }

        const plan = await prisma.plans.create({
            data: {
                name,
                price: parseInt(price),
                duration: parseInt(duration),
                daily_roi: parseFloat(daily_roi),
                image, // URL direta da imagem
                loops: parseInt(loops),
                vip_needed: vip_needed || 'VIP_0',
                status: true
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
        const { 
            name, 
            price, 
            duration, 
            daily_roi,
            image,
            loops,
            vip_needed,
            status 
        } = req.body;

        const plan = await prisma.plans.update({
            where: {
                id: parseInt(planId),
            },
            data: {
                name,
                price: parseInt(price),
                duration: parseInt(duration),
                daily_roi: parseFloat(daily_roi),
                image,
                loops: parseInt(loops),
                vip_needed,
                status: status === 'true'
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
    getAll,
};