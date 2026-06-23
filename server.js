import app from './src/app.js'
import db,{initDatabase} from './src/config/db.js';

// Initialize the database with default data if it's empty
initDatabase().then(() => {
  console.log('Database is ready.');
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1); // Exit if the database cannot be initialized
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log('app started , listening on port ${PORT}')
});
