import { vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import WorkingArea from '../component';

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.hoisted ensures these are available before vi.mock factories run)
// ---------------------------------------------------------------------------
const mockPolygonDataInstance = vi.hoisted(() => ({
  hasAlphaMask: vi.fn().mockReturnValue(false),
  hasContours: vi.fn().mockReturnValue(false),
  hasPolygons: vi.fn().mockReturnValue(false),
  hasTriangles: vi.fn().mockReturnValue(false),
  deserializeAlphaMask: vi.fn().mockReturnValue(new Uint8Array(0)),
  deserializeContours: vi.fn().mockReturnValue([]),
  deserializePolygons: vi.fn().mockReturnValue([]),
  deserializeTriangles: vi.fn().mockReturnValue([]),
  deserializeOffset: vi.fn().mockReturnValue(0),
  deserializeOutline: vi.fn().mockReturnValue(0),
}));

vi.mock('image-polygonizer', () => ({
  PolygonData: { getInstance: vi.fn().mockReturnValue(mockPolygonDataInstance) },
  ImagePolygonizer: vi.fn(),
  NOOP: () => {},
}));

vi.mock('../helpers', () => ({
  createBackgroundPatern: vi.fn().mockReturnValue({ width: 128, height: 128 }),
  drawTransparentPixelsOverlay: vi.fn(),
  drawContoursOverlay: vi.fn(),
  drawPolygonsDebug: vi.fn(),
  drawTriangulation: vi.fn(),
}));

// Import helpers after mock so we get the mocked version
import * as helpers from '../helpers';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Use fake timers to prevent setTimeout(handleResize, 0) from firing outside act()
  vi.useFakeTimers();

  // Reset has* return values to false before every test
  mockPolygonDataInstance.hasAlphaMask.mockReturnValue(false);
  mockPolygonDataInstance.hasContours.mockReturnValue(false);
  mockPolygonDataInstance.hasPolygons.mockReturnValue(false);
  mockPolygonDataInstance.hasTriangles.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('WorkingArea', () => {
  it('renders a container div with className "working-area"', () => {
    render(<WorkingArea />);
    expect(document.querySelector('.working-area')).not.toBeNull();
  });

  it('renders a canvas with className "working-canvas"', () => {
    render(<WorkingArea />);
    expect(document.querySelector('.working-canvas')).not.toBeNull();
  });

  it('renders no action buttons when polygonInfo is empty (default)', () => {
    render(<WorkingArea />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders alpha button with text "A" when hasAlphaMask returns true', () => {
    mockPolygonDataInstance.hasAlphaMask.mockReturnValue(true);
    render(<WorkingArea polygonInfo={new Uint16Array([1, 2, 3])} />);
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy();
  });

  it('renders contour button with text "□" when hasContours returns true', () => {
    mockPolygonDataInstance.hasContours.mockReturnValue(true);
    render(<WorkingArea polygonInfo={new Uint16Array([1, 2, 3])} />);
    expect(screen.getByRole('button', { name: '□' })).toBeTruthy();
  });

  it('renders polygon button with text "◇" when hasPolygons returns true', () => {
    mockPolygonDataInstance.hasPolygons.mockReturnValue(true);
    render(<WorkingArea polygonInfo={new Uint16Array([1, 2, 3])} />);
    expect(screen.getByRole('button', { name: '◇' })).toBeTruthy();
  });

  it('renders triangles button with text "△" when hasTriangles returns true', () => {
    mockPolygonDataInstance.hasTriangles.mockReturnValue(true);
    render(<WorkingArea polygonInfo={new Uint16Array([1, 2, 3])} />);
    expect(screen.getByRole('button', { name: '△' })).toBeTruthy();
  });

  it('clicking a button toggles the "working-area-button-active" class on/off', () => {
    mockPolygonDataInstance.hasAlphaMask.mockReturnValue(true);
    render(<WorkingArea polygonInfo={new Uint16Array([1, 2, 3])} />);

    const button = screen.getByRole('button', { name: 'A' });

    expect(button.className).not.toContain('working-area-button-active');

    fireEvent.click(button);
    expect(button.className).toContain('working-area-button-active');

    fireEvent.click(button);
    expect(button.className).not.toContain('working-area-button-active');
  });

  it('does not call drawing overlay helpers when src is null', () => {
    render(<WorkingArea src={null} />);

    expect(helpers.drawTransparentPixelsOverlay).not.toHaveBeenCalled();
    expect(helpers.drawContoursOverlay).not.toHaveBeenCalled();
    expect(helpers.drawPolygonsDebug).not.toHaveBeenCalled();
    expect(helpers.drawTriangulation).not.toHaveBeenCalled();
  });
});
