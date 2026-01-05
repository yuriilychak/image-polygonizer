import { useState } from 'react';
import './App.css';

/**
 * Main application component for the Image Polygonizer
 * @returns The main App component
 */
function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Image Polygonizer</h1>
        <p>A browser-based polygonization tool for PNG/WebP assets</p>
        <div className="card">
          <button onClick={() => setCount(count => count + 1)}>count is {count}</button>
        </div>
      </header>
    </div>
  );
}

export default App;
