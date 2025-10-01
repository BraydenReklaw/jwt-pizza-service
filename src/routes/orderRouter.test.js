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
    const origGetConnection = DB.getConnection;
    const origGetOffset = DB.getOffset;
    const origQuery = DB.query;

    // Mock connection
    const mockConnection = { end: jest.fn() };

  // Mock data
    const mockOrders = [
    { id: 1, franchiseId: 1, storeId: 1, date: '2025-09-30' }
        ];
    const mockItems = [
        { id: 1, menuId: 1, description: 'Veggie', price: 0.05 }
    ];

  // Override methods
    DB.getConnection = () => Promise.resolve(mockConnection);
    DB.getOffset = () => 0;
    DB.query = (conn, sql, params) => {
        if (sql.includes('FROM dinerOrder')) {
            return Promise.resolve(mockOrders);
        }
        if (sql.includes('FROM orderItem')) {
            return Promise.resolve(mockItems);
        }
            return Promise.resolve([]);
    };

  // Run actual getOrders
    const user = { id: 123 };
    const result = await DB.getOrders(user, 1);

  // Assertions
    expect(result).toEqual({
        dinerId: user.id,
        orders: [{ ...mockOrders[0], items: mockItems }],
        page: 1
    });
    expect(mockConnection.end).toHaveBeenCalled();

  // Restore original methods
    DB.getConnection = origGetConnection;
    DB.getOffset = origGetOffset;
    DB.query = origQuery;
})