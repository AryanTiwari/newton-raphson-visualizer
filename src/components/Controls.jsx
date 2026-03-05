import { useState, useEffect, useRef, useCallback } from "react";
import { validateExpression } from "../utils/mathParser";
import "mathlive";
import katex from "katex";
import "katex/dist/katex.min.css";

// Theme management
function getInitialTheme() {
  const stored = localStorage.getItem("theme");
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

// Helper function to find matching brace
function findMatchingBrace(str, startIndex) {
  let depth = 0;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Convert MathLive LaTeX to math.js compatible format
function latexToMathJS(latex) {
  let expr = latex;

  // Remove placeholder characters from MathLive
  expr = expr.replace(/\u200B/g, ""); // zero-width space
  expr = expr.replace(/\\placeholder\{\}/g, "");
  expr = expr.replace(/#\?/g, "");
  expr = expr.replace(/\u00A0/g, " "); // non-breaking space
  expr = expr.replace(/\\,/g, ""); // thin space
  expr = expr.replace(/\\;/g, ""); // medium space
  expr = expr.replace(/\\:/g, ""); // thick space
  expr = expr.replace(/\\ /g, " "); // explicit space
  expr = expr.replace(/\\!/g, ""); // negative thin space

  // Remove LaTeX formatting
  expr = expr.replace(/\\cdot/g, "*");
  expr = expr.replace(/\\times/g, "*");
  expr = expr.replace(/\\div/g, "/");

  // Handle fractions with a more robust approach
  let maxIterations = 20; // Prevent infinite loops
  while (expr.includes("\\frac") && maxIterations > 0) {
    maxIterations--;
    const fracIndex = expr.indexOf("\\frac");
    if (fracIndex === -1) break;

    // Find the opening brace of numerator
    const numStart = expr.indexOf("{", fracIndex);
    if (numStart === -1) break;

    // Find the closing brace of numerator
    const numEnd = findMatchingBrace(expr, numStart);
    if (numEnd === -1) break;

    // Find the opening brace of denominator
    const denStart = expr.indexOf("{", numEnd + 1);
    if (denStart === -1) break;

    // Find the closing brace of denominator
    const denEnd = findMatchingBrace(expr, denStart);
    if (denEnd === -1) break;

    // Extract numerator and denominator
    let numerator = expr.substring(numStart + 1, numEnd).trim();
    let denominator = expr.substring(denStart + 1, denEnd).trim();

    // Remove any remaining placeholder characters
    numerator = numerator
      .replace(/\\placeholder\{\}/g, "")
      .replace(/#\?/g, "")
      .trim();
    denominator = denominator
      .replace(/\\placeholder\{\}/g, "")
      .replace(/#\?/g, "")
      .trim();

    // Check for empty/incomplete fraction
    if (!numerator || !denominator) {
      throw new Error(
        "Fraction is incomplete - please fill in both numerator and denominator",
      );
    }

    // Replace the fraction with division
    expr =
      expr.substring(0, fracIndex) +
      `((${numerator})/(${denominator}))` +
      expr.substring(denEnd + 1);
  }

  // Handle sqrt with nth root notation first
  expr = expr.replace(/\\sqrt\[([^\]]+)\]\{([^}]*)\}/g, (match, n, content) => {
    const trimmedContent = content
      .replace(/\\placeholder\{\}/g, "")
      .replace(/#\?/g, "")
      .trim();
    if (!trimmedContent) {
      throw new Error("Square root is incomplete - please fill in the content");
    }
    return `nthRoot(${trimmedContent}, ${n})`;
  });

  // Handle sqrt - match both with braces and handle empty/missing content
  expr = expr.replace(/\\sqrt\{([^}]*)\}/g, (match, content) => {
    const trimmed = content
      .replace(/\\placeholder\{\}/g, "")
      .replace(/#\?/g, "")
      .trim();
    if (!trimmed) {
      throw new Error("Square root is incomplete - please fill in the content");
    }
    return `sqrt(${trimmed})`;
  });

  // Handle sqrt without braces (just \sqrt followed by a single character or nothing)
  expr = expr.replace(/\\sqrt([a-zA-Z0-9])/g, "sqrt($1)");
  expr = expr.replace(/\\sqrt(?![a-zA-Z])/g, "sqrt");

  expr = expr.replace(/\\sin/g, "sin");
  expr = expr.replace(/\\cos/g, "cos");
  expr = expr.replace(/\\tan/g, "tan");
  expr = expr.replace(/\\ln/g, "log");
  expr = expr.replace(/\\log/g, "log10");
  expr = expr.replace(/\\exp/g, "exp");
  expr = expr.replace(/\\pi/g, "pi");
  expr = expr.replace(/\\left\(/g, "(");
  expr = expr.replace(/\\right\)/g, ")");
  expr = expr.replace(/\\left\[/g, "[");
  expr = expr.replace(/\\right\]/g, "]");
  expr = expr.replace(/\{/g, "(");
  expr = expr.replace(/\}/g, ")");
  expr = expr.replace(/\^/g, "^");

  // Remove any remaining backslash commands that weren't handled
  expr = expr.replace(/\\[a-zA-Z]+/g, "");

  // Clean up whitespace
  expr = expr.replace(/\s+/g, "");

  // Clean up empty parentheses that might result from removed commands
  expr = expr.replace(/\(\)/g, "");

  return expr;
}

function Controls({
  onGraphFunction,
  onNextIteration,
  onReset,
  isActive,
  currentIteration,
  hasConverged,
  currentInitialGuess,
  tangentLineMode,
  onTangentLineModeChange,
}) {
  const [expression, setExpression] = useState("x^2 - 2");
  const [latexExpression, setLatexExpression] = useState("x^2-2");
  const [initialGuess, setInitialGuess] = useState("3");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(getInitialTheme);
  const mathFieldRef = useRef(null);
  const explanationRef = useRef(null);
  const x0Ref = useRef(null);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme);

    // Re-inject MathLive styles when theme changes
    const mf = mathFieldRef.current;
    if (mf && mf.shadowRoot) {
      const existingStyle = mf.shadowRoot.querySelector("#custom-ml-style");
      if (existingStyle) existingStyle.remove();

      const style = document.createElement("style");
      style.id = "custom-ml-style";
      const isDark = theme === "dark";
      style.textContent = `
        * {
          background: transparent !important;
          background-color: transparent !important;
        }
        .ML__caret {
          background: ${isDark ? "#f1f5f9" : "#000"} !important;
          background-color: ${isDark ? "#f1f5f9" : "#000"} !important;
        }
        .ML__selection {
          background: rgba(37, 99, 235, 0.15) !important;
        }
        [class*="highlight"],
        [class*="matching"],
        [class*="focused"],
        .ML__contains-caret,
        .ML__sqrt,
        .ML__frac,
        .ML__surd {
          background: transparent !important;
          background-color: transparent !important;
        }
      `;
      mf.shadowRoot.appendChild(style);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  // Initialize MathLive field
  useEffect(() => {
    const mf = mathFieldRef.current;
    if (mf) {
      mf.value = "x^2-2";

      // Configure MathLive options
      mf.mathModeSpace = "\\:";
      mf.smartFence = false; // Disable smart fence to reduce highlighting
      mf.removeExtraneousParentheses = false;
      mf.smartMode = false;

      // Disable menu and virtual keyboard
      mf.menuItems = [];
      mf.virtualKeyboardMode = "off";

      // Inject CSS into shadow DOM to remove all highlighting
      const injectStyles = () => {
        const shadowRoot = mf.shadowRoot;
        if (shadowRoot) {
          // Remove any previously injected style
          const existingStyle = shadowRoot.querySelector("#custom-ml-style");
          if (existingStyle) existingStyle.remove();

          const style = document.createElement("style");
          style.id = "custom-ml-style";
          const isDark =
            document.documentElement.getAttribute("data-theme") === "dark";
          style.textContent = `
            * {
              background: transparent !important;
              background-color: transparent !important;
            }
            .ML__caret {
              background: ${isDark ? "#f1f5f9" : "#000"} !important;
              background-color: ${isDark ? "#f1f5f9" : "#000"} !important;
            }
            .ML__selection {
              background: rgba(37, 99, 235, 0.15) !important;
            }
            [class*="highlight"],
            [class*="matching"],
            [class*="focused"],
            .ML__contains-caret,
            .ML__sqrt,
            .ML__frac,
            .ML__surd {
              background: transparent !important;
              background-color: transparent !important;
            }
          `;
          shadowRoot.appendChild(style);
        }
      };

      // Try to inject immediately and also after a short delay
      injectStyles();
      setTimeout(injectStyles, 100);

      // Add inline shortcuts for common functions
      mf.inlineShortcuts = {
        ...mf.inlineShortcuts,
        sqrt: "\\sqrt{#?}",
        pi: "\\pi",
        sin: "\\sin",
        cos: "\\cos",
        tan: "\\tan",
        log: "\\log",
        ln: "\\ln",
        exp: "\\exp",
      };

      // Listen for input changes
      mf.addEventListener("input", (evt) => {
        const latex = evt.target.value;
        setLatexExpression(latex);
        try {
          const mathJsExpr = latexToMathJS(latex);
          setExpression(mathJsExpr);

          // Validate the converted expression
          if (mathJsExpr.trim()) {
            const validation = validateExpression(mathJsExpr);
            if (!validation.valid) {
              setError(validation.error);
            } else {
              setError(""); // Clear any previous error
            }
          } else {
            setError(""); // Empty expression is ok (will be caught on submit)
          }
        } catch (err) {
          // Don't update expression if conversion fails
          setError(err.message);
        }
      });
    }
  }, []);

  // Render KaTeX for the explanation and x0 label
  useEffect(() => {
    // Render x0 in the label
    if (x0Ref.current) {
      try {
        katex.render("x_0", x0Ref.current, { throwOnError: false });
      } catch (e) {
        x0Ref.current.textContent = "x₀";
      }
    }

    // Render formulas in the explanation
    if (explanationRef.current) {
      const formulas =
        explanationRef.current.querySelectorAll(".katex-formula");
      formulas.forEach((el) => {
        const latex = el.getAttribute("data-latex");
        if (latex) {
          try {
            katex.render(latex, el, {
              throwOnError: false,
              displayMode: el.classList.contains("display-mode"),
            });
          } catch (e) {
            el.textContent = latex;
          }
        }
      });
    }
  }, []);

  // Sync input field when initial guess changes from dragging
  useEffect(() => {
    if (currentInitialGuess !== undefined && isActive) {
      setInitialGuess(currentInitialGuess.toFixed(4));
    }
  }, [currentInitialGuess, isActive]);

  const handleGraphFunction = () => {
    // Don't proceed if there's already a conversion error
    if (error) return;

    // Validate expression
    const validation = validateExpression(expression);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    // Validate initial guess
    const guess = parseFloat(initialGuess);
    if (isNaN(guess)) {
      setError("Initial guess must be a valid number");
      return;
    }

    onGraphFunction(expression, latexExpression, guess);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleGraphFunction();
    }
  };

  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-lg transition-colors duration-300"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-primary)",
      }}
    >
      <div className="flex justify-between items-center">
        <h2
          className="m-0 mb-2 text-2xl font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Newton–Raphson Visualizer
        </h2>
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-10 h-10 p-0 rounded-lg cursor-pointer text-lg transition-all duration-150"
          style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-secondary)",
          }}
          title={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
        >
          {theme === "light" ? "\u{1F319}" : "\u{2600}\u{FE0F}"}
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <label
          className="flex flex-col gap-1.5 text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Function f(x):
        </label>
        <math-field
          ref={mathFieldRef}
          class="math-input"
          virtual-keyboard-mode="off"
          smart-superscript="on"
          inline-shortcut-timeout="0"
          menu-toggle="false"
          default-mode="math"
        />
        <p className="m-0 text-xs" style={{ color: "var(--text-muted)" }}>
          Type x^2 for powers, use / for fractions, \sqrt for roots
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label
          className="flex flex-col gap-1.5 text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <span className="inline whitespace-nowrap">
            Initial Guess (
            <span ref={x0Ref} className="inline align-baseline text-[0.95em]">
              x₀
            </span>
            ):
          </span>
          <input
            type="text"
            value={initialGuess}
            onChange={(e) => setInitialGuess(e.target.value)}
            onKeyDown={handleKeyDown}
            className="px-3 py-2.5 text-[15px] font-mono rounded-md transition-all duration-150 focus:outline-none"
            style={{
              border: "1px solid var(--border-secondary)",
              background: "var(--bg-tertiary)",
              color: "var(--text-primary)",
            }}
            placeholder="e.g., 3"
          />
        </label>
      </div>

      {error && (
        <div
          className="px-3 py-2.5 text-[13px] rounded-md"
          style={{
            color: "var(--error-text)",
            background: "var(--error-bg)",
            border: "1px solid var(--error-border)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleGraphFunction}
          disabled={!!error}
          className="btn btn-primary"
        >
          Graph Function
        </button>

        <button
          onClick={onNextIteration}
          disabled={!isActive || hasConverged || !!error}
          className="btn btn-secondary"
        >
          Next Iteration
        </button>

        <button
          onClick={onReset}
          disabled={!isActive}
          className="btn btn-outline"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Tangent Lines:
        </label>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onTangentLineModeChange('segment')}
            className={`px-3 py-1.5 text-[13px] rounded cursor-pointer transition-all duration-150 ${
              tangentLineMode === 'segment' ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              background: tangentLineMode === 'segment' ? 'var(--bg-tertiary)' : 'transparent',
              border: '1px solid var(--border-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            Segment
          </button>
          <button
            onClick={() => onTangentLineModeChange('full')}
            className={`px-3 py-1.5 text-[13px] rounded cursor-pointer transition-all duration-150 ${
              tangentLineMode === 'full' ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              background: tangentLineMode === 'full' ? 'var(--bg-tertiary)' : 'transparent',
              border: '1px solid var(--border-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            Full Line
          </button>
          <button
            onClick={() => onTangentLineModeChange('hidden')}
            className={`px-3 py-1.5 text-[13px] rounded cursor-pointer transition-all duration-150 ${
              tangentLineMode === 'hidden' ? 'ring-2 ring-blue-500' : ''
            }`}
            style={{
              background: tangentLineMode === 'hidden' ? 'var(--bg-tertiary)' : 'transparent',
              border: '1px solid var(--border-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            Hidden
          </button>
        </div>
      </div>

      {isActive && (
        <div
          className="p-3 rounded-md"
          style={{
            background: "var(--success-bg)",
            border: "1px solid var(--success-border)",
          }}
        >
          <div className="flex gap-2 text-sm">
            <span style={{ color: "var(--text-tertiary)" }}>
              Current Iteration:
            </span>
            <span
              className="font-semibold font-mono"
              style={{ color: "var(--success-text)" }}
            >
              {currentIteration}
            </span>
          </div>
          {hasConverged && (
            <div
              className="mt-2 p-2 rounded text-[13px] font-medium text-center"
              style={{
                background: "var(--success-highlight)",
                color: "var(--success-text)",
              }}
            >
              Converged! Root found.
            </div>
          )}
        </div>
      )}

      <div
        className="mt-2 p-4 rounded-md"
        ref={explanationRef}
        style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h3
          className="m-0 mb-2 text-sm font-semibold"
          style={{ color: "var(--text-secondary)" }}
        >
          How Newton's Method Works
        </h3>
        <p
          className="m-0 mb-3 text-[13px] leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          Newton's method finds roots (zeros) of a function by repeatedly
          improving an initial guess using tangent lines.
        </p>
        <ol
          className="m-0 pl-5 text-[13px] leading-loose list-decimal"
          style={{ color: "var(--text-tertiary)" }}
        >
          <li className="mb-1.5">
            Start with initial guess{" "}
            <span className="katex-formula" data-latex="x_0"></span>
          </li>
          <li className="mb-1.5">
            Draw tangent line at{" "}
            <span className="katex-formula" data-latex="(x_n, f(x_n))"></span>
          </li>
          <li className="mb-1.5">
            Find the zeros of consecutive tangent line approximation
          </li>
          <li className="mb-1.5">
            Use this x-intercept as the next guess and repeat:
            <div
              className="my-2 p-3 rounded text-center text-[1.1em]"
              style={{ background: "var(--bg-secondary)" }}
            >
              <span
                className="katex-formula display-mode"
                data-latex="x_{n+1} = x_n - \frac{f(x_n)}{f'(x_n)}"
              ></span>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}

export default Controls;
