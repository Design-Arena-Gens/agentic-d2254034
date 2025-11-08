"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Operator = "+" | "-" | "×" | "÷";

type ButtonDefinition =
  | { type: "digit"; label: string; value: string }
  | { type: "decimal"; label: string }
  | { type: "operator"; label: string; value: Operator }
  | {
      type: "action";
      label: string;
      action: "clear" | "delete" | "percent" | "sign" | "equals";
    };

interface HistoryEntry {
  expression: string;
  result: string;
  id: string;
}

const BUTTON_GRID: ButtonDefinition[][] = [
  [
    { type: "action", label: "AC", action: "clear" },
    { type: "action", label: "⌫", action: "delete" },
    { type: "action", label: "%", action: "percent" },
    { type: "operator", label: "÷", value: "÷" },
  ],
  [
    { type: "digit", label: "7", value: "7" },
    { type: "digit", label: "8", value: "8" },
    { type: "digit", label: "9", value: "9" },
    { type: "operator", label: "×", value: "×" },
  ],
  [
    { type: "digit", label: "4", value: "4" },
    { type: "digit", label: "5", value: "5" },
    { type: "digit", label: "6", value: "6" },
    { type: "operator", label: "-", value: "-" },
  ],
  [
    { type: "digit", label: "1", value: "1" },
    { type: "digit", label: "2", value: "2" },
    { type: "digit", label: "3", value: "3" },
    { type: "operator", label: "+", value: "+" },
  ],
  [
    { type: "action", label: "±", action: "sign" },
    { type: "digit", label: "0", value: "0" },
    { type: "decimal", label: "." },
    { type: "action", label: "=", action: "equals" },
  ],
];

const MAX_DIGITS = 16;

const generateId = () => crypto.randomUUID();

const stripTrailingZeros = (value: string) => {
  if (!value.includes(".")) {
    return value;
  }
  const [intPart, decimalPart] = value.split(".");
  const trimmedDecimal = decimalPart.replace(/0+$/, "");
  if (trimmedDecimal.length === 0) {
    return intPart;
  }
  return `${intPart}.${trimmedDecimal}`;
};

const formatDisplay = (raw: string) => {
  if (raw === "") {
    return "0";
  }
  if (raw.includes("e")) {
    return raw;
  }
  const isNegative = raw.startsWith("-");
  const [intPart, decimalPart] = raw.replace(/^-/, "").split(".");
  const formattedInt = Number(intPart).toLocaleString("en-US");
  if (!decimalPart) {
    return isNegative ? `-${formattedInt}` : formattedInt;
  }
  return `${isNegative ? "-" : ""}${formattedInt}.${decimalPart}`;
};

const computeResult = (a: string, b: string, operator: Operator) => {
  const left = Number(a);
  const right = Number(b);

  let result: number;

  switch (operator) {
    case "+":
      result = left + right;
      break;
    case "-":
      result = left - right;
      break;
    case "×":
      result = left * right;
      break;
    case "÷":
      result = right === 0 ? NaN : left / right;
      break;
    default:
      result = right;
      break;
  }

  if (!Number.isFinite(result)) {
    return "0";
  }

  const normalized = Number(result.toPrecision(12));
  return stripTrailingZeros(String(normalized));
};

