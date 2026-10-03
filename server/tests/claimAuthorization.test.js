const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const claimModel = require('../models/claimModel');
const itemModel = require('../models/foundItemModel');
const {
    ACTIVE_CLAIM_EXISTS,
    authorizeClaim,
    hasInterviewContent,
    normalizeCollegeDomain,
    sameCollegeDomain
} = require('../utils/claimAuthorization');
const { finalizeClaim } = require('../controllers/claimController');

const userId = new mongoose.Types.ObjectId();
const reporterId = new mongoose.Types.ObjectId();
const itemId = new mongoose.Types.ObjectId();

function item({ status = 'found', reporterEmail = 'finder@campus.edu', reporterObjectId = reporterId } = {}) {
    return {
        _id: itemId,
        status,
        reportedBy: { _id: reporterObjectId, email: reporterEmail }
    };
}

function mockFindItem(value) {
    itemModel.findById = () => ({ populate: async () => value });
}

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

const verifiedUser = { _id: userId, email: 'owner@campus.edu', isEmailVerified: true };

test('college-domain normalization is conservative and exact', () => {
    assert.equal(normalizeCollegeDomain(' Student@Campus.EDU '), 'campus.edu');
    assert.equal(normalizeCollegeDomain('student@localhost'), null);
    assert.equal(normalizeCollegeDomain('student@campus..edu'), null);
    assert.equal(normalizeCollegeDomain('student@.campus.edu'), null);
    assert.equal(sameCollegeDomain('owner@campus.edu', 'finder@campus.edu'), true);
    assert.equal(sameCollegeDomain('owner@campus.edu', 'finder@other.edu'), false);
    assert.equal(sameCollegeDomain('owner@campus.edu', 'not-an-email'), false);
});

test('interview content requires both an AI question and claimant answer', () => {
    assert.equal(hasInterviewContent([]), false);
    assert.equal(hasInterviewContent([{ role: 'ai', text: 'Question?' }]), false);
    assert.equal(hasInterviewContent([{ role: 'user', text: 'Answer' }]), false);
    assert.equal(hasInterviewContent([
        { role: 'ai', text: 'Question?' },
        { role: 'user', text: 'Answer' }
    ]), true);
});

test('claim authorization rejects self-claims, other colleges, unavailable items and active duplicates', async () => {
    claimModel.findOne = async () => null;

    mockFindItem(item());
    let result = await authorizeClaim({ itemId, user: verifiedUser });
    assert.deepEqual(result, { ok: true, item: item() });

    mockFindItem(item({ reporterObjectId: userId, reporterEmail: 'owner@campus.edu' }));
    result = await authorizeClaim({ itemId, user: verifiedUser });
    assert.equal(result.status, 403);

    mockFindItem(item({ reporterEmail: 'finder@other.edu' }));
    result = await authorizeClaim({ itemId, user: verifiedUser });
    assert.equal(result.status, 403);

    mockFindItem(item({ status: 'pending_admin_review' }));
    result = await authorizeClaim({ itemId, user: verifiedUser });
    assert.equal(result.status, 400);

    mockFindItem(item());
    claimModel.findOne = async () => ({ _id: new mongoose.Types.ObjectId() });
    result = await authorizeClaim({ itemId, user: verifiedUser });
    assert.equal(result.status, 409);
    assert.equal(result.error, ACTIVE_CLAIM_EXISTS);
});

test('unverified users cannot enter claim flow', async () => {
    mockFindItem(item());
    claimModel.findOne = async () => null;
    const result = await authorizeClaim({ itemId, user: { ...verifiedUser, isEmailVerified: false } });
    assert.equal(result.status, 403);
});

test('finalize rejects fabricated or incomplete interview transcripts', async () => {
    mockFindItem(item());
    claimModel.findOne = async () => null;
    const create = claimModel.create;
    claimModel.create = async () => { throw new Error('Must not create'); };
    const res = response();
    await finalizeClaim({ user: verifiedUser, body: {
        itemId: itemId.toString(),
        chatHistory: [{ role: 'ai', text: 'Question only' }],
        tentativeVerdict: { status: 'verified', score: 100, message: 'approved' }
    } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /questions and answers/i);
    claimModel.create = create;
});

test('finalize converts a unique-index race into a conflict response', async () => {
    mockFindItem(item());
    claimModel.findOne = async () => null;
    const create = claimModel.create;
    claimModel.create = async () => { const error = new Error('duplicate'); error.code = 11000; throw error; };
    const res = response();
    await finalizeClaim({ user: verifiedUser, body: {
        itemId: itemId.toString(),
        chatHistory: [
            { role: 'ai', text: 'What identifying detail do you remember?' },
            { role: 'user', text: 'A private detail.' }
        ],
        tentativeVerdict: { status: 'verified', score: 100, message: 'approved' }
    } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.error, ACTIVE_CLAIM_EXISTS);
    claimModel.create = create;
});

test('claim model defines one active claim partial unique index', () => {
    const indexes = claimModel.schema.indexes();
    const index = indexes.find(([fields, options]) => options?.name === 'one_active_claim_per_item_claimant');
    assert.ok(index);
    assert.deepEqual(index[0], { itemId: 1, claimantId: 1 });
    assert.deepEqual(index[1].partialFilterExpression.verdict.$in, ['pending_admin_review', 'needs_review', 'verified']);
});

afterEach(() => {
    delete itemModel.findById;
    delete claimModel.findOne;
    delete claimModel.create;
});
