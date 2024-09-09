// Express server
import express from 'express';
import router from './routes/index';
import bodyParser from 'body-parser';

require('@dotenvx/dotenvx').config()

const api = express();
const port = parseInt(process.env.PORT, 10) || 5000;

api.use(express.json());
api.use(bodyParser.json({ limit: '800kb' }));
api.use('/', router);

api.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

module.exports = api;
