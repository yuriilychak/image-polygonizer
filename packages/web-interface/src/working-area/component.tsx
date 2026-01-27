import { useRef, useEffect, useState, useCallback } from 'react';
import { createBackgroundPatern } from './helpers';

import type { FC } from 'react';

import './component.css';

type WorkingAreaProps = {
    src: ImageBitmap | null;
};

const WorkingArea: FC<WorkingAreaProps> = ({ src }) => {
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
        }
    }, [canvasSize, pattern, context, src]);

    return (
        <div className="working-area" ref={rootRef}>
            <canvas ref={canvasRef} {...canvasSize} className="working-canvas" />
        </div>
    );
};

export default WorkingArea;
