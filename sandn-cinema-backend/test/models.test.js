const test = require('node:test');
const assert = require('node:assert');

const { User, Studio, Booking, Service, AlbumSelection, SubscriptionPlan } = require('../models');

test('User schema', async (t) => {
    await t.test('applies defaults for a new user', () => {
        const user = new User({
            name: 'Test User',
            mobile: '9999999999',
            email: 'test@example.com',
            password: 'secret'
        });

        assert.strictEqual(user.role, 'USER');
        assert.strictEqual(user.addedBy, 'SELF');
        assert.strictEqual(user.wallet.coins, 0);
        assert.ok(user.joinedDate instanceof Date);
        assert.strictEqual(user.validateSync(), undefined);
    });

    await t.test('requires name, mobile, email and password', () => {
        const user = new User({});
        const err = user.validateSync();

        assert.ok(err);
        assert.ok(err.errors.name);
        assert.ok(err.errors.mobile);
        assert.ok(err.errors.email);
        assert.ok(err.errors.password);
    });

    await t.test('rejects an invalid activePlan type', () => {
        const user = new User({
            name: 'Test User',
            mobile: '9999999999',
            email: 'test@example.com',
            password: 'secret',
            activePlan: { id: 'p1', planName: 'Gold', type: 'GOLD' }
        });

        const err = user.validateSync();
        assert.ok(err);
        assert.ok(err.errors['activePlan.type']);
    });

    await t.test('requires a url on unlockedMedia entries', () => {
        const user = new User({
            name: 'Test User',
            mobile: '9999999999',
            email: 'test@example.com',
            password: 'secret',
            unlockedMedia: [{}]
        });

        const err = user.validateSync();
        assert.ok(err);
        assert.ok(err.errors['unlockedMedia.0.url']);
    });
});

test('Studio schema', async (t) => {
    await t.test('applies storage plan defaults', () => {
        const studio = new Studio({
            ownerName: 'Owner',
            studioName: 'Studio One',
            mobile: '8888888888',
            email: 'studio@example.com',
            password: 'secret'
        });

        assert.strictEqual(studio.role, 'STUDIO');
        assert.strictEqual(studio.storagePlan, 'FREE');
        assert.strictEqual(studio.allocatedStorageGB, 5);
        assert.strictEqual(studio.usedStorageGB, 0);
        assert.strictEqual(studio.autoDowngradeToFree, true);
        assert.strictEqual(studio.adhaarNumber, 'Pending');
        assert.strictEqual(studio.isAdhaarVerified, false);
        assert.strictEqual(studio.validateSync(), undefined);
    });

    await t.test('requires owner and studio identity fields', () => {
        const studio = new Studio({});
        const err = studio.validateSync();

        assert.ok(err);
        assert.ok(err.errors.ownerName);
        assert.ok(err.errors.studioName);
        assert.ok(err.errors.mobile);
        assert.ok(err.errors.email);
        assert.ok(err.errors.password);
    });
});

test('Booking schema', async (t) => {
    await t.test('starts in Pending status with proposal defaults', () => {
        const booking = new Booking({ name: 'Client', mobile: '7777777777' });

        assert.strictEqual(booking.status, 'Pending');
        assert.strictEqual(booking.isEmergency, false);
        assert.strictEqual(booking.providerTarget, 'ADMIN');
        assert.strictEqual(booking.advancePaid, false);
        assert.strictEqual(booking.proposal.totalPrice, 0);
        assert.strictEqual(booking.proposal.isAccepted, false);
        assert.deepStrictEqual(booking.cartItems, []);
        assert.strictEqual(booking.validateSync(), undefined);
    });
});

test('Service schema', async (t) => {
    await t.test('requires title and startingPrice', () => {
        const service = new Service({});
        const err = service.validateSync();

        assert.ok(err);
        assert.ok(err.errors.title);
        assert.ok(err.errors.startingPrice);
    });

    await t.test('defaults discount fields', () => {
        const service = new Service({ title: 'Wedding Shoot', startingPrice: 5000 });

        assert.strictEqual(service.discountPercentage, 0);
        assert.strictEqual(service.offerText, '');
        assert.strictEqual(service.isPopular, false);
        assert.strictEqual(service.addedBy, 'ADMIN');
        assert.strictEqual(service.validateSync(), undefined);
    });
});

test('AlbumSelection schema', async (t) => {
    const baseAlbum = {
        studioMobile: '8888888888',
        clientMobile: '9999999999',
        folderName: 'Wedding-2026'
    };

    await t.test('applies workflow defaults', () => {
        const album = new AlbumSelection(baseAlbum);

        assert.strictEqual(album.status, 'Pending');
        assert.strictEqual(album.totalPhases, 3);
        assert.strictEqual(album.currentPhase, 1);
        assert.strictEqual(album.isSplitRequested, false);
        assert.strictEqual(album.isFrozen, false);
        assert.strictEqual(album.splitDetails.hasSplit, false);
        assert.strictEqual(album.isPaid, true);
        assert.strictEqual(album.cloudProvider, 'CLOUDINARY');
        assert.strictEqual(album.validateSync(), undefined);
    });

    await t.test('rejects an invalid status', () => {
        const album = new AlbumSelection({ ...baseAlbum, status: 'NOT_A_STATUS' });
        const err = album.validateSync();

        assert.ok(err);
        assert.ok(err.errors.status);
    });

    await t.test('rejects an invalid image status and defaults albumTag', () => {
        const valid = new AlbumSelection({ ...baseAlbum, images: [{ url: 'http://x/img.jpg' }] });
        assert.strictEqual(valid.images[0].status, 'active');
        assert.strictEqual(valid.images[0].albumTag, 'Album 1');
        assert.strictEqual(valid.images[0].subFolder, 'Main Event');

        const invalid = new AlbumSelection({
            ...baseAlbum,
            images: [{ url: 'http://x/img.jpg', status: 'archived' }]
        });
        const err = invalid.validateSync();
        assert.ok(err);
        assert.ok(err.errors['images.0.status']);
    });
});

test('SubscriptionPlan schema', async (t) => {
    await t.test('requires plan name, storage limit and monthly price', () => {
        const plan = new SubscriptionPlan({});
        const err = plan.validateSync();

        assert.ok(err);
        assert.ok(err.errors.planName);
        assert.ok(err.errors.storageLimitGB);
        assert.ok(err.errors.monthlyPrice);
    });

    await t.test('is active by default', () => {
        const plan = new SubscriptionPlan({
            planName: 'Pro',
            storageLimitGB: 100,
            monthlyPrice: 499
        });

        assert.strictEqual(plan.isActive, true);
        assert.strictEqual(plan.discountPercentage, 0);
        assert.strictEqual(plan.validateSync(), undefined);
    });
});
