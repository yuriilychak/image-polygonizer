import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default [
    {
        input: 'src/index.ts',
        output: {
            file: '../../dist/image-polygonizer.js',
            format: 'esm',
            sourcemap: true,
        },
        plugins: [
            resolve(),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false,
                declarationMap: false,
            }),
            terser(),
        ],
    },
    {
        input: 'src/image-poligonizer.worker.ts',
        output: {
            file: '../../dist/image-polygonizer.calc.js',
            format: 'iife',
            sourcemap: true,
        },
        plugins: [
            resolve(),
            commonjs(),
            typescript({
                tsconfig: './tsconfig.json',
                declaration: false,
                declarationMap: false,
            }),
            terser(),
        ],
    },
];
