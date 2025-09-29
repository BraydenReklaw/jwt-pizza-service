const request = require('supertest');
const app = require('../service');
const { randomName } = require('../testUtility');

// test('update user', async () => {
//     const name = randomName();
//     const testUser = { name: `${name}`, email: 'test@test.com', password: 'test'};
//     const registerRes = await request(app).post('/api/auth').send(testUser).expect(200);
//     const token = registerRes.body.token;
//     // update the user
//     const newName = `${name}updated`;
//     const updateRes = await request(app).put(`/api/user/${registerRes.body.user.id}`).set('Authorization', `Bearer ${token}`);
//     expect(updateRes.status).toBe(200);
//     expect(updateRes.body.user.name).toBe(newName);
//     expect(updateRes.body.user.email).toBe(testUser.email);
//     expect(updateRes.body.token).toBeDefined();
//     expect(updateRes.bode.token).not.toBe(token);

//     const authRes = await request(app).get('/api/user/me').set('Authorization', `Bearer ${updateRes.body.token}`);
//     expect(authRes.status).toBe(200);
//     expect(authRes.body.name).toBe(newName);
})