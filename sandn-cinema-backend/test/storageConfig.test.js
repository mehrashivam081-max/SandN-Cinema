const test = require('node:test');
const assert = require('node:assert');

const StorageConfig = require('../StorageConfig');

test('StorageConfig schema', async (t) => {
    await t.test('requires nickname and provider', () => {
        const config = new StorageConfig({});
        const err = config.validateSync();

        assert.ok(err);
        assert.ok(err.errors.nickname);
        assert.ok(err.errors.provider);
    });

    await t.test('only accepts known providers', () => {
        const config = new StorageConfig({ nickname: 'Bad Cloud', provider: 'DROPBOX' });
        const err = config.validateSync();

        assert.ok(err);
        assert.ok(err.errors.provider);
    });

    await t.test('accepts each supported provider', () => {
        for (const provider of ['CLOUDINARY', 'AWS_S3', 'CLOUDFLARE_R2', 'CUSTOM']) {
            const config = new StorageConfig({ nickname: 'Cloud', provider });
            assert.strictEqual(config.validateSync(), undefined);
        }
    });

    await t.test('applies storage defaults', () => {
        const config = new StorageConfig({ nickname: 'My Cloudinary', provider: 'CLOUDINARY' });

        assert.strictEqual(config.isActive, false);
        assert.strictEqual(config.maxLimitGB, 5);
        assert.strictEqual(config.usedStorageGB, 0);
        assert.ok(config.createdAt instanceof Date);
    });

    await t.test('stores provider credentials', () => {
        const config = new StorageConfig({
            nickname: 'S3 Bucket',
            provider: 'AWS_S3',
            credentials: {
                apiKey: 'key',
                apiSecret: 'secret',
                region: 'ap-south-1',
                bucketName: 'my-bucket'
            }
        });

        assert.strictEqual(config.validateSync(), undefined);
        assert.strictEqual(config.credentials.region, 'ap-south-1');
        assert.strictEqual(config.credentials.bucketName, 'my-bucket');
    });
});
