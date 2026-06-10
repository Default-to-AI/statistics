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
} from'recharts';
import HypothesisTestingCalculator from'./components/HypothesisTestingCalculator';
import FormulaSheet from'./components/FormulaSheet';

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

/**
 * Student's T Cumulative Distribution Function (CDF)
 * Accurate analytical trigonometric formula for any integer degrees of freedom
 */
function studentTCDF(t: number, df: number): number {
 if (df <= 0) return 0.5;
 
 if (df >= 500) {
 return normalCDF(t, 0, 1);
 }
 
 const theta = Math.atan(t / Math.sqrt(df));
 
 if (df === 1) {
 return 0.5 + theta / Math.PI;
 }
 
 const cosT = Math.cos(theta);
 const sinT = Math.sin(theta);
 
 let sum = 1;
 let term = 1;
 
 if (df % 2 === 0) {
 for (let i = 2; i <= df - 2; i += 2) {
 term *= (cosT * cosT * (i - 1)) / i;
 sum += term;
 }
 return 0.5 + 0.5 * sinT * sum;
 } else {
 for (let i = 3; i <= df - 2; i += 2) {
 term *= (cosT * cosT * (i - 1)) / i;
 sum += term;
 }
 return 0.5 + (theta + sinT * cosT * sum) / Math.PI;
 }
}

/**
 * Student's T Inverse CDF (Quantile/Critical Value Function)
 * Extremely fast, precise bisection solver using the exact CDF above
 */
function studentTInverseCDF(p: number, df: number): number {
 if (p <= 0) return -999;
 if (p >= 1) return 999;
 if (p === 0.5) return 0;
 
 if (df === 1) {
 return Math.tan(Math.PI * (p - 0.5));
 }
 
 if (df >= 500) {
 return inverseNormalCDF(p);
 }
 
 // Use a targeted, range-narrowed solver starting around Z margin
 const z = inverseNormalCDF(p);
 let low = z < 0 ? z * 10 - 2 : 0;
 let high = z < 0 ? 0 : z * 10 + 2;
 
 // Double-check extreme bounds
 if (studentTCDF(high, df) < p) {
 high *= 5;
 }
 if (studentTCDF(low, df) > p) {
 low *= 5;
 }

 for (let iter = 0; iter < 100; iter++) {
 const mid = (low + high) / 2;
 const val = studentTCDF(mid, df);
 if (Math.abs(val - p) < 1e-12) {
 return mid;
 }
 if (val < p) {
 low = mid;
 } else {
 high = mid;
 }
 }
 return (low + high) / 2;
}

// --- Types ---

type CalcMode ='forward' |'inverse' |'table' |'hypothesis' |'formula-sheet';
type CalcType ='below' |'above' |'between' |'outside' |'conditional';
type CondType ='below' |'above' |'between';

interface CalculationResult {
 probability: number;
 z1: number;
 z2?: number;
 steps: string[];
 calculatedX?: number;
}

// --- Components ---