export default function Home() {
  const [currentValue, setCurrentValue] = useState("0");
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [activeOperator, setActiveOperator] = useState<Operator | null>(null);
  const [overwrite, setOverwrite] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const appendNumber = useCallback(
    (value: string) => {
      setCurrentValue((prev) => {
        if (overwrite) {
          setOverwrite(false);
          if (value === ".") {
            return "0.";
          }
          return value;
        }
        if (value === ".") {
          if (prev.includes(".")) {
            return prev;
          }
          return `${prev}.`;
        }
        if (prev === "0") {
          return value;
        }
        const digitCount = prev.replace(/[-.]/g, "");
        if (digitCount.length >= MAX_DIGITS) {
          return prev;
        }
        return `${prev}${value}`;
      });
    },
    [overwrite]
  );

  const handleDecimal = useCallback(() => {
    appendNumber(".");
  }, [appendNumber]);

  const pushHistory = useCallback((expression: string, result: string) => {
    setHistory((prev) => {
      const next = [
        {
          expression,
          result,
          id: generateId(),
        },
        ...prev,
      ];
      return next.slice(0, 8);
    });
  }, []);

  const handleOperator = useCallback(
    (operator: Operator) => {
      if (activeOperator && !overwrite && previousValue !== null) {
        const result = computeResult(previousValue, currentValue, activeOperator);
        setPreviousValue(result);
        setCurrentValue(result);
      } else {
        setPreviousValue(currentValue);
      }
      setActiveOperator(operator);
      setOverwrite(true);
    },
    [activeOperator, currentValue, overwrite, previousValue]
  );

  const handleEquals = useCallback(() => {
    if (!activeOperator || previousValue === null || overwrite) {
      return;
    }
    const result = computeResult(previousValue, currentValue, activeOperator);
    pushHistory(
      `${formatDisplay(previousValue)} ${activeOperator} ${formatDisplay(currentValue)}`,
      formatDisplay(result)
    );
    setCurrentValue(result);
    setPreviousValue(null);
    setActiveOperator(null);
    setOverwrite(true);
  }, [activeOperator, currentValue, overwrite, previousValue, pushHistory]);

  const handleClear = useCallback(() => {
    setCurrentValue("0");
    setPreviousValue(null);
    setActiveOperator(null);
    setOverwrite(true);
  }, []);

  const handleDelete = useCallback(() => {
    setCurrentValue((prev) => {
      if (overwrite || prev.length === 1) {
        setOverwrite(true);
        return "0";
      }
      return prev.slice(0, -1);
    });
  }, [overwrite]);

  const handleToggleSign = useCallback(() => {
    setCurrentValue((prev) => {
      if (prev === "0") {
        return prev;
      }
      return prev.startsWith("-") ? prev.slice(1) : `-${prev}`;
    });
    setOverwrite(false);
  }, []);

  const handlePercent = useCallback(() => {
    setCurrentValue((prev) => {
      const numeric = Number(prev);
      if (!Number.isFinite(numeric)) {
        return prev;
      }
      const percentValue = numeric / 100;
      const normalized = Number(percentValue.toPrecision(12));
      return stripTrailingZeros(String(normalized));
    });
    setOverwrite(true);
  }, []);

  const handleButtonPress = useCallback(
    (button: ButtonDefinition) => {
      switch (button.type) {
        case "digit":
          appendNumber(button.value);
          break;
        case "decimal":
          handleDecimal();
          break;
        case "operator":
          handleOperator(button.value);
          break;
        case "action":
          if (button.action === "clear") {
            handleClear();
          } else if (button.action === "delete") {
            handleDelete();
          } else if (button.action === "percent") {
            handlePercent();
          } else if (button.action === "sign") {
            handleToggleSign();
          } else if (button.action === "equals") {
            handleEquals();
          }
          break;
        default:
          break;
      }
    },
    [
      appendNumber,
      handleDecimal,
      handleOperator,
      handleClear,
      handleDelete,
      handlePercent,
      handleToggleSign,
      handleEquals,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      if (key >= "0" && key <= "9") {
        appendNumber(key);
        return;
      }
      if (key === ".") {
        handleDecimal();
        return;
      }
      if (key === "+" || key === "-" || key === "*" || key === "x" || key === "X" || key === "/") {
        event.preventDefault();
        const operator: Operator =
          key === "+"
            ? "+"
            : key === "-"
            ? "-"
            : key === "/"
            ? "÷"
            : "×";
        handleOperator(operator);
        return;
      }
      if (key === "Enter" || key === "=") {
        event.preventDefault();
        handleEquals();
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        handleDelete();
        return;
      }
      if (key === "%") {
        event.preventDefault();
        handlePercent();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        handleClear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    appendNumber,
    handleDecimal,
    handleOperator,
    handleEquals,
    handleDelete,
    handlePercent,
    handleClear,
  ]);

  const liveExpression = useMemo(() => {
    if (previousValue === null || !activeOperator) {
      return "";
    }
    const trailing = overwrite ? "" : currentValue;
    const formattedPrev = formatDisplay(previousValue);
    const formattedCurrent = trailing ? formatDisplay(trailing) : "";
    return `${formattedPrev} ${activeOperator} ${formattedCurrent}`.trim();
  }, [activeOperator, currentValue, overwrite, previousValue]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-16 text-slate-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-24 top-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 left-16 h-72 w-72 rounded-full bg-cyan-400/10 blur-2xl" />
      </div>
      <main className="relative z-10 flex w-full max-w-5xl flex-col gap-6 lg:flex-row">
        <section className="flex flex-1 flex-col justify-between rounded-3xl bg-slate-900/70 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
          <div className="flex flex-col gap-3 rounded-2xl bg-slate-950/60 px-6 py-8 text-right shadow-inner backdrop-blur-xl">
            <span className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">
              Calculator
            </span>
            <div className="min-h-[28px] text-sm text-slate-400">
              {liveExpression || ""}
            </div>
            <div className="text-5xl font-light tracking-tight text-white sm:text-6xl">
              {formatDisplay(currentValue)}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 pt-6">
            {BUTTON_GRID.flat().map((button, index) => {
              const isOperator = button.type === "operator";
              const isEquals = button.type === "action" && button.action === "equals";
              const isAccent = button.type === "action" && ["clear", "delete", "percent", "sign"].includes(button.action);
              const isActive = isOperator && activeOperator === button.value;
              return (
                <button
                  key={`${button.label}-${index}`}
                  onClick={() => handleButtonPress(button)}
                  className={[
                    "group relative flex h-16 items-center justify-center overflow-hidden rounded-2xl text-xl font-medium transition-all duration-200",
                    isEquals
                      ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30 hover:bg-sky-400"
                      : isOperator
                      ? isActive
                        ? "bg-white/15 text-white ring-2 ring-sky-400/80"
                        : "bg-white/10 text-white hover:bg-white/20"
                      : isAccent
                      ? "bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                      : "bg-slate-800 text-slate-100 hover:bg-slate-700",
                  ].join(" ")}
                  aria-pressed={isOperator && isActive}
                >
                  <span className="relative z-10">{button.label}</span>
                  <span className="absolute inset-0 -z-0 translate-y-16 scale-125 bg-white/10 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </section>
        <aside className="flex w-full max-w-sm flex-col gap-4 self-stretch rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-wide text-slate-100">
              Activity
            </h2>
            <button
              onClick={() => setHistory([])}
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              Clear
            </button>
          </header>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="flex-1 overflow-y-auto pr-2">
            {history.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No calculations yet.
              </div>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-right text-slate-200 shadow-sm"
                  >
                    <span className="text-xs uppercase tracking-widest text-slate-400">
                      {entry.expression}
                    </span>
                    <span className="text-2xl font-semibold text-white">
                      {entry.result}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
