import chai from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';
import sha1 from 'sha1';

chai.use(chaiHttp);

describe('UsersController', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('POST /users', () => {
    it('should create a new user if valid email and password are provided', async () => {
      const mockEmail = 'test@example.com';
      const mockPassword = 'password123';
      const mockHashedPassword = sha1(mockPassword);
      const mockUser = {
        email: mockEmail,
        password: mockHashedPassword,
      };

      sandbox.stub(dbClient.db.collection('users'), 'findOne').callsFake((query, callback) => {
        callback(null, null); // Simulate no user found
      });

      sandbox.stub(dbClient.db.collection('users'), 'insertOne').resolves({ insertedId: '605c72ef9f1b2c001f6479c9' });

      const res = await request
        .post('/users')
        .send({ email: mockEmail, password: mockPassword });

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('id').eql('605c72ef9f1b2c001f6479c9');
      expect(res.body).to.have.property('email').eql(mockEmail);
    });

    it('should return 400 if email is missing', async () => {
      const res = await request
        .post('/users')
        .send({ password: 'password123' });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').eql('Missing email');
    });

    it('should return 400 if password is missing', async () => {
      const res = await request
        .post('/users')
        .send({ email: 'test@example.com' });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').eql('Missing password');
    });

    it('should return 400 if email already exists', async () => {
      const mockEmail = 'test@example.com';
      const mockPassword = 'password123';

      sandbox.stub(dbClient.db.collection('users'), 'findOne').callsFake((query, callback) => {
        callback(null, { email: mockEmail }); // Simulate user already exists
      });

      const res = await request
        .post('/users')
        .send({ email: mockEmail, password: mockPassword });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error').eql('Already exist');
    });
  });

  describe('GET /users/me', () => {
    it('should retrieve user details if token is valid', async () => {
      const mockToken = 'mock-token';
      const mockUserId = '605c72ef9f1b2c001f6479c9';
      const mockUser = {
        _id: mockUserId,
        email: 'test@example.com',
      };

      sandbox.stub(redisClient, 'get').resolves(mockUserId);
      sandbox.stub(dbClient.db.collection('users'), 'findOne').resolves(mockUser);

      const res = await request
        .get('/users/me')
        .set('X-Token', mockToken);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('id').eql(mockUserId);
      expect(res.body).to.have.property('email').eql('test@example.com');
    });

    it('should return 401 if token is invalid or user not found', async () => {
      const mockToken = 'invalid-token';

      sandbox.stub(redisClient, 'get').resolves(null); // Simulate invalid token

      const res = await request
        .get('/users/me')
        .set('X-Token', mockToken);

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').eql('Unauthorized');
    });
  });
});
