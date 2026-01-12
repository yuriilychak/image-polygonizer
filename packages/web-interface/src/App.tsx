import { ActionMenu } from './action-menu';
import { WorkingArea } from './working-area';
import './App.css';

/**
 * Main application component for the Image Polygonizer
 * @returns The main App component
 */
function App() {
  return (
    <div className="app-container">
      <ActionMenu />
      <WorkingArea />
    </div>
  );
}

export default App;
