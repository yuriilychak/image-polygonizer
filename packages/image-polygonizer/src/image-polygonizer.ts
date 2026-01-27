

export default class ImagePolygonizer {
    constructor() {
        // Initialization code here
    }

    async polygonize(id: string, image: ImageBitmap, maxPointCount: number, alphaThreshold: number, minimalDistance: number): Promise<void> {
        console.log(id, image, maxPointCount, alphaThreshold, minimalDistance);
    }
}