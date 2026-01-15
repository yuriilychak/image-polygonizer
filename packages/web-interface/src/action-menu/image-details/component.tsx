import { MenuSection } from "../menu-section";
import { RangeInput } from "./range-input";
import './component.css';


const ImageDetails = () => (
    <MenuSection title="Image details" contentClassName="image-details-content">
        <RangeInput id="maxPointCount" label="Maximum point count" min={1} max={100} value={50} title="Maximium point count alloved in result polyogn" />
        <RangeInput id="alphaThreshold" label="Alpha threshold" min={0} max={256} value={0} title="Alpha trashold that will mark all alpha values below as empty area" />
        <RangeInput id="minimalDistance" label="Minimal distance" min={1} max={256} value={8} title="Max distance from non optimized polygon to reduce point count during simplification"/>
    </MenuSection>
);

export default ImageDetails;