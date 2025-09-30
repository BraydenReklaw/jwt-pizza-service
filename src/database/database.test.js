const request = require('supertest');
const app = require('../service');
const { DB } = require('./database.js');

let origGetConnection;
let origQuery;

beforeAll(async () => {
    origGetConnection = DB.pool.getConnection;
    origQuery = DB.pool.query;
})

afterAll(async () => {
    DB.pool.getConnection = origGetConnection;
    DB.pool.query = origQuery;
})