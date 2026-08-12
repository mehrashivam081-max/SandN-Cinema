import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useBackButton from './useBackButton';

const firePopState = () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
};

describe('useBackButton', () => {
    let pushStateSpy;

    beforeEach(() => {
        pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    });

    it('sets a history trap on mount', () => {
        renderHook(() => useBackButton(vi.fn()));
        expect(pushStateSpy).toHaveBeenCalledWith(null, null, window.location.href);
    });

    it('calls the callback and re-arms the trap on back navigation', () => {
        const callback = vi.fn();
        renderHook(() => useBackButton(callback));
        pushStateSpy.mockClear();

        act(() => {
            firePopState();
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(pushStateSpy).toHaveBeenCalledWith(null, null, window.location.href);
    });

    it('always invokes the latest callback without re-subscribing', () => {
        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = renderHook(({ cb }) => useBackButton(cb), {
            initialProps: { cb: first },
        });

        rerender({ cb: second });

        act(() => {
            firePopState();
        });

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('removes the popstate listener on unmount', () => {
        const callback = vi.fn();
        const { unmount } = renderHook(() => useBackButton(callback));
        unmount();

        act(() => {
            firePopState();
        });

        expect(callback).not.toHaveBeenCalled();
    });
});
