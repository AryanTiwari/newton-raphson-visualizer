import { useState, useCallback, useRef } from 'react';
import Graph from './components/Graph';
import Controls from './components/Controls';
import IterationList from './components/IterationList';
import { createNewtonSolver } from './utils/newton';

function App() {
  const [functionExpression, setFunctionExpression] = useState('');
  const [latexExpression, setLatexExpression] = useState('');
  const [iterations, setIterations] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [hasConverged, setHasConverged] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [error, setError] = useState('');
  const [initialGuess, setInitialGuess] = useState(3);
  const [visibleIterations, setVisibleIterations] = useState(new Set());
  const [tangentLineMode, setTangentLineMode] = useState('segment'); // 'full', 'segment', or 'hidden'

  const solverRef = useRef(null);

  const handleGraphFunction = useCallback((expression, latex, guess) => {
    try {
      setError('');
      setSelectedElement(null);

      // Create new solver
      const solver = createNewtonSolver(expression);
      solver.setInitialGuess(guess);
      solverRef.current = solver;

      // Set state
      setFunctionExpression(expression);
      setLatexExpression(latex);
      setInitialGuess(guess);
      setIterations(solver.getIterations());
      setVisibleIterations(new Set([0])); // Show first iteration by default
      setIsActive(true);
      setHasConverged(false);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleNextIteration = useCallback(() => {
    if (!solverRef.current) return;

    try {
      setError('');
      solverRef.current.nextIteration();
      const newIterations = solverRef.current.getIterations();
      setIterations(newIterations);

      // Add new iteration to visible set
      setVisibleIterations(prev => new Set([...prev, newIterations.length - 1]));

      // Check for convergence
      if (solverRef.current.hasConverged()) {
        setHasConverged(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleReset = useCallback(() => {
    solverRef.current = null;
    setFunctionExpression('');
    setLatexExpression('');
    setIterations([]);
    setVisibleIterations(new Set());
    setIsActive(false);
    setHasConverged(false);
    setSelectedElement(null);
    setError('');
  }, []);

  // Toggle visibility of an iteration
  const handleToggleIteration = useCallback((index) => {
    setVisibleIterations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleElementClick = useCallback((element) => {
    setSelectedElement(element);
  }, []);

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: 'var(--bg-primary)' }}>
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_350px] 2xl:grid-cols-[320px_1fr_350px] gap-5 p-5 min-h-screen max-w-[1800px] mx-auto max-xl:grid-cols-1 max-xl:grid-rows-[auto_1fr_auto]">
        <aside className="flex flex-col gap-4 max-xl:order-1">
          <Controls
            onGraphFunction={handleGraphFunction}
            onNextIteration={handleNextIteration}
            onReset={handleReset}
            isActive={isActive}
            currentIteration={iterations.length - 1}
            hasConverged={hasConverged}
            currentInitialGuess={initialGuess}
            tangentLineMode={tangentLineMode}
            onTangentLineModeChange={setTangentLineMode}
          />
          {error && (
            <div
              className="px-4 py-3 rounded-lg text-sm"
              style={{
                background: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
                color: 'var(--error-text)'
              }}
            >
              {error}
            </div>
          )}
        </aside>

        <main className="flex flex-col min-h-[600px] max-xl:order-2 max-xl:min-h-[500px]">
          <Graph
            functionExpression={functionExpression}
            solver={solverRef.current}
            iterations={iterations}
            visibleIterations={visibleIterations}
            tangentLineMode={tangentLineMode}
            onElementClick={handleElementClick}
          />
        </main>

        <aside className="flex flex-col max-xl:order-3">
          <IterationList
            iterations={iterations}
            selectedElement={selectedElement}
            visibleIterations={visibleIterations}
            onToggleIteration={handleToggleIteration}
            latexExpression={latexExpression}
          />
        </aside>
      </div>
    </div>
  );
}

export default App;
