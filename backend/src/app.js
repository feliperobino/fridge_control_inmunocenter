import express from 'express';
import alarmsRoutes from './routes/alarms.routes.js';
import authRoutes from './routes/auth.routes.js';
import exportsRoutes from './routes/exports.routes.js';
import ingestRoutes from './routes/ingest.routes.js';
import fridgesRoutes from './routes/fridges.routes.js';
import reportSchedulesRoutes from './routes/report-schedules.routes.js';
import usersRoutes from './routes/users.routes.js';
import helmet from 'helmet';
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware.js';

const app = express();

app.use(helmet());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/ingest', ingestRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/fridges', fridgesRoutes);
app.use('/api/alarms', alarmsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/report-schedules', reportSchedulesRoutes);

app.use(errorHandlerMiddleware);

export default app;
