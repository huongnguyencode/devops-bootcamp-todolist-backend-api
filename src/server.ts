import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import client from 'prom-client';
import todoRoutes from './routes/todoRoutes';
import todoModel from './models/todoModel';
import pool from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/**
 * Prometheus metrics
 */
const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: 'todolist_backend_',
});

const httpRequestsTotal = new client.Counter({
  name: 'todolist_backend_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'todolist_backend_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

// Middleware
app.use(cors({
  origin: '*',
  methods: '*',
  allowedHeaders: '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

/**
 * Request metrics middleware
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDurationSeconds.startTimer();

  res.on('finish', () => {
    const route = req.route?.path || req.path || 'unknown';

    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    end(labels);
  });

  next();
});

/**
 * Prometheus metrics endpoint
 * Must be defined before the 404 handler.
 */
app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Metrics endpoint failed:', error);
    res.status(500).end();
  }
});

// Health check endpoint for Kubernetes liveness probe
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness check endpoint for Kubernetes readiness probe
app.get('/ready', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/todos', todoRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Todo List API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      ready: '/ready',
      metrics: '/metrics',
      todos: '/api/todos'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await todoModel.initDatabase();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Readiness check: http://localhost:${PORT}/ready`);
      console.log(`Metrics endpoint: http://localhost:${PORT}/metrics`);
      console.log(`API endpoint: http://localhost:${PORT}/api/todos`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();