/* eslint global-require:0, no-undef: 0 */
'use strict';

process.env.NODE_ENV = 'test';

const app = require('../lib/app')();
const request = require('supertest-as-promised').agent(app.listen());
const expect = require('chai').expect;
const searchError = require('./util/searchError');


describe('search', () => {
    it('should answer to requests with "total" and "results"', (done) => {
        request
            .get('/search/')
            .query({ term: 'express' })
            .expect(200)
            .then((res) => {
                expect(res.body.total).to.be.a('number');
                expect(res.body.results).to.be.instanceof(Array).with.length.above(0);
            })
            .then(done);
    });

    it('"test" should show "mocha", "chai" & "jasmine-core" first', () => {
        const wantedResults = {
            mocha: 0,
            'jasmine-core': 0,
            chai: 0,
        };

        request
            .get('/search/')
            .query({ term: 'test', size: 10 })
            .expect(200)
            .then((res) => {
                const results = res.body.results.map((result) => result.name);

                expect(searchError(wantedResults, results)).to.be.below(4);
            });
    });
});
