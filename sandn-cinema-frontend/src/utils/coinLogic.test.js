import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateDailyReward } from './coinLogic';

const toDateStr = (date) => date.toISOString().slice(0, 10);

// 2026-08-12 is a Wednesday, 2026-08-16 is a Sunday
const WEDNESDAY = new Date('2026-08-12T12:00:00Z');
const SUNDAY = new Date('2026-08-16T12:00:00Z');

describe('calculateDailyReward', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('gives 1 coin and starts a streak for a user with no wallet', () => {
        vi.setSystemTime(WEDNESDAY);

        const result = calculateDailyReward({});

        expect(result.coins).toBe(1);
        expect(result.currentStreak).toBe(1);
        expect(result.rewardAdded).toBe(true);
        expect(result.rewardAmount).toBe(1);
        expect(result.isSundayBonus).toBe(false);
        expect(result.lastLoginDate).toBe(toDateStr(WEDNESDAY));
    });

    it('does not reward twice on the same day', () => {
        vi.setSystemTime(WEDNESDAY);
        const wallet = { coins: 10, lastLoginDate: toDateStr(WEDNESDAY), currentStreak: 3 };

        const result = calculateDailyReward({ wallet });

        expect(result.rewardAdded).toBe(false);
        expect(result.coins).toBe(10);
        expect(result.currentStreak).toBe(3);
        expect(result.lastLoginDate).toBe(toDateStr(WEDNESDAY));
    });

    it('increments the streak when the user logged in yesterday', () => {
        vi.setSystemTime(WEDNESDAY);
        const yesterday = new Date(WEDNESDAY);
        yesterday.setDate(yesterday.getDate() - 1);
        const wallet = { coins: 5, lastLoginDate: toDateStr(yesterday), currentStreak: 2 };

        const result = calculateDailyReward({ wallet });

        expect(result.currentStreak).toBe(3);
        expect(result.coins).toBe(6);
        expect(result.rewardAdded).toBe(true);
        expect(result.rewardAmount).toBe(1);
    });

    it('resets the streak when a day was missed', () => {
        vi.setSystemTime(WEDNESDAY);
        const twoDaysAgo = new Date(WEDNESDAY);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const wallet = { coins: 5, lastLoginDate: toDateStr(twoDaysAgo), currentStreak: 9 };

        const result = calculateDailyReward({ wallet });

        expect(result.currentStreak).toBe(1);
        expect(result.coins).toBe(6);
        expect(result.rewardAdded).toBe(true);
    });

    it('adds the Sunday bonus when the streak reaches 7 on a Sunday', () => {
        vi.setSystemTime(SUNDAY);
        const saturday = new Date(SUNDAY);
        saturday.setDate(saturday.getDate() - 1);
        const wallet = { coins: 20, lastLoginDate: toDateStr(saturday), currentStreak: 6 };

        const result = calculateDailyReward({ wallet });

        expect(result.currentStreak).toBe(7);
        expect(result.coins).toBe(28); // 20 + 1 + 7 bonus
        expect(result.rewardAmount).toBe(8);
        expect(result.isSundayBonus).toBe(true);
    });

    it('does not add the Sunday bonus when the streak is below 7', () => {
        vi.setSystemTime(SUNDAY);
        const saturday = new Date(SUNDAY);
        saturday.setDate(saturday.getDate() - 1);
        const wallet = { coins: 20, lastLoginDate: toDateStr(saturday), currentStreak: 2 };

        const result = calculateDailyReward({ wallet });

        expect(result.currentStreak).toBe(3);
        expect(result.coins).toBe(21);
        expect(result.rewardAmount).toBe(1);
        expect(result.isSundayBonus).toBe(false);
    });

    it('does not add a bonus on a weekday even with a long streak', () => {
        vi.setSystemTime(WEDNESDAY);
        const yesterday = new Date(WEDNESDAY);
        yesterday.setDate(yesterday.getDate() - 1);
        const wallet = { coins: 20, lastLoginDate: toDateStr(yesterday), currentStreak: 10 };

        const result = calculateDailyReward({ wallet });

        expect(result.currentStreak).toBe(11);
        expect(result.coins).toBe(21);
        expect(result.isSundayBonus).toBe(false);
    });
});
