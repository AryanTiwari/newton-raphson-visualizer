import { useEffect, useRef } from 'react';
import { getIterationColor, getConvergenceProgress } from '../utils/newton';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Convert math.js expression to LaTeX for display
function mathJsToLatex(expr) {
  if (!expr) return '';
  let latex = expr;

  // Remove unnecessary outer parentheses
  latex = latex.trim();
  if (latex.startsWith('(') && latex.endsWith(')')) {
    // Check if these are matching outer parentheses
    let depth = 0;
    let isOuter = true;
    for (let i = 0; i < latex.length - 1; i++) {
      if (latex[i] === '(') depth++;
      else if (latex[i] === ')') depth--;
      if (depth === 0 && i < latex.length - 1) {
        isOuter = false;
        break;
      }
    }
    if (isOuter) {
      latex = latex.slice(1, -1);
    }
  }

  // Handle fractions: a / b -> \frac{a}{b}
  // This is tricky because we need to handle nested expressions
  // For now, handle simple cases
  latex = latex.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/([a-zA-Z0-9]+)\s*\/\s*([a-zA-Z0-9]+)/g, '\\frac{$1}{$2}');

  // Handle sqrt
  latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');

  // Handle powers with braces
  latex = latex.replace(/\^(\d+)/g, '^{$1}');
  latex = latex.replace(/\^\(([^)]+)\)/g, '^{$1}');

  // Handle multiplication - use \cdot
  latex = latex.replace(/\s*\*\s*/g, ' \\cdot ');

  // Handle trig and log functions
  latex = latex.replace(/log10\(([^)]+)\)/g, '\\log_{10}($1)');
  latex = latex.replace(/log\(([^)]+)\)/g, '\\ln($1)');
  latex = latex.replace(/sin\(/g, '\\sin(');
  latex = latex.replace(/cos\(/g, '\\cos(');
  latex = latex.replace(/tan\(/g, '\\tan(');
  latex = latex.replace(/exp\(/g, '\\exp(');
  latex = latex.replace(/\bpi\b/g, '\\pi');

  // Clean up double spaces
  latex = latex.replace(/\s+/g, ' ').trim();

  return latex;
}

function IterationList({ iterations, selectedElement, visibleIterations, onToggleIteration, latexExpression }) {
  const selectedElementRef = useRef(null);

  // Render KaTeX formulas when selectedElement changes
  useEffect(() => {
    if (!selectedElementRef.current || !selectedElement) return;

    const formulas = selectedElementRef.current.querySelectorAll('.katex-render');
    formulas.forEach(el => {
      const latex = el.getAttribute('data-latex');
      if (latex) {
        try {
          katex.render(latex, el, { throwOnError: false, displayMode: false });
        } catch (e) {
          el.textContent = latex;
        }
      }
    });
  }, [selectedElement, latexExpression]);

  const listContainerClasses = "flex flex-col gap-3 p-4 rounded-lg max-h-[calc(100vh-60px)] overflow-y-auto transition-colors duration-300";
  const listContainerStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)'
  };

  if (!iterations || iterations.length === 0) {
    return (
      <div className={listContainerClasses} style={listContainerStyle}>
        <h3 className="m-0 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Iterations
        </h3>
        <p className="m-0 text-sm italic" style={{ color: 'var(--text-muted)' }}>
          Enter a function and click "Graph Function" to begin.
        </p>
      </div>
    );
  }

  return (
    <div className={listContainerClasses} style={listContainerStyle}>
      <h3 className="m-0 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
        Iterations
      </h3>
      <p className="m-0 mb-2 text-[11px] italic" style={{ color: 'var(--text-muted)' }}>
        Click a row to toggle visibility
      </p>

      {selectedElement && (
        <div
          className="p-3 rounded-md"
          ref={selectedElementRef}
          style={{
            background: 'var(--info-bg)',
            border: '1px solid var(--info-border)'
          }}
        >
          <h4 className="m-0 mb-2 text-sm font-semibold" style={{ color: 'var(--info-text)' }}>
            {selectedElement.type === 'function' ? 'Function' : selectedElement.name}
          </h4>
          {selectedElement.type === 'function' && (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`f(x) = ${latexExpression || ''}`}></span>
              </p>
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`f'(x) = ${mathJsToLatex(selectedElement.derivative)}`}></span>
              </p>
            </div>
          )}
          {selectedElement.type === 'point' && (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`x = ${selectedElement.x.toFixed(8)}`}></span>
              </p>
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`f(x) = ${selectedElement.fx.toFixed(8)}`}></span>
              </p>
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`f'(x) = ${selectedElement.fPrimeX.toFixed(8)}`}></span>
              </p>
            </div>
          )}
          {selectedElement.type === 'tangent' && (
            <div className="flex flex-col gap-1">
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`\\text{Slope} = ${selectedElement.slope.toFixed(4)}`}></span>
              </p>
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`\\text{y-intercept} = ${selectedElement.intercept.toFixed(4)}`}></span>
              </p>
              <p className="m-0 text-[13px] font-mono" style={{ color: 'var(--accent-primary)' }}>
                <span className="katex-render" data-latex={`\\text{x-intercept} = ${selectedElement.xIntercept.toFixed(4)}`}></span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold border-b-2" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}></th>
              <th className="px-2 py-1.5 text-left font-semibold border-b-2" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>n</th>
              <th className="px-2 py-1.5 text-left font-semibold border-b-2" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>xₙ</th>
              <th className="px-2 py-1.5 text-left font-semibold border-b-2" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>f(xₙ)</th>
              <th className="px-2 py-1.5 text-left font-semibold border-b-2" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>f'(xₙ)</th>
            </tr>
          </thead>
          <tbody>
            {iterations.map((iter, idx) => {
              const isVisible = visibleIterations?.has(idx) ?? true;
              const initialFx = iterations[0]?.fx ?? 1;
              const color = getIterationColor(iter.fx, initialFx);
              return (
                <tr
                  key={idx}
                  className={`cursor-pointer transition-colors duration-150 hover:opacity-80 ${!isVisible ? 'opacity-50' : ''}`}
                  style={{ background: !isVisible ? 'var(--bg-tertiary)' : 'transparent' }}
                  onClick={() => onToggleIteration?.(idx)}
                >
                  <td className="w-6 text-center p-1 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                    <span className={`text-xs ${isVisible ? 'opacity-70' : 'opacity-30'}`}>
                      {isVisible ? '👁' : '👁‍🗨'}
                    </span>
                  </td>
                  <td className="px-2 py-1 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      {idx}
                    </div>
                  </td>
                  <td className="px-2 py-1 border-b font-mono" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>{formatNumber(iter.x)}</td>
                  <td className="px-2 py-1 border-b font-mono" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>{formatNumber(iter.fx)}</td>
                  <td className="px-2 py-1 border-b font-mono" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>{formatNumber(iter.fPrimeX)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {iterations.length > 0 && (
        <div className="mt-1.5 p-2.5 rounded-md" style={{ background: 'var(--bg-tertiary)' }}>
          <h4 className="m-0 mb-2 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Convergence Progress
          </h4>
          <div className="flex flex-col gap-1.5">
            {iterations.map((iter, idx) => {
              const initialFx = iterations[0]?.fx ?? 1;
              const progress = getConvergenceProgress(iter.fx, initialFx);
              const barWidth = progress * 100;

              return (
                <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-[50px] flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                    n = {idx}
                  </span>
                  <div
                    className="flex-1 h-2 rounded overflow-hidden"
                    style={{ background: 'var(--border-primary)' }}
                  >
                    <div
                      className="h-full rounded transition-all duration-300"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: getIterationColor(iter.fx, initialFx)
                      }}
                    />
                  </div>
                  <span className="w-[100px] flex-shrink-0 text-right font-mono" style={{ color: 'var(--text-muted)' }}>
                    |f(x)| = {Math.abs(iter.fx).toExponential(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatNumber(num) {
  if (!isFinite(num)) return 'undefined';
  if (Math.abs(num) < 0.0001 || Math.abs(num) > 10000) {
    return num.toExponential(2);
  }
  return num.toFixed(4);
}

export default IterationList;
