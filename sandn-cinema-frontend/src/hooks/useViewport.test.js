import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useViewport from './useViewport';

const resizeWindowTo = (width) => {
    window.innerWidth = width;
    window.dispatchEvent(new Event('resize'));
};

describe('useViewport', () => {
    it('returns the current window width', () => {
        window.innerWidth = 1024;
        const { result } = renderHook(() => useViewport());
        expect(result.current).toBe(1024);
    });

    it('updates the width when the window is resized', () => {
        window.innerWidth = 1024;
        const { result } = renderHook(() => useViewport());

        act(() => {
            resizeWindowTo(480);
        });

        expect(result.current).toBe(480);
    });

    it('stops listening after unmount', () => {
        window.innerWidth = 1024;
        const { result, unmount } = renderHook(() => useViewport());
        unmount();

        act(() => {
            resizeWindowTo(320);
        });

        expect(result.current).toBe(1024);
    });
});
