const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { uploadRedactedImage } = require('../utils/cloudinary');
const validation = require('../validation/foundItemImages');
const Item = require('../models/foundItemModel');
const Claim = require('../models/claimModel');
const Escrow = require('../models/escrowModel');

const mask = { x: 25, y: 25, w: 50, h: 50 };
async function fixture() {
    const buffer = await sharp({ create: { width: 8, height: 8, channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
    return `data:image/png;base64,${buffer.toString('base64')}`;
}

test('validation rejects remote URLs, unsupported and malformed data', () => {
    for (const value of ['https://example.test/private.png', 'data:image/svg+xml;base64,AAAA',
        'data:image/png;base64,A===', 'data:image/png;base64,AB==', null]) {
        assert.throws(() => validation.decodeImageDataUri(value));
    }
    assert.throws(() => validation.decodeImageDataUri(`data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}`));
});

test('mask bounds, counts and mappings fail closed', () => {
    for (const zones of [[{ ...mask, x: 90 }], [{ ...mask, w: 0 }],
        [{ ...mask, y: NaN }], Array(51).fill(mask)]) {
        assert.throws(() => validation.validateBlurZones(zones));
    }
    for (const data of [
        { images: ['a', 'b'], blurZones: [] },
        { images: ['a'], blurZones: [], allBlurZones: {} },
        { images: ['a'], allBlurZones: { 1: [] } }
    ]) {
        const issues = [];
        validation.validateImageZoneMapping(data, { addIssue: issue => issues.push(issue) });
        assert.ok(issues.length);
    }
    assert.deepEqual(validation.normalizeImageZones(['a', 'b'], { 1: [mask] }), { 0: [], 1: [mask] });
});

test('public PNG contains opaque replaced pixels; original upload is authenticated', async t => {
    const uploads = [];
    t.mock.method(cloudinary.uploader, 'upload', async (data, options) => {
        uploads.push({ data, options });
        return { public_id: options.public_id, type: options.type, secure_url: 'https://example.test/public.png' };
    });
    const result = await uploadRedactedImage(await fixture(), [mask]);
    assert.equal(uploads[0].options.type, 'authenticated');
    assert.equal(uploads[1].options.type, 'upload');
    assert.notEqual(uploads[0].options.public_id.split('/').at(-1), uploads[1].options.public_id.split('/').at(-1));
    assert.equal(result.originalUrl, undefined);
    const publicBuffer = Buffer.from(uploads[1].data.split(',')[1], 'base64');
    const meta = await sharp(publicBuffer).metadata();
    assert.equal(meta.exif, undefined);
    const { data, info } = await sharp(publicBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const pixel = [...data.subarray((y * 8 + x) * info.channels, (y * 8 + x) * info.channels + 4)];
        assert.deepEqual(pixel, x >= 2 && x < 6 && y >= 2 && y < 6 ? [0, 0, 0, 255] : [255, 0, 0, 255]);
    }
});

test('even unmasked images use an independent re-encoded public asset', async t => {
    const uploads = [];
    t.mock.method(cloudinary.uploader, 'upload', async (data, options) => {
        uploads.push(options);
        return { public_id: options.public_id, type: options.type, secure_url: 'https://example.test/public.png' };
    });
    await uploadRedactedImage(await fixture(), []);
    assert.equal(uploads.length, 2);
    assert.notEqual(uploads[0].public_id, uploads[1].public_id);
});

test('public upload failure cleans up both attempted assets', async t => {
    const attempted = [], removed = [];
    t.mock.method(cloudinary.uploader, 'upload', async (_data, options) => {
        attempted.push(options);
        if (options.type === 'upload') throw new Error('Synthetic failure');
        return { public_id: options.public_id, type: options.type };
    });
    t.mock.method(cloudinary.uploader, 'destroy', async (id, options) => {
        removed.push([id, options.type]);
        return { result: 'ok' };
    });
    await assert.rejects(uploadRedactedImage(await fixture(), [mask]), /securely upload/);
    assert.deepEqual(removed, attempted.map(options => [options.public_id, options.type]));
});

test('corrupt image bytes never reach storage', async t => {
    const upload = t.mock.method(cloudinary.uploader, 'upload', async () => { throw new Error('Must not upload'); });
    await assert.rejects(uploadRedactedImage('data:image/png;base64,YWJj', []), /decoded safely/);
    assert.equal(upload.mock.callCount(), 0);
});

test('original references are stripped even from newly created documents', () => {
    const item = new Item({ images: ['https://example.test/safe.png'], imagePrivacyVersion: 1,
        originalImages: ['https://example.test/secret.png'], originalImageAssets: [
            { publicId: 'private-secret', type: 'authenticated', resourceType: 'image' }
        ] });
    for (const value of [item.toObject(), item.toJSON(), JSON.parse(JSON.stringify(item))]) {
        assert.equal(value.originalImages, undefined);
        assert.equal(value.originalImageAssets, undefined);
        assert.deepEqual(value.images, ['https://example.test/safe.png']);
        assert.equal(value.imagesUnavailable, false);
    }
});

test('legacy images fail closed in direct and populated document responses', () => {
    const item = Item.hydrate({ _id: new Item()._id, images: ['https://example.test/legacy-secret.png'] });
    for (const value of [item.toJSON(), item.toObject()]) {
        assert.deepEqual(value.images, []);
        assert.equal(value.imagesUnavailable, true);
    }
    for (const Model of [Claim, Escrow]) {
        const parent = new Model({ itemId: item._id });
        parent.itemId = item;
        assert.ok(parent.itemId instanceof Item);
        for (const value of [parent.toObject(), JSON.parse(JSON.stringify(parent))]) {
            assert.deepEqual(value.itemId.images, []);
            assert.equal(value.itemId.imagesUnavailable, true);
        }
    }
});

test('frontend mapping and legacy image filtering match backend contract', async () => {
    const ui = await import('../../src/utils/foundImagePrivacy.js');
    const image = await fixture();
    assert.equal(ui.foundImagesError(Array(5).fill(image), { 1: [mask] }), '');
    assert.notEqual(ui.foundImagesError(Array(6).fill(image), {}), '');
    assert.notEqual(ui.foundImagesError([image], { 1: [mask] }), '');
    assert.deepEqual(ui.publicFoundImages({ images: ['legacy'] }), []);
    assert.deepEqual(ui.publicFoundImages({ images: ['safe'], imagePrivacyVersion: 1 }), ['safe']);
});

function response() {
    return { statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; } };
}

test('item API rejects missing photos, excess photos, remote URLs and invalid mappings before persistence', async t => {
    const { addItem } = require('../controllers/itemFoundController');
    const create = t.mock.method(Item, 'create', async () => { throw new Error('Must not save'); });
    const upload = t.mock.method(cloudinary.uploader, 'upload', async () => { throw new Error('Must not upload'); });
    const image = await fixture();
    const base = { shortTitle: 'Red bag', description: 'Found a bag', location: 'Library', category: 'bag' };
    for (const body of [
        { ...base, images: [] },
        { ...base, images: Array(6).fill(image) },
        { ...base, images: ['https://example.test/arbitrary.png'] },
        { ...base, images: [image], allBlurZones: { 1: [mask] } },
        { ...base, images: [image, image], blurZones: [mask] }
    ]) {
        const res = response();
        await addItem({ user: { _id: new Item()._id }, body }, res);
        assert.equal(res.statusCode, 400);
    }
    assert.equal(create.mock.callCount(), 0);
    assert.equal(upload.mock.callCount(), 0);
});

test('item API isolates two photo masks and strips originals from create response', async t => {
    const { addItem } = require('../controllers/itemFoundController');
    const email = require('../utils/emailUtils');
    t.mock.method(email, 'sendAdminReviewAlert', async () => true);
    t.mock.method(Item, 'create', async data => new Item(data));
    const publicBuffers = [];
    t.mock.method(cloudinary.uploader, 'upload', async (data, options) => {
        if (options.type === 'upload') publicBuffers.push(Buffer.from(data.split(',')[1], 'base64'));
        return { public_id: options.public_id, type: options.type, secure_url: 'https://example.test/public.png' };
    });
    const image = await fixture();
    const res = response();
    await addItem({ user: { _id: new Item()._id }, body: {
        shortTitle: 'Red bag', description: 'Found a bag', location: 'Library', category: 'bag',
        images: [image, image], allBlurZones: { 0: [mask], 1: [] }, imagePrivacyVersion: 999
    } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.item.imagePrivacyVersion, 1);
    assert.equal(res.body.item.originalImageAssets, undefined);
    assert.equal(res.body.item.originalImages, undefined);
    assert.deepEqual(res.body.item.allBlurZones, { 0: [mask], 1: [] });
    const first = await sharp(publicBuffers[0]).ensureAlpha().raw().toBuffer();
    const second = await sharp(publicBuffers[1]).ensureAlpha().raw().toBuffer();
    const offset = (3 * 8 + 3) * 4;
    assert.deepEqual([...first.subarray(offset, offset + 4)], [0, 0, 0, 255]);
    assert.deepEqual([...second.subarray(offset, offset + 4)], [255, 0, 0, 255]);
});
