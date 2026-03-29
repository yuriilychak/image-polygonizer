import { renderHook, act } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import useImageItem from '../hooks';

const label = 'test-image.png';
const id = 'img-1';

describe('useImageItem', () => {
    let onAction: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        onAction = vi.fn();
    });

    it('initial state: renameMode=false and localName equals label', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        expect(result.current.renameMode).toBe(false);
        expect(result.current.localName).toBe(label);
    });

    it('initial actions are openEditMode and removeImage', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        expect(result.current.actions).toEqual(['openEditMode', 'removeImage']);
    });

    it('warnings includes polygonsOutdated when outdated=true', () => {
        const { result } = renderHook(() => useImageItem(true, true, label, false, id, onAction));
        expect(result.current.warnings).toContain('polygonsOutdated');
    });

    it('warnings includes polygonsMissing when hasPolygons=false', () => {
        const { result } = renderHook(() => useImageItem(false, false, label, false, id, onAction));
        expect(result.current.warnings).toContain('polygonsMissing');
    });

    it('warnings is empty when not outdated and hasPolygons=true', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        expect(result.current.warnings).toHaveLength(0);
    });

    it('isLocalNameInvalid=true when localName equals label', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        expect(result.current.isLocalNameInvalid).toBe(true);
    });

    it('isLocalNameInvalid=true when localName is empty', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        act(() => {
            result.current.handleLocalNameChange({ target: { value: '' } } as any);
        });
        expect(result.current.isLocalNameInvalid).toBe(true);
    });

    it('handleButtonAction openEditMode sets renameMode=true', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        act(() => {
            result.current.handleButtonAction('openEditMode', id);
        });
        expect(result.current.renameMode).toBe(true);
    });

    it('handleButtonAction closeEditMode sets renameMode=false', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        act(() => {
            result.current.handleButtonAction('openEditMode', id);
        });
        act(() => {
            result.current.handleButtonAction('closeEditMode', id);
        });
        expect(result.current.renameMode).toBe(false);
    });

    it('handleButtonAction renameImage calls onAction and sets renameMode=false', () => {
        const mockOnAction = vi.fn();
        const { result } = renderHook(() =>
            useImageItem(false, true, label, false, id, mockOnAction),
        );
        act(() => {
            result.current.handleButtonAction('openEditMode', id);
        });
        act(() => {
            result.current.handleButtonAction('renameImage', id);
        });
        expect(mockOnAction).toHaveBeenCalledWith('renameImage', id, label);
        expect(result.current.renameMode).toBe(false);
    });

    it('handleButtonAction removeImage calls onAction with removeImage and id', () => {
        const mockOnAction = vi.fn();
        const { result } = renderHook(() =>
            useImageItem(false, true, label, false, id, mockOnAction),
        );
        act(() => {
            result.current.handleButtonAction('removeImage', id);
        });
        expect(mockOnAction).toHaveBeenCalledWith('removeImage', id);
    });

    it('handleLocalNameChange updates localName', () => {
        const { result } = renderHook(() => useImageItem(false, true, label, false, id, onAction));
        act(() => {
            result.current.handleLocalNameChange({ target: { value: 'new name' } } as any);
        });
        expect(result.current.localName).toBe('new name');
    });

    it('renameMode resets to false when disabled changes', () => {
        const { result, rerender } = renderHook(
            ({ disabled }: { disabled: boolean }) =>
                useImageItem(false, true, label, disabled, id, onAction),
            { initialProps: { disabled: false } },
        );
        act(() => {
            result.current.handleButtonAction('openEditMode', id);
        });
        expect(result.current.renameMode).toBe(true);
        rerender({ disabled: true });
        expect(result.current.renameMode).toBe(false);
    });
});
