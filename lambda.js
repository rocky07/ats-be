import serverlessExpress from '@vendia/serverless-express';
import app from './src/app.js';
import { initDatabase } from './src/config/db.js';

let serverlessExpressInstance;

async function bootstrap(event, context) {
  // 1. Initialize LowDB/S3 database once per Lambda Container lifecycle
  try {
    await initDatabase();
    console.log('Database initialized successfully in Lambda container.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    throw err;
  }

  // 2. Configure the app instance with the serverless-express handler
  serverlessExpressInstance = serverlessExpress({ app });
  
  // 3. Execute the handler for this first cold-start event
  return await serverlessExpressInstance(event, context);
}

export const handler = async (event, context) => {
  try {
    // If the container is already warm, use the cached handler
    if (serverlessExpressInstance) {
      return await serverlessExpressInstance(event, context);
    }

    // Cold start setup path
    return await bootstrap(event, context);
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};