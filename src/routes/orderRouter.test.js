const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');
const { createAdminUser } = require('../testUtility');

let testAdmin
let testAdminAuthToken;

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

    const res = await request(app)
        .put('/api/order/menu')
        .send(newMenuItem)
        .set('Authorization', `Bearer ${testAdminAuthToken}`)
        .expect(200);

    expect(DB.addMenuItem).toHaveBeenCalledWith(newMenuItem);
    expect(DB.getMenu).toHaveBeenCalled();
    expect(res.body).toEqual(fakeMenu);

    DB.addMenuItem = add;
    DB.getMenu = get;
})