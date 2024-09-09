describe('GET /status', () => {
    it('should return status of the API services', async () => {
    await request.get('/status')
      .expect(200)
        .then((err, res) => {
            if (err) return err;
            expect(res.body).to.have.property('redis');
            expect(res.body).to.have.property('db');
        })
    });
})

describe('GET /stats', () => {
    it('should return status 200 and an object with users and files properties', async () => {
    await request.get('/stats')
        .expect(200)
        .then((err, res) => {
            if (err) return err;
            expect(res.body).to.have.property('files');
            expect(res.body).to.have.property('users');
        })
    });
})