const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');
const { createAdminUser } = require('../testUtility');

let testAdmin
let testAdminAuthToken;

beforeAll(async () => {
    testAdmin = await createAdminUser();
    const LoginRes = await request(app).put('/api/auth').send(testAdmin);
    testAdminAuthToken = LoginRes.body.token;
})

afterAll(async () => {
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${testAdminAuthToken}`);
});

test('getFranchises', async () => {
    const fakeFranchises = [{ id: 1, name: 'test1', stores: [] }, { id: 2, name: 'test2', stores: [] }];
    const getFranchises = DB.getFranchises;
    DB.getFranchises = jest.fn().mockResolvedValue([fakeFranchises, false]);
    const res = await request(app).get('/api/franchise').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.franchises).toEqual(fakeFranchises);
    expect(DB.getFranchises).toHaveBeenCalled();
    DB.getFranchises = getFranchises;
})

test('create and get user franchises', async () => {
    const newFranchise = { name: 'Test Franchise', userId: 1 };
    const createdFranchise = { id: 1234, ...newFranchise };
    const fakeUserFranchises = [createdFranchise];
    const createFranchise = DB.createFranchise;
    const getUserFranchises = DB.getUserFranchises;
    DB.createFranchise = jest.fn().mockResolvedValue(createdFranchise);
    const res = await request(app).post('/api/franchise').send(newFranchise).set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(createdFranchise);
    expect(DB.createFranchise).toHaveBeenCalledWith(newFranchise);
    DB.createFranchise = createFranchise;

    DB.getUserFranchises = jest.fn().mockResolvedValue(fakeUserFranchises);
    const getRes = await request(app).get('/api/franchise/1').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body).toEqual(fakeUserFranchises);
    expect(DB.getUserFranchises).toHaveBeenCalledWith(1);
    DB.getUserFranchises = getUserFranchises;
})

test('create franchise (unauthorized)', async () => {
    const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    const registerRes = await request(app).post('/api/auth').send(testUser);
    testUserAuthToken = registerRes.body.token;
    const newFranchise = { name: 'Test Franchise', userId: 1 };
    const res = await request(app).post('/api/franchise').send(newFranchise).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(res.status).toBe(403);
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${testUserAuthToken}`);
})

test('delete franchise', async () => {
    const deleteFranchise = DB.deleteFranchise;
    DB.deleteFranchise = jest.fn().mockResolvedValue();
    const res = await request(app).delete('/api/franchise/1').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'franchise deleted' });
    expect(DB.deleteFranchise).toHaveBeenCalledWith(1);
    DB.deleteFranchise = deleteFranchise;
})

test('create store', async () => {
    const newStore = { name: 'Test Store' };
    const createdStore = { id: 1234, ...newStore };
    const fakeFranchise = { id: 1, name: 'test1', stores: [createdStore] };
    const createStore = DB.createStore;
    const getFranchise = DB.getFranchise;
    DB.createStore = jest.fn().mockResolvedValue(createdStore);
    DB.getFranchise = jest.fn().mockResolvedValue(fakeFranchise);
    const res = await request(app).post('/api/franchise/1/store').send(newStore).set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toEqual(newStore.name);
    expect(DB.createStore).toHaveBeenCalledWith(1, newStore);
    expect(DB.getFranchise).toHaveBeenCalledWith({ id: 1 });
    DB.createStore = createStore;
    DB.getFranchise = getFranchise;
}) 

test('delete store', async () => {
    const deleteStore = DB.deleteStore;
    DB.deleteStore = jest.fn().mockResolvedValue();
    const res = await request(app).delete('/api/franchise/1/store/1').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'store deleted' });
    expect(DB.deleteStore).toHaveBeenCalledWith(1, 1);
    DB.deleteStore = deleteStore;
})
