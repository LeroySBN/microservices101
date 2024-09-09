import redisClient from "../../utils/redis";

describe('redisClient test', () => {
    it('should be connected to the database', async() => {
        expect(await redisClient.isAlive()).to.be.true;
    })

    it('should successfully set and get a value from Redis', async () => {
        const key = 'test_key';
        const value = 'test_value';
        const duration = 10;

        await redisClient.set(key, value, duration);
        const result = await redisClient.get(key);

      expect(result).to.equal(value);
    });

    it('should successfully delete a value from Redis', async () => {
      const key = 'test_key';
      const value = 'test_value';
      const duration = 10;

      await redisClient.set(key, value, duration);
      await redisClient.del(key);
      const result = await redisClient.get(key);

      expect(result).to.be.null;
    });
})