import { useEffect, useRef, useCallback } from 'react';
import JXG from 'jsxgraph';
import { getIterationColor } from '../utils/newton';

function Graph({
  functionExpression,
  solver,
  iterations,
  visibleIterations,
  tangentLineMode = 'segment',
  onElementClick
}) {
  const containerRef = useRef(null);
  const boardRef = useRef(null);
  const elementsRef = useRef({
    functionCurve: null,
    iterationElements: [],
    initialGuessPoint: null
  });
  const panStateRef = useRef({
    isPanning: false,
    startX: 0,
    startY: 0
  });

  // Initialize the board with pan and zoom support
  useEffect(() => {
    if (!containerRef.current) return;

    // Create board with initial settings
    const board = JXG.JSXGraph.initBoard(containerRef.current.id, {
      boundingbox: [-10, 10, 10, -10],
      axis: true,
      grid: true,
      showNavigation: true,
      showCopyright: false,
      pan: {
        enabled: true,
        needTwoFingers: false,
        needShift: false
      },
      zoom: {
        wheel: true,
        needShift: false,
        min: 0.001,
        max: 1000
      },
      keepAspectRatio: true
    });

    boardRef.current = board;

    // Add middle-click pan support
    const container = containerRef.current;

    const handleMouseDown = (e) => {
      if (e.button === 1) {
        e.preventDefault();
        panStateRef.current = {
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY
        };
        container.style.cursor = 'grabbing';
      }
    };

    const handleMouseMove = (e) => {
      if (!panStateRef.current.isPanning || !boardRef.current) return;

      const dx = e.clientX - panStateRef.current.startX;
      const dy = e.clientY - panStateRef.current.startY;

      const box = boardRef.current.getBoundingBox();
      const containerRect = container.getBoundingClientRect();

      const unitX = (box[2] - box[0]) / containerRect.width;
      const unitY = (box[1] - box[3]) / containerRect.height;

      const moveX = -dx * unitX;
      const moveY = dy * unitY;

      boardRef.current.setBoundingBox([
        box[0] + moveX,
        box[1] + moveY,
        box[2] + moveX,
        box[3] + moveY
      ], false);

      panStateRef.current.startX = e.clientX;
      panStateRef.current.startY = e.clientY;
    };

    const handleMouseUp = (e) => {
      if (e.button === 1) {
        panStateRef.current.isPanning = false;
        container.style.cursor = '';
      }
    };

    const handleContextMenu = (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('auxclick', handleContextMenu);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('auxclick', handleContextMenu);

      if (boardRef.current) {
        JXG.JSXGraph.freeBoard(boardRef.current);
        boardRef.current = null;
      }
    };
  }, []);

  // Clear all iteration elements
  const clearIterations = useCallback(() => {
    if (!boardRef.current) return;

    elementsRef.current.iterationElements.forEach(element => {
      if (element && boardRef.current.objects[element.id]) {
        boardRef.current.removeObject(element);
      }
    });
    elementsRef.current.iterationElements = [];

    if (elementsRef.current.initialGuessPoint) {
      if (boardRef.current.objects[elementsRef.current.initialGuessPoint.id]) {
        boardRef.current.removeObject(elementsRef.current.initialGuessPoint);
      }
      elementsRef.current.initialGuessPoint = null;
    }
  }, []);

  // Draw the main function curve
  useEffect(() => {
    if (!boardRef.current || !solver) return;

    if (elementsRef.current.functionCurve) {
      boardRef.current.removeObject(elementsRef.current.functionCurve);
    }

    elementsRef.current.functionCurve = boardRef.current.create('functiongraph', [
      (x) => {
        const y = solver.evaluate(x);
        return isFinite(y) ? y : NaN;
      }
    ], {
      strokeColor: '#2563eb',
      strokeWidth: 2,
      name: `f(x) = ${functionExpression}`,
      withLabel: false,
      highlight: true,
      fixed: true
    });

    elementsRef.current.functionCurve.on('down', () => {
      if (onElementClick) {
        onElementClick({
          type: 'function',
          name: `f(x) = ${functionExpression}`,
          derivative: solver.getDerivativeString()
        });
      }
    });

  }, [functionExpression, solver, onElementClick]);

  // Draw iteration elements
  useEffect(() => {
    if (!boardRef.current || !solver || !iterations || iterations.length === 0) {
      clearIterations();
      return;
    }

    clearIterations();
    const board = boardRef.current;
    const newElements = [];

    const initialFx = iterations[0]?.fx ?? 1;

    iterations.forEach((iter, idx) => {
      const isVisible = visibleIterations?.has(idx) ?? true;
      if (!isVisible) return;

      const color = getIterationColor(iter.fx, initialFx);
      const isFirst = idx === 0;

      const tangentSlope = iter.fPrimeX;
      const tangentIntercept = iter.fx - iter.fPrimeX * iter.x;

      // Point on the curve
      const pointOnCurve = board.create('point', [iter.x, iter.fx], {
        name: `P${idx}`,
        size: 5,
        fillColor: color,
        strokeColor: '#000000',
        strokeWidth: 1,
        withLabel: true,
        fixed: true,
        label: {
          position: 'top',
          offset: [8, 12],
          fontSize: 14,
          fontWeight: 'bold',
          color: '#000000',
          strokeColor: '#ffffff',
          strokeWidth: 2,
          useMathJax: false,
          cssStyle: 'background: rgba(255,255,255,0.85); padding: 2px 5px; border-radius: 3px; border: 1px solid ' + color
        }
      });
      newElements.push(pointOnCurve);

      pointOnCurve.on('down', () => {
        if (onElementClick) {
          onElementClick({
            type: 'point',
            name: `Iteration ${idx}`,
            x: iter.x,
            fx: iter.fx,
            fPrimeX: iter.fPrimeX
          });
        }
      });

      // Tangent line (only draw if not hidden)
      if (tangentLineMode !== 'hidden') {
        const xIntercept = -tangentIntercept / tangentSlope;

        let tangentElement;
        if (tangentLineMode === 'segment') {
          // Draw segment from point on curve to x-axis intercept
          tangentElement = board.create('segment', [
            [iter.x, iter.fx],
            [xIntercept, 0]
          ], {
            strokeColor: color,
            strokeWidth: 3.5,
            dash: 2,
            name: `Tangent ${idx}`,
            withLabel: false,
            highlight: true,
            fixed: true
          });
        } else {
          // Full tangent line across the graph
          tangentElement = board.create('functiongraph', [
            (t) => tangentSlope * t + tangentIntercept
          ], {
            strokeColor: color,
            strokeWidth: 3.5,
            dash: 2,
            name: `Tangent ${idx}`,
            withLabel: false,
            highlight: true,
            fixed: true
          });
        }
        newElements.push(tangentElement);

        tangentElement.on('down', () => {
          if (onElementClick) {
            onElementClick({
              type: 'tangent',
              name: `Tangent at x${idx}`,
              slope: tangentSlope,
              intercept: tangentIntercept,
              xIntercept: xIntercept
            });
          }
        });
      }

      // Vertical line from point to x-axis
      const verticalLine = board.create('segment', [
        [iter.x, iter.fx],
        [iter.x, 0]
      ], {
        strokeColor: color,
        strokeWidth: 3,
        dash: 3,
        highlight: false,
        fixed: true
      });
      newElements.push(verticalLine);

      // Point on x-axis
      if (isFirst) {
        // First point (x0)
        const initialGuessPoint = board.create('point', [iter.x, 0], {
          name: 'x₀',
          size: 6,
          fillColor: '#ef4444',
          strokeColor: '#000000',
          strokeWidth: 1,
          withLabel: true,
          fixed: true,
          label: {
            position: 'bottom',
            offset: [0, -20],
            fontSize: 14,
            fontWeight: 'bold',
            color: '#b91c1c',
            cssStyle: 'background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; border: 2px solid #ef4444'
          }
        });

        elementsRef.current.initialGuessPoint = initialGuessPoint;
        newElements.push(initialGuessPoint);
      } else {
        // Other x-axis points are NOT draggable
        const pointOnAxis = board.create('point', [iter.x, 0], {
          name: `x${idx}`,
          size: 4,
          fillColor: color,
          strokeColor: '#000000',
          strokeWidth: 1,
          withLabel: true,
          fixed: true,
          label: {
            position: 'bottom',
            offset: [0, -18],
            fontSize: 13,
            fontWeight: 'bold',
            color: '#000000',
            cssStyle: 'background: rgba(255,255,255,0.85); padding: 1px 4px; border-radius: 3px; border: 1px solid ' + color
          }
        });
        newElements.push(pointOnAxis);
      }
    });

    elementsRef.current.iterationElements = newElements;
  }, [iterations, visibleIterations, tangentLineMode, solver, clearIterations, onElementClick]);

  const resetView = useCallback(() => {
    if (boardRef.current) {
      boardRef.current.setBoundingBox([-10, 10, 10, -10], true);
    }
  }, []);

  const zoomToFit = useCallback(() => {
    if (!boardRef.current || !iterations || iterations.length === 0) {
      resetView();
      return;
    }

    const xValues = iterations.map(i => i.x);
    const yValues = iterations.map(i => i.fx).filter(y => isFinite(y));

    if (xValues.length === 0) {
      resetView();
      return;
    }

    const minX = Math.min(...xValues) - 2;
    const maxX = Math.max(...xValues) + 2;
    const minY = Math.min(...yValues, 0) - 2;
    const maxY = Math.max(...yValues, 0) + 2;

    boardRef.current.setBoundingBox([minX, maxY, maxX, minY], true);
  }, [iterations, resetView]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div
        id="jsxgraph-board"
        ref={containerRef}
        className="graph-board w-full rounded-lg transition-colors duration-300"
        style={{
          border: '1px solid var(--border-primary)',
          background: 'var(--graph-bg)',
          aspectRatio: '1 / 1',
          maxHeight: 'calc(100vh - 120px)',
          minHeight: '400px'
        }}
      />
      <div className="flex gap-2 py-2 justify-end">
        <button
          onClick={resetView}
          className="px-3 py-1.5 text-[13px] rounded cursor-pointer transition-all duration-150 hover:border-slate-400"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-secondary)',
            color: 'var(--text-secondary)'
          }}
          title="Reset View"
        >
          Reset View
        </button>
        <button
          onClick={zoomToFit}
          className="px-3 py-1.5 text-[13px] rounded cursor-pointer transition-all duration-150 hover:border-slate-400"
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-secondary)',
            color: 'var(--text-secondary)'
          }}
          title="Zoom to Fit"
        >
          Zoom to Fit
        </button>
      </div>
    </div>
  );
}

export default Graph;
