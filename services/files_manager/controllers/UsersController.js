// Users controller
// Description: This controller is responsible for handling all the user related requests
// and responses.
import sha1 from 'sha1';
import {ObjectId} from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class UsersController {
  static postNew(request, response) {
    const { email, password } = request.body;

    if (!email) {
      response.status(400).json({ error: 'Missing email' });
      return;
    }
    if (!password) {
      response.status(400).json({ error: 'Missing password' });
      return;
    }

    const users = dbClient.db.collection('users');
    console.log(users);
    users.findOne({ email }, (err, user) => {
      if (user) {
        response.status(400).json({ error: 'Already exist' });
      } else {
        const hashedPassword = sha1(password);
        users.insertOne(
          {
            email,
            password: hashedPassword,
          },
        ).then((result) => {
          response.status(201).json({ id: result.insertedId, email });
        }).catch((error) => console.log(error));
      }
    });
  }

  static async getMe(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (userId) {
      const users = await dbClient.db.collection('users');
      const userObj = new ObjectId(userId);
      const user = await users.findOne({ _id: userObj });
      if (user) {
        return res.status(200).json({ id: user._id, email: user.email });
      }
    }

    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = UsersController;
