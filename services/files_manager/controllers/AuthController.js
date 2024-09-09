// Authentication client
import sha1 from 'sha1';
import {v4} from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    // Parse Basic Auth header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [email, password] = credentials.split(':');

    if (email && password) {
      // Retrieve user based on email and password
      const users = dbClient.db.collection('users');
      const user = await users.findOne({ email, password: sha1(password) });
      if (user) {
        const token = v4();
        const key = `auth_${token}`;
        const expiryInSeconds = 60 * 60 * 24;
        // Store the user ID in Redis with the token as the key for 24 hours
        await redisClient.set(key, user._id.toString(), expiryInSeconds);
        // Return the generated token
        return res.status(200).json({ token });
      }
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);
    if (userId) {
      await redisClient.del(`auth_${token}`);
      return res.status(204).json({});
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export default AuthController;