const Tooltip: React.FC<{ content: string; children: React.ReactNode }> = ({ content, children }) => {
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
 className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 text-xs rounded-xl shadow-xl pointer-events-none text-center leading-normal font-medium bg-slate-800 text-slate-100 border border-slate-700"
 >
 {content}
 <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
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
}> = ({ mean, stdDev, type, x1, x2, condType, condTypeA, condX1, condX2, probability, mode }) => {
 
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
 if (t ==='below') return [-Infinity, val1];
 if (t ==='above') return [val1, Infinity];
 if (t ==='between') return [Math.min(val1, val2), Math.max(val1, val2)];
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

 if (type ==='conditional') {
 const rA = getRangeRange(condTypeA ||'below', x1, x2);
 const rB = getRangeRange(condType, condX1, condX2);

 if (isXInside(x, rB)) {
 condBShadedY = y;
 }
 if (isXInside(x, rA) && isXInside(x, rB)) {
 intersectShadedY = y;
 }
 } else {
 switch (type) {
 case'below':
 if (x <= x1) shadedY = y;
 break;
 case'above':
 if (x >= x1) shadedY = y;
 break;
 case'between':
 if (x >= minStandardX && x <= maxStandardX) shadedY = y;
 break;
 case'outside':
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
 <div className="flex h-64 items-center justify-center rounded-xl bg-red-950/20 text-red-500 font-bold border border-red-900/30">
 נא להזין סטיית תקן גדולה מ-0 להצגת גרף.
 </div>
 );
 }

 // Define line colors based on the theme
 const curveColor ='#60a5fa';
 const mainGridColor ='#334155';
 const axisLabelColor ='#94a3b8';
 const shadedColor ='rgba(96, 165, 250, 0.4)';
 const bShadedColor ='rgba(16, 185, 129, 0.2)';
 const intersectShadedColor ='rgba(59, 130, 246, 0.65)';

 const minStandardX = Math.min(x1, x2);
 const maxStandardX = Math.max(x1, x2);

 // Customized tooltip
 const CustomTooltipInner = ({ active, payload }: any) => {
 if (active && payload && payload.length) {
 const dataPt = payload[0].payload;
 const zVal = (dataPt.x - mean) / stdDev;
 return (
 <div className="p-3 border rounded-xl shadow-lg text-xs font-sans text-right space-y-1 backdrop-blur-md bg-slate-900/90 border-slate-700 text-slate-100">
 <p className="font-bold text-sm text-blue-400">נקודה על העקומה</p>
 <p className="flex justify-between gap-4"><span>ערך X:</span> <span className="font-mono font-bold">{dataPt.x.toFixed(2)}</span></p>
 <p className="flex justify-between gap-4"><span>ציון תקן Z:</span> <span className="font-mono font-bold">{zVal.toFixed(2)}</span></p>
 <p className="flex justify-between gap-4"><span>צפיפות PDF:</span> <span className="font-mono font-bold">{dataPt.pdf.toFixed(4)}</span></p>
 </div>
 );
 }
 return null;
 };

 return (
 <div className="w-full rounded-2xl p-4 border transition-colors bg-slate-900 border-slate-800">
 <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b pb-4 border-slate-800">
 <h3 className="text-base font-bold text-slate-200">
 {type ==='conditional' ?'גרף התפלגות מותנית P(A|B)' :'עקומת פעמון ושטחים מחושבים'}
 </h3>
 <span className="px-3 py-1 rounded-full text-xs font-black tracking-wide shrink-0 bg-blue-900/30 text-blue-300">
 {type ==='conditional' ? `P(A|B) = ${probability.toFixed(4)}` : `שטח מחושב: ${(probability * 100).toFixed(2)}%`}
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
 {type ==='conditional' ? (
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
 ) : type ==='outside' ? (
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
 stroke={'var(--color-text-secondary)'} 
 strokeWidth={1.5} 
 strokeDasharray="4 4"
 label={{
 value: `μ=${mean}`,
 position:'top',
 fill:'var(--color-text-primary)',
 fontSize: 11,
 fontWeight:'bold'
 }}
 />

 {/* Reference Lines for Inputs */}
 {type ==='conditional' ? (
 <>
 {condX1 !== undefined && (condType ==='below' || condType ==='above' || condType ==='between') && (
 <ReferenceLine 
 x={condX1} 
 stroke="var(--color-success)" 
 strokeWidth={1.5} 
 strokeDasharray="3 3"
 label={{
 value: condType ==='between' ?'B: x1' :'B',
 position:'top',
 fill:'var(--color-success)',
 fontSize: 10,
 fontWeight:'bold'
 }}
 />
 )}
 {condX2 !== undefined && condType ==='between' && (
 <ReferenceLine 
 x={condX2} 
 stroke="var(--color-success)" 
 strokeWidth={1.5} 
 strokeDasharray="3 3"
 label={{
 value:'B: x2',
 position:'top',
 fill:'var(--color-success)',
 fontSize: 10,
 fontWeight:'bold'
 }}
 />
 )}
 {(condTypeA ==='below' || condTypeA ==='above' || condTypeA ==='between') && (
 <ReferenceLine 
 x={x1} 
 stroke="var(--color-error)" 
 strokeWidth={1.5} 
 label={{
 value: condTypeA ==='between' ?'A: x1' :'A',
 position:'top',
 fill:'var(--color-error)',
 fontSize: 10,
 fontWeight:'bold'
 }}
 />
 )}
 {condTypeA ==='between' && (
 <ReferenceLine 
 x={x2} 
 stroke="var(--color-error)" 
 strokeWidth={1.5} 
 label={{
 value:'A: x2',
 position:'top',
 fill:'var(--color-error)',
 fontSize: 10,
 fontWeight:'bold'
 }}
 />
 )}
 </>
 ) : mode ==='inverse' ? (
 <ReferenceLine 
 x={x1} 
 stroke="var(--color-accent)" 
 strokeWidth={1.5} 
 label={{
 value: `X = ${x1.toFixed(2)}`,
 position:'top',
 fill:'var(--color-accent)',
 fontSize: 11,
 fontWeight:'bold'
 }}
 />
 ) : (
 <>
 <ReferenceLine 
 x={x1} 
 stroke="var(--color-error)" 
 strokeWidth={1.5} 
 label={{
 value: type ==='between' || type ==='outside' ?'X₁' :'X',
 position:'top',
 fill:'var(--color-error)',
 fontSize: 11,
 fontWeight:'bold'
 }}
 />
 {(type ==='between' || type ==='outside') && (
 <ReferenceLine 
 x={x2} 
 stroke="var(--color-success)" 
 strokeWidth={1.5} 
 label={{
 value:'X₂',
 position:'top',
 fill:'var(--color-success)',
 fontSize: 11,
 fontWeight:'bold'
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

const FormattedStep: React.FC<{ text: string }> = ({ text }) => {
 const isResult = text.startsWith('תוצאה סופית:');
 const parts = text.split(/\[MATH\](.*?)\[\/MATH\]/g);

 return (
 <div className={`text-sm md:text-base leading-relaxed w-full transition-all ${
 isResult 
 ?'font-bold text-blue-200 bg-blue-950/40 p-5 rounded-2xl border border-blue-900 shadow-lg'
 :'text-slate-200'
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
 className="my-3 text-center py-3 px-2 rounded-xl border shadow-inner overflow-x-auto bg-slate-800/60 border-slate-700/60" 
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

const ZTable: React.FC<{ activeZ?: number | null; showSearch?: boolean }> = ({ activeZ = null, showSearch = false }) => {
 const [searchType, setSearchType] = useState<'z' |'phi'>('z');
 const [searchVal, setSearchVal] = useState<string>(activeZ?.toFixed(2) ||'');
 const [phiSearchVal, setPhiSearchVal] = useState<string>('');
 const [isZGuideOpen, setIsZGuideOpen] = useState<boolean>(false);
 const [isTGuideOpen, setIsTGuideOpen] = useState<boolean>(false);

 // Student's T-distribution states
 const [tDf, setTDf] = useState<number>(10);
 const [tAlpha, setTAlpha] = useState<number>(0.05);
 const [tSide, setTSide] = useState<'two'>('two');

 useEffect(() => {
 if (activeZ !== null) {
 setSearchVal(activeZ.toFixed(2));
 setSearchType('z');
 }
 }, [activeZ]);

 const rows = useMemo(() => Array.from({ length: 40 }, (_, i) => i / 10), []);
 const cols = useMemo(() => Array.from({ length: 10 }, (_, i) => i / 100), []);

 const dfList = useMemo(() => [
 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 
 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 
 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 
 40, 50, 60, 80, 100, 120, 500
 ], []);

 const tCols = useMemo(() => [
 { oneTail: 0.10, twoTail: 0.20 },
 { oneTail: 0.05, twoTail: 0.10 },
 { oneTail: 0.025, twoTail: 0.05 },
 { oneTail: 0.01, twoTail: 0.02 },
 { oneTail: 0.005, twoTail: 0.01 },
 { oneTail: 0.0005, twoTail: 0.001 }
 ], []);

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
 if (searchType ==='phi') {
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

 const activeCellRef = useRef<HTMLTableCellElement | null>(null);
 const containerRef = useRef<HTMLDivElement | null>(null);

 useEffect(() => {
 if (activeCellRef.current && containerRef.current) {
 const cell = activeCellRef.current;
 const container = containerRef.current;
 
 const cellRect = cell.getBoundingClientRect();
 const containerRect = container.getBoundingClientRect();
 
 const scrollTop = container.scrollTop + (cellRect.top - containerRect.top) - (containerRect.height / 2) + (cellRect.height / 2);
 const scrollLeft = container.scrollLeft + (cellRect.left - containerRect.left) - (containerRect.width / 2) + (cellRect.width / 2);
 
 container.scrollTo({
 top: scrollTop,
 left: scrollLeft,
 behavior:'smooth'
 });
 }
 }, [rowVal, colVal]);

 const computedTCritical = useMemo(() => {
 if (tDf <= 0 || isNaN(tDf)) return null;
 const targetP = tSide ==='two' ? 1 - (tAlpha / 2) : 1 - tAlpha;
 if (targetP <= 0 || targetP >= 1 || isNaN(targetP)) return null;
 return studentTInverseCDF(targetP, tDf);
 }, [tDf, tAlpha, tSide]);

 const renderTableSection = (tableRows: number[]) => (
 <div ref={containerRef} dir="ltr" className="overflow-auto rounded-xl border border-slate-800 max-h-[480px]">
 <table className="w-full text-xs sm:text-sm border-collapse">
 <thead>
 <tr className="bg-slate-800">
 <th className="sticky top-0 left-0 p-2.5 border border-slate-700 text-blue-400 font-extrabold text-center text-sm w-14 bg-slate-800 z-30">Z</th>
 {cols.map(c => {
 const isColActive = lookupZ !== null && Math.abs(c - colVal!) < 0.001;
 return (
 <th 
 key={c} 
 className={`sticky top-0 p-2.5 border border-slate-700 transition-colors duration-300 font-extrabold text-center min-w-[58px] z-20 ${
 isColActive 
 ?'bg-blue-600 text-white bg-blue-500' 
 :'text-slate-400 bg-slate-800'
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
 ?'bg-blue-950/20' 
 :'hover:bg-slate-800/20'
 }`}>
 <td className={`sticky left-0 p-2.5 border border-slate-700 font-black text-center text-sm transition-colors duration-300 z-10 ${
 isRowActive 
 ?'bg-blue-600 text-white bg-blue-500' 
 :'text-slate-200 bg-slate-900'
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
 ref={isActive ? activeCellRef : undefined}
 className={`p-2.5 border border-slate-700 text-center transition-all duration-300 tabular-nums ${
 isActive 
 ?'bg-blue-600 text-white bg-blue-500 font-extrabold scale-102 shadow-lg z-10 relative rounded-md' 
 : isRowActive
 ?'bg-blue-100/40 text-blue-900 bg-blue-900/20 text-blue-300 font-semibold'
 : isColActive
 ?'bg-indigo-100/40 text-indigo-900 bg-indigo-900/20 text-indigo-300 font-semibold'
 :'text-slate-350 hover:bg-slate-800 font-medium'
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

 const renderTTableSection = () => (
 <div className="overflow-auto rounded-xl border border-slate-800 max-h-[480px]">
 <table className="w-full text-xs sm:text-sm border-collapse">
 <thead>
 <tr className="bg-slate-800 text-slate-400">
 <th rowSpan={2} className="sticky top-0 right-0 p-3 border border-slate-700 text-indigo-400 font-black text-center text-xs sm:text-sm w-16 bg-slate-800 z-30">
 דרגות חופש <br/> (df)
 </th>
 <th colSpan={6} className="sticky top-0 p-1.5 border-b border-slate-700 font-extrabold text-center text-xs bg-slate-800 z-20">
 רמת מובהקות עבור התפלגות T
 </th>
 </tr>
 <tr className="bg-slate-800 text-slate-400">
 {tCols.map((c, idx) => {
 const isActiveCol = (tSide ==='two' && Math.abs(tAlpha - c.twoTail) < 0.0001);
 return (
 <th
 key={idx}
 className={`sticky top-0 p-2.5 border border-slate-700 font-bold text-center transition-colors min-w-[70px] z-20 ${
 isActiveCol
 ?'bg-indigo-600 text-white bg-indigo-600'
 :'bg-slate-800'
 }`}
 >
 <div className="text-[10px] opacity-75">חד-צדדי: {c.oneTail}</div>
 <div className="text-xs">דו-צדדי: {c.twoTail}</div>
 </th>
 );
 })}
 </tr>
 </thead>
 <tbody>
 {dfList.map(df => {
 const isRowActive = df === tDf;
 return (
 <tr key={df} className={`transition-colors duration-200 ${
 isRowActive 
 ?'bg-indigo-950/20' 
 :'hover:bg-slate-800/20'
 }`}>
 <td className={`sticky right-0 p-2.5 border border-slate-700 font-black text-center text-xs sm:text-sm transition-colors duration-300 z-10 ${
 isRowActive 
 ?'bg-indigo-600 text-white bg-indigo-500' 
 :'text-slate-200 bg-slate-900'
 }`}>
 {df === 500 ?'∞ (Z)' : df}
 </td>
 {tCols.map((c, colIdx) => {
 const val = studentTInverseCDF(1 - c.oneTail, df);
 const isActiveCol = (tSide ==='two' && Math.abs(tAlpha - c.twoTail) < 0.0001);
 const isActive = isRowActive && isActiveCol;

 return (
 <td
 key={colIdx}
 className={`p-2.5 border border-slate-700 text-center transition-all duration-300 tabular-nums ${
 isActive 
 ?'bg-indigo-600 text-white bg-indigo-600 font-black scale-102 shadow-lg z-10 relative rounded-md' 
 : isRowActive
 ?'bg-indigo-100/40 text-indigo-900 bg-indigo-900/20 text-indigo-300 font-semibold'
 : isActiveCol
 ?'bg-indigo-50/60 text-indigo-900 bg-indigo-950/20 text-indigo-300 font-semibold'
 :'text-slate-350 hover:bg-slate-800 font-medium'
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
'bg-slate-900 border-slate-800'
 } ${!showSearch ?'mt-4' :''}`}>
 
 <div className="p-6 space-y-10" dir="rtl">
 {/* SECTION 1: CONSOLIDATED Z-TABLE */}
 <div className="space-y-4">
 <div className="flex flex-col gap-3 border-b pb-3 border-slate-800">
 <div>
 <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
 <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
 טבלת Z מלאה (התפלגות נורמלית סטנדרטית)
 </h3>
 </div>
 
 <div className="flex flex-wrap items-center gap-2.5">
 <div 
 style={{ width:'412px', fontSize:'15.6px' }}
 className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 px-2 rounded-xl text-xs max-w-full shrink-0 shadow-sm"
 >
 <div 
 style={{ width:'108.236px' }}
 className="flex p-0.5 rounded-lg border bg-slate-800 border-slate-700 shadow-inner"
 >
 <button
 type="button"
 onClick={() => setSearchType('z')}
 className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
 searchType ==='z' 
 ?'bg-blue-600 text-white shadow-md' 
 :'text-slate-400'
 }`}
 >
 לפי Z
 </button>
 <button
 type="button"
 onClick={() => setSearchType('phi')}
 className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
 searchType ==='phi' 
 ?'bg-blue-600 text-white shadow-md' 
 :'text-slate-400'
 }`}
 >
 לפי PHI
 </button>
 </div>

 <div className="h-4 w-px bg-slate-200 bg-slate-800" />

 <div className="flex items-center gap-1 text-slate-300">
 <span className="font-bold">
 {searchType ==='z' ?'ערך Z:' :'ערך PHI:'}
 </span>
 {searchType ==='z' ? (
 <input 
 type="number" 
 step="0.01"
 min="0"
 max="3.99"
 value={searchVal}
 onChange={(e) => setSearchVal(e.target.value)}
 placeholder="1.96"
 style={{ width:'95px' }}
 className="px-1 py-0.5 border border-slate-700 bg-slate-800 rounded font-bold font-mono text-center text-blue-400 animate-none"
 />
 ) : (
 <input 
 type="number" 
 step="0.0001"
 min="0.5"
 max="0.9999"
 value={phiSearchVal}
 onChange={(e) => setPhiSearchVal(e.target.value)}
 placeholder="0.95"
 style={{ width:'95px' }}
 className="px-1 py-0.5 border border-slate-700 bg-slate-800 rounded font-bold font-mono text-center text-emerald-400 animate-none"
 />
 )}
 </div>

 {lookupZ !== null && (
 <>
 <div className="h-4 w-px bg-slate-200 bg-slate-800" />
 <div className="flex items-center gap-1 bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-lg select-all tabular-nums text-xs border border-blue-700 shadow-sm" dir="ltr">
 <span className="opacity-85 mr-1 text-[10px]">{searchType ==='z' ?'Φ(z) =' :'z_val ='}</span>
 <span>
 {searchType ==='z' 
 ? normalCDF(actualZ || lookupZ, 0, 1).toFixed(4)
 : lookupZ.toFixed(2)
 }
 </span>
 </div>
 </>
 )}
 </div>

 <button
 type="button"
 onClick={() => setIsZGuideOpen(!isZGuideOpen)}
 className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1 cursor-pointer text-xs font-semibold text-slate-300 border border-slate-700"
 >
 <BookOpen size={13} className="text-blue-500" />
 <span>איך לנווט בטבלה?</span>
 <ChevronDown 
 size={12} 
 className={`transition-transform duration-300 ${isZGuideOpen ?'rotate-180' :''}`} 
 />
 </button>
 </div>
 </div>

 <AnimatePresence initial={false}>
 {isZGuideOpen && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2, ease:'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="p-4 bg-slate-900/10 border border-slate-800/60 rounded-xl text-right animate-none">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
 <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold flex-1">
 ערך ה-Z מופיע <strong>בשולי הטבלה</strong> (אנכית השורה עם השלם והעשירית, ואופקית העמודה עם המאית). 
 ערך ה-PHI (ההסתברות המצטברת משמאל) מופיע <strong>בתוך תאי הטבלה</strong>.
 </p>
 <div className="text-sm bg-blue-500/10 p-2 rounded-lg border border-blue-500/15 text-blue-300 whitespace-nowrap md:self-center shrink-0" dir="rtl">
 דוגמה: למציאת <InlineMath math="Z=1.96" />, נצליב שורה 1.9 ועמודה 0.06 כדי לקבל <InlineMath math="0.9750" />.
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* SECTION: POPULAR Z-VALUES FOR HYPOTHESIS TESTING */}
 <div className="space-y-3 pt-2">
 <h4 className="text-xs sm:text-sm font-black text-slate-200 flex items-center gap-1.5">
 <span className="w-2 h-2 rounded bg-blue-500" />
 ערכי Z פופולריים בבחינת השערות (רמות אלפא ורמות סמך מקובלות)
 </h4>
 <div dir="ltr" className="overflow-auto rounded-xl border border-slate-800 bg-slate-900/40 p-1">
 <table className="w-full text-xs border-collapse text-center">
 <thead>
 <tr className="bg-slate-800/80 font-extrabold text-slate-300">
 <th className="p-2 border border-slate-700 font-bold bg-slate-750 text-left w-28 rtl:text-right">
 ערך ה-Z
 </th>
 {[1.282, 1.645, 1.960, 2.326, 2.576, 3.090, 3.291, 3.891, 4.417].map((z, idx) => (
 <th key={idx} className="p-2 border border-slate-755 font-mono font-black text-blue-400 min-w-[70px]">
 {z.toFixed(3)}
 </th>
 ))}
 </tr>
 </thead>
 <tbody>
 <tr className="text-slate-300 font-semibold bg-slate-900">
 <td className="p-2 border border-slate-700 font-bold bg-slate-800/60 text-left rtl:text-right">
 <InlineMath math="\Phi(z)" /> (הסתברות)
 </td>
 {['0.90','0.95','0.975','0.99','0.995','0.999','0.9995','0.99995','0.999995'].map((phi, idx) => (
 <td key={idx} className="p-2 border border-slate-700 font-mono text-slate-200">
 {phi}
 </td>
 ))}
 </tr>
 <tr className="text-[10px] text-slate-400 font-medium bg-slate-900">
 <td className="p-2 border border-slate-700 font-bold bg-slate-800/60 text-left leading-tight rtl:text-right">
 רמת סמך / שימוש מקובל
 </td>
 {[
'90% (חד-צדדי)',
'95% (חד) / 90% (דו)',
'95% (דו-צדדי)',
'99% (חד-צדדי)',
'99% (דו-צדדי)',
'99.9% (חד-צדדי)',
'99.9% (דו-צדדי)',
'99.99% (דו-צדדי)',
'99.999% (דו-צדדי)'
 ].map((desc, idx) => (
 <td key={idx} className="p-2 border border-slate-700 leading-snug">
 {desc}
 </td>
 ))}
 </tr>
 </tbody>
 </table>
 </div>
 </div>

 {renderTableSection(rows)}
 </div>

 {/* Result & Helper steps for Z Table */}
 {lookupZ !== null && (
 <div className="p-5 border rounded-2xl font-sans shadow-sm transition-colors bg-slate-950/60 border-slate-800 text-slate-100">
 {isZNegative ? (
 <div className="space-y-4">
 <div className="flex items-center gap-2 font-black text-sm text-blue-400">
 <Info size={18} className="text-blue-500 shrink-0" />
 <span>חישוב שלב עזר עבור ערך Z שלילי ({actualZ?.toFixed(2)})</span>
 </div>
 <div className="space-y-3 leading-relaxed">
 <p className="text-sm text-slate-350 font-semibold">כדי למצוא את תוצאת הפונקציה <InlineMath math="\Phi" /> עבור ערך <InlineMath math="z" /> שלילי, נשתמש בכלל הסימטריה המוכר בסטטיסטיקה:</p>
 <div className="text-center py-3 bg-slate-900 border border-slate-805 rounded-xl overflow-x-auto text-sm sm:text-base font-bold shadow-sm text-blue-300">
 <InlineMath math={`\\Phi(${actualZ?.toFixed(2)}) = 1 - \\Phi(${lookupZ.toFixed(2)})`} />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-right">
 <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-sm space-y-1">
 <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold">שלב 1: מציאת הערך החיובי בטבלה</p>
 <p className="font-bold text-xs text-slate-400">
 הצלבנו שורה {rowVal?.toFixed(1)}, עמודה {colVal?.toFixed(2).slice(2)}
 </p>
 <p className="text-sm sm:text-base font-black text-slate-100 mt-1">
 <InlineMath math={`\\Phi(${lookupZ.toFixed(2)}) = ${normalCDF(lookupZ, 0, 1).toFixed(4)}`} />
 </p>
 </div>
 <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-sm space-y-1">
 <p className="text-[10px] uppercase tracking-wider text-indigo-400 font-extrabold">שלב 2: חיסור ההסתברות המצטברת מ-1</p>
 <p className="font-bold text-xs text-slate-400">
 <InlineMath math={`1 - ${normalCDF(lookupZ, 0, 1).toFixed(4)}`} />
 </p>
 <p className="text-sm sm:text-base font-black text-emerald-400 mt-1">
 = {normalCDF(actualZ!, 0, 1).toFixed(4)}
 </p>
 </div>
 </div>
 <p className="font-black text-center text-base sm:text-lg pt-4 border-t border-slate-800 text-indigo-400">
 תוצאה סופית: <InlineMath math={`\\Phi(${actualZ?.toFixed(2)}) = ${normalCDF(actualZ!, 0, 1).toFixed(4)}`} />
 </p>
 </div>
 </div>
 ) : (
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
 <Calculator size={18} className="stroke-[2.5]" />
 </div>
 <div className="text-right">
 <div className="text-sm sm:text-base font-black leading-normal text-slate-50">
 עבור <InlineMath math={`Z = ${lookupZ.toFixed(2)}`} /> התקבלה הסתברות <InlineMath math={`\\Phi(z) = ${normalCDF(lookupZ, 0, 1).toFixed(4)}`} />
 </div>
 </div>
 </div>
 <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-800 shadow-sm">
 <div className="flex flex-col text-center">
 <span className="text-[10px] text-slate-400 font-bold">שורה</span>
 <span className="font-black text-sm text-slate-200">{rowVal?.toFixed(1)}</span>
 </div>
 <div className="w-px h-6 bg-slate-200 bg-slate-800" />
 <div className="flex flex-col text-center">
 <span className="text-[10px] text-slate-400 font-bold">עמודה</span>
 <span className="font-black text-sm text-slate-200">{colVal?.toFixed(2).slice(2)}</span>
 </div>
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
};

const TTable: React.FC<{}> = () => {
 const [isTGuideOpen, setIsTGuideOpen] = useState<boolean>(false);
 const [tDf, setTDf] = useState<number>(10);
 const [tAlpha, setTAlpha] = useState<number>(0.05);
 const [tSide, setTSide] = useState<'two'>('two');

 const dfList = useMemo(() => [
 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 
 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 
 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 
 40, 50, 60, 80, 100, 120, 500
 ], []);

 const tCols = useMemo(() => [
 { oneTail: 0.10, twoTail: 0.20 },
 { oneTail: 0.05, twoTail: 0.10 },
 { oneTail: 0.025, twoTail: 0.05 },
 { oneTail: 0.01, twoTail: 0.02 },
 { oneTail: 0.005, twoTail: 0.01 },
 { oneTail: 0.0005, twoTail: 0.001 }
 ], []);

 const computedTCritical = useMemo(() => {
 if (tDf <= 0 || isNaN(tDf)) return null;
 const targetP = tSide ==='two' ? 1 - (tAlpha / 2) : 1 - tAlpha;
 if (targetP <= 0 || targetP >= 1 || isNaN(targetP)) return null;
 return studentTInverseCDF(targetP, tDf);
 }, [tDf, tAlpha, tSide]);

 const renderTTableSection = () => (
 <div dir="ltr" className="overflow-auto rounded-xl border border-slate-800 max-h-[480px]">
 <table className="w-full text-xs sm:text-sm border-collapse">
 <thead>
 <tr className="bg-slate-800 text-slate-400">
 <th rowSpan={2} className="sticky top-0 left-0 p-3 border border-slate-700 text-indigo-400 font-black text-center text-xs sm:text-sm w-16 bg-slate-800 z-30">
 דרגות חופש <br/> (df)
 </th>
 <th colSpan={6} className="sticky top-0 p-1.5 border-b border-slate-705 font-extrabold text-center text-xs bg-slate-800 z-20">
 רמת מובהקות עבור התפלגות T
 </th>
 </tr>
 <tr className="bg-slate-800 text-slate-400">
 {tCols.map((c, idx) => {
 const isActiveCol = (tSide ==='two' && Math.abs(tAlpha - c.twoTail) < 0.0001);
 return (
 <th
 key={idx}
 className={`sticky top-0 p-2.5 border border-slate-700 font-bold text-center transition-colors min-w-[70px] z-20 ${
 isActiveCol
 ?'bg-indigo-600 text-white bg-indigo-600'
 :'bg-slate-800'
 }`}
 >
 <div className="text-[10px] opacity-75">חד-צדדי: {c.oneTail}</div>
 <div className="text-xs">דו-צדדי: {c.twoTail}</div>
 </th>
 );
 })}
 </tr>
 </thead>
 <tbody>
 {dfList.map(df => {
 const isRowActive = df === tDf;
 return (
 <tr key={df} className={`transition-colors duration-200 ${
 isRowActive 
 ?'bg-indigo-950/20' 
 :'hover:bg-slate-800/20'
 }`}>
 <td className={`sticky left-0 p-2.5 border border-slate-700 font-black text-center text-xs sm:text-sm transition-colors duration-300 z-10 ${
 isRowActive 
 ?'bg-indigo-600 text-white bg-indigo-500' 
 :'text-slate-200 bg-slate-900'
 }`}>
 {df === 500 ?'∞ (Z)' : df}
 </td>
 {tCols.map((c, colIdx) => {
 const val = studentTInverseCDF(1 - c.oneTail, df);
 const isActiveCol = (tSide ==='two' && Math.abs(tAlpha - c.twoTail) < 0.0001);
 const isActive = isRowActive && isActiveCol;

 return (
 <td
 key={colIdx}
 className={`p-2.5 border border-slate-700 text-center transition-all duration-300 tabular-nums ${
 isActive 
 ?'bg-indigo-600 text-white bg-indigo-600 font-black scale-102 shadow-lg z-10 relative rounded-md' 
 : isRowActive
 ?'bg-indigo-100/40 text-indigo-900 bg-indigo-900/20 text-indigo-300 font-semibold'
 : isActiveCol
 ?'bg-indigo-50/60 text-indigo-900 bg-indigo-950/20 text-indigo-300 font-semibold'
 :'text-slate-350 hover:bg-slate-800 font-medium'
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
 <div className="overflow-hidden border rounded-3xl shadow-xl transition-all bg-slate-900 border-slate-800" dir="rtl">
 <div className="p-6 space-y-4">
 <div className="flex flex-col gap-3 border-b pb-3 border-slate-800">
 <div>
 <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
 <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
 טבלת T קריטית (התפלגות Student's t)
 </h3>
 </div>
 
 <div className="flex flex-wrap items-center gap-2.5">
 <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 px-2 rounded-xl text-xs max-w-full shrink-0 shadow-sm">
 <div className="flex items-center gap-1 font-semibold text-slate-300">
 <span>בדיקה:</span>
 <select 
 value={tSide}
 onChange={(e) => setTSide(e.target.value as'one' |'two')}
 style={{ fontSize:'15.6px' }}
 className="px-1.5 py-0.5 border border-slate-700 bg-slate-800 rounded font-bold cursor-pointer text-xs text-indigo-400 animate-none"
 >
 <option value="two">דו-צדדית</option>
 <option value="one">חד-צדדית</option>
 </select>
 </div>

 <div className="h-4 w-px bg-slate-200 bg-slate-800" />

 <div className="flex items-center gap-1 text-slate-300">
 <span className="font-bold">df:</span>
 <input 
 type="number" 
 min="1" 
 max="500" 
 value={tDf}
 onChange={(e) => setTDf(Math.max(1, parseInt(e.target.value) || 10))}
 style={{ width:'51px', fontFamily:'Assistant, sans-serif', fontSize:'15.6px' }}
 className="px-1 py-0.5 border border-slate-700 bg-slate-800 rounded font-bold font-mono text-center text-indigo-400 animate-none"
 />
 </div>

 <div className="h-4 w-px bg-slate-200 bg-slate-800" />

 <div className="flex items-center gap-1 text-slate-300">
 <span className="font-bold">אלפא (α):</span>
 <select 
 value={tAlpha}
 onChange={(e) => setTAlpha(parseFloat(e.target.value))}
 style={{ fontFamily:'Assistant, sans-serif', fontSize:'15.6px' }}
 className="px-1.5 py-0.5 border border-slate-700 bg-slate-800 rounded font-bold font-mono text-center text-indigo-400 cursor-pointer text-xs"
 >
 <option value={0.20}>0.20</option>
 <option value={0.10}>0.10</option>
 <option value={0.05}>0.05</option>
 <option value={0.02}>0.02</option>
 <option value={0.01}>0.01</option>
 <option value={0.002}>0.002</option>
 <option value={0.001}>0.001</option>
 </select>
 </div>

 {computedTCritical !== null && (
 <>
 <div className="h-4 w-px bg-slate-200 bg-slate-800" />
 <div 
 style={{ fontSize:'15.6px' }}
 className="flex items-center gap-1 bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-lg select-all tabular-nums text-xs border border-indigo-700 shadow-sm" 
 dir="ltr"
 >
 <span className="opacity-85 mr-1 text-[10px]">t_crit =</span>
 <span>{computedTCritical.toFixed(4)}</span>
 </div>
 </>
 )}
 </div>

 <button
 type="button"
 onClick={() => setIsTGuideOpen(!isTGuideOpen)}
 className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1 cursor-pointer text-xs font-semibold text-slate-300 border border-slate-700"
 >
 <BookOpen size={13} className="text-indigo-500" />
 <span>איך לנווט בטבלה?</span>
 <ChevronDown 
 size={12} 
 className={`transition-transform duration-300 ${isTGuideOpen ?'rotate-180' :''}`} 
 />
 </button>
 </div>
 </div>

 <AnimatePresence initial={false}>
 {isTGuideOpen && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2, ease:'easeInOut' }}
 className="overflow-hidden"
 >
 <div className="p-4 bg-slate-900/10 border border-slate-800/60 rounded-xl text-right">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
 <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold flex-1">
 דרגות החופש (df) מופיעות <strong>בשורה האנכית הימנית</strong>, ואילו רמות המובהקות (<InlineMath math="\alpha" /> חד-צדדי או דו-צדדי) מופיעות <strong>בראש העמודות</strong>. 
 מפגש השורה והעמודה נותן את ערך ה-T הפיזי הקריטי המבוקש.
 </p>
 <div className="text-sm bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/15 text-indigo-300 whitespace-nowrap md:self-center shrink-0" dir="rtl">
 דוגמה: עבור <InlineMath math="df = 10" /> ובדיקה דו-צדדית עם <InlineMath math="\alpha = 0.05" />, נקבל ערך קריטי של <InlineMath math="t = 2.2281" />.
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {renderTTableSection()}
 </div>
 </div>
 );
};

export default function NormalDistributionCalculator() {
 const [mode, setMode] = useState<CalcMode>('forward');
 const [isInputPanelOpen, setIsInputPanelOpen] = useState<boolean>(true);
 const [mean, setMean] = useState<number>(170);
 const [meanInput, setMeanInput] = useState<string>('170');
 const [meanError, setMeanError] = useState<string | null>(null);

 const [stdDev, setStdDev] = useState<number>(5);
 const [stdDevInput, setStdDevInput] = useState<string>('5');
 const [stdDevError, setStdDevError] = useState<string | null>(null);
 const [varianceInput, setVarianceInput] = useState<string>('25');
 const [varianceError, setVarianceError] = useState<string | null>(null);

 const [type, setType] = useState<CalcType>('below');
 const [inverseType, setInverseType] = useState<'lower' |'upper'>('lower');
 
 const [x1, setX1] = useState<number>(165);
 const [x2, setX2] = useState<number>(175);
 const [condType, setCondType] = useState<CondType>('above');
 const [condTypeA, setCondTypeA] = useState<CondType>('below');
 const [condX1, setCondX1] = useState<number>(160);
 const [condX2, setCondX2] = useState<number>(180);
 const [percentile, setPercentile] = useState<number>(90);



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
 setVarianceInput('');
 setVarianceError('שדה חובה');
 } else if (isNaN(parsed)) {
 setStdDevError('אנא הזן מספר תקין');
 setVarianceInput('');
 setVarianceError('אנא הזן מספר תקין');
 } else if (parsed <= 0) {
 setStdDevError('סטיית התקן חייבת להיות גדולה מ-0 בלבד!');
 setVarianceInput('');
 setVarianceError('השונות חייבת להיות גדולה מ-0 בלבד!');
 } else {
 setStdDevError(null);
 setStdDev(parsed);
 const computedVar = parsed * parsed;
 setVarianceInput(parseFloat(computedVar.toFixed(6)).toString());
 setVarianceError(null);
 }
 };

 const handleVarianceChange = (val: string) => {
 setVarianceInput(val);
 const parsed = parseFloat(val);
 if (val.trim() === '') {
 setVarianceError('שדה חובה');
 setStdDevInput('');
 setStdDevError('שדה חובה');
 } else if (isNaN(parsed)) {
 setVarianceError('אנא הזן מספר תקין');
 setStdDevInput('');
 setStdDevError('אנא הזן מספר תקין');
 } else if (parsed <= 0) {
 setVarianceError('השונות חייבת להיות גדולה מ-0 בלבד!');
 setStdDevInput('');
 setStdDevError('סטיית התקן חייבת להיות גדולה מ-0 בלבד!');
 } else {
 setVarianceError(null);
 const computedStdDev = Math.sqrt(parsed);
 setStdDev(computedStdDev);
 setStdDevInput(parseFloat(computedStdDev.toFixed(6)).toString());
 setStdDevError(null);
 }
 };

 // Quick validations check before processing
 const isValidToCalculate = useMemo(() => {
 return stdDev > 0 && !isNaN(mean) && !stdDevError && !meanError && !varianceError;
 }, [stdDev, mean, stdDevError, meanError, varianceError]);

 const result = useMemo((): CalculationResult => {
 if (!isValidToCalculate) {
 return { probability: 0, z1: 0, steps: [] };
 }

 const steps: string[] = [];
 steps.push(`נתוני ההתפלגות שלנו: [MATH]\\mu = ${mean}, \\sigma = ${stdDev}[/MATH]`);

 if (mode ==='inverse') {
 const pInput = percentile / 100;
 const pLookup = inverseType ==='lower' ? pInput : 1 - pInput;
 const z = inverseNormalCDF(pLookup);
 const calculatedX = mean + z * stdDev;
 
 steps.push(`נבצע חישוב הפוך למציאת ערך X לפי אחוזון ${inverseType ==='lower' ?'תחתון' :'עליון'} של ${percentile}%:`);
 
 if (inverseType ==='lower') {
 steps.push(`שלב 1: נמצא את ספרת ה-Z המתאימה להסתברות השטח משמאל [MATH]P(X < x) = ${pLookup.toFixed(4)}[/MATH] מתוך טבלת ה-Z המותאמת:`);
 } else {
 steps.push(`שלב 1: אנו מחפשים שטח מימין הגדול מ-[MATH]${pInput.toFixed(4)}[/MATH].`);
 steps.push(`נוסחה שקולה לשטח המשלים משמאל: [MATH]1 - ${pInput.toFixed(4)} = ${pLookup.toFixed(4)}[/MATH].`);
 steps.push(`נאתר את ה-Z המתאים ל-[MATH]P(X < x) = ${pLookup.toFixed(4)}[/MATH] בטבלה:`);
 }
 
 steps.push(`[MATH]Z = \\Phi^{-1}(${pLookup.toFixed(4)}) = ${z.toFixed(4)}[/MATH]`);
 steps.push(`שלב 2: נשתמש בנוסחת הקשר הפיזי (טרנספורמציה הפוכה) של ציון תקנון למציאת [MATH]X[/MATH]:`);
 steps.push(`[MATH]X = \\mu + Z \\cdot \\sigma[/MATH]`);
 steps.push(`נציג מילוי של הנתונים שלנו:`);
 steps.push(`[MATH]X = ${mean} + (${z.toFixed(4)}) \\cdot ${stdDev}[/MATH]`);
 steps.push(`[MATH]X = ${calculatedX.toFixed(4)}[/MATH]`);
 steps.push(`תוצאה סופית: ערך ה-X המבוקש התואם לאחוזון הוא [MATH]X = ${calculatedX.toFixed(4)}[/MATH]`);
 
 return { probability: pInput, z1: z, steps, calculatedX };
 }

 const z1 = (x1 - mean) / stdDev;
 const z2 = (x2 - mean) / stdDev;
 let prob = 0;

 switch (type) {
 case'below':
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
 
 case'above':
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

 case'between':
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

 case'outside':
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

 case'conditional':
 const getRangeBounds = (t: string, v1: number, v2: number): [number, number] => {
 if (t ==='below') return [-Infinity, v1];
 if (t ==='above') return [v1, Infinity];
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
 
 if (condType ==='below') probB = normalCDF(condX1, mean, stdDev);
 else if (condType ==='above') probB = 1 - normalCDF(condX1, mean, stdDev);
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
 if (t ==='below') return `X < ${v1}`;
 if (t ==='above') return `X > ${v1}`;
 return `${v1} < X < ${v2}`;
 };

 steps.push(`המאורעות בהם אנו דנים:`);
 steps.push(`[MATH]A (\\text{המטרה}): ${getDescText(condTypeA, x1, x2)}[/MATH]`);
 steps.push(`[MATH]B (\\text{התנאי}): ${getDescText(condType, condX1, condX2)}[/MATH]`);

 steps.push(`שלב 1: נחשב תחילה את ההסתברות המוחלטת של התנאי [MATH]P(B)[/MATH]:`);
 if (condType ==='below') {
 steps.push(`[MATH]Z_{B} = \\frac{${condX1} - ${mean}}{${stdDev}} = ${zB2.toFixed(4)}[/MATH]`);
 steps.push(`[MATH]P(B) = P(X < ${condX1}) = \\Phi(${zB2.toFixed(4)}) = ${probB.toFixed(4)}[/MATH]`);
 } else if (condType ==='above') {
 steps.push(`[MATH]Z_{B} = \\frac{${condX1} - ${mean}}{${stdDev}} = ${zB1.toFixed(4)}[/MATH]`);
 steps.push(`[MATH]P(B) = P(X > ${condX1}) = 1 - \\Phi(${zB1.toFixed(4)}) = ${probB.toFixed(4)}[/MATH]`);
 } else {
 steps.push(`[MATH]Z_{B1} = \\frac{${condX1} - ${mean}}{${stdDev}} = ${zB1.toFixed(4)}[/MATH]`);
 steps.push(`[MATH]Z_{B2} = \\frac{${condX2} - ${mean}}{${stdDev}} = ${zB2.toFixed(4)}[/MATH]`);
 steps.push(`[MATH]P(B) = \\Phi(${zB2.toFixed(4)}) - \\Phi(${zB1.toFixed(4)}) = ${probB.toFixed(4)}[/MATH]`);
 }

 steps.push(`שלב 2: נחשב את הסתברות החיתוך המשותף [MATH]P(A \\cap B)[/MATH]:`);
 
 if (intersectStart < intersectEnd) {
 steps.push(`טווח החיתוך המשותף שמתקבל: [MATH]${intersectStart === -Infinity ?'(-\\infty' : intersectStart} < X < ${intersectEnd === Infinity ?'\\infty)' : intersectEnd}[/MATH]`);
 
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

 const inputSummaryText = useMemo(() => {
 if (mode ==='forward') {
 let typeName ='';
 let xRange ='';
 switch (type) {
 case'below':
 typeName ='הסתברות מתחת ל-X';
 xRange = `X = ${x1}`;
 break;
 case'above':
 typeName ='הסתברות מעל ל-X';
 xRange = `X = ${x1}`;
 break;
 case'between':
 typeName ='הסתברות בין ערכים';
 xRange = `${x1} ≤ X ≤ ${x2}`;
 break;
 case'outside':
 typeName ='הסתברות מחוץ לטווח';
 xRange = `X < ${x1} או X > ${x2}`;
 break;
 case'conditional':
 typeName ='הסתברות מותנה';
 xRange ='מותנה מראש';
 break;
 }
 return `תוחלת: μ = ${mean}, ס.תקן: σ = ${stdDev} | ${typeName} (${xRange})`;
 } else if (mode ==='inverse') {
 const side = inverseType ==='lower' ?'מצטבר משמאל' :'מצטבר מימין';
 return `תוחלת: μ = ${mean}, ס.תקן: σ = ${stdDev} | אחוזון ${percentile}% (${side})`;
 }
 return '';
 }, [mode, mean, stdDev, type, x1, x2, inverseType, percentile]);

 return (
 <div className="min-h-screen font-sans selection:bg-blue-200 transition-colors duration-300 bg-slate-950 text-slate-100" dir="rtl">
 
 {/* Header */}
 <header className="border-b sticky top-0 z-40 transition-colors shadow-sm bg-slate-900 border-slate-800">
 <div className="w-full mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
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

 
 <div className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-400">
 <Info size={14} className="text-blue-500" />
 <span>גרסאות למידה</span>
 </div>
 </div>
 </div>
 </header>

 <main className="w-full py-8">
 <div className="w-full mx-auto px-4 md:px-8">
 
 {/* Navigation/Modes Tabs */}
 <div className="p-1 rounded-2xl border shadow-inner mb-6 flex flex-wrap transition-all gap-1 bg-slate-900 border-slate-800">
 <button
 onClick={() => setMode('forward')}
 className={`flex-1 min-w-[124px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
 mode ==='forward' 
 ?'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
 :'text-slate-400 hover:bg-slate-800/80'
 }`}
 >
 חישוב הסתברות (X ← P)
 </button>
 <button
 onClick={() => setMode('inverse')}
 className={`flex-1 min-w-[124px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
 mode ==='inverse' 
 ?'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
 :'text-slate-400 hover:bg-slate-800/80'
 }`}
 >
 חישוב הפוך (אחוזון → X)
 </button>
 <button
 onClick={() => setMode('table')}
 className={`flex-1 min-w-[124px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
 mode ==='table' 
 ?'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
 :'text-slate-400 hover:bg-slate-800/80'
 }`}
 >
 טבלת Z מלאה
 </button>
 <button
 onClick={() => setMode('hypothesis')}
 className={`flex-1 min-w-[124px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
 mode ==='hypothesis' 
 ?'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
 :'text-slate-400 hover:bg-slate-800/80'
 }`}
 >
 מחשבון בדיקת השערות
 </button>
 <button
 onClick={() => setMode('formula-sheet')}
 className={`flex-1 min-w-[124px] py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
 mode ==='formula-sheet' 
 ?'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
 :'text-slate-400 hover:bg-slate-800/80'
 }`}
 >
 דף נוסחאות בסטטיסטיקה
 </button>
 </div>

 {/* Notation Header Banner */}
 {mode !=='hypothesis' && mode !=='formula-sheet' && mode !=='table' && (
 <div className="space-y-8 w-full">
 
 {/* Left Column Input Panel Layout */}
 <section className="w-full space-y-6">
 <div className="rounded-2xl border shadow-sm transition-all overflow-visible relative z-10 bg-slate-900 border-slate-800">
 {/* Accordion Toggle Bar */}
 <button
 type="button"
 onClick={() => setIsInputPanelOpen(!isInputPanelOpen)}
 className="w-full text-right px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer bg-transparent outline-none border-b border-slate-800 pb-4"
 >
 <div className="flex flex-wrap items-center gap-3">
 <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
 <span className="font-extrabold text-sm sm:text-base text-slate-100">
 קלט נתונים ופרמטרי ההתפלגות (קליטת נתונים)
 </span>
 <span className="text-[11px] font-black px-2.5 py-1 rounded-full border shadow-sm transition-all bg-slate-800 border-slate-700 text-blue-300">
 {inputSummaryText}
 </span>
 </div>
 
 <div className="flex items-center gap-2 text-xs font-bold text-slate-400 self-end sm:self-auto">
 <span>{isInputPanelOpen ?'הסתר פאנל קלט' :'הצג פאנל קלט'}</span>
 <ChevronDown 
 size={15} 
 className={`transition-transform duration-300 ${isInputPanelOpen ?'rotate-180' :''}`} 
 />
 </div>
 </button>

 <AnimatePresence initial={true}>
 {isInputPanelOpen && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.25 }}
 className="p-6 font-sans"
 style={{ overflow: isInputPanelOpen ?'visible' :'hidden' }}
 >
 <div className="w-full">
 <AnimatePresence mode="wait">
 {mode ==='forward' ? (
 <motion.div
 key="forward-grid"
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.2 }}
 className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
 >
 {/* Column 1: Params */}
 <div className="space-y-4">
 <h3 className="text-xs sm:text-sm font-black text-slate-400 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded bg-blue-500" />
 פרמטרי ההתפלגות
 </h3>
 
 {/* Mean */}
 <div className="space-y-1">
 <Tooltip content="הערך המרכזי של פעמון ההתפלגות (התוחלת)">
 <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-705">תוחלת (μ):</label>
 </Tooltip>
 <input 
 type="text" 
 value={meanInput} 
 onChange={(e) => handleMeanChange(e.target.value)}
 className={`w-full px-4 py-2 bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-100 ${
 meanError 
 ?'border-red-500 text-red-500 ring-4 ring-red-500/10' 
 :'border-slate-700/80 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
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

 {/* SD & Var */}
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1">
 <Tooltip content="מדד הפיזור של הערכים סביב הממוצע (חייב להיות חיובי וגדול מ-0)">
 <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-705">סטיית תקן (σ):</label>
 </Tooltip>
 <input 
 type="text" 
 value={stdDevInput} 
 onChange={(e) => handleStdDevChange(e.target.value)}
 className={`w-full px-3 py-2 bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-100 ${
 stdDevError 
 ?'border-red-500 text-red-500 ring-4 ring-red-500/10' 
 :'border-slate-700/80 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
 }`}
 placeholder="סטיית תקן"
 />
 {stdDevError && (
 <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
 <AlertCircle size={10} className="stroke-[2.5]" />
 <span>{stdDevError}</span>
 </p>
 )}
 </div>

 <div className="space-y-1">
 <Tooltip content="שונות ההתפלגות (σ²), מחושבת ישירות כריבוע סטיית התקן">
 <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-705">שונות (σ²):</label>
 </Tooltip>
 <input 
 type="text" 
 value={varianceInput} 
 onChange={(e) => handleVarianceChange(e.target.value)}
 className={`w-full px-3 py-2 bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-100 ${
 varianceError 
 ?'border-red-500 text-red-500 ring-4 ring-red-500/10' 
 :'border-slate-700/80 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
 }`}
 placeholder="שונות"
 />
 {varianceError && (
 <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
 <AlertCircle size={10} className="stroke-[2.5]" />
 <span>{varianceError}</span>
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Column 2: Event Choice */}
 <div className="space-y-4">
 <h3 className="text-xs sm:text-sm font-black text-slate-400 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded bg-blue-500" />
 מאורע / סוג החישוב
 </h3>
 <div className="flex flex-col gap-1.5 w-full">
 {[
 { id:'below', label:'מתחת ל- X' },
 { id:'above', label:'מעל ל- X' },
 { id:'between', label:'בין X₁ ל- X₂' },
 { id:'outside', label:'מחוץ לטווח' },
 { id:'conditional', label:'מותנה מראש' }
 ].map((item) => (
 <button
 key={item.id}
 type="button"
 onClick={() => setType(item.id as CalcType)}
 className={`w-full py-2 px-3 text-xs font-black rounded-lg transition-all border text-right flex items-center justify-between cursor-pointer ${
 type === item.id 
 ?'bg-blue-600 text-white border-blue-600 shadow-sm' 
 :'bg-slate-850 text-slate-350 border-slate-800 hover:bg-slate-800'
 }`}
 >
 <span>{item.label}</span>
 {type === item.id && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
 </button>
 ))}
 </div>
 </div>

 {/* Column 3: Bounds and Limits */}
 <div className="space-y-4 opacity-100">
 <h3 className="text-xs sm:text-sm font-black text-slate-400 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded bg-blue-500" />
 ערכי גבולות וקלט
 </h3>
 
 {type ==='conditional' ? (
 <div className="p-3 bg-slate-850/60 rounded-xl border border-slate-800 space-y-3">
 <div className="space-y-1.5">
 <h4 className="text-[11px] font-black text-blue-500 leading-none">מאורע A (ההסתברות המבוקשת)</h4>
 <select 
 value={condTypeA}
 onChange={(e) => setCondTypeA(e.target.value as CondType)}
 className="w-full p-1.5 text-xs bg-slate-800 border rounded-lg outline-none font-bold text-slate-100"
 >
 <option value="below">X &lt; x</option>
 <option value="above">X &gt; x</option>
 <option value="between">x1 &lt; X &lt; x2</option>
 </select>
 <div className="grid grid-cols-2 gap-1.5">
 <input 
 type="number" 
 value={x1}
 onChange={(e) => setX1(Number(e.target.value))}
 className="p-1.5 text-xs font-bold border rounded-lg outline-none bg-slate-800 text-slate-100"
 placeholder="x1"
 />
 {condTypeA ==='between' && (
 <input 
 type="number" 
 value={x2}
 onChange={(e) => setX2(Number(e.target.value))}
 className="p-1.5 text-xs font-bold border rounded-lg outline-none bg-slate-800 text-slate-100"
 placeholder="x2"
 />
 )}
 </div>
 </div>
 
 <div className="space-y-1.5 border-t pt-2 border-slate-800">
 <h4 className="text-[11px] font-black text-emerald-500 leading-none">מאורע B (התנאי הנתון)</h4>
 <select 
 value={condType}
 onChange={(e) => setCondType(e.target.value as CondType)}
 className="w-full p-1.5 text-xs bg-slate-800 border rounded-lg outline-none font-bold text-slate-100"
 >
 <option value="below">X &lt; x</option>
 <option value="above">X &gt; x</option>
 <option value="between">x1 &lt; X &lt; x2</option>
 </select>
 <div className="grid grid-cols-2 gap-1.5">
 <input 
 type="number" 
 value={condX1}
 onChange={(e) => setCondX1(Number(e.target.value))}
 className="p-1.5 text-xs font-bold border rounded-lg outline-none bg-slate-800 text-slate-100"
 placeholder="x1"
 />
 {condType ==='between' && (
 <input 
 type="number" 
 value={condX2}
 onChange={(e) => setCondX2(Number(e.target.value))}
 className="p-1.5 text-xs font-bold border rounded-lg outline-none bg-slate-800 text-slate-100"
 placeholder="x2"
 />
 )}
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="space-y-1">
 <label className="text-xs font-black text-slate-400 block pb-1">
 {type ==='between' || type ==='outside' ?'גבול תחתון X₁' :'ערך משתנה X:'}
 </label>
 <input 
 type="number" 
 value={x1}
 onChange={(e) => setX1(Number(e.target.value))}
 className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none font-mono font-bold text-sm text-slate-100"
 />
 </div>
 { (type ==='between' || type ==='outside') && (
 <div className="space-y-1">
 <label className="text-xs font-black text-slate-400 block pb-1">גבול עליון X₂:</label>
 <input 
 type="number" 
 value={x2}
 onChange={(e) => setX2(Number(e.target.value))}
 className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none font-mono font-bold text-sm text-slate-100"
 />
 </div>
 )}
 </div>
 )}
 </div>
 </motion.div>
 ) : (
 <motion.div
 key="inverse-grid"
 initial={{ opacity: 0, y: 5 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -5 }}
 transition={{ duration: 0.2 }}
 className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
 >
 {/* Column 1: Params */}
 <div className="space-y-4">
 <h3 className="text-xs sm:text-sm font-black text-slate-400 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded bg-blue-500" />
 פרמטרי ההתפלגות
 </h3>
 
 {/* Mean */}
 <div className="space-y-1">
 <Tooltip content="הערך המרכזי של פעמון ההתפלגות (התוחלת)">
 <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-705">תוחלת (μ):</label>
 </Tooltip>
 <input 
 type="text" 
 value={meanInput} 
 onChange={(e) => handleMeanChange(e.target.value)}
 className={`w-full px-4 py-2 bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-100 ${
 meanError 
 ?'border-red-500 text-red-500 ring-4 ring-red-500/10' 
 :'border-slate-700/80 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
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

 {/* SD & Var */}
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-1">
 <Tooltip content="מדד הפיזור של הערכים סביב הממוצע (חייב להיות חיובי וגדול מ-0)">
 <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-705">סטיית תקן (σ):</label>
 </Tooltip>
 <input 
 type="text" 
 value={stdDevInput} 
 onChange={(e) => handleStdDevChange(e.target.value)}
 className={`w-full px-3 py-2 bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-100 ${
 stdDevError 
 ?'border-red-500 text-red-500 ring-4 ring-red-500/10' 
 :'border-slate-700/80 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
 }`}
 placeholder="סטיית תקן"
 />
 {stdDevError && (
 <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
 <AlertCircle size={10} className="stroke-[2.5]" />
 <span>{stdDevError}</span>
 </p>
 )}
 </div>

 <div className="space-y-1">
 <Tooltip content="שונות ההתפלגות (σ²), מחושבת ישירות כריבוע סטיית התקן">
 <label className="text-xs font-black text-slate-400 ml-1 cursor-help border-b border-dotted border-slate-705">שונות (σ²):</label>
 </Tooltip>
 <input 
 type="text" 
 value={varianceInput} 
 onChange={(e) => handleVarianceChange(e.target.value)}
 className={`w-full px-3 py-2 bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-slate-100 ${
 varianceError 
 ?'border-red-500 text-red-505 ring-4 ring-red-500/10' 
 :'border-slate-700/80 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500'
 }`}
 placeholder="שונות"
 />
 {varianceError && (
 <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 mt-1">
 <AlertCircle size={10} className="stroke-[2.5]" />
 <span>{varianceError}</span>
 </p>
 )}
 </div>
 </div>
 </div>

 {/* Column 2: Percentile Type */}
 <div className="space-y-4">
 <h3 className="text-xs sm:text-sm font-black text-slate-400 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded bg-blue-500" />
 סוג האחוזון
 </h3>
 <div className="flex flex-col gap-2 w-full">
 <button
 type="button"
 onClick={() => setInverseType('lower')}
 className={`w-full py-2 px-3 text-xs font-black rounded-lg transition-all border text-right flex items-center justify-between cursor-pointer ${
 inverseType ==='lower' 
 ?'bg-blue-600 text-white border-blue-600 shadow-sm' 
 :'bg-slate-850 text-slate-505 border-slate-800 hover:bg-slate-100'
 }`}
 >
 <span>אחוזון מצטבר משמאל</span>
 {inverseType ==='lower' && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
 </button>
 <button
 type="button"
 onClick={() => setInverseType('upper')}
 className={`w-full py-2 px-3 text-xs font-black rounded-lg transition-all border text-right flex items-center justify-between cursor-pointer ${
 inverseType ==='upper' 
 ?'bg-blue-600 text-white border-blue-600 shadow-sm' 
 :'bg-slate-850 text-slate-505 border-slate-800 hover:bg-slate-100'
 }`}
 >
 <span>אחוזון מצטבר מימין</span>
 {inverseType ==='upper' && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
 </button>
 </div>
 </div>

 {/* Column 3: Percentile Value */}
 <div className="space-y-4">
 <h3 className="text-xs sm:text-sm font-black text-slate-400 flex items-center gap-1.5">
 <span className="w-1.5 h-1.5 rounded bg-blue-500" />
 ערך האחוזון (P)
 </h3>
 <div className="space-y-1">
 <div className="relative">
 <input 
 type="number" 
 value={percentile} 
 min="0.01"
 max="99.99"
 step="0.01"
 onChange={(e) => setPercentile(Math.min(99.99, Math.max(0.01, Number(e.target.value))))}
 className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl outline-none font-mono font-bold text-sm pl-10 text-slate-100"
 />
 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
 </div>
 <p className="text-[10px] text-slate-400">הזן הסתברות בין 0.01% ל-99.99%.</p>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 </section>

 {/* Right Column Visualization & Step Breakdown */}
 <section className="w-full space-y-8">
 
 {/* Dynamically Styled Math steps */}
 <div className="rounded-2xl p-6 border shadow-sm transition-colors bg-slate-900 border-slate-800">
 <h2 className="text-base font-black mb-4 flex items-center gap-2 border-b pb-3 border-slate-800">
 <Calculator size={16} className="text-blue-500" />
 שלבי פתרון מתמטיים מפורטים
 </h2>
 
 {isValidToCalculate ? (
 <div className="space-y-4">
 {stepGroups.map((group, idx) => (
 <div key={idx} className="flex gap-4 items-start text-right">
 <div className="w-7 h-7 rounded-full bg-blue-900/20 border border-blue-100 border-blue-900 flex items-center justify-center text-xs font-black text-blue-400 shrink-0 mt-0.5">
 {idx + 1}
 </div>
 <div className="flex-1 space-y-2 w-full">
 {group.map((step, sIdx) => (
 <FormattedStep key={sIdx} text={step} />
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
 <div className="rounded-2xl p-6 border shadow-sm transition-colors bg-slate-900 border-slate-800">
 <NormalChart 
 mean={mean} 
 stdDev={stdDev} 
 type={mode ==='inverse' ? (inverseType ==='lower' ?'below' :'above') : type} 
 x1={mode ==='inverse' ? (result.calculatedX ?? 0) : x1} 
 x2={x2} 
 condType={condType}
 condTypeA={condTypeA}
 condX1={condX1}
 condX2={condX2}
 probability={result.probability}
 mode={mode}

 />
 </div>

 </section>

 {/* Z-Table Lookup helper links right beneath the core loop */}
 {isValidToCalculate && (result.z1 !== undefined || result.z2 !== undefined) && (
 <div className="rounded-2xl p-5 border shadow-sm transition-colors bg-slate-900 border-slate-800">
 <h3 className="text-sm font-black mb-3 text-slate-400 flex items-center gap-1.5 leading-none">
 <Info size={14} className="text-blue-500" />
 איתור ציוני Z בטבלה
 </h3>
 <div className="space-y-6">
 <ZTable activeZ={result.z1} />
 {result.z2 !== undefined && <ZTable activeZ={result.z2} />}
 </div>
 </div>
 )}

 </div>
 )}

 {mode ==='hypothesis' && (
 <HypothesisTestingCalculator />
 )}

 {mode ==='formula-sheet' && (
 <FormulaSheet />
 )}

 {mode ==='table' && (
 <div className="space-y-8 w-full">
 <div className="rounded-2xl p-6 border shadow-sm transition-colors bg-slate-900 border-slate-800">
 <ZTable showSearch={true} />
 </div>

 <div className="rounded-2xl p-6 border shadow-sm transition-colors bg-slate-900 border-slate-800">
 <TTable />
 </div>
 </div>
 )}

 </div>
 </main>

 {/* Footer */}
 <footer className="w-full mx-auto px-4 md:px-8 py-12 text-center text-xs font-bold text-slate-400/80 tracking-wide border-t border-slate-800 mt-12">
 <p>© {new Date().getFullYear()} מחשבון התפלגות נורמלית מתקדם - פותח על ידי רוברט תיגר עבור סטודנטים</p>
 </footer>
 </div>
 );
}
