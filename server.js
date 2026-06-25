import 'dotenv/config' // load ANTHROPIC_API_KEY etc. from .env (no-op if absent)
import app from './src/app.js'
import db,{initDatabase} from './src/config/db.js';
import cors from 'cors'
// Initialize the database with default data if it's empty
initDatabase().then(() => {
  console.log('Database is ready.');
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1); // Exit if the database cannot be initialized
});

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*' 
}));

// app.listen(PORT, () => {
// 	console.log('app started , listening on port ${PORT}')
// });

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Application is running on port ${PORT}`);
});
