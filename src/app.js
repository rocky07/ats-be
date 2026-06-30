import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import settingsRouter from './routes/settings.js';
import pipelineRouter from './routes/pipeline.js';
import requirementsRouter from './routes/requirements.js';
import candidatesRouter from './routes/candidates.js';
import pipelinesRouter from './routes/pipelines.js';
import intelligenceRouter from './routes/intelligence.js';
import examsRouter from './routes/exams.js';
import interviewsRouter from './routes/interviews.js';
import vendorsRouter from './routes/vendors.js';
import dashboardRouter from './routes/dashboard.js';
import publicRouter from './routes/public.js';

const app = express();

app.use(cors());
app.use(express.json());

// Public routes (no auth required) — before auth middleware
app.use('/api/public', publicRouter);

// Auth routes are public — register before the auth middleware
app.use('/api/auth', authRouter);

// All other routes require a valid token
app.use(authMiddleware);

app.use('/api/settings', settingsRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/requirements', requirementsRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/pipelines', pipelinesRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/exams', examsRouter);
app.use('/api/interviews', interviewsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/dashboard', dashboardRouter);

export default app;
