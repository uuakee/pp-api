const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/user.routes');
const planRoutes = require('./routes/plan.routes');

const app = express();

app.use(cors()); 
app.use(express.json());

app.use('/api/user', userRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/gateway', gatewayRoutes);

const PORT = 1994;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));