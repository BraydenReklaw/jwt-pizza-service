const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');
const { createAdminUser, randomName } = require('../testUtility');

let testAdmin
let testAdminAuthToken;
let add, get;

beforeAll(async () => {
    testAdmin = await createAdminUser();
    const loginRes = await request(app).put('/api/auth').send(testAdmin);
    testAdminAuthToken = loginRes.body.token;
})

afterAll(async () => {
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${testAdminAuthToken}`);
})

test('get menu', async () => {
    const res = await request(app).get('/api/order/menu').set('Authorization', `Bearer ${testAdminAuthToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
})

test('add menu item', async () => {
    add = DB.addMenuItem
    get = DB.getMenu

    const newMenuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
    const fakeMenu = [{ id: 9999, ...newMenuItem }];

    DB.addMenuItem = jest.fn().mockResolvedValue();
    DB.getMenu = jest.fn().mockResolvedValue(fakeMenu);

    const res = await request(app).put('/api/order/menu').send(newMenuItem).set('Authorization', `Bearer ${testAdminAuthToken}`)
    expect(res.status).toBe(200);

    expect(DB.addMenuItem).toHaveBeenCalledWith(newMenuItem);
    expect(DB.getMenu).toHaveBeenCalled();
    expect(res.body).toEqual(fakeMenu);

    DB.addMenuItem = add;
    DB.getMenu = get;
})

test('fail to add menu item (unauthorized)', async () => {
    const testUser = { name: `${randomName()}`, email: 'testt@test.com', password: 'test'};
    const registerRes = await request(app).post('/api/auth').send(testUser);
    const authToken = registerRes.body.token;
    const newMenuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
    const res = await request(app).put('/api/order/menu').send(newMenuItem).set('Authorization', `Bearer ${authToken}`)
    expect(res.status).toBe(403);
})

test('createOrder', async () => {
    const orderData = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }] };
    const createOrder = DB.addDinerOrder;

    const fakeOrder = { id: 1234, ...orderData, createdAt: Date.now() };
    DB.addDinerOrder = jest.fn().mockResolvedValue(fakeOrder);

    const res = await request(app).post('/api/order').send(orderData).set('Authorization', `Bearer ${testAdminAuthToken}`)
    expect(res.status).toBe(200);

    expect(res.body.order).toMatchObject(orderData);
    expect(res.body.jwt).toBeDefined();

    DB.addDinerOrder = createOrder;
})

test('getOrders', async () => {
    const origGetOrders = DB.getOrders;

    const fakeOrders = [
      { id: 1, franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], createdAt: Date.now() }
    ];

    DB.getOrders = jest.fn().mockResolvedValue(fakeOrders);

    const res = await request(app).get('/api/order').set('Authorization', `Bearer ${testAdminAuthToken}`)
    expect(res.status).toBe(200);

    expect(DB.getOrders).toHaveBeenCalled();
    expect(res.body).toEqual(fakeOrders);

    DB.getOrders = origGetOrders;
})