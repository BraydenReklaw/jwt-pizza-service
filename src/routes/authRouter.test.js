const request = require('supertest');
const app = require('../service');
const randomName = require('../testUtility').randomName;``

test('register fails with missing field', async () => {
    const testUser = { name: `${randomName()}`, email: 'test@test.com', password: ''};
    const res = await request(app).post('/api/auth').send(testUser);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name, email, and password are required/);
})

test('log out a registered user', async () => {
    const testUser = { name: `${randomName()}`, email: 'testt@test.com', password: 'test'};
    const registerRes = await request(app).post('/api/auth').send(testUser);
    expect(registerRes.body.token).toBeDefined();
    const authToken = registerRes.body.token;
    const logoutRes = await request(app).delete('/api/auth').set('Authorization', `Bearer ${authToken}`);
    expect(logoutRes.body).toHaveProperty('message', 'logout successful');
    // try to log out again with the same token
    const secondLogout = await request(app).delete('/api/auth').set('Authorization', `Bearer ${authToken}`)
    expect(secondLogout.status).toBe(401);
})
