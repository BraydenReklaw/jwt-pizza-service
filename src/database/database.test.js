const request = require('supertest');
const app = require('../service');
const { DB } = require('./database.js');
const { createAdminUser } = require('../testUtility');


let origGetConnection;
let origQuery;
let testAdmin
let testAdminAuthToken;

beforeAll(async () => {
    origGetConnection = DB.getConnection;
    origQuery = DB.query;
    testAdmin = await createAdminUser();
    const LoginRes = await request(app).put('/api/auth').send(testAdmin);
    testAdminAuthToken = LoginRes.body.token;
})

afterAll(async () => {
    DB.getConnection = origGetConnection;
    DB.query = origQuery;
    await request(app).delete('/api/auth').set('Authorization', `Bearer ${testAdminAuthToken}`);

})

test("get menu" , async () => {
    const fakeMenu = [{ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 }];
    DB.getConnection = jest.fn().mockResolvedValue({ end: jest.fn() });
    DB.query = jest.fn().mockResolvedValue(fakeMenu);
    const res = await DB.getMenu();
    expect(DB.getConnection).toHaveBeenCalled();
    expect(DB.query).toHaveBeenCalledWith(expect.anything(), 'SELECT * FROM menu');
    expect(res).toEqual(fakeMenu);
})

test("add menu item", async () => {
    const newMenuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
    DB.getConnection = jest.fn().mockResolvedValue({ end: jest.fn() });
    DB.query = jest.fn().mockResolvedValue({ insertId: 9999 });
    const res = await DB.addMenuItem(newMenuItem);
    expect(DB.getConnection).toHaveBeenCalled();
    expect(DB.query).toHaveBeenCalledWith(expect.anything(), 'INSERT INTO menu (title, description, image, price) VALUES (?, ?, ?, ?)', [newMenuItem.title, newMenuItem.description, newMenuItem.image, newMenuItem.price]);
    expect(res).toEqual({...newMenuItem, id: 9999 });
})

test("add user", async () => {
    const newUser = { name: 'testUser', email: 'test@test.com', password: 'testpassword', roles: [{ role: 'diner' }] };
    DB.getConnection = jest.fn().mockResolvedValue({ end: jest.fn() });
    DB.query = jest.fn().mockResolvedValue({ insertId: 1234 });
    await DB.addUser(newUser);
    expect(DB.getConnection).toHaveBeenCalled();
    expect(DB.query).toHaveBeenCalledTimes(2);
})

test("get user", async () => {
    DB.getConnection = origGetConnection;
    DB.query = origQuery;
    const res = await DB.getUser(testAdmin.email, "toomanysecrets");
    expect(res).toHaveProperty('id', expect.any(Number));
    expect(res).toHaveProperty('email', testAdmin.email);
    expect(Array.isArray(res.roles)).toBe(true);
    expect(res.password).toBeUndefined();
})

