/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InlineMath, BlockMath } from 'react-katex';
import { 
  Info, 
  Calculator, 
  RefreshCw, 
  HelpCircle, 
  Sun, 
  Moon, 
  AlertCircle, 
  BookOpen, 
  Settings, 
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import HypothesisTestingCalculator from './components/HypothesisTestingCalculator';

// --- Math Utilities ---

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 * Approximation using the error function (erf)
 */
function normalCDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0.5; // fallback
  const z = (x - mean) / stdDev;
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

/**
 * Error function approximation (A&S formula 7.1.26)
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Normal Probability Density Function (PDF)
 */
function normalPDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0;
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
}

/**
 * Inverse Standard Normal Cumulative Distribution Function
 * Rational approximation for Z-score from probability
 */
function inverseNormalCDF(p: number): number {
  if (p <= 0) return -5;
  if (p >= 1) return 5;

  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];

  const t = p < 0.5 ? Math.sqrt(-2.0 * Math.log(p)) : Math.sqrt(-2.0 * Math.log(1.0 - p));
  const z = t - ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1.0);

  return p < 0.5 ? -z : z;
}

// --- Types ---

type CalcMode = 'forward' | 'inverse' | 'table' | 'hypothesis';
type CalcType = 'below' | 'above' | 'between' | 'outside' | 'conditional';
type CondType = 'below' | 'above' | 'between';

interface CalculationResult {
  probability: number;
  z1: number;
  z2?: number;
  steps: string[];
  calculatedX?: number;
}

// --- Components ---

