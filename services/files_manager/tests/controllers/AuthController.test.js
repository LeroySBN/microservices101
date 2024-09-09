import chai from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { expect } from 'chai';
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';
import sha1 from 'sha1';
import { v4 } from 'uuid';

chai.use(chaiHttp);

describe('AuthController', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('GET /connect', () => {
    it('should authenticate user and return a token if valid email and password are provided', async () => {
      const mockEmail = 'test@example.com';
      const mockPassword = 'password123';
      const mockHashedPassword = sha1(mockPassword);
      const mockUser = {
        _id: '605c72ef9f1b2c001f6479c9',
        email: mockEmail,
        password: mockHashedPassword,
      };

      const mockToken = v4();
      sandbox.stub(dbClient.db.collection('users'), 'findOne').resolves(mockUser);
      sandbox.stub(redisClient, 'set').resolves();
      sandbox.stub(v4, 'v4').returns(mockToken);

      const authHeader = `Basic ${Buffer.from(`${mockEmail}:${mockPassword}`).toString('base64')}`;
      const res = await request.get('/connect').set('Authorization', authHeader);

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('token').eql(mockToken);
    });

    it('should return 401 if email and password are incorrect', async () => {
      const authHeader = `Basic ${Buffer.from('test@example.com:wrongpassword').toString('base64')}`;
      sandbox.stub(dbClient.db.collection('users'), 'findOne').resolves(null);

      const res = await request.get('/connect').set('Authorization', authHeader);

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').eql('Unauthorized');
    });

    it('should return 401 if Authorization header is missing or invalid', async () => {
      const res = request.get('/connect');

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').eql('Unauthorized');
    });
  });

  describe('GET /disconnect', () => {
    it('should invalidate the token and log out the user if a valid token is provided', async () => {
      const mockToken = 'mock-token';
      const mockUserId = '605c72ef9f1b2c001f6479c9';

      sandbox.stub(redisClient, 'get').resolves(mockUserId);
      sandbox.stub(redisClient, 'del').resolves();

      const res = await request.get('/disconnect').set('X-Token', mockToken);

      expect(res).to.have.status(204);
    });

    it('should return 401 if token is invalid or not provided', async () => {
      const mockToken = 'invalid-token';

      sandbox.stub(redisClient, 'get').resolves(null);

      const res = await request.get('/disconnect').set('X-Token', mockToken);

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('error').eql('Unauthorized');
    });
  });
});
