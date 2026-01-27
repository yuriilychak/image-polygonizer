import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

export default [
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/image-polygonizer.js',
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
        ],
    },
    {
        input: 'src/index.ts',
        output: {
            file: 'dist/image-polygonizer.d.ts',
            sourcemap: false,
        },
        plugins: [resolve(), dts()],
    },
];