const Tooltip: React.FC<{ content: string; children: React.ReactNode; theme: 'light' | 'dark' }> = ({ content, children, theme }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  return (
    <div className="relative inline-block" onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className={`absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 text-xs rounded-xl shadow-xl pointer-events-none text-center leading-normal font-medium ${
              theme === 'dark' 
                ? 'bg-slate-800 text-slate-100 border border-slate-700' 
                : 'bg-slate-900 text-white'
            }`}
          >
            {content}
            <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${
              theme === 'dark' ? 'border-t-slate-800' : 'border-t-slate-900'
            }`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Recharts-based Interactive Normal Chart ---
const NormalChart: React.FC<{
  mean: number;
  stdDev: number;
  type: CalcType;
  x1: number;
  x2: number;
  condType?: CondType;
  condTypeA?: CondType;
  condX1?: number;
  condX2?: number;
  probability: number;
  mode?: CalcMode;
  theme: 'light' | 'dark';
}> = ({ mean, stdDev, type, x1, x2, condType, condTypeA, condX1, condX2, probability, mode, theme }) => {
  
  const chartData = useMemo(() => {
    if (stdDev <= 0) return [];
    
    const pts = [];
    const numPoints = 140;
    const xMin = mean - 4 * stdDev;
    const xMax = mean + 4 * stdDev;
    const step = (xMax - xMin) / (numPoints - 1);

    const getRangeRange = (t: string | undefined, v1: number | undefined, v2: number | undefined): [number, number] => {
      const val1 = v1 ?? 0;
      const val2 = v2 ?? 0;
      if (t === 'below') return [-Infinity, val1];
      if (t === 'above') return [val1, Infinity];
      if (t === 'between') return [Math.min(val1, val2), Math.max(val1, val2)];
      return [-Infinity, Infinity];
    };

    const isXInside = (val: number, range: [number, number]) => val >= range[0] && val <= range[1];

    const minStandardX = Math.min(x1, x2);
    const maxStandardX = Math.max(x1, x2);

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      const y = normalPDF(x, mean, stdDev);

      let shadedY: number | null = null;
      let shadedYBelow: number | null = null;
      let shadedYAbove: number | null = null;
      let condBShadedY: number | null = null;
      let intersectShadedY: number | null = null;

      if (type === 'conditional') {
        const rA = getRangeRange(condTypeA || 'below', x1, x2);
        const rB = getRangeRange(condType, condX1, condX2);

        if (isXInside(x, rB)) {
          condBShadedY = y;
        }
        if (isXInside(x, rA) && isXInside(x, rB)) {
          intersectShadedY = y;
        }
      } else {
        switch (type) {
          case 'below':
            if (x <= x1) shadedY = y;
            break;
          case 'above':
            if (x >= x1) shadedY = y;
            break;
          case 'between':
            if (x >= minStandardX && x <= maxStandardX) shadedY = y;
            break;
          case 'outside':
            if (x <= minStandardX) shadedYBelow = y;
            if (x >= maxStandardX) shadedYAbove = y;
            break;
        }
      }

      pts.push({
        x: Number(x.toFixed(4)),
        pdf: y,
        shadedY,
        shadedYBelow,
        shadedYAbove,
        condBShadedY,
        intersectShadedY,
      });
    }
    return pts;
  }, [mean, stdDev, type, x1, x2, condType, condTypeA, condX1, condX2]);

  if (stdDev <= 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/20 text-red-500 font-bold border border-red-100 dark:border-red-900/30">
        נא להזין סטיית תקן גדולה מ-0 להצגת גרף.
      </div>
    );
  }

  // Define line colors based on the theme
  const curveColor = theme === 'dark' ? '#60a5fa' : '#2563eb';
  const mainGridColor = theme === 'dark' ? '#334155' : '#f1f5f9';
  const axisLabelColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const shadedColor = theme === 'dark' ? 'rgba(96, 165, 250, 0.4)' : 'rgba(37, 99, 235, 0.25)';
  const bShadedColor = theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)';
  const intersectShadedColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.65)' : 'rgba(37, 99, 235, 0.55)';

  const minStandardX = Math.min(x1, x2);
  const maxStandardX = Math.max(x1, x2);

  // Customized tooltip
  const CustomTooltipInner = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPt = payload[0].payload;
      const zVal = (dataPt.x - mean) / stdDev;
      return (
        <div className={`p-3 border rounded-xl shadow-lg text-xs font-sans text-right space-y-1 backdrop-blur-md ${
          theme === 'dark' 
            ? 'bg-slate-900/90 border-slate-700 text-slate-100' 
            : 'bg-white/90 border-slate-200 text-slate-900'
        }`}>
          <p className="font-bold text-sm text-blue-600 dark:text-blue-400">נקודה על העקומה</p>
          <p className="flex justify-between gap-4"><span>ערך X:</span> <span className="font-mono font-bold">{dataPt.x.toFixed(2)}</span></p>
          <p className="flex justify-between gap-4"><span>ציון תקן Z:</span> <span className="font-mono font-bold">{zVal.toFixed(2)}</span></p>
          <p className="flex justify-between gap-4"><span>צפיפות PDF:</span> <span className="font-mono font-bold">{dataPt.pdf.toFixed(4)}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`w-full rounded-2xl p-4 border transition-colors ${
      theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
    }`}>
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b pb-4 border-slate-100 dark:border-slate-800">
        <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
          {type === 'conditional' ? 'גרף התפלגות מותנית P(A|B)' : 'עקומת פעמון ושטחים מחושבים'}
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide shrink-0 ${
          theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-750'
        }`}>
          {type === 'conditional' ? `P(A|B) = ${probability.toFixed(4)}` : `שטח מחושב: ${(probability * 100).toFixed(2)}%`}
        </span>
      </div>

      <div className="h-[350px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
            <defs>
              <linearGradient id="mainColor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={curveColor} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={curveColor} stopOpacity={0.01}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={mainGridColor} />

            <XAxis 
              dataKey="x" 
              type="number" 
              domain={[mean - 4.2 * stdDev, mean + 4.2 * stdDev]}
              tick={{ fill: axisLabelColor, fontSize: 11 }}
              axisLine={{ stroke: mainGridColor }}
              tickLine={false}
            />
            <YAxis hide={true} />
            <RechartsTooltip content={<CustomTooltipInner />} />

            {/* Always render standard curve path */}
            <Area 
              type="monotone" 
              dataKey="pdf" 
              stroke={curveColor} 
              strokeWidth={2.5} 
              fill="url(#mainColor)" 
              dot={false}
              isAnimationActive={false}
            />

            {/* Shaded area layers depending on normal / conditional type */}
            {type === 'conditional' ? (
              <>
                <Area 
                  type="monotone" 
                  dataKey="condBShadedY" 
                  stroke="none" 
                  fill={bShadedColor} 
                  dot={false}
                  isAnimationActive={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="intersectShadedY" 
                  stroke="none" 
                  fill={intersectShadedColor} 
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            ) : type === 'outside' ? (
              <>
                <Area 
                  type="monotone" 
                  dataKey="shadedYBelow" 
                  stroke="none" 
                  fill={shadedColor} 
                  dot={false}
                  isAnimationActive={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="shadedYAbove" 
                  stroke="none" 
                  fill={shadedColor} 
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            ) : (
              <Area 
                type="monotone" 
                dataKey="shadedY" 
                stroke="none" 
                fill={shadedColor} 
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* Reference Line for Mean */}
            <ReferenceLine 
              x={mean} 
              stroke={theme === 'dark' ? '#94a3b8' : '#475569'} 
              strokeWidth={1.5} 
              strokeDasharray="4 4"
              label={{
                value: `μ=${mean}`,
                position: 'top',
                fill: theme === 'dark' ? '#cbd5e1' : '#334155',
                fontSize: 11,
                fontWeight: 'bold'
              }}
            />

            {/* Reference Lines for Inputs */}
            {type === 'conditional' ? (
              <>
                {condX1 !== undefined && (condType === 'below' || condType === 'above' || condType === 'between') && (
                  <ReferenceLine 
                    x={condX1} 
                    stroke="#10b981" 
                    strokeWidth={1.5} 
                    strokeDasharray="3 3"
                    label={{
                      value: condType === 'between' ? 'B: x1' : 'B',
                      position: 'top',
                      fill: '#10b981',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}
                  />
                )}
                {condX2 !== undefined && condType === 'between' && (
                  <ReferenceLine 
                    x={condX2} 
                    stroke="#10b981" 
                    strokeWidth={1.5} 
                    strokeDasharray="3 3"
                    label={{
                      value: 'B: x2',
                      position: 'top',
                      fill: '#10b981',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}
                  />
                )}
                {(condTypeA === 'below' || condTypeA === 'above' || condTypeA === 'between') && (
                  <ReferenceLine 
                    x={x1} 
                    stroke="#ef4444" 
                    strokeWidth={1.5} 
                    label={{
                      value: condTypeA === 'between' ? 'A: x1' : 'A',
                      position: 'top',
                      fill: '#ef4444',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}
                  />
                )}
                {condTypeA === 'between' && (
                  <ReferenceLine 
                    x={x2} 
                    stroke="#ef4444" 
                    strokeWidth={1.5} 
                    label={{
                      value: 'A: x2',
                      position: 'top',
                      fill: '#ef4444',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}
                  />
                )}
              </>
            ) : mode === 'inverse' ? (
              <ReferenceLine 
                x={x1} 
                stroke="#3b82f6" 
                strokeWidth={1.5} 
                label={{
                  value: `X = ${x1.toFixed(2)}`,
                  position: 'top',
                  fill: '#3b82f6',
                  fontSize: 11,
                  fontWeight: 'bold'
                }}
              />
            ) : (
              <>
                <ReferenceLine 
                  x={x1} 
                  stroke="#ef4444" 
                  strokeWidth={1.5} 
                  label={{
                    value: type === 'between' || type === 'outside' ? 'X₁' : 'X',
                    position: 'top',
                    fill: '#ef4444',
                    fontSize: 11,
                    fontWeight: 'bold'
                  }}
                />
                {(type === 'between' || type === 'outside') && (
                  <ReferenceLine 
                    x={x2} 
                    stroke="#10b981" 
                    strokeWidth={1.5} 
                    label={{
                      value: 'X₂',
                      position: 'top',
                      fill: '#10b981',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  />
                )}
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const FormattedStep: React.FC<{ text: string; theme: 'light' | 'dark' }> = ({ text, theme }) => {
  const isResult = text.startsWith('תוצאה סופית:');
  const parts = text.split(/\[MATH\](.*?)\[\/MATH\]/g);

  return (
    <div className={`text-sm md:text-base leading-relaxed w-full transition-all ${
      isResult 
        ? theme === 'dark'
          ? 'font-bold text-blue-200 bg-blue-950/40 p-5 rounded-2xl border border-blue-900 shadow-lg'
          : 'font-bold text-blue-900 bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-md'
        : theme === 'dark' ? 'text-slate-200' : 'text-slate-850'
    }`}>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const isOnlyMath = parts.length === 3 && parts[0] === "" && parts[2] === "";
          const hasFraction = part.includes('\\frac');
          const hasPercentage = part.includes('%') || part.includes('\\%');
          const hasEquals = part.includes('=');
          const shouldBeBlockPoint = (hasFraction || (isOnlyMath && hasEquals)) && !hasPercentage;

          if (shouldBeBlockPoint) {
            return (
              <div 
                key={i} 
                className={`my-3 text-center py-3 px-2 rounded-xl border shadow-inner overflow-x-auto ${
                  theme === 'dark' 
                    ? 'bg-slate-800/60 border-slate-700/60' 
                    : 'bg-slate-50 border-slate-100'
                }`} 
                dir="ltr"
              >
                <BlockMath math={part} />
              </div>
            );
          }
          return <span key={i} dir="ltr" className="inline-block mx-1 font-bold whitespace-nowrap"><InlineMath math={part} /></span>;
        }
        if (!part && parts.length > 1) return null;
        return <span key={i} className="align-middle font-sans font-medium">{part}</span>;
      })}
    </div>
  );
};

const ZTable: React.FC<{ activeZ?: number | null; showSearch?: boolean; theme: 'light' | 'dark' }> = ({ activeZ = null, showSearch = false, theme }) => {
  const [searchType, setSearchType] = useState<'z' | 'phi'>('z');
  const [searchVal, setSearchVal] = useState<string>(activeZ?.toFixed(2) || '');
  const [phiSearchVal, setPhiSearchVal] = useState<string>('');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  
  useEffect(() => {
    if (activeZ !== null) {
      setSearchVal(activeZ.toFixed(2));
      setSearchType('z');
    }
  }, [activeZ]);

  const rows = useMemo(() => Array.from({ length: 36 }, (_, i) => i / 10), []);
  const cols = useMemo(() => Array.from({ length: 10 }, (_, i) => i / 100), []);
  
  const leftRows = useMemo(() => rows.slice(0, 18), [rows]);
  const rightRows = useMemo(() => rows.slice(18), [rows]);

  const findZByPhiVal = (targetPhi: number) => {
    let closestZ = 0;
    let minDiff = Infinity;
    
    for (const r of rows) {
      for (const c of cols) {
        const z = r + c;
        const phi = normalCDF(z, 0, 1);
        const diff = Math.abs(phi - targetPhi);
        if (diff < minDiff) {
          minDiff = diff;
          closestZ = z;
        }
      }
    }
    return closestZ;
  };

  if (activeZ === null && !showSearch) return null;
  
  const actualZ = useMemo(() => {
    if (searchType === 'phi') {
      const parsedPhi = parseFloat(phiSearchVal);
      if (isNaN(parsedPhi) || parsedPhi < 0 || parsedPhi > 1) return null;
      return findZByPhiVal(parsedPhi);
    }
    if (activeZ !== null) return activeZ;
    const parsed = parseFloat(searchVal);
    return isNaN(parsed) ? null : parsed;
  }, [activeZ, searchVal, phiSearchVal, searchType, rows, cols]);

  const isZNegative = actualZ !== null && actualZ < 0;
  const lookupZ = actualZ !== null ? Math.abs(actualZ) : null;

  const rowVal = lookupZ !== null ? Math.floor(lookupZ * 10) / 10 : null;
  const colVal = lookupZ !== null ? Math.round((lookupZ - rowVal!) * 100) / 100 : null;

  const renderTableSection = (tableRows: number[]) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-xs sm:text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="p-2.5 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 font-black text-center text-sm w-14 bg-slate-100 dark:bg-slate-800">Z</th>
            {cols.map(c => {
              const isColActive = lookupZ !== null && Math.abs(c - colVal!) < 0.001;
              return (
                <th 
                  key={c} 
                  className={`p-2.5 border border-slate-200 dark:border-slate-700 transition-colors duration-300 font-extrabold text-center min-w-[58px] ${
                    isColActive 
                      ? 'bg-blue-600 text-white dark:bg-blue-500' 
                      : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {c.toFixed(2).slice(2)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tableRows.map(r => {
            const isRowActive = lookupZ !== null && Math.abs(r - rowVal!) < 0.01;
            return (
              <tr key={r} className={`transition-colors duration-200 ${
                isRowActive 
                  ? theme === 'dark' ? 'bg-blue-950/20' : 'bg-blue-50/50' 
                  : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
              }`}>
                <td className={`p-2.5 border border-slate-200 dark:border-slate-700 font-black text-center text-sm transition-colors duration-300 ${
                  isRowActive 
                    ? 'bg-blue-600 text-white dark:bg-blue-500' 
                    : 'text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900'
                }`}>
                  {r.toFixed(1)}
                </td>
                {cols.map(c => {
                  const z = r + c;
                  const val = normalCDF(z, 0, 1);
                  const isColActive = lookupZ !== null && Math.abs(c - colVal!) < 0.001;
                  const isActive = isRowActive && isColActive;
                  
                  return (
                    <td 
                      key={c} 
                      className={`p-2.5 border border-slate-200 dark:border-slate-700 text-center transition-all duration-300 tabular-nums ${
                        isActive 
                          ? 'bg-blue-600 text-white dark:bg-blue-500 font-black scale-102 shadow-lg z-10 relative rounded-md' 
                          : isRowActive
                            ? 'bg-blue-100/40 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300 font-extrabold'
                            : isColActive
                              ? 'bg-indigo-100/40 text-indigo-900 dark:bg-indigo-900/20 dark:text-indigo-300 font-extrabold'
                              : 'text-slate-600 dark:text-slate-350 hover:bg-blue-50 dark:hover:bg-slate-800 font-medium'
                      }`}
                    >
                      {val.toFixed(4)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`overflow-hidden border rounded-2xl shadow-xl transition-all ${
      theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
    } ${!showSearch ? 'mt-4' : ''}`}>
      {/* Educational Header - Interactive Collapsible Accordion */}
      <button 
        type="button"
        onClick={() => setIsGuideOpen(!isGuideOpen)}
        className="w-full text-right p-5 bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-between hover:from-slate-750 hover:to-slate-900 transition-all cursor-pointer border-b border-white/5 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-xl shadow-lg shadow-blue-500/30">
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              איך קוראים את טבלת Z?
            </h3>
            <p className="text-xs text-slate-350 mt-0.5 font-bold">
              {isGuideOpen ? 'לחץ לכיווץ והסתרת ההנחיות' : 'לחץ להצגת הסבר קצר ושימושי לקריאת הטבלה'}
            </p>
          </div>
        </div>
        <div className="p-1.5 rounded-lg bg-white/10 text-blue-400">
          <ChevronDown 
            size={18} 
            className={`transition-transform duration-300 ${isGuideOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>
      
      <AnimatePresence initial={false}>
        {isGuideOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden bg-slate-950/45 border-b border-slate-800"
          >
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
              <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-blue-400 font-bold">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  ערך ה-Z (ציון התקן)
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-semibold">
                  מופיע <strong>בשולי הטבלה</strong> (אנכית ואופקית). השורה מציינת את השלם והעשירית, והעמודה את המאית.
                </p>
                <div className="text-xs bg-blue-500/15 p-2 rounded-lg border border-blue-500/20 text-blue-200" dir="rtl">
                  דוגמה: למציאת <InlineMath math="Z=1.96" />, נבחר שורה 1.9 ועמודה 0.06.
                </div>
              </div>
              
              <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  ערך ה-PHI (ההסתברות)
                </div>
                <p className="text-sm text-slate-300 leading-relaxed font-semibold">
                  מופיע <strong>בתוך הטבלה (תאים לבנים)</strong>. זהו השטח המצטבר שמתחת לעקומת הפעמון המצטבר משמאל לערך ה-Z.
                </p>
                <div className="text-xs bg-emerald-500/15 p-2 rounded-lg border border-emerald-500/20 text-emerald-250" dir="rtl">
                  דוגמה: בתוך הטבלה נמצא את השטח 0.9750 המייצג את הערך Z של 1.96.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Controls */}
      <div className={`p-5 border-b ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5 justify-end">
              <span>חיפוש וחקירת ערכים בטבלה</span>
              <Calculator size={14} className="text-blue-500" />
            </h4>
            <p className="text-xs text-slate-400">בחר את סוג החיפוש והזן ערך לקבלת הצלבה של הנתונים</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 justify-end">
            <div className="flex p-1 rounded-xl border transition-colors bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-inner">
              <button
                onClick={() => setSearchType('z')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  searchType === 'z' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                חיפוש לפי Z
              </button>
              <button
                onClick={() => setSearchType('phi')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  searchType === 'phi' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                חיפוש לפי PHI
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all" dir="rtl">
              <label className="text-xs font-black text-slate-400 whitespace-nowrap">
                {searchType === 'z' ? 'ערך Z:' : 'ערך PHI:'}
              </label>
              {searchType === 'z' ? (
                <input 
                  type="number" 
                  step="0.01"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="לדוגמה: 1.96"
                  className="w-24 text-sm font-black outline-none bg-transparent text-blue-600 dark:text-blue-400 placeholder:text-slate-300"
                />
              ) : (
                <input 
                  type="number" 
                  step="0.0001"
                  min="0.5"
                  max="0.9999"
                  value={phiSearchVal}
                  onChange={(e) => setPhiSearchVal(e.target.value)}
                  placeholder="לדוגמה: 0.95"
                  className="w-24 text-sm font-black outline-none bg-transparent text-emerald-600 dark:text-emerald-400 placeholder:text-slate-300"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Table Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-400 border-b pb-2 border-slate-100 dark:border-slate-800">צד שמאל: ערכי Z מ-0.0 עד 1.7</div>
          {renderTableSection(leftRows)}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-400 border-b pb-2 border-slate-100 dark:border-slate-800">צד ימין: ערכי Z מ-1.8 עד 3.5</div>
          {renderTableSection(rightRows)}
        </div>
      </div>
      
      {/* Result Footer */}
      {lookupZ !== null && (
        <div className="p-5 bg-blue-600 dark:bg-blue-725 text-white border-t border-blue-700 shadow-inner">
          {isZNegative ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-black text-base">
                <Info size={18} />
                חישוב שלב עזר עבור ערך Z שלילי ({actualZ?.toFixed(2)})
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20 space-y-3 leading-relaxed">
                <p className="text-blue-100 text-sm">כדי למצוא את תוצאת הפונקציה <InlineMath math="\Phi" /> עבור ערך <InlineMath math="z" /> שלילי, נשתמש בכלל הסימטריה המוכר בסטטיסטיקה:</p>
                <div className="text-center py-2.5 bg-black/15 rounded-lg overflow-x-auto text-base">
                  <InlineMath math={`\\Phi(${actualZ?.toFixed(2)}) = 1 - \\Phi(${lookupZ.toFixed(2)})`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-right">
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider text-blue-205 mb-1 font-bold">שלב 1: מציאת הערך החיובי בטבלה</p>
                    <p className="font-bold text-xs">
                      הצלבנו שורה {rowVal?.toFixed(1)}, עמודה {colVal?.toFixed(2).slice(2)}
                    </p>
                    <p className="text-base font-black mt-1">
                      <InlineMath math={`\\Phi(${lookupZ.toFixed(2)}) = ${normalCDF(lookupZ, 0, 1).toFixed(4)}`} />
                    </p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p className="text-[10px] uppercase tracking-wider text-blue-205 mb-1 font-bold">שלב 2: חיסור ההסתברות המצטברת מ-1</p>
                    <p className="font-bold text-xs">
                      <InlineMath math={`1 - ${normalCDF(lookupZ, 0, 1).toFixed(4)}`} />
                    </p>
                    <p className="text-base font-black mt-1 text-emerald-300">
                      = {normalCDF(actualZ!, 0, 1).toFixed(4)}
                    </p>
                  </div>
                </div>
                <p className="font-black text-center text-lg pt-3 border-t border-white/10">
                  תוצאה סופית: <InlineMath math={`\\Phi(${actualZ?.toFixed(2)}) = ${normalCDF(actualZ!, 0, 1).toFixed(4)}`} />
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Calculator size={18} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-black text-blue-200">תוצאה מתוך הצלבת נתוני הטבלה</div>
                  <div className="text-sm sm:text-base font-extrabold leading-normal">
                    עבור <InlineMath math={`Z = ${lookupZ.toFixed(2)}`} /> התקבלה הסתברות <InlineMath math={`\\Phi(z) = ${normalCDF(lookupZ, 0, 1).toFixed(4)}`} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                <div className="flex flex-col text-center">
                  <span className="text-[10px] text-blue-100 font-bold">שורה</span>
                  <span className="font-black text-sm">{rowVal?.toFixed(1)}</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="flex flex-col text-center">
                  <span className="text-[10px] text-blue-100 font-bold">עמודה</span>
                  <span className="font-black text-sm">{colVal?.toFixed(2).slice(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function NormalDistributionCalculator() {
  const [mode, setMode] = useState<CalcMode>('forward');
  const [mean, setMean] = useState<number>(170);
  const [meanInput, setMeanInput] = useState<string>('170');
  const [meanError, setMeanError] = useState<string | null>(null);

  const [stdDev, setStdDev] = useState<number>(5);
  const [stdDevInput, setStdDevInput] = useState<string>('5');
  const [stdDevError, setStdDevError] = useState<string | null>(null);

  const [type, setType] = useState<CalcType>('below');
  const [inverseType, setInverseType] = useState<'lower' | 'upper'>('lower');
  
  const [x1, setX1] = useState<number>(165);
  const [x2, setX2] = useState<number>(175);
  const [condType, setCondType] = useState<CondType>('above');
  const [condTypeA, setCondTypeA] = useState<CondType>('below');
  const [condX1, setCondX1] = useState<number>(160);
  const [condX2, setCondX2] = useState<number>(180);
  const [percentile, setPercentile] = useState<number>(90);

  // Theme support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const rootEl = document.documentElement;
    if (theme === 'dark') {
      rootEl.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      rootEl.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Inputs handler with inline validations
  const handleMeanChange = (val: string) => {
    setMeanInput(val);
    const parsed = parseFloat(val);
    if (val.trim() === '') {
      setMeanError('שדה חובה');
    } else if (isNaN(parsed)) {
      setMeanError('אנא הזן מספר תקין');
    } else {
      setMeanError(null);
      setMean(parsed);
    }
  };

  const handleStdDevChange = (val: string) => {
    setStdDevInput(val);
    const parsed = parseFloat(val);
    if (val.trim() === '') {
      setStdDevError('שדה חובה');
    } else if (isNaN(parsed)) {
      setStdDevError('אנא הזן מספר תקין');
    } else if (parsed <= 0) {
      setStdDevError('סטיית התקן חייבת להיות גדולה מ-0 בלבד!');
    } else {
      setStdDevError(null);
      setStdDev(parsed);
    }
  };

  // Quick validations check before processing
  const isValidToCalculate = useMemo(() => {
    return stdDev > 0 && !isNaN(mean) && !stdDevError && !meanError;
  }, [stdDev, mean, stdDevError, meanError]);

  const result = useMemo((): CalculationResult => {
    if (!isValidToCalculate) {
      return { probability: 0, z1: 0, steps: [] };
    }

    const steps: string[] = [];
    steps.push(`נתוני ההתפלגות שלנו: [MATH]\\mu = ${mean}, \\sigma = ${stdDev}[/MATH]`);

    if (mode === 'inverse') {
      const pInput = percentile / 100;
      const pLookup = inverseType === 'lower' ? pInput : 1 - pInput;
      const z = inverseNormalCDF(pLookup);
      const calculatedX = mean + z * stdDev;
      
      steps.push(`נבצע חישוב הפוך למציאת ערך X לפי אחוזון ${inverseType === 'lower' ? 'תחתון' : 'עליון'} של ${percentile}%:`);
      
      if (inverseType === 'lower') {
        steps.push(`שלב 1: נמצא את ספרת ה-Z המתאימה להסתברות השטח משמאל [MATH]P(X < x) = ${pLookup.toFixed(4)}[/MATH] מתוך טבלת ה-Z המותאמת:`);
      } else {
        steps.push(`שלב 1: אנו מחפשים שטח מימין הגדול מ-[MATH]${pInput.toFixed(4)}[/MATH].`);
        steps.push(`נוסחה שקולה לשטח המשלים משמאל: [MATH]1 - ${pInput.toFixed(4)} = ${pLookup.toFixed(4)}[/MATH].`);
        steps.push(`נאתר את ה-Z המתאים ל-[MATH]P(X < x) = ${pLookup.toFixed(4)}[/MATH] בטבלה:`);
      }
      
      steps.push(`[MATH]\\mathbf{Z = \\Phi^{-1}(${pLookup.toFixed(4)}) = ${z.toFixed(4)}}[/MATH]`);
      steps.push(`שלב 2: נשתמש בנוסחת הקשר הפיזי (טרנספורמציה הפוכה) של ציון תקנון למציאת [MATH]X[/MATH]:`);
      steps.push(`[MATH]\\mathbf{X = \\mu + Z \\cdot \\sigma}[/MATH]`);
      steps.push(`נציג מילוי של הנתונים שלנו:`);
      steps.push(`[MATH]\\mathbf{X = ${mean} + (${z.toFixed(4)}) \\cdot ${stdDev}}[/MATH]`);
      steps.push(`[MATH]\\mathbf{X = ${calculatedX.toFixed(4)}}[/MATH]`);
      steps.push(`תוצאה סופית: ערך ה-X המבוקש התואם לאחוזון הוא [MATH]\\mathbf{X = ${calculatedX.toFixed(4)}}[/MATH]`);
      
      return { probability: pInput, z1: z, steps, calculatedX };
    }

    const z1 = (x1 - mean) / stdDev;
    const z2 = (x2 - mean) / stdDev;
    let prob = 0;

    switch (type) {
      case 'below':
        prob = normalCDF(x1, mean, stdDev);
        steps.push(`שלב 1: נחשב את ציון התקן (Z-score) עבור ערך הגבול [MATH]X = ${x1}[/MATH]:`);
        steps.push(`[MATH]Z = \\frac{X - \\mu}{\\sigma} = \\frac{${x1} - ${mean}}{${stdDev}} = ${z1.toFixed(4)}[/MATH]`);
        
        if (z1 < 0) {
          const absZ = Math.abs(z1);
          const phiAbsZ = normalCDF(absZ, 0, 1);
          steps.push(`מכיוון שערך ה-Z שקיבלנו הוא שלילי, נפעל על פי כלל הסימטריה:`);
          steps.push(`[MATH]P(Z < ${z1.toFixed(4)}) = P(Z > ${absZ.toFixed(4)}) = 1 - \\Phi(${absZ.toFixed(4)})[/MATH]`);
          steps.push(`נשלוף מטבלת ה-Z המורחבת את [MATH]\\Phi(${absZ.toFixed(4)}) = ${phiAbsZ.toFixed(4)}[/MATH] ואז נחסיר מ-1:`);
          steps.push(`[MATH]P(X < ${x1}) = 1 - ${phiAbsZ.toFixed(4)} = ${prob.toFixed(4)}[/MATH]`);
        } else {
          steps.push(`נאתר בטבלת ההתפלגות הנורמלית את שטח ההסתברות המצטברת משמאל עבור [MATH]Z = ${z1.toFixed(4)}[/MATH]:`);
          steps.push(`[MATH]P(X < ${x1}) = P(Z < ${z1.toFixed(4)}) = ${prob.toFixed(4)}[/MATH]`);
        }
        steps.push(`תוצאה סופית: ההסתברות הנדרשת השווה לשטח היא [MATH]${prob.toFixed(4)}[/MATH] (או [MATH]${(prob * 100).toFixed(2)}\\%[/MATH])`);
        return { probability: prob, z1, steps };
      
      case 'above':
        prob = 1 - normalCDF(x1, mean, stdDev);
        steps.push(`שלב 1: נחשב את ציון התקן (Z-score) עבור ערך הגבול [MATH]X = ${x1}[/MATH]:`);
        steps.push(`[MATH]Z = \\frac{X - \\mu}{\\sigma} = \\frac{${x1} - ${mean}}{${stdDev}} = ${z1.toFixed(4)}[/MATH]`);
        
        if (z1 < 0) {
          const absZ = Math.abs(z1);
          const phiAbsZ = normalCDF(absZ, 0, 1);
          steps.push(`כיוון שערך ציון התקן Z שלילי, נחשב את השטח מימין המצוי מעבר לו:`);
          steps.push(`[MATH]P(Z > ${z1.toFixed(4)}) = P(Z < ${absZ.toFixed(4)}) = \\Phi(${absZ.toFixed(4)})[/MATH]`);
          steps.push(`נמצא את הערך התואם בטבלה [MATH]\\Phi(${absZ.toFixed(4)}) = ${phiAbsZ.toFixed(4)}[/MATH]`);
        } else {
          const phiZ = normalCDF(z1, 0, 1);
          steps.push(`נאתר את כלל השטח משמאל ל-Z שלידינו ולאחר מכן נפקיר את המשלים (פחות 1):`);
          steps.push(`[MATH]P(X > ${x1}) = 1 - P(Z < ${z1.toFixed(4)}) = 1 - ${phiZ.toFixed(4)} = ${prob.toFixed(4)}[/MATH]`);
        }
        steps.push(`תוצאה סופית: ההסתברות המבוקשת היא [MATH]${prob.toFixed(4)}[/MATH] (או [MATH]${(prob * 100).toFixed(2)}\\%[/MATH])`);
        return { probability: prob, z1, steps };

      case 'between':
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minZ = (minX - mean) / stdDev;
        const maxZ = (maxX - mean) / stdDev;
        const pMax = normalCDF(maxX, mean, stdDev);
        const pMin = normalCDF(minX, mean, stdDev);
        prob = pMax - pMin;
        steps.push(`שלב 1: נבצע סטנדרטיזציה ונקבע ציוני תקן לשני הערכים שהוזנו:`);
        steps.push(`[MATH]Z_1 (\\text{נמוך}) = \\frac{${minX} - ${mean}}{${stdDev}} = ${minZ.toFixed(4)}[/MATH]`);
        steps.push(`[MATH]Z_2 (\\text{גבוה}) = \\frac{${maxX} - ${mean}}{${stdDev}} = ${maxZ.toFixed(4)}[/MATH]`);
        steps.push(`שלב 2: ההסתברות בין הערכים מיוצגת על ידי הפרש השטחים המצטברים:`);
        steps.push(`[MATH]P(${minX} < X < ${maxX}) = P(Z < ${maxZ.toFixed(4)}) - P(Z < ${minZ.toFixed(4)})[/MATH]`);
        steps.push(`[MATH]= \\Phi(${maxZ.toFixed(4)}) - \\Phi(${minZ.toFixed(4)}) = ${pMax.toFixed(4)} - ${pMin.toFixed(4)} = ${prob.toFixed(4)}[/MATH]`);
        steps.push(`תוצאה סופית: ההסתברות לקבל ערך בטווח הזה היא [MATH]${prob.toFixed(4)}[/MATH] (או [MATH]${(prob * 100).toFixed(2)}\\%[/MATH])`);
        return { probability: prob, z1: minZ, z2: maxZ, steps };

      case 'outside':
        const sX = Math.min(x1, x2);
        const eX = Math.max(x1, x2);
        const sZ = (sX - mean) / stdDev;
        const eZ = (eX - mean) / stdDev;
        const pS = normalCDF(sX, mean, stdDev);
        const pE = 1 - normalCDF(eX, mean, stdDev);
        prob = pS + pE;
        steps.push(`שלב 1: נמצא ציוני Z-score לכל אחד מקצוות השטח המבוקש:`);
        steps.push(`[MATH]Z_1 = \\frac{${sX} - ${mean}}{${stdDev}} = ${sZ.toFixed(4)}[/MATH]`);
        steps.push(`[MATH]Z_2 = \\frac{${eX} - ${mean}}{${stdDev}} = ${eZ.toFixed(4)}[/MATH]`);
        steps.push(`שלב 2: ההסתברות מחוץ לטווח משולבת מסכום השטחים הקיצוניים:`);
        steps.push(`[MATH]P(X < ${sX} \\text{ או } X > ${eX}) = P(Z < ${sZ.toFixed(4)}) + P(Z > ${eZ.toFixed(4)})[/MATH]`);
        steps.push(`[MATH]= ${pS.toFixed(4)} + ${pE.toFixed(4)} = ${prob.toFixed(4)}[/MATH]`);
        steps.push(`תוצאה סופית: ההסתברות הכוללת היא [MATH]${prob.toFixed(4)}[/MATH] (או [MATH]${(prob * 100).toFixed(2)}\\%[/MATH])`);
        return { probability: prob, z1: sZ, z2: eZ, steps };

      case 'conditional':
        const getRangeBounds = (t: string, v1: number, v2: number): [number, number] => {
          if (t === 'below') return [-Infinity, v1];
          if (t === 'above') return [v1, Infinity];
          return [Math.min(v1, v2), Math.max(v1, v2)];
        };

        const rA = getRangeBounds(condTypeA, x1, x2); 
        const rB = getRangeBounds(condType, condX1, condX2);

        const intersectStart = Math.max(rA[0], rB[0]);
        const intersectEnd = Math.min(rA[1], rB[1]);

        const getZRatio = (x: number) => (x - mean) / stdDev;
        
        let probB = 0;
        const zB1 = rB[0] === -Infinity ? -Infinity : getZRatio(rB[0]);
        const zB2 = rB[1] === Infinity ? Infinity : getZRatio(rB[1]);
        
        if (condType === 'below') probB = normalCDF(condX1, mean, stdDev);
        else if (condType === 'above') probB = 1 - normalCDF(condX1, mean, stdDev);
        else probB = Math.abs(normalCDF(condX2, mean, stdDev) - normalCDF(condX1, mean, stdDev));

        let probAandB = 0;
        const zI1 = intersectStart === -Infinity ? -Infinity : getZRatio(intersectStart);
        const zI2 = intersectEnd === Infinity ? Infinity : getZRatio(intersectEnd);
        
        if (intersectStart < intersectEnd) {
          const pStart = intersectStart === -Infinity ? 0 : normalCDF(intersectStart, mean, stdDev);
          const pEnd = intersectEnd === Infinity ? 1 : normalCDF(intersectEnd, mean, stdDev);
          probAandB = pEnd - pStart;
        }

        prob = probB > 0 ? probAandB / probB : 0;

        steps.push(`נפתור הסתברות מותנית לפי הנוסחה הקלאסית: [MATH]P(A|B) = \\frac{P(A \\cap B)}{P(B)}[/MATH]`);
        
        const getDescText = (t: CondType, v1: number, v2: number) => {
          if (t === 'below') return `X < ${v1}`;
          if (t === 'above') return `X > ${v1}`;
          return `${v1} < X < ${v2}`;
        };

        steps.push(`המאורעות בהם אנו דנים:`);
        steps.push(`[MATH]A (\\text{המטרה}): ${getDescText(condTypeA, x1, x2)}[/MATH]`);
        steps.push(`[MATH]B (\\text{התנאי}): ${getDescText(condType, condX1, condX2)}[/MATH]`);

        steps.push(`שלב 1: נחשב תחילה את ההסתברות המוחלטת של התנאי [MATH]P(B)[/MATH]:`);
        if (condType === 'below') {
          steps.push(`[MATH]Z_{B} = \\frac{${condX1} - ${mean}}{${stdDev}} = ${zB2.toFixed(4)}[/MATH]`);
          steps.push(`[MATH]P(B) = P(X < ${condX1}) = \\Phi(${zB2.toFixed(4)}) = ${probB.toFixed(4)}[/MATH]`);
        } else if (condType === 'above') {
          steps.push(`[MATH]Z_{B} = \\frac{${condX1} - ${mean}}{${stdDev}} = ${zB1.toFixed(4)}[/MATH]`);
          steps.push(`[MATH]P(B) = P(X > ${condX1}) = 1 - \\Phi(${zB1.toFixed(4)}) = ${probB.toFixed(4)}[/MATH]`);
        } else {
          steps.push(`[MATH]Z_{B1} = \\frac{${condX1} - ${mean}}{${stdDev}} = ${zB1.toFixed(4)}[/MATH]`);
          steps.push(`[MATH]Z_{B2} = \\frac{${condX2} - ${mean}}{${stdDev}} = ${zB2.toFixed(4)}[/MATH]`);
          steps.push(`[MATH]P(B) = \\Phi(${zB2.toFixed(4)}) - \\Phi(${zB1.toFixed(4)}) = ${probB.toFixed(4)}[/MATH]`);
        }

        steps.push(`שלב 2: נחשב את הסתברות החיתוך המשותף [MATH]P(A \\cap B)[/MATH]:`);
        
        if (intersectStart < intersectEnd) {
          steps.push(`טווח החיתוך המשותף שמתקבל: [MATH]${intersectStart === -Infinity ? '(-\\infty' : intersectStart} < X < ${intersectEnd === Infinity ? '\\infty)' : intersectEnd}[/MATH]`);
          
          if (intersectStart !== -Infinity && intersectEnd !== Infinity) {
            steps.push(`נבצע תקנון לגבולות המפגש של שטח החיתוך:`);
            steps.push(`[MATH]Z_{I1} = \\frac{${intersectStart} - ${mean}}{${stdDev}} = ${zI1.toFixed(4)}[/MATH]`);
            steps.push(`[MATH]Z_{I2} = \\frac{${intersectEnd} - ${mean}}{${stdDev}} = ${zI2.toFixed(4)}[/MATH]`);
            steps.push(`[MATH]P(A \\cap B) = \\Phi(${zI2.toFixed(4)}) - \\Phi(${zI1.toFixed(4)}) = ${probAandB.toFixed(4)}[/MATH]`);
          } else if (intersectStart !== -Infinity) {
            steps.push(`ציון תקנון עבור גבול החיתוך:`);
            steps.push(`[MATH]Z_I = \\frac{${intersectStart} - ${mean}}{${stdDev}} = ${zI1.toFixed(4)}[/MATH]`);
            steps.push(`[MATH]P(A \\cap B) = 1 - \\Phi(${zI1.toFixed(4)}) = ${probAandB.toFixed(4)}[/MATH]`);
          } else {
            steps.push(`ציון תקנון עבור גבול החיתוך:`);
            steps.push(`[MATH]Z_I = \\frac{${intersectEnd} - ${mean}}{${stdDev}} = ${zI2.toFixed(4)}[/MATH]`);
            steps.push(`[MATH]P(A \\cap B) = \\Phi(${zI2.toFixed(4)}) = ${probAandB.toFixed(4)}[/MATH]`);
          }
        } else {
          steps.push(`השטחים זרים לחלוטין - אין חיתוך אופרטיבי בין המאורעות.`);
          steps.push(`[MATH]P(A \\cap B) = 0[/MATH]`);
        }

        steps.push(`שלב 3: נפעיל את חוק בייס לקבלת ההסתברות המותנית:`);
        steps.push(`[MATH]P(A|B) = \\frac{P(A \\cap B)}{P(B)} = \\frac{${probAandB.toFixed(4)}}{${probB.toFixed(4)}} = ${prob.toFixed(4)}[/MATH]`);
        steps.push(`תוצאה סופית: ההסתברות המותנית המחושבת היא [MATH]${prob.toFixed(4)}[/MATH] (או [MATH]${(prob * 100).toFixed(2)}\\%[/MATH])`);
        
        return { probability: prob, z1: (x1 - mean) / stdDev, steps };
      
      default:
        return { probability: 0, z1: 0, steps: [] };
    }
  }, [mean, stdDev, type, x1, x2, condType, condTypeA, condX1, condX2, mode, percentile, inverseType, isValidToCalculate]);

  const stepGroups = useMemo(() => {
    const groups: string[][] = [];
    result.steps.forEach((step) => {
      const lastGroup = groups[groups.length - 1];
      const isPureMath = step.startsWith('[MATH]') && step.endsWith('[/MATH]') && !step.includes('תוצאה סופית');
      const lastStepEndsWithColon = lastGroup && lastGroup[lastGroup.length - 1].trim().endsWith(':');
      
      if (lastGroup && (lastStepEndsWithColon || isPureMath)) {
        lastGroup.push(step);
      } else {
        groups.push([step]);
      }
    });
    return groups;
  }, [result.steps]);

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-200 transition-colors duration-300 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`} dir="rtl">
      
      {/* Header */}
      <header className={`border-b sticky top-0 z-40 transition-colors shadow-sm ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Calculator size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight">מחשבון התפלגות נורמלית מתקדם</h1>
              <p className="text-[10px] text-slate-400 font-bold hidden sm:block">כלי למידה אינטראקטיבי ואינפורמטיבי</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl border transition-all ${
                theme === 'dark' 
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-250'
              }`}
              title={theme === 'dark' ? 'למצב מואר' : 'למצב חשוך'}
            >
              {theme === 'dark' ? <Sun size={17} className="stroke-[2.5]" /> : <Moon size={17} />}
            </button>
            
            <div className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <Info size={14} className="text-blue-500" />
              <span>גרסאות למידה</span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full py-8">
        <div className="max-w-5xl mx-auto px-4">
          
          {/* Navigation/Modes Tabs */}
          <div className={`p-1 rounded-2xl border shadow-inner mb-6 flex flex-wrap transition-all ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <button
              onClick={() => setMode('forward')}
              className={`flex-1 min-w-[120px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                mode === 'forward' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              חישוב הסתברות (X ← P)
            </button>
            <button
              onClick={() => setMode('inverse')}
              className={`flex-1 min-w-[120px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                mode === 'inverse' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              חישוב הפוך (אחוזון → X)
            </button>
            <button
              onClick={() => setMode('table')}
              className={`flex-1 min-w-[110px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                mode === 'table' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              טבלת Z מלאה
            </button>
            <button
              onClick={() => setMode('hypothesis')}
              className={`flex-1 min-w-[135px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                mode === 'hypothesis' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              מחשבון בדיקת השערות
            </button>
          </div>

          {/* Notation Header Banner */}
          {mode !== 'hypothesis' && (
            <div className={`rounded-3xl border p-6 text-center relative overflow-hidden mb-8 shadow-sm transition-all ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-600 to-green-500" />
              <div className="text-blue-500 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-3">הגדרה פורמלית של משתנה מקרי נורמלי</div>
              <div className="py-2 overflow-x-auto text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight" dir="ltr">
                <InlineMath math={`X \\sim N(\\mu = ${isValidToCalculate ? mean : '?'}, \\sigma^2 = ${isValidToCalculate ? (stdDev * stdDev).toFixed(2) : '?'})`} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-black text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  תוחלת (ממוצע): {isValidToCalculate ? mean : '?'}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  סטיית תקן: {isValidToCalculate ? stdDev : '?'}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  שונות: {isValidToCalculate ? (stdDev * stdDev).toFixed(2) : '?'}
                </div>
              </div>
            </div>
          )}

          {mode === 'hypothesis' ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <HypothesisTestingCalculator theme={theme} />
            </motion.div>
          ) : mode === 'table' ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl p-6 border shadow-sm transition-all ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-2">טבלת התפלגות נורמלית סטנדרטית (Z)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  השתמש בטבלה השלמה כדי לאתר ערכים מוגדרים של ה-CDF, המייצגים את פונקציית <InlineMath math="\Phi" />. 
                  ניתן להקליד ערכי חיפוש כדי להצליב את השורה והעמודה בדיוק כחץ מכוון.
                </p>
              </div>
              <ZTable showSearch={true} theme={theme} />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column Input Panel */}
              <section className="lg:col-span-5 space-y-6">
                <div className={`rounded-2xl p-6 border shadow-sm transition-all ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  
                  {/* Informational Widget */}
                  <div className="mb-6">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md relative overflow-hidden" dir="ltr">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl" />
                      <div className="relative z-10 space-y-2">
                        <div className="flex items-center gap-2">
                          <Info size={16} className="text-blue-200" />
                          <p className="text-xs font-black tracking-wide text-blue-100">סטיית תקן μ ו-σ</p>
                        </div>
                        <p className="text-xs text-slate-100 leading-relaxed text-right">
                          בסטטיסטיקה, מעבר לערכים אמיתיים משתמשים בנוסחת התקנון להפיכת המשתנה המקרי ל-Z (התפלגות סטנדרטית בעלת תוחלת 0 וסטיית תקן 1).
                        </p>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-base font-black mb-4 flex items-center gap-2">
                    <RefreshCw size={16} className="text-blue-500" />
                    פרמטרי ההתפלגות
                  </h2>

                  {/* Input Fields */}
                  <div className="space-y-4 mb-6">
                    {/* Mean Input */}
                    <div className="space-y-1">
                      <Tooltip content="הערך המרכזי של פעמון ההתפלגות (התוחלת)" theme={theme}>
                        <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-300 dark:border-slate-700">תוחלת (μ):</label>
                      </Tooltip>
                      <input 
                        type="text" 
                        value={meanInput} 
                        onChange={(e) => handleMeanChange(e.target.value)}
                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-900 dark:text-slate-100 ${
                          meanError 
                            ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                            : 'border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
                        }`}
                        placeholder="הזן ממוצע, לדוגמה: 170"
                      />
                      {meanError && (
                        <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
                          <AlertCircle size={10} className="stroke-[2.5]" />
                          <span>{meanError}</span>
                        </p>
                      )}
                    </div>

                    {/* Standard Deviation Input (Strict Validation > 0) */}
                    <div className="space-y-1">
                      <Tooltip content="מדד הפיזור של הערכים סביב הממוצע (חייב להיו חיובי וגדול מ-0)" theme={theme}>
                        <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-300 dark:border-slate-700">סטיית תקן (σ):</label>
                      </Tooltip>
                      <input 
                        type="text" 
                        value={stdDevInput} 
                        onChange={(e) => handleStdDevChange(e.target.value)}
                        className={`w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-900 dark:text-slate-100 ${
                          stdDevError 
                            ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                            : 'border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
                        }`}
                        placeholder="חייב להיות גדול מ-0"
                      />
                      {stdDevError ? (
                        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-2.5 rounded-lg mt-1 space-y-1">
                          <p className="text-[11px] text-red-500 font-black flex items-center gap-1">
                            <AlertCircle size={12} className="stroke-[2.5]" />
                            <span>שגיאת קלט חסומה!</span>
                          </p>
                          <p className="text-[10px] text-red-500/80 leading-tight">
                            {stdDevError}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400">יש להקפיד על ערך חיובי בלבד כדי למנוע חלוקה באפס.</p>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {mode === 'forward' ? (
                      <motion.div 
                        key="forward-container"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <div className="border-t pt-4 border-slate-100 dark:border-slate-800">
                          <h3 className="text-sm font-black mb-3 text-slate-400 flex items-center gap-1.5">
                            מאורע הסתברות
                            <HelpCircle size={13} />
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: 'below', label: 'מתחת ל- X' },
                              { id: 'above', label: 'מעל ל- X' },
                              { id: 'between', label: 'בין X₁ ל- X₂' },
                              { id: 'outside', label: 'מחוץ לטווח' },
                              { id: 'conditional', label: 'מותנה מראש' }
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setType(item.id as CalcType)}
                                className={`px-3 py-2 text-xs font-black rounded-lg transition-all border ${
                                  type === item.id 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10' 
                                    : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {type === 'conditional' ? (
                          <div className="p-4 bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-xs font-black text-blue-500">מאורע A (ההסתברות המבוקשת)</h4>
                              <select 
                                value={condTypeA}
                                onChange={(e) => setCondTypeA(e.target.value as CondType)}
                                className="w-full p-2 text-xs bg-white dark:bg-slate-800 border rounded-lg outline-none font-bold"
                              >
                                <option value="below">X &lt; x</option>
                                <option value="above">X &gt; x</option>
                                <option value="between">x1 &lt; X &lt; x2</option>
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                                <input 
                                  type="number" 
                                  value={x1}
                                  onChange={(e) => setX1(Number(e.target.value))}
                                  className="p-2 text-xs font-bold border rounded-lg outline-none bg-white dark:bg-slate-800"
                                  placeholder="x1"
                                />
                                {condTypeA === 'between' && (
                                  <input 
                                    type="number" 
                                    value={x2}
                                    onChange={(e) => setX2(Number(e.target.value))}
                                    className="p-2 text-xs font-bold border rounded-lg outline-none bg-white dark:bg-slate-800"
                                    placeholder="x2"
                                  />
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-2 border-t pt-3 border-slate-200/50 dark:border-slate-800">
                              <h4 className="text-xs font-black text-emerald-500">מאורע B (התנאי הנתון)</h4>
                              <select 
                                value={condType}
                                onChange={(e) => setCondType(e.target.value as CondType)}
                                className="w-full p-2 text-xs bg-white dark:bg-slate-800 border rounded-lg outline-none font-bold"
                              >
                                <option value="below">X &lt; x</option>
                                <option value="above">X &gt; x</option>
                                <option value="between">x1 &lt; X &lt; x2</option>
                              </select>
                              <div className="grid grid-cols-2 gap-2">
                                <input 
                                  type="number" 
                                  value={condX1}
                                  onChange={(e) => setCondX1(Number(e.target.value))}
                                  className="p-2 text-xs font-bold border rounded-lg outline-none bg-white dark:bg-slate-800"
                                  placeholder="x1"
                                />
                                {condType === 'between' && (
                                  <input 
                                    type="number" 
                                    value={condX2}
                                    onChange={(e) => setCondX2(Number(e.target.value))}
                                    className="p-2 text-xs font-bold border rounded-lg outline-none bg-white dark:bg-slate-800"
                                    placeholder="x2"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <label className="text-xs font-black text-slate-400">
                                {type === 'between' || type === 'outside' ? 'גבול תחתון X₁' : 'ערך משתנה X:'}
                              </label>
                              <input 
                                type="number" 
                                value={x1}
                                onChange={(e) => setX1(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                              />
                            </div>
                            { (type === 'between' || type === 'outside') && (
                              <div className="space-y-1">
                                <label className="text-xs font-black text-slate-400">גבול עליון X₂:</label>
                                <input 
                                  type="number" 
                                  value={x2}
                                  onChange={(e) => setX2(Number(e.target.value))}
                                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold text-sm text-slate-900 dark:text-slate-100"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="inverse-container"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-400">סוג האחוזון הנדרש:</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setInverseType('lower')}
                              className={`py-2 px-3 text-xs font-black rounded-lg transition-all border ${
                                inverseType === 'lower' 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                  : 'bg-slate-50 dark:bg-slate-850 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              אחוזון מצטבר משמאל
                            </button>
                            <button
                              onClick={() => setInverseType('upper')}
                              className={`py-2 px-3 text-xs font-black rounded-lg transition-all border ${
                                inverseType === 'upper' 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                  : 'bg-slate-50 dark:bg-slate-850 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              אחוזון מצטבר מימין
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-black text-slate-400">ערך האחוזון (P) באחוזים:</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              value={percentile} 
                              min="0.01"
                              max="99.99"
                              step="0.01"
                              onChange={(e) => setPercentile(Math.min(99.99, Math.max(0.01, Number(e.target.value))))}
                              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold text-sm pl-10 text-slate-900 dark:text-slate-100"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                          </div>
                          <p className="text-[10px] text-slate-400">הזן הסתברות בין 0.01% ל-99.99%.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Main Shaded Probability Output Card */}
                {isValidToCalculate ? (
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl" />
                    <span className="text-xs text-blue-105 font-bold block mb-1">
                      {mode === 'inverse' ? 'ערך משתנה ה-X הפיזי שחושב' : 'ההסתברות שנתקבלה (P)'}
                    </span>
                    <div className="text-4xl font-extrabold leading-normal">
                      {mode === 'inverse' 
                        ? (result.calculatedX?.toFixed(4) ?? '0.0000')
                        : `${(result.probability * 100).toFixed(2)}%`}
                    </div>
                    <div className="text-xs text-blue-200 mt-2">
                      {mode === 'inverse' 
                        ? `עבור אחוזון ${percentile}%`
                        : `ערך עשרוני מדויק: ${result.probability.toFixed(4)}`}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-950/20 text-red-600 rounded-2xl p-5 border border-red-100 dark:border-red-900/30 text-center text-xs font-black">
                    ממתין להזנת נתונים תקינים בפנל הקלטים כדי לבצע חישוב.
                  </div>
                )}
              </section>

              {/* Right Column Visualization & Step Breakdown */}
              <section className="lg:col-span-7 space-y-8">
                
                {/* Dynamically Styled Math steps */}
                <div className={`rounded-2xl p-6 border shadow-sm transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <h2 className="text-base font-black mb-4 flex items-center gap-2 border-b pb-3 border-slate-100 dark:border-slate-800">
                    <Calculator size={16} className="text-blue-500" />
                    שלבי פתרון מתמטיים מפורטים
                  </h2>
                  
                  {isValidToCalculate ? (
                    <div className="space-y-4">
                      {stepGroups.map((group, idx) => (
                        <div key={idx} className="flex gap-4 items-start text-right">
                          <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-xs font-black text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="flex-1 space-y-2 w-full">
                            {group.map((step, sIdx) => (
                              <FormattedStep key={sIdx} text={step} theme={theme} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <AlertCircle className="mx-auto mb-2 text-slate-300" size={32} />
                      <p className="text-xs font-bold">הזן פרמטרים תקינים כדי לצפות בצעדי הפתרון המפורטים.</p>
                    </div>
                  )}
                </div>

                {/* Curve Visualization Area */}
                <div className={`rounded-2xl p-6 border shadow-sm transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <NormalChart 
                    mean={mean} 
                    stdDev={stdDev} 
                    type={mode === 'inverse' ? (inverseType === 'lower' ? 'below' : 'above') : type} 
                    x1={mode === 'inverse' ? (result.calculatedX ?? 0) : x1} 
                    x2={x2} 
                    condType={condType}
                    condTypeA={condTypeA}
                    condX1={condX1}
                    condX2={condX2}
                    probability={result.probability}
                    mode={mode}
                    theme={theme}
                  />
                </div>

              </section>

              {/* Z-Table Lookup helper links right beneath the core loop */}
              {isValidToCalculate && (result.z1 !== undefined || result.z2 !== undefined) && (
                <div className={`lg:col-span-12 rounded-2xl p-5 border shadow-sm transition-colors ${
                  theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <h3 className="text-sm font-black mb-3 text-slate-400 flex items-center gap-1.5 leading-none">
                    <Info size={14} className="text-blue-500" />
                    איתור ציוני Z בטבלה
                  </h3>
                  <div className="space-y-6">
                    <ZTable activeZ={result.z1} theme={theme} />
                    {result.z2 !== undefined && <ZTable activeZ={result.z2} theme={theme} />}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-12 text-center text-xs font-bold text-slate-400/80 tracking-wide border-t border-slate-100 dark:border-slate-800 mt-12">
        <p>© {new Date().getFullYear()} מחשבון התפלגות נורמלית מתקדם - פותח על ידי רוברט תיגר עבור סטודנטים</p>
      </footer>
    </div>
  );
}
