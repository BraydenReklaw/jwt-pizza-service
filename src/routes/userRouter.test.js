const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js')

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const [user, userToken] = await registerUser(request(app));
  expect(user).not.toBe(null)
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
  expect(listUsersRes.body.users.length).toBeGreaterThan(0);
});

test('delete unathorized', async () => {
  const deleteRes = await request(app).delete('/api/user/:userId')
  expect(deleteRes.status).toBe(401);
})

test('delete fake user', async () => {
  // First, register a user so we have a token
  const [user, token] = await registerUser(request(app));

  // Mock DB.deleteUser so it doesn't touch the real DB
  const deleteUserMock = jest.spyOn(DB, 'deleteUser').mockResolvedValue();

  const deleteRes = await request(app)
    .delete(`/api/user/${user.id}`)
    .set('Authorization', `Bearer ${token}`);

  // Assertions
  expect(deleteRes.status).toBe(200);
  expect(deleteRes.body).toEqual({ message: 'User deleted' });
  expect(deleteUserMock).toHaveBeenCalledWith(user.id);

  // Restore the original function
  deleteUserMock.mockRestore();
})

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}