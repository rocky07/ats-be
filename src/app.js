// src/app.js
import express from 'express';
import cors from 'cors';
import pipelineRouter from './routes/pipeline.js';
import requirementsRouter from './routes/requirements.js'; 

const app = express();

app.use(cors()); // Safe communication with React
app.use(express.json());

// Link domains to specific URL prefixes
app.use('/api/pipeline', pipelineRouter);
app.use('/api/requirements', requirementsRouter);
// app.use('/api/candidates', candidateRouter);

export default app;
