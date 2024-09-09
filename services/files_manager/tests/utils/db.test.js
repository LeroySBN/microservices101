import dbClient from "../../utils/db";

describe('dbClient test', () => {
    it('should be connected to the database', async() => {
        expect(await dbClient.isAlive()).to.be.true;
    })

    it('should return the number of users', async () => {
        const userCount = await dbClient.nbUsers();
        expect(userCount).to.be.a('number');
        expect(userCount).to.be.at.least(0);
    });

    it('should return the number of files', async () => {
        const fileCount = await dbClient.nbFiles();
        expect(fileCount).to.be.a('number');
        expect(fileCount).to.be.at.least(0);
    });
})