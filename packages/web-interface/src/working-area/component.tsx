import { useRef, useEffect, useState, useCallback } from 'react';
import { DEFAULT_POLYGON_INFO } from 'image-polygonizer';
import {
    createBackgroundPatern,
    drawContoursOverlay,
    drawTransparentPixelsOverlay,
    drawPolygonsDebug,
} from './helpers';
import { DRAW_ITEMS_TO_CHAR } from './constants';

import type { FC, MouseEventHandler } from 'react';
import type { PolygonInfo } from 'image-polygonizer';
import type { DrawItem } from '../types';

import './component.css';

type WorkingAreaProps = {
    src?: ImageBitmap | null;
    polygonInfo?: PolygonInfo;
};

const WorkingArea: FC<WorkingAreaProps> = ({ src = null, polygonInfo = DEFAULT_POLYGON_INFO }) => {
    const [availableActions, setAvailableActions] = useState<DrawItem[]>([]);
    const [activeActions, setActiveActions] = useState<DrawItem[]>([]);
    const rootRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
    const [pattern, setPattern] = useState<CanvasPattern | null>(null);

    const handleResize = useCallback(() => {
        if (rootRef.current) {
            const { clientWidth, clientHeight } = rootRef.current;
            setCanvasSize({ width: clientWidth, height: clientHeight });
        }
    }, []);

    const onAction: MouseEventHandler<HTMLButtonElement> = e => {
        const item = e.currentTarget.id as DrawItem;
        setActiveActions(preveActiveActions =>
            preveActiveActions.includes(item)
                ? preveActiveActions.filter(a => a !== item)
                : [...preveActiveActions, item]
        );
    };

    useEffect(() => {
        const nextActions: DrawItem[] = [];
        if (polygonInfo.alphaMask.length > 0) {
            nextActions.push('alpha');
        }

        if (polygonInfo.contours.length > 0) {
            nextActions.push('contour');
        }

        if (polygonInfo.polygons.length > 0) {
            nextActions.push('polygon');
        }

        setAvailableActions(nextActions);
        setActiveActions([]);
    }, [polygonInfo]);

    useEffect(() => {
        if (canvasRef.current && !context) {
            const ctx = canvasRef.current.getContext('2d') as CanvasRenderingContext2D;
            setContext(ctx);
        }
        setTimeout(handleResize, 0);
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    useEffect(() => {
        if (canvasSize.width === 0 || canvasSize.height === 0 || !context) {
            return;
        }

        let usedPattern: CanvasPattern;

        if (!pattern) {
            const patternCanvas = createBackgroundPatern();
            usedPattern = context.createPattern(patternCanvas, 'repeat') as CanvasPattern;

            setPattern(usedPattern);
        } else {
            usedPattern = pattern;
        }

        context.fillStyle = usedPattern;
        context.fillRect(0, 0, canvasSize.width, canvasSize.height);
        if (src !== null) {
            const offset = 64;
            const scale = Math.min(
                (canvasSize.width - 2 * offset) / src.width,
                (canvasSize.height - 2 * offset) / src.height,
                1
            );
            const scaledWidth = src.width * scale;
            const scaledHeight = src.height * scale;
            context.drawImage(
                src,
                (canvasSize.width - scaledWidth) / 2,
                (canvasSize.height - scaledHeight) / 2,
                scaledWidth,
                scaledHeight
            );

            if (activeActions.includes('alpha') && polygonInfo.alphaMask.length > 0) {
                drawTransparentPixelsOverlay(
                    context,
                    polygonInfo.alphaMask,
                    src.width + 4,
                    src.height + 4,
                    {
                        offsetX: (canvasSize.width - scaledWidth) / 2,
                        offsetY: (canvasSize.height - scaledHeight) / 2,
                        scale,
                        padding: 2,
                        colorRGBA: [255, 0, 0, 120],
                    }
                );
            }

            if (activeActions.includes('contour') && polygonInfo.contours.length > 0) {
                drawContoursOverlay(context, polygonInfo.contours, {
                    offsetX: (canvasSize.width - scaledWidth) / 2,
                    offsetY: (canvasSize.height - scaledHeight) / 2,
                    scale,
                    lineWidth: 2,
                    color: 'rgba(0, 255, 0, 1)',
                    fillAlpha: 0.5,
                });
            }

            if (activeActions.includes('polygon') && polygonInfo.polygons.length > 0) {
                drawPolygonsDebug(context, polygonInfo.polygons, {
                    offsetX: (canvasSize.width - scaledWidth) / 2,
                    offsetY: (canvasSize.height - scaledHeight) / 2,
                    scale,
                    lineWidth: 2,
                    color: 'rgba(0, 0, 255, 1)',
                    fillAlpha: 0.35,
                });
            }
        }
    }, [canvasSize, pattern, context, src, activeActions, polygonInfo]);

    return (
        <div className="working-area" ref={rootRef}>
            <canvas ref={canvasRef} {...canvasSize} className="working-canvas" />
            {availableActions.length > 0 && (
                <div className="working-area-actions">
                    {availableActions.map(item => (
                        <button
                            key={item}
                            className={`working-area-button ${activeActions.includes(item) ? 'working-area-button-active' : ''}`}
                            id={item}
                            onClick={onAction}
                        >
                            {DRAW_ITEMS_TO_CHAR[item]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WorkingArea;
