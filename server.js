import 'dotenv/config';
import cors from 'cors';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Application is running on port ${PORT}`);
});
