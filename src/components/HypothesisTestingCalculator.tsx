/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InlineMath, BlockMath } from 'react-katex';
import {
  Info,
  Calculator,
  RefreshCw,
  TrendingUp,
  Sliders,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CheckCircle,
  XCircle,
  BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  CartesianGrid,
  Legend
} from 'recharts';

// --- Probability Math Helpers ---

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 */
function normalCDF(x: number, mean: number, stdDev: number): number {
  if (stdDev <= 0) return 0.5;
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
 * Inverse Standard Normal Cumulative Distribution Function Z-score converter
 */
function inverseNormalCDF(p: number): number {
  if (p <= 0) return -4.5;
  if (p >= 1) return 4.5;

  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];

  const t = p < 0.5 ? Math.sqrt(-2.0 * Math.log(p)) : Math.sqrt(-2.0 * Math.log(1.0 - p));
  const z = t - ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1.0);

  return p < 0.5 ? -z : z;
}

/**
 * Lanczos approximation for the natural logarithm of the Gamma function ln(Γ(x))
 */
function lnGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j <= 5; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

/**
 * Student's t-distribution Probability Density Function (PDF)
 */
function studentTPDF(t: number, df: number): number {
  if (df > 250) {
    return normalPDF(t, 0, 1);
  }
  const logC = lnGamma((df + 1) / 2) - 0.5 * Math.log(df * Math.PI) - lnGamma(df / 2);
  const C = Math.exp(logC);
  return C * Math.pow(1 + (t * t) / df, -(df + 1) / 2);
}

/**
 * Student's t-distribution Cumulative Distribution Function (CDF)
 * Accurate closed form/trigonometric series representation for integer df
 */
function studentTCDF(t: number, df: number): number {
  if (df > 200) {
    return normalCDF(t, 0, 1);
  }
  
  const theta = Math.atan(t / Math.sqrt(df));
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  
  if (df % 2 === 0) {
    // df is even
    let sum = 0;
    let term = 1;
    for (let r = 1; r <= df / 2 - 1; r++) {
      term = term * (2 * r - 1) / (2 * r) * cos * cos;
      sum += term;
    }
    return 0.5 + 0.5 * sin * (1 + sum);
  } else {
    // df is odd
    let sum = 0;
    let term = 1;
    for (let r = 1; r <= (df - 3) / 2; r++) {
      term = term * (2 * r) / (2 * r + 1) * cos * cos;
      sum += term;
    }
    const multiplier = df === 1 ? 0 : sin * cos * (1 + sum);
    return 0.5 + theta / Math.PI + multiplier / Math.PI;
  }
}

/**
 * Initial guess of Inverse Student's t CDF using Cornish-Fisher expansion
 */
function studentTPPFInitial(p: number, df: number): number {
  const z = inverseNormalCDF(p);
  if (df > 500) return z;
  
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;
  
  const term1 = z;
  const term2 = (z3 + z) / (4 * df);
  const term3 = (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df);
  const term4 = (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * df * df * df);
  
  return term1 + term2 + term3 + term4;
}

/**
 * Student's t Percentage Point Function (Inverse CDF)
 * Uses high precision Cornish-Fisher guess refined with Newton-Raphson
 */
function studentTPPF(p: number, df: number): number {
  if (p <= 0.00001) return -10.0;
  if (p >= 0.99999) return 10.0;
  
  // 1. Initial guess using Cornish-Fisher expansion
  let t = studentTPPFInitial(p, df);
  
  // 2. Newton-Raphson refinement (3 steps is extremely stable and converges to ~14 decimal places)
  for (let i = 0; i < 3; i++) {
    const error = studentTCDF(t, df) - p;
    const derivative = studentTPDF(t, df);
    if (derivative === 0) break;
    t = t - error / derivative;
  }
  return t;
}

// --- Types ---
type TestType = 'single' | 'mean' | 'sum';
type TailType = 'right' | 'left' | 'two-tailed';

interface HTCalculatorProps {
  theme: 'light' | 'dark';
}

// --- Decision Matrix Helper Component ---
interface DecisionMatrixProps {
  theme: 'light' | 'dark';
  isValid: boolean;
  stats: any;
  alpha: number;
}

function DecisionMatrix({ theme, isValid, stats, alpha }: DecisionMatrixProps) {
  if (!isValid || !stats) {
    return (
      <div className="py-12 text-center text-slate-500 font-bold text-sm">
        נא להזין ערכי קלט תקינים להצגת מטריצת החלטה...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/25">
      <table className="w-full text-sm text-right border-collapse">
        <thead>
          <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-xs text-slate-800 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800">
            <th className="p-4 border-l border-slate-200 dark:border-slate-800 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-200/30 dark:bg-slate-800/25 w-1/4">החלטת המבחן</th>
            <th className="p-4 border-l border-slate-200 dark:border-slate-800 text-center font-black bg-blue-50/40 dark:bg-blue-900/10" style={{ minWidth: '180px' }}>H₀ נכונה במציאות (אין אפקט)</th>
            <th className="p-4 text-center font-black bg-amber-50/30 dark:bg-amber-900/10" style={{ minWidth: '180px' }}>H₁ נכונה במציאות (קיים אפקט)</th>
          </tr>
        </thead>
        <tbody>
          {/* Row 1: Fail to reject H0 (Accept H0) */}
          <tr className="border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-950 dark:text-slate-50">
            <td className="p-4 sm:p-5 border-l border-slate-200 dark:border-slate-800 font-extrabold bg-slate-100/30 dark:bg-slate-900/40">
              <span className="text-base font-black block">קבלת <InlineMath math="H_0" /></span>
              <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-400 mt-1">אי-דחיית השערת האפס</span>
            </td>
            
            {/* Cell 1-1: Accept H0 and H0 is true => Correct decision */}
            <td className="p-4 sm:p-5 border-l border-slate-200 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/35 dark:hover:bg-emerald-950/20 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 text-xs sm:text-sm">
                  <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400" />
                  החלטה נכונה
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400" dir="ltr">1 - α</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-2 text-emerald-800 dark:text-emerald-300">
                {((1 - alpha) * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
                רמת הסמך הסטטיסטית (Confidence Level) – הסיכוי לא לקפוץ למסקנות שווא כאשר ההשערה אינה נכונה.
              </p>
            </td>

            {/* Cell 1-2: Accept H0 but H1 is true => Type II Error Beta */}
            <td className="p-4 sm:p-5 bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/35 dark:hover:bg-amber-950/20 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-xs sm:text-sm">
                  <XCircle size={15} className="text-amber-600" />
                  טעות מסוג II
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400" dir="ltr">β (Beta)</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-2 text-amber-700 dark:text-amber-300">
                {(stats.beta * 100).toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
                קבלת השערת האפס אף על פי שהיא שקרית – החמצת גילוי של אפקט או הבדל קיים במציאות.
              </p>
            </td>
          </tr>

          {/* Row 2: Reject H0 */}
          <tr className="font-semibold text-slate-950 dark:text-slate-50">
            <td className="p-4 sm:p-5 border-l border-slate-200 dark:border-slate-800 font-extrabold bg-slate-100/30 dark:bg-slate-900/40">
              <span className="text-base font-black block">דחיית <InlineMath math="H_0" /></span>
              <span className="block text-[11px] font-bold text-slate-400 dark:text-slate-400 mt-1">קבלת הטענה האלטרנטיבית</span>
            </td>

            {/* Cell 2-1: Reject H0 and H0 is true => Type I Error Alpha */}
            <td className="p-4 sm:p-5 border-l border-slate-200 dark:border-slate-800 bg-red-50/20 dark:bg-red-950/10 hover:bg-red-50/35 dark:hover:bg-red-950/20 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-red-700 dark:text-red-400 flex items-center gap-1.5 text-xs sm:text-sm">
                  <XCircle size={15} className="text-red-600" />
                  טעות מסוג I
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400" dir="ltr">α (Alpha)</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-2 text-red-700 dark:text-red-300">
                {(alpha * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
                רמת המובהקות – הסיכוי לדחות בטעות את השערת האפס הנכונה, כלומר לטעון לקשר או אפקט שאינו קיים באמת.
              </p>
            </td>

            {/* Cell 2-2: Reject H0 and H1 is true => Correct decision Power! */}
            <td className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/30 to-emerald-50/30 dark:from-indigo-950/10 dark:to-emerald-950/10 hover:from-indigo-50/45 hover:to-emerald-50/45 dark:hover:from-indigo-950/15 dark:hover:to-emerald-950/15 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 text-xs sm:text-sm">
                  <CheckCircle size={15} className="text-indigo-600 dark:text-indigo-400" />
                  החלטה נכונה (עוצמה)
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400" dir="ltr">1 - β (Power)</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black mt-2 text-indigo-700 dark:text-indigo-400 tracking-tight">
                {(stats.power * 100).toFixed(2)}%
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
                עוצמת המבחן – ההסתברות של המחקר לזהות ולדחות השערה מוטעית, ובכך להוכיח את קיומו של אפקט אמיתי.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// --- Tooltip helper for Input Labels ---
interface InputTooltipProps {
  content: string;
  children: React.ReactNode;
  theme: 'light' | 'dark';
}

const InputTooltip: React.FC<InputTooltipProps> = ({ content, children, theme }) => {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

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

export default function HypothesisTestingCalculator({ theme }: HTCalculatorProps) {
  // Input states
  const [varianceKnown, setVarianceKnown] = useState<boolean>(true);

  const [mu0, setMu0] = useState<number>(100);
  const [mu0Input, setMu0Input] = useState<string>('100');
  
  const [mu1, setMu1] = useState<number>(108);
  const [mu1Input, setMu1Input] = useState<string>('108');

  const [sigma, setSigma] = useState<number>(15);
  const [sigmaInput, setSigmaInput] = useState<string>('15');

  const [n, setN] = useState<number>(36);
  const [nInput, setNInput] = useState<string>('36');

  const [alpha, setAlpha] = useState<number>(0.05);
  const [alphaInput, setAlphaInput] = useState<string>('0.05');

  const [testType, setTestType] = useState<TestType>('mean');
  const [tailType, setTailType] = useState<TailType>('right');

  const statSymbol = testType === 'single' ? 'X' : testType === 'sum' ? '\\sum X' : '\\bar{X}';
  const statName = testType === 'single' ? 'הערך הבודד' : testType === 'sum' ? 'סכום המדגם' : 'ממוצע המדגם';
  const statNamePlural = testType === 'single' ? 'ערכים בודדים' : testType === 'sum' ? 'סכומי מדגם' : 'ממוצעי מדגם';

  // Dynamic parameterized formal hypothesis
  const getFormalHypothesisMath = () => {
    let parameterSymbol = '\\mu';
    let h0Val = mu0Input;

    if (testType === 'sum') {
      parameterSymbol = 'E(\\sum X)';
      const parsedMu0 = parseFloat(mu0Input);
      const parsedN = parseInt(nInput, 10);
      if (!isNaN(parsedMu0) && !isNaN(parsedN)) {
        h0Val = (parsedN * parsedMu0).toString();
      } else {
        h0Val = 'n \\cdot \\mu_0';
      }
    }

    let h0Symbol = '=';
    let h1Symbol = '\\neq';

    if (tailType === 'right') {
      h0Symbol = '\\le';
      h1Symbol = '>';
    } else if (tailType === 'left') {
      h0Symbol = '\\ge';
      h1Symbol = '<';
    }

    return `H_0: ${parameterSymbol} ${h0Symbol} ${h0Val} \\quad \\text{vs.} \\quad H_1: ${parameterSymbol} ${h1Symbol} ${h0Val}`;
  };

  // Dynamic theoretical (general) formal hypothesis
  const getGeneralFormalHypothesisMath = () => {
    let parameterSymbol = '\\mu';
    if (testType === 'sum') {
      parameterSymbol = 'E(\\sum X)';
    }

    const nullValueSymbol = testType === 'sum' ? 'n \\cdot \\mu_0' : '\\mu_0';

    let h0Symbol = '=';
    let h1Symbol = '\\neq';

    if (tailType === 'right') {
      h0Symbol = '\\le';
      h1Symbol = '>';
    } else if (tailType === 'left') {
      h0Symbol = '\\ge';
      h1Symbol = '<';
    }

    return `H_0: ${parameterSymbol} ${h0Symbol} ${nullValueSymbol} \\quad \\text{vs.} \\quad H_1: ${parameterSymbol} ${h1Symbol} ${nullValueSymbol}`;
  };

  // Accordion state
  const [showSteps, setShowSteps] = useState<boolean>(true);

  // Error validations
  const errors = useMemo(() => {
    const errList: { [key: string]: string } = {};
    
    const parsedMu0 = parseFloat(mu0Input);
    if (mu0Input.trim() === '') errList.mu0 = 'שדה חובה';
    else if (isNaN(parsedMu0)) errList.mu0 = 'הזן מספר תקין';

    const parsedMu1 = parseFloat(mu1Input);
    if (mu1Input.trim() === '') errList.mu1 = 'שדה חובה';
    else if (isNaN(parsedMu1)) errList.mu1 = 'הזן מספר תקין';

    const parsedSigma = parseFloat(sigmaInput);
    if (sigmaInput.trim() === '') errList.sigma = 'שדה חובה';
    else if (isNaN(parsedSigma)) errList.sigma = 'הזן מספר תקין';
    else if (parsedSigma <= 0) errList.sigma = 'סטיית תקן חייבת להיות גדולה מ-0';

    const parsedN = parseInt(nInput, 10);
    if (nInput.trim() === '') errList.n = 'שדה חובה';
    else if (isNaN(parsedN)) errList.n = 'הזן מספר שלם';
    else if (parsedN <= 0) errList.n = 'גודל מדגם חייב להיות לפחות 1';

    const parsedAlpha = parseFloat(alphaInput);
    if (alphaInput.trim() === '') errList.alpha = 'שדה חובה';
    else if (isNaN(parsedAlpha)) errList.alpha = 'הזן הסתברות';
    else if (parsedAlpha <= 0 || parsedAlpha >= 1) errList.alpha = 'רמת מובהקות חייבת להיות בין 0 ל-1 בלבד';

    return errList;
  }, [mu0Input, mu1Input, sigmaInput, nInput, alphaInput]);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  // Handle input changes
  const handleMu0Change = (val: string) => {
    setMu0Input(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) setMu0(parsed);
  };

  const handleMu1Change = (val: string) => {
    setMu1Input(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) setMu1(parsed);
  };

  const handleSigmaChange = (val: string) => {
    setSigmaInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) setSigma(parsed);
  };

  const handleNChange = (val: string) => {
    setNInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) setN(parsed);
  };

  const handleAlphaChange = (val: string) => {
    setAlphaInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0 && parsed < 1) setAlpha(parsed);
  };

  // Safe preset setters
  const applyAlphaPreset = (preset: number) => {
    setAlpha(preset);
    setAlphaInput(preset.toString());
  };

  // Reset calculator to standard defaults
  const handleReset = () => {
    setVarianceKnown(true);
    setMu0(100);
    setMu0Input('100');
    setMu1(108);
    setMu1Input('108');
    setSigma(15);
    setSigmaInput('15');
    setN(36);
    setNInput('36');
    setAlpha(0.05);
    setAlphaInput('0.05');
    setTestType('mean');
    setTailType('right');
  };

  // --- Core Calculations Engine ---
  const stats = useMemo(() => {
    if (!isValid) return null;

    // 1. Calculate Standard Error (SE) based on Test Type and CLT
    let se = sigma;
    let effectH0Mean = mu0;
    let effectH1Mean = mu1; // Explicitly uses mu1, decoupled from xBar

    if (testType === 'mean') {
      se = sigma / Math.sqrt(n);
      effectH0Mean = mu0;
      effectH1Mean = mu1;
    } else if (testType === 'sum') {
      se = sigma * Math.sqrt(n);
      effectH0Mean = mu0 * n;
      effectH1Mean = mu1 * n;
    } else {
      // Single item
      se = sigma;
      effectH0Mean = mu0;
      effectH1Mean = mu1;
    }

    const df = testType === 'single' ? 1 : Math.max(1, n - 1);
    
    // Non-Centrality Parameter calculation
    const ncp = (effectH1Mean - effectH0Mean) / se;

    // 2. Critical Score Sourcing & Distribution Mapping
    let zCrit: number = 0;
    let zCritLower: number = 0; // for two-tailed

    if (varianceKnown) {
      if (tailType === 'right') {
        zCrit = inverseNormalCDF(1 - alpha);
      } else if (tailType === 'left') {
        zCrit = inverseNormalCDF(alpha); // This will be negative
      } else { // two-tailed
        zCrit = inverseNormalCDF(1 - alpha / 2);
        zCritLower = -zCrit;
      }
    } else {
      if (tailType === 'right') {
        zCrit = studentTPPF(1 - alpha, df);
      } else if (tailType === 'left') {
        zCrit = studentTPPF(alpha, df);
      } else { // two-tailed
        zCrit = studentTPPF(1 - alpha / 2, df);
        zCritLower = -zCrit;
      }
    }

    // Single Boundary Calculation Engine
    let c2: number = effectH0Mean + zCrit * se;
    let c1: number = tailType === 'two-tailed' ? effectH0Mean + zCritLower * se : 0;
    
    const C_bar_value = tailType === 'two-tailed' ? c2 : c2; // primary boundary
    const C_bar_value_1 = c1;
    const C_bar_value_2 = c2;

    // 3. Non-Central Risk & Power Evaluation
    let beta = 0;
    let power = 0;

    if (varianceKnown) {
      if (tailType === 'right') {
        beta = normalCDF(c2, effectH1Mean, se);
        power = 1 - beta;
      } else if (tailType === 'left') {
        beta = 1 - normalCDF(c2, effectH1Mean, se);
        power = 1 - beta;
      } else { // two-tailed
        beta = normalCDF(c2, effectH1Mean, se) - normalCDF(c1, effectH1Mean, se);
        power = 1 - beta;
      }
    } else {
      if (tailType === 'right') {
        beta = studentTCDF(zCrit - ncp, df);
        power = 1 - beta;
      } else if (tailType === 'left') {
        beta = 1 - studentTCDF(zCrit - ncp, df); // Using exact area map
        power = 1 - beta;
      } else { // two-tailed
        beta = studentTCDF(zCrit - ncp, df) - studentTCDF(zCritLower - ncp, df);
        power = 1 - beta;
      }
    }

    // Keep it safe
    beta = Math.max(0, Math.min(1, beta));
    power = Math.max(0, Math.min(1, power));

    return {
      se,
      effectH0Mean,
      effectH1Mean,
      c1,
      c2,
      C_bar_value,
      C_bar_value_1,
      C_bar_value_2,
      zCrit,
      zCritLower,
      beta,
      power,
      df,
      ncp,
      varianceKnown
    };
  }, [mu0, mu1, sigma, n, alpha, testType, tailType, isValid, varianceKnown]);

  // --- Dynamic Decision Data Logic ---
  const decisionData = useMemo(() => {
    if (!stats || !isValid) return null;

    // We decouple xBar from mu1, by defining xBar variable which will eventually be bound to a separate state.
    // For now we use the existing mu1 state as the xBar fallback until we add the xBar state, but the calculation is completely isolated.
    const xBarValue = mu1; 
    
    let isReject = false;
    let ruleText = '';
    let decisionHeading = '';
    let belongingExplanationText = '';
    
    // Formal Structural Set Compilation using purely C and \bar{C}
    let zoneRejectionTeX = '';
    let zoneAcceptanceTeX = '';

    const formattedXBar = xBarValue.toFixed(xBarValue % 1 === 0 ? 0 : 3);

    if (tailType === 'right') {
      isReject = xBarValue >= stats.C_bar_value;
      zoneRejectionTeX = `C = \\{ \\bar{X} \\mid \\bar{X} \\ge ${stats.C_bar_value.toFixed(4)} \\}`;
      zoneAcceptanceTeX = `\\bar{C} = \\{ \\bar{X} \\mid \\bar{X} < ${stats.C_bar_value.toFixed(4)} \\}`;
    } else if (tailType === 'left') {
      isReject = xBarValue <= stats.C_bar_value;
      zoneRejectionTeX = `C = \\{ \\bar{X} \\mid \\bar{X} \\le ${stats.C_bar_value.toFixed(4)} \\}`;
      zoneAcceptanceTeX = `\\bar{C} = \\{ \\bar{X} \\mid \\bar{X} > ${stats.C_bar_value.toFixed(4)} \\}`;
    } else { // two-tailed
      isReject = xBarValue <= stats.C_bar_value_1 || xBarValue >= stats.C_bar_value_2;
      zoneRejectionTeX = `C = \\{ \\bar{X} \\mid \\bar{X} \\le ${stats.C_bar_value_1.toFixed(4)} \\lor \\bar{X} \\ge ${stats.C_bar_value_2.toFixed(4)} \\}`;
      zoneAcceptanceTeX = `\\bar{C} = \\{ \\bar{X} \\mid ${stats.C_bar_value_1.toFixed(4)} < \\bar{X} < ${stats.C_bar_value_2.toFixed(4)} \\}`;
    }

    if (isReject) {
      decisionHeading = 'Reject H_0';
      belongingExplanationText = `מכיוון שממוצע המדגם בפועל הוא X̄ = ${formattedXBar}, הוא שייך לקבוצה C.`;
    } else {
      decisionHeading = 'Do Not Reject H_0';
      belongingExplanationText = `מכיוון שממוצע המדגם בפועל הוא X̄ = ${formattedXBar}, הוא שייך לקבוצה \\bar{C}.`;
    }

    let verbalConclusion = '';
    const comparisonText = tailType === 'right' ? `גדולה מ-${mu0}` : tailType === 'left' ? `קטנה מ-${mu0}` : `שונה מ-${mu0}`;
    
    if (isReject) {
      verbalConclusion = `ברמת מובהקות של ${alpha}, קיימות ראיות סטטיסטיות מספקות המבוססות על המדגם כדי לדחות את השערת האפס ולקבוע כי תוחלת האוכלוסייה ${comparisonText}.`;
    } else {
      verbalConclusion = `ברמת מובהקות של ${alpha}, אין מספיק ראיות סטטיסטיות במדגם כדי לשלול את השערת האפס, ולכן לא ניתן לקבוע כי תוחלת האוכלוסייה ${comparisonText}.`;
    }

    return {
      xBar: xBarValue,
      isReject,
      decisionHeading,
      verbalConclusion,
      zoneRejectionTeX,
      zoneAcceptanceTeX,
      belongingExplanationText,
      formattedXBar
    };
  }, [stats, isValid, mu0, mu1, alpha, tailType]);

  // --- Dynamic Graph Data Generation ---
  const chartData = useMemo(() => {
    if (!stats || !isValid) return [];

    const pts = [];
    const numPoints = 180;
    const { effectH0Mean, effectH1Mean, se, c1, c2 } = stats;

    // We want the graph limits to cover approx 4.2 standard errors around both peaks
    const minCenter = Math.min(effectH0Mean, effectH1Mean);
    const maxCenter = Math.max(effectH0Mean, effectH1Mean);
    
    const xMin = minCenter - 4.2 * se;
    const xMax = maxCenter + 4.2 * se;
    const step = (xMax - xMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      const { df, varianceKnown } = stats;
      const pdfH0 = varianceKnown 
        ? normalPDF(x, effectH0Mean, se) 
        : studentTPDF((x - effectH0Mean) / se, df) / se;
      const pdfH1 = varianceKnown 
        ? normalPDF(x, effectH1Mean, se) 
        : studentTPDF((x - effectH1Mean) / se, df) / se;

      // Determine rejection regions to shade Alpha and Power
      let isRejected = false;
      if (tailType === 'right') {
        isRejected = x >= c2;
      } else if (tailType === 'left') {
        isRejected = x <= c1; 
      } else { // two-tailed
        isRejected = x <= c1 || x >= c2;
      }

      // Rejection area under H0 is Alpha (Type I Error)
      const alphaShade = isRejected ? pdfH0 : 0;
      
      // Rejection area under H1 is Power (1-Beta)
      const powerShade = isRejected ? pdfH1 : 0;

      pts.push({
        x: Number(x.toFixed(4)),
        pdfH0,
        pdfH1,
        alphaShade,
        powerShade,
      });
    }

    return pts;
  }, [stats, isValid, tailType]);

  // Custom tooltips for graphs
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className={`p-4 rounded-xl border shadow-xl text-xs text-right leading-relaxed ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-700 text-slate-100' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mb-1 border-b pb-1 border-slate-200 dark:border-slate-800">ערכי צפיפות (PDF)</p>
          <div className="flex justify-between gap-6">
            <span>ערך המשתנה (X):</span>
            <span className="font-mono font-bold">{data.x.toFixed(3)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>צפיפות תחת H₀:</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{data.pdfH0.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>צפיפות תחת H₁:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{data.pdfH1.toFixed(4)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 font-sans" dir="rtl">

      {/* Parameters Input Card */}
      <div className={`rounded-3xl p-5 md:p-6 border shadow-md transition-colors ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-indigo-500" />
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
              פרמטרים והשערות מחקר
            </h3>
          </div>
          
          {/* Main Test Statistic Type (Single, Mean, Sum) Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400">סטטיסטי המבחן:</span>
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border dark:border-slate-800">
              <button 
                type="button"
                onClick={() => setTestType('single')}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all ${
                  testType === 'single'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                תצפית X
              </button>
              <button 
                type="button"
                onClick={() => setTestType('mean')}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all ${
                  testType === 'mean'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                ממוצע X̄
              </button>
              <button 
                type="button"
                onClick={() => setTestType('sum')}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all ${
                  testType === 'sum'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                סכום ΣX
              </button>
            </div>
          </div>
        </div>

        {/* Custom Parameters Table Layout */}
        <div className="overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all mb-6" dir="rtl">
          {/* Table Header Row */}
          <div className="grid grid-cols-2 text-center text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-slate-800">
            <div className="py-2.5 bg-slate-50 dark:bg-slate-800/40 border-l border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-center">
              מדגם
            </div>
            <div className="py-2 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-slate-100 flex flex-col sm:flex-row items-center justify-between px-4 gap-2">
              <span className="font-extrabold">אוכלוסייה</span>
              <div className="flex items-center gap-1.5 bg-slate-250 dark:bg-slate-800 px-2.5 py-1 rounded-xl shadow-xs transition-colors select-none">
                <span className="text-[10px] sm:text-[11px] text-slate-700 dark:text-slate-300 font-extrabold">שונות ידועה:</span>
                <button
                  type="button"
                  onClick={() => setVarianceKnown(!varianceKnown)}
                  className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    varianceKnown ? 'bg-indigo-650' : 'bg-slate-400 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      varianceKnown ? '-translate-x-3.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Table Body - Row 1 */}
          <div className="grid grid-cols-2 border-b border-slate-200 dark:border-slate-800/80">
            {/* Left side: Sample - n */}
            <div className="flex flex-col sm:flex-row items-stretch border-l border-slate-350 dark:border-slate-800/80">
              <div className="w-full sm:w-1/2 px-4 py-3 bg-slate-50/20 dark:bg-slate-950/20 flex items-center justify-between sm:justify-start gap-1">
                <InputTooltip content="מספר התצפיות במדגם (n)" theme={theme}>
                  <label className={`text-xs font-black text-slate-600 dark:text-slate-300 cursor-help border-b border-dotted border-slate-400 dark:border-slate-500 ml-1 ${testType === 'single' ? 'opacity-30' : ''}`}>
                    גודל מדגם (n):
                  </label>
                </InputTooltip>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-center bg-transparent">
                <input 
                  type="text" 
                  value={testType === 'single' ? '1' : nInput}
                  disabled={testType === 'single'}
                  onChange={(e) => handleNChange(e.target.value)}
                  className={`w-full px-4 py-3 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none transition-all ${
                    testType === 'single' ? 'opacity-40 cursor-not-allowed bg-slate-100/10' : 'focus:bg-indigo-50/10 dark:focus:bg-indigo-950/10'
                  } ${errors.n && testType !== 'single' ? 'bg-red-500/5 text-red-600 dark:text-red-400' : ''}`}
                  placeholder="36"
                  dir="ltr"
                />
                {errors.n && testType !== 'single' && (
                  <div className="px-4 pb-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold leading-tight">{errors.n}</div>
                )}
              </div>
            </div>

            {/* Right side: Population - mu0 */}
            <div className="flex flex-col sm:flex-row items-stretch">
              <div className="w-full sm:w-1/2 px-4 py-3 bg-slate-50/20 dark:bg-slate-950/20 flex items-center justify-between sm:justify-start gap-1">
                <InputTooltip content="תוחלת אוכלוסיית הבסיס (השערת האפס H₀)" theme={theme}>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 cursor-help border-b border-dotted border-slate-400 dark:border-slate-500 ml-1">
                    תוחלת (μ₀):
                  </label>
                </InputTooltip>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold">H0</span>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-center">
                 <input 
                  type="text" 
                  value={mu0Input}
                  onChange={(e) => handleMu0Change(e.target.value)}
                  className={`w-full px-4 py-3 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none transition-all focus:bg-indigo-50/10 dark:focus:bg-indigo-950/10 ${
                    errors.mu0 ? 'bg-red-500/5 text-red-600 dark:text-red-400 mr-0.5' : ''
                  }`}
                  placeholder="100"
                  dir="ltr"
                />
                {errors.mu0 && (
                  <div className="px-4 pb-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold leading-tight">{errors.mu0}</div>
                )}
              </div>
            </div>
          </div>

          {/* Table Body - Row 2 */}
          <div className="grid grid-cols-2">
            {/* Left side: Sample - mu1 (X̄ in visual) */}
            <div className="flex flex-col sm:flex-row items-stretch border-l border-slate-350 dark:border-slate-800/80">
              <div className="w-full sm:w-1/2 px-4 py-3 bg-slate-50/20 dark:bg-slate-950/20 flex items-center justify-between sm:justify-start gap-1">
                <InputTooltip content="ממוצע המדגם" theme={theme}>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 cursor-help border-b border-dotted border-slate-400 dark:border-slate-500 ml-1">
                    ממוצע מדגם (X̄):
                  </label>
                </InputTooltip>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-center">
                 <input 
                  type="text" 
                  value={mu1Input}
                  onChange={(e) => handleMu1Change(e.target.value)}
                  className={`w-full px-4 py-3 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none transition-all focus:bg-indigo-50/10 dark:focus:bg-indigo-950/10 ${
                    errors.mu1 ? 'bg-red-500/5 text-red-600 dark:text-red-400 mr-0.5' : ''
                  }`}
                  placeholder="108"
                  dir="ltr"
                />
                {errors.mu1 && (
                  <div className="px-4 pb-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold leading-tight">{errors.mu1}</div>
                )}
              </div>
            </div>

            {/* Right side: Population - sigma */}
            <div className="flex flex-col sm:flex-row items-stretch">
              <div className="w-full sm:w-1/2 px-4 py-3 bg-slate-50/20 dark:bg-slate-950/20 flex items-center justify-between sm:justify-start gap-1">
                <InputTooltip content={varianceKnown ? "סטיית תקן של האוכלוסייה (σ)" : "סטיית תקן מדגמית (S) המשמשת כאומד לסטיית התקן של האוכלוסייה"} theme={theme}>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 cursor-help border-b border-dotted border-slate-400 dark:border-slate-500 ml-1">
                    {varianceKnown ? 'סטיית תקן של האוכלוסייה (σ):' : 'סטיית תקן מדגמית (S):'}
                  </label>
                </InputTooltip>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-center">
                 <input 
                  type="text" 
                  value={sigmaInput}
                  onChange={(e) => handleSigmaChange(e.target.value)}
                  className={`w-full px-4 py-3 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent outline-none transition-all focus:bg-indigo-50/10 dark:focus:bg-indigo-950/10 ${
                    errors.sigma ? 'bg-red-500/5 text-red-600 dark:text-red-400' : ''
                  }`}
                  placeholder="15"
                  dir="ltr"
                />
                {errors.sigma && (
                  <div className="px-4 pb-1.5 text-[11px] text-red-600 dark:text-red-400 font-bold leading-tight">{errors.sigma}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Formal Hypotheses Display Banner */}
        <div className="mb-6 p-4 rounded-2xl border border-indigo-150/80 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/10 flex flex-col sm:flex-row items-center justify-between gap-4 transition-all" dir="rtl">
          <div>
            <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Award size={16} className="text-indigo-500" />
              השערות המבחן בצורה הפורמלית (Formal Hypotheses):
            </h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1 leading-normal font-medium max-w-lg">
              קביעת השערת האפס (<InlineMath math="H_0" />) המבטאת חוסר שינוי, למול השערת המחקר אלטרנטיבית (<InlineMath math="H_1" />) המבטאת אפקט משמעותי.
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800 rounded-xl min-w-[210px] text-center shadow-sm">
            <span className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-wider mb-1">השערות המבחן הפורמליות:</span>
            <div className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 font-mono tracking-wide" dir="ltr">
              <InlineMath math={getFormalHypothesisMath()} />
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-1.5 border-t border-dotted border-slate-200 dark:border-slate-800 pt-1" dir="ltr">
              <InlineMath math={getGeneralFormalHypothesisMath()} />
            </div>
          </div>
        </div>

        {/* Test Direction and Alpha Below Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="rtl">
          {/* Test Direction select */}
          <div className="space-y-1.5 text-right font-sans">
            <div className="flex justify-between items-center px-0.5">
              <InputTooltip content="כיוון השערת המחקר (H₁) - חד-צדדית או דו-צדדית" theme={theme}>
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 cursor-help border-b border-dotted border-slate-400 dark:border-slate-500 ml-1">השערת המחקר (H₁):</label>
              </InputTooltip>
            </div>
            <select 
              value={tailType}
              onChange={(e) => setTailType(e.target.value as TailType)}
              className="w-full px-3 py-2.5 text-xs bg-[#070d33] border border-slate-300 dark:border-slate-800 rounded-xl outline-none font-bold text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
              style={{ backgroundColor: '#070d33' }}
            >
              <option value="right" className="bg-[#070d33] text-white">חד-צדדי ימני (μ &gt; μ₀)</option>
              <option value="left" className="bg-[#070d33] text-white">חד-צדדי שמאלי (μ &lt; μ₀)</option>
              <option value="two-tailed" className="bg-[#070d33] text-white">דו-צדדי (μ ≠ μ₀)</option>
            </select>
          </div>

          {/* Alpha Input & Presets */}
          <div className="space-y-1.5 text-right font-sans">
            <div className="flex justify-between items-center px-0.5">
              <InputTooltip content="רמת מובהקות (α) - ההסתברות המרבית לכל היותר לדחות בטעות את השערת האפס" theme={theme}>
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 cursor-help border-b border-dotted border-slate-400 dark:border-slate-500 ml-1">מובהקות (α):</label>
              </InputTooltip>
            </div>
            <div className="flex gap-1" dir="ltr">
              <input 
                type="text" 
                value={alphaInput}
                onChange={(e) => handleAlphaChange(e.target.value)}
                className={`w-14 px-1 py-2.5 bg-[#070d33] text-center border rounded-xl outline-none transition-all font-mono font-bold text-xs text-white ${
                  errors.alpha 
                    ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                    : 'border-slate-300 dark:border-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-505'
                }`}
                style={{ backgroundColor: '#070d33', textAlign: 'center' }}
                placeholder="0.05"
              />
              <div className="flex-1 grid grid-cols-3 gap-0.5">
                {[0.10, 0.05, 0.01].map((pVal) => (
                  <button
                    key={pVal}
                    type="button"
                    onClick={() => applyAlphaPreset(pVal)}
                    className={`py-1 text-[15px] font-black rounded-lg transition-all border ${
                      alpha === pVal 
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750'
                    }`}
                  >
                    {pVal * 100}%
                  </button>
                ))}
              </div>
            </div>
            {errors.alpha && <p className="text-[11px] text-red-600 dark:text-red-400 font-bold leading-tight mt-1">{errors.alpha}</p>}
          </div>
        </div>

      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* RIGHT Column - Dashboard & Visual Analytics */}
        <div className="lg:col-span-9 space-y-8 order-1 lg:order-2">

          {/* Quick Stats Grid Widgets */}
          {isValid && stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className={`p-4 sm:p-5 rounded-2xl border text-right shadow-md transition-all ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}>
                <span className="text-xs sm:text-sm text-slate-900 dark:text-slate-200 font-extrabold flex items-center gap-1.5 break-words">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
                  טעות מסוג ראשון (<InlineMath math="\alpha" />)
                </span>
                <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 text-red-700 dark:text-red-400 tracking-tight break-all">
                  {(alpha * 100).toFixed(1)}%
                </div>
                <span className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 font-bold block mt-2 leading-tight">רמת מובהקות המבחן המקורית</span>
              </div>

              <div className={`p-4 sm:p-5 rounded-2xl border text-right shadow-md transition-all ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}>
                <span className="text-xs sm:text-sm text-slate-900 dark:text-slate-200 font-extrabold flex items-center gap-1.5 break-words">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse shrink-0" />
                  טעות מסוג שני (<InlineMath math="\beta" />)
                </span>
                <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 text-amber-700 dark:text-amber-400 tracking-tight break-all">
                  {(stats.beta * 100).toFixed(2)}%
                </div>
                <span className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 font-bold block mt-2 leading-tight">הסיכוי לקבלת H₀ מוטעית</span>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-700 to-emerald-800 text-white shadow-xl flex flex-col justify-between">
                <div>
                  <span className="text-xs sm:text-sm font-black flex items-center gap-1.5 text-white break-words">
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                    עוצמת המבחן (<InlineMath math="1-\beta" />)
                  </span>
                  <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 tracking-tight break-all">
                    {(stats.power * 100).toFixed(2)}%
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-indigo-100 font-bold block mt-2 leading-tight">הסיכוי לדחות נכון את H₀</span>
              </div>

              <div className={`p-4 sm:p-5 rounded-2xl border text-right shadow-md transition-all ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-300'
              }`}>
                <span className="text-xs sm:text-sm text-slate-900 dark:text-slate-200 font-extrabold flex items-center gap-1.5 break-words">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                  שגיאת תקן (<InlineMath math="SE" />)
                </span>
                <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 text-indigo-700 dark:text-indigo-400 tracking-tight break-all">
                  {stats.se.toFixed(4)}
                </div>
                <span className="text-[10px] sm:text-xs text-slate-700 dark:text-slate-300 font-bold block mt-2 leading-tight">סטיית התקן של הסטטיסטי</span>
              </div>

            </div>
          )}


          {/* Overlapping Curves Chart */}
          <div className={`rounded-3xl p-6 md:p-8 border shadow-md transition-all ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 mb-5">
              <h3 className={`text-lg md:text-xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
                ייצוג גרפי: דילמת ההתפלגויות המקבילות והחפיפה
              </h3>
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1.5 font-black text-blue-700 dark:text-blue-400">
                  <span className="w-3 h-2 rounded bg-blue-600 inline-block" />
                  התפלגות תחת H₀
                </span>
                <span className="flex items-center gap-1.5 font-black text-amber-700 dark:text-amber-400">
                  <span className="w-3 h-2 rounded bg-amber-500 inline-block" />
                  התפלגות תחת H₁
                </span>
                <span className="flex items-center gap-1.5 font-black text-red-700 dark:text-red-400">
                  <span className="w-3 h-2 rounded bg-red-600/30 border border-red-500 inline-block" />
                  אזור דחייה (<InlineMath math="\alpha" />)
                </span>
                <span className="flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-400">
                  <span className="w-3 h-2 rounded bg-emerald-500/30 border border-emerald-500 inline-block" />
                  אזור עוצמה (<InlineMath math="1-\beta" />)
                </span>
              </div>
            </div>

            {isValid && stats ? (
              <div className="h-[380px] w-full mt-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
                    <defs>
                      <linearGradient id="h0Color" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#2563eb'} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#2563eb'} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="h1Color" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                    
                    <XAxis 
                      dataKey="x" 
                      type="number" 
                      domain={['auto', 'auto']}
                      tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10 }}
                      axisLine={{ stroke: theme === 'dark' ? '#334155' : '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis hide={true} />
                    <RechartsTooltip content={<CustomChartTooltip />} />

                    {/* H0 Curve Base Area */}
                    <Area 
                      type="monotone" 
                      dataKey="pdfH0" 
                      stroke={theme === 'dark' ? '#3b82f6' : '#2563eb'} 
                      strokeWidth={2} 
                      fill="url(#h0Color)" 
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* H1 Curve Base Area */}
                    <Area 
                      type="monotone" 
                      dataKey="pdfH1" 
                      stroke="#f59e0b" 
                      strokeWidth={2} 
                      fill="url(#h1Color)" 
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Shaded Red Layer for Alpha Area (Type I) */}
                    <Area 
                      type="monotone" 
                      dataKey="alphaShade" 
                      stroke="none" 
                      fill={theme === 'dark' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(220, 38, 38, 0.25)'} 
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Shaded Emerald Layer for Power Area */}
                    <Area 
                      type="monotone" 
                      dataKey="powerShade" 
                      stroke="none" 
                      fill={theme === 'dark' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(5, 150, 105, 0.25)'} 
                      dot={false}
                      isAnimationActive={false}
                    />

                    {/* Legend of distributions */}
                    <Legend 
                      verticalAlign="top" 
                      height={40} 
                      content={() => (
                        <div className="flex justify-center gap-8 text-xs sm:text-sm md:text-base py-2">
                          <span className="text-slate-900 dark:text-slate-100 font-black flex items-center gap-2 select-none">
                            <span className="w-3.5 h-1.5 inline-block bg-blue-500 rounded" />
                            H₀: מיקום המרכז = {stats.effectH0Mean.toFixed(2)}
                          </span>
                          <span className="text-slate-900 dark:text-slate-100 font-black flex items-center gap-2 select-none">
                            <span className="w-3.5 h-1.5 inline-block bg-amber-500 rounded" />
                            H₁: מיקום המרכז = {stats.effectH1Mean.toFixed(2)}
                          </span>
                        </div>
                      )}
                    />

                    {/* Vertical Reference Line at Mean of H0 */}
                    <ReferenceLine 
                      x={stats.effectH0Mean} 
                      stroke="#3b82f6" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4"
                    />

                    {/* Vertical Reference Line at Mean of H1 */}
                    <ReferenceLine 
                      x={stats.effectH1Mean} 
                      stroke="#f59e0b" 
                      strokeWidth={1.5} 
                      strokeDasharray="4 4"
                    />

                    {/* Vertical LINE for SELECTOR: Critical Values */}
                    {tailType === 'two-tailed' ? (
                      <>
                        <ReferenceLine 
                          x={stats.c1} 
                          stroke="#ef4444" 
                          strokeWidth={2.5} 
                          label={{
                            value: `C₁: ${stats.c1.toFixed(2)}`,
                            position: 'top',
                            fill: '#ef4444',
                            fontSize: 13,
                            fontWeight: 'bold'
                          }}
                        />
                        <ReferenceLine 
                          x={stats.c2} 
                          stroke="#ef4444" 
                          strokeWidth={2.5} 
                          label={{
                            value: `C₂: ${stats.c2.toFixed(2)}`,
                            position: 'top',
                            fill: '#ef4444',
                            fontSize: 13,
                            fontWeight: 'bold'
                          }}
                        />
                      </>
                    ) : (
                      <ReferenceLine 
                        x={stats.c2} 
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        label={{
                          value: `C (קריטי): ${stats.c2.toFixed(2)}`,
                          position: 'top',
                          fill: '#ef4444',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }}
                      />
                    )}

                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-24 text-center text-red-650 dark:text-red-400 font-black text-lg md:text-xl">
                נא לתקן את שגיאות הקלטים בצד ימין על מנת להציג את הגרף.
              </div>
            )}
          </div>

          {/* Solutions Steps Accordion / Panel */}
          <div className={`rounded-3xl border shadow-md transition-all overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <button
              onClick={() => setShowSteps(!showSteps)}
              className="w-full px-8 py-5.5 flex items-center justify-between font-black text-slate-900 dark:text-slate-50 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-200/50 dark:border-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <Calculator className="text-indigo-600" size={24} />
                <span className="text-xl sm:text-2xl font-black">שלבי פתרון מתמטיים וגזירת הערכים</span>
              </div>
              {showSteps ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </button>

            <AnimatePresence>
              {showSteps && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-8 py-6.5 space-y-8"
                >
                  {isValid && stats ? (
                    <div className="space-y-8 text-base divide-y divide-slate-200 dark:divide-slate-800/50">
                      
                      {/* Step 1: Definition of variables and SE */}
                      <div className="space-y-3 pt-4">
                        <div className="flex items-center gap-3 font-extrabold text-indigo-700 dark:text-indigo-400">
                          <span className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">1</span>
                          <span className="text-xl sm:text-2xl font-black">קביעת השערות וחישוב שגיאת התקן (Standard Error)</span>
                        </div>
                        <p className="text-base sm:text-lg text-slate-800 dark:text-slate-200 leading-relaxed pr-9 font-semibold">
                          {varianceKnown 
                            ? "לפי משפט הגבול המרכזי (CLT), שגיאת התקן מייצגת את פיזור ההתפלגות של הסטטיסטי שנמדד:"
                            : "מכיוון ששונות האוכלוסייה אינה ידועה, נשתמש בסטיית התקן המדגמית S כדי לאמוד את שגיאת התקן של הממוצע:"}
                        </p>
                        <div className="pr-9 py-3 text-xl md:text-2xl">
                          {testType === 'single' ? (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">
                                {varianceKnown 
                                  ? "תצפית בודדת: הפיזור המקורי של האוכלוסייה תקף כמות שהוא."
                                  : "תצפית בודדת: פיזור המדגם המקורי (S) משמש ישירות כפיזור ההתפלגות."}
                              </p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`SE = ${varianceKnown ? '\\sigma' : 'S'} = ${sigmaInput}`} />
                                </div>
                              </div>
                            </div>
                          ) : testType === 'mean' ? (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">
                                {varianceKnown 
                                  ? "ממוצע מדגם: סטיית התקן מתכווצת על פי שורש גודל המדגם."
                                  : "ממוצע מדגם: סטיית התקן המדגמית מתכווצת על פי שורש גודל המדגם."}
                              </p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`SE = \\frac{${varianceKnown ? '\\sigma' : 'S'}}{\\sqrt{n}} = \\frac{${sigmaInput}}{\\sqrt{${nInput}}} = ${stats.se.toFixed(4)}`} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">
                                {varianceKnown
                                  ? "סכום מדגם: ממוצעי ההשערה והפיזור גדלים על פי גודל המדגם."
                                  : "סכום מדגם: ממוצעי ההשערה והפיזור גדלים על פי גודל המדגם תוך שימוש ב-S."}
                              </p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`SE = ${varianceKnown ? '\\sigma' : 'S'} \\cdot \\sqrt{n} = ${sigmaInput} \\cdot \\sqrt{${nInput}} = ${stats.se.toFixed(4)}`} />
                                </div>
                              </div>
                              <div className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mt-2 p-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                                ממוצעי ההתפלגות החדשים הופכים ל-
                                <InlineMath math={`n \\cdot \\mu`} />:
                                <br />
                                תחת H₀: <InlineMath math={`E(\\sum X) = ${nInput} \\cdot ${mu0Input} = ${stats.effectH0Mean}`} />
                                <br />
                                תחת H₁: <InlineMath math={`E(\\sum X) = ${nInput} \\cdot ${mu1Input} = ${stats.effectH1Mean}`} />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Critical Value derivation */}
                      <div className="space-y-3 pt-6">
                        <div className="flex items-center gap-3 font-extrabold text-indigo-700 dark:text-indigo-400">
                          <span className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">2</span>
                          <span className="text-xl sm:text-2xl font-black">מציאת ערך קריטי (Critical Value) של המבחן</span>
                        </div>
                        <p className="text-base sm:text-lg text-slate-800 dark:text-slate-205 leading-relaxed pr-9 font-semibold">
                          {varianceKnown ? (
                            <span>
                              עבור רמת מובהקות של <InlineMath math={`\\alpha = ${alpha}`} />, נאתר את ציון ה-<InlineMath math="Z" /> הגבולי ונממש טרנספורמציה.
                            </span>
                          ) : (
                            <span>
                              עבור רמת מובהקות של <InlineMath math={`\\alpha = ${alpha}`} /> ודרגות חופש <InlineMath math={`df = ${stats.df}`} /> (גודל מדגם <InlineMath math="n - 1" />), נאתר את ציון ה-<InlineMath math="t" /> הגבולי ונרשום את הטרנספורמציה.
                            </span>
                          )}
                        </p>

                        <div className="pr-9 py-3 space-y-5 text-xl md:text-2xl">
                          {tailType === 'right' ? (
                            <div className="space-y-4">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">
                                {varianceKnown 
                                  ? "חד-צדדי ימני: אנו מחפשים שטח עבודה משמאל בגודל 1-α."
                                  : "חד-צדדי ימני (מבחן t): אנו מאתרים בקצה הימני שטח ברמת מובהקות α."}
                              </p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  {varianceKnown ? (
                                    <>
                                      <BlockMath math={`Z_{crit} = \\Phi^{-1}(1 - ${alpha}) = \\Phi^{-1}(${(1-alpha).toFixed(4)}) = ${stats.zCrit.toFixed(4)}`} />
                                      <BlockMath math={`C = \\mu_0 + Z_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                    </>
                                  ) : (
                                    <>
                                      <BlockMath math={`t_{crit} = F_{t, ${stats.df}}^{-1}(1 - ${alpha}) = ${stats.zCrit.toFixed(4)}`} />
                                      <BlockMath math={`C = \\mu_0 + t_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="mt-6 space-y-4 text-right" dir="rtl">
                                <p className="text-sm sm:text-base text-slate-850 dark:text-slate-100 font-extrabold mb-2 leading-relaxed">
                                  עבור ערך קריטי מוגדר <InlineMath math="c" /> וכלל החלטה (עבור {statName} <InlineMath math={statSymbol} />):
                                </p>
                                
                                <div className="space-y-3 pr-2">
                                  <div className="space-y-1">
                                    <div className="flex items-start gap-2">
                                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
                                      <p className="text-xs sm:text-sm text-slate-705 dark:text-slate-200 font-extrabold leading-relaxed">
                                        <strong className="text-indigo-700 dark:text-indigo-400 font-black font-sans">אזור הדחייה (<InlineMath math="C" />):</strong> קבוצת הערכים שעבורם נחליט לדחות את השערת האפס <InlineMath math="H_0" />.
                                      </p>
                                    </div>
                                    <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                      <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                        <BlockMath math={`C = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} \\ge ${stats.c2.toFixed(3)} \\right\\}`} />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold italic mr-5">
                                      *תרגום למילים: אזור הדחייה מוגדר על ידי כל הערכים של {statName} שהם גדולים או שווים לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
                                    </p>
                                  </div>

                                  <div className="space-y-1 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="flex items-start gap-2">
                                      <span className="text-slate-550 dark:text-slate-405 font-extrabold text-sm sm:text-base shrink-0">●</span>
                                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-extrabold leading-relaxed">
                                        <strong className="text-slate-705 dark:text-slate-300 font-black font-sans">אזור הקבלה / אי-הדחייה (<InlineMath math="C^c" />):</strong> קבוצת הערכים המשלימה שעבורם לא נדחה את השערת האפס <InlineMath math="H_0" />.
                                      </p>
                                    </div>
                                    <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                      <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                        <BlockMath math={`C^c = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} < ${stats.c2.toFixed(3)} \\right\\}`} />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold italic mr-5">
                                      *תרגום למילים: אזור הקבלה מקיף את כל {statNamePlural} הנופלים מתחת לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : tailType === 'left' ? (
                            <div className="space-y-4">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">
                                {varianceKnown 
                                  ? "חד-צדדי שמאלי: אנו מחפשים שטח קיצון שמאלי בגודל α."
                                  : "חד-צדדי שמאלי (מבחן t): אנו מחפשים שטח קיצון שמאלי בגודל α בהתפלגות t."}
                              </p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  {varianceKnown ? (
                                    <>
                                      <BlockMath math={`Z_{crit} = \\Phi^{-1}(${alpha}) = ${stats.zCrit.toFixed(4)}`} />
                                      <BlockMath math={`C = \\mu_0 + Z_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                    </>
                                  ) : (
                                    <>
                                      <BlockMath math={`t_{crit} = F_{t, ${stats.df}}^{-1}(${alpha}) = ${stats.zCrit.toFixed(4)}`} />
                                      <BlockMath math={`C = \\mu_0 + t_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="mt-6 space-y-4 text-right" dir="rtl">
                                <p className="text-sm sm:text-base text-slate-850 dark:text-slate-100 font-extrabold mb-2 leading-relaxed">
                                  עבור ערך קריטי מוגדר <InlineMath math="c" /> וכלל החלטה (עבור {statName} <InlineMath math={statSymbol} />):
                                </p>
                                
                                <div className="space-y-3 pr-2">
                                  <div className="space-y-1">
                                    <div className="flex items-start gap-2">
                                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
                                      <p className="text-xs sm:text-sm text-slate-705 dark:text-slate-200 font-extrabold leading-relaxed">
                                        <strong className="text-indigo-700 dark:text-indigo-400 font-black font-sans">אזור הדחייה (<InlineMath math="C" />):</strong> קבוצת הערכים שעבורם נחליט לדחות את השערת האפס <InlineMath math="H_0" />.
                                      </p>
                                    </div>
                                    <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                      <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                        <BlockMath math={`C = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} \\le ${stats.c2.toFixed(3)} \\right\\}`} />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold italic mr-5">
                                      *תרגום למילים: אזור הדחייה מוגדר על ידי כל הערכים של {statName} שהם קטנים או שווים לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
                                    </p>
                                  </div>

                                  <div className="space-y-1 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="flex items-start gap-2">
                                      <span className="text-slate-550 dark:text-slate-405 font-extrabold text-sm sm:text-base shrink-0">●</span>
                                      <p className="text-xs sm:text-sm text-slate-705 dark:text-slate-200 font-extrabold leading-relaxed">
                                        <strong className="text-slate-705 dark:text-slate-300 font-black font-sans">אזור הקבלה / אי-הדחייה (<InlineMath math="C^c" />):</strong> קבוצת הערכים המשלימה שעבורם לא נדחה את השערת האפס <InlineMath math="H_0" />.
                                      </p>
                                    </div>
                                    <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                      <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                        <BlockMath math={`C^c = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} > ${stats.c2.toFixed(3)} \\right\\}`} />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold italic mr-5">
                                      *תרגום למילים: אזור הקבלה מקיף את כל {statNamePlural} הנופלים מעל לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">דו-צדדי: אנו מפצלים את המובהקות לשני קצוות ההתפלגות (α/2 בכל קצה).</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  {varianceKnown ? (
                                    <>
                                      <BlockMath math={`Z_{crit} = \\Phi^{-1}(1 - \\frac{${alpha}}{2}) = \\Phi^{-1}(${(1 - alpha/2).toFixed(4)}) = ${stats.zCrit.toFixed(4)}`} />
                                      <BlockMath math={`C_1 = \\mu_0 - Z_{crit} \\cdot SE = ${stats.effectH0Mean} - (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c1.toFixed(4)}`} />
                                      <BlockMath math={`C_2 = \\mu_0 + Z_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                    </>
                                  ) : (
                                    <>
                                      <BlockMath math={`t_{crit} = F_{t, ${stats.df}}^{-1}(1 - \\frac{${alpha}}{2}) = ${stats.zCrit.toFixed(4)}`} />
                                      <BlockMath math={`C_1 = \\mu_0 - t_{crit} \\cdot SE = ${stats.effectH0Mean} - (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c1.toFixed(4)}`} />
                                      <BlockMath math={`C_2 = \\mu_0 + t_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="mt-6 space-y-4 text-right" dir="rtl">
                                <p className="text-sm sm:text-base text-slate-850 dark:text-slate-100 font-extrabold mb-2 leading-relaxed">
                                  עבור שני ערכים קריטיים מוגדרים <InlineMath math="c_1, c_2" /> וכלל החלטה (עבור {statName} <InlineMath math={statSymbol} />):
                                </p>
                                
                                <div className="space-y-3 pr-2">
                                  <div className="space-y-1">
                                    <div className="flex items-start gap-2">
                                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
                                      <p className="text-xs sm:text-sm text-slate-705 dark:text-slate-200 font-extrabold leading-relaxed">
                                        <strong className="text-indigo-700 dark:text-indigo-400 font-black font-sans">אזור הדחייה (<InlineMath math="C" />):</strong> קבוצת הערכים שעבורם נחליט לדחות את השערת האפס <InlineMath math="H_0" />.
                                      </p>
                                    </div>
                                    <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                      <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                        <BlockMath math={`C = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} \\le ${stats.c1.toFixed(3)} \\;\\cup\\; ${statSymbol} \\ge ${stats.c2.toFixed(3)} \\right\\}`} />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-404 font-bold italic mr-5">
                                      *תרגום למילים: אזור הדחייה מוגדר על ידי כל הערכים של {statName} שהם קטנים או שווים לערך הקריטי התחתון (<InlineMath math={`${stats.c1.toFixed(3)}`} />) או גדולים או שווים לערך הקריטי העליון (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
                                    </p>
                                  </div>

                                  <div className="space-y-1 pt-3 border-t border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="flex items-start gap-2">
                                      <span className="text-slate-550 dark:text-slate-405 font-extrabold text-sm sm:text-base shrink-0">●</span>
                                      <p className="text-xs sm:text-sm text-slate-705 dark:text-slate-200 font-extrabold leading-relaxed">
                                        <strong className="text-slate-705 dark:text-slate-300 font-black font-sans">אזור הקבלה / אי-הדחייה (<InlineMath math="C^c" />):</strong> קבוצת הערכים המשלימה שעבורם לא נדחה את השערת האפס <InlineMath math="H_0" />.
                                      </p>
                                    </div>
                                    <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                      <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                        <BlockMath math={`C^c = \\left\\{ ${statSymbol} \\;\\middle|\\; ${stats.c1.toFixed(3)} < ${statSymbol} < ${stats.c2.toFixed(3)} \\right\\}`} />
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-404 font-bold italic mr-5">
                                      *תרגום למילים: אזור הקבלה מקיף את כל {statNamePlural} הנופלים בתחום התקין שבין שני הערכים הקריטיים שנקבעו.*
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                    </div>

                    {/* Step 3: Power calculation under H1 */}
                    <div className="space-y-3 pt-6">
                        <div className="flex items-center gap-3 font-extrabold text-indigo-700 dark:text-indigo-400">
                          <span className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">3</span>
                          <span className="text-xl sm:text-2xl font-black">חישוב טעות מסוג שני (<InlineMath math="\\beta" />) ועוצמת המבחן (<InlineMath math="1-\\beta" />)</span>
                        </div>
                        <p className="text-base sm:text-lg text-slate-800 dark:text-slate-200 leading-relaxed pr-9 font-semibold">
                          עוצמת המבחן מייצגת את הסיכוי להגיע להחלטת דחייה מוצדקת עבור הטענה האלטרנטיבית. אנו בודקים מה השטח של התפלגות H₁ הנופל בתוך סקטור אזור הדחייה:
                        </p>
                        <div className="pr-9 py-3 space-y-4 text-xl md:text-2xl">
                          {varianceKnown ? (
                            tailType === 'right' ? (
                              <div className="space-y-3">
                                <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">עוצמה מעל הערך הקריטי C (תחת התפלגות Z):</p>
                                <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                    <BlockMath math={`Z_{H1} = \\frac{C - \\mu_1}{SE} = \\frac{${stats.c2.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                    <BlockMath math={`\\beta = P(Accept\\ H_0 | H_1\\ is\\ True) = \\Phi(Z_{H1}) = ${stats.beta.toFixed(4)}`} />
                                    <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
                                  </div>
                                </div>
                              </div>
                            ) : tailType === 'left' ? (
                              <div className="space-y-3">
                                <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">עוצמה מתחת לערך הקריטי C (תחת התפלגות Z):</p>
                                <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                    <BlockMath math={`Z_{H1} = \\frac{C - \\mu_1}{SE} = \\frac{${stats.c1.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                    <BlockMath math={`\\beta = P(Accept\\ H_0 | H_1\\ is\\ True) = 1 - \\Phi(Z_{H1}) = ${stats.beta.toFixed(4)}`} />
                                    <BlockMath math={`Power (1-\\beta) =  \\Phi(Z_{H1}) = ${(stats.power).toFixed(4)}`} />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">עוצמה בשטח הדו-צדדי תחת H₁ (תחת התפלגות Z):</p>
                                <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                    <BlockMath math={`Z_{H1,1} = \\frac{C_1 - \\mu_1}{SE} = \\frac{${stats.c1.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                    <BlockMath math={`Z_{H1,2} = \\frac{C_2 - \\mu_1}{SE} = \\frac{${stats.c2.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                    <BlockMath math={`\\beta = \\Phi(${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(3)}) - \\Phi(${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(3)}) = ${stats.beta.toFixed(4)}`} />
                                    <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (
                            tailType === 'right' ? (
                              <div className="space-y-3">
                                <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">חישוב לפי פונקציית התפלגות t ופרמטר אי-מרכזיות (NCP):</p>
                                <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                    <BlockMath math={`NCP = \\frac{\\mu_{H1} - \\mu_{H0}}{SE} = \\frac{${stats.effectH1Mean} - ${stats.effectH0Mean}}{${stats.se.toFixed(4)}} = ${stats.ncp.toFixed(4)}`} />
                                    <BlockMath math={`t_{\\beta} = t_{crit} - NCP = ${stats.zCrit.toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(stats.zCrit - stats.ncp).toFixed(4)}`} />
                                    <BlockMath math={`\\beta = P(t_{df} < t_{\\beta}) = ${stats.beta.toFixed(4)}`} />
                                    <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
                                  </div>
                                </div>
                              </div>
                            ) : tailType === 'left' ? (
                              <div className="space-y-3">
                                <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">חישוב לפי פונקציית התפלגות t ופרמטר אי-מרכזיות (NCP):</p>
                                <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                    <BlockMath math={`NCP = \\frac{\\mu_{H1} - \\mu_{H0}}{SE} = \\frac{${stats.effectH1Mean} - ${stats.effectH0Mean}}{${stats.se.toFixed(4)}} = ${stats.ncp.toFixed(4)}`} />
                                    <BlockMath math={`t_{\\beta} = t_{crit} - NCP = ${stats.zCrit.toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(stats.zCrit - stats.ncp).toFixed(4)}`} />
                                    <BlockMath math={`\\beta = 1 - P(t_{df} < t_{\\beta}) = ${stats.beta.toFixed(4)}`} />
                                    <BlockMath math={`Power (1-\\beta) = ${(stats.power).toFixed(4)}`} />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">חישוב לפי פונקציית התפלגות t ופרמטר אי-מרכזיות (NCP):</p>
                                <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                  <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                    <BlockMath math={`NCP = \\frac{\\mu_{H1} - \\mu_{H0}}{SE} = \\frac{${stats.effectH1Mean} - ${stats.effectH0Mean}}{${stats.se.toFixed(4)}} = ${stats.ncp.toFixed(4)}`} />
                                    <BlockMath math={`t_{\\beta, 1} = -t_{crit} - NCP = ${(-stats.zCrit).toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(-stats.zCrit - stats.ncp).toFixed(4)}`} />
                                    <BlockMath math={`t_{\\beta, 2} = t_{crit} - NCP = ${stats.zCrit.toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(stats.zCrit - stats.ncp).toFixed(4)}`} />
                                    <BlockMath math={`\\beta = P(t_{df} < t_{\\beta, 2}) - P(t_{df} < t_{\\beta, 1}) = ${stats.beta.toFixed(4)}`} />
                                    <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>


                      {/* Step 4: Final Decision Block (Highlighted green/red panel) - Requirement 2 & 3 */}
                      {decisionData && (
                        <div className={`mt-8 rounded-3xl p-6 md:p-8 border-2 shadow-lg transition-all text-right relative overflow-hidden ${
                          decisionData.isReject 
                            ? 'bg-gradient-to-br from-emerald-50 to-teal-50/40 dark:from-emerald-950/25 dark:to-teal-950/5 border-emerald-400 dark:border-emerald-800' 
                            : 'bg-gradient-to-br from-slate-50 to-slate-100/45 dark:from-slate-900/25 dark:to-slate-800/5 border-slate-400 dark:border-slate-700'
                        }`}>
                          {/* Top Accent Strip */}
                          <div className={`absolute top-0 right-0 w-full h-1.5 ${decisionData.isReject ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                          
                          <h3 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2 pb-3 border-b border-dashed border-slate-200 dark:border-slate-800/85">
                            {decisionData.isReject ? (
                              <CheckCircle className="text-emerald-500 animate-bounce shrink-0" size={24} />
                            ) : (
                              <XCircle className="text-slate-500 shrink-0" size={24} />
                            )}
                            <span className={`text-xl font-black ${decisionData.isReject ? 'text-emerald-900 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-300'}`}>
                              שלב הכרעה סטטיסטית סופי 4 (Statistical Verdict)
                            </span>
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-auto font-mono">
                              α = {alpha} | n = {n}
                            </span>
                          </h3>

                          <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 leading-relaxed text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
                              <p className={`text-base sm:text-lg font-black ${decisionData.isReject ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-300'}`}>
                                מצב: המדגם נמצא באזור {decisionData.isReject ? 'הדחייה C' : 'הקבלה \\bar{C}'}
                              </p>
                              <p className="text-base sm:text-lg font-black mt-2">
                                החלטה פורמלית: <span className="font-mono underline decoration-2"><InlineMath math={decisionData.decisionHeading} /></span>
                              </p>
                            </div>
                            
                            <p className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 leading-relaxed mt-4">
                              {decisionData.verbalConclusion}
                            </p>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <p className="text-xl text-red-700 font-extrabold">הנתונים אינם תקינים</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        {/* LEFT Column - Info & Explanations Panel */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">

          {/* Theoretical Help widget inside side panel */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-900 border border-slate-800 text-white shadow-md relative overflow-hidden" dir="rtl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl" />
            <h4 className="text-sm font-black flex items-center gap-2 text-indigo-300 mb-2">
              <Info size={16} />
              הוראות הסבר מהירות:
            </h4>
            <ul className="text-xs space-y-2 text-slate-300 leading-relaxed pr-2 list-disc list-inside font-semibold font-sans">
              <li><strong>ממוצע H₀ המרכזי</strong> מבסס את קו התחלת הבסיס להשוואה (H₀ baseline).</li>
              <li><strong>אלטרנטיבה H₁</strong> מגדירה את המיקום השני המשוער בפועל.</li>
              <li>ככל ש-<strong>גודל המדגם (n)</strong> גדול יותר, שגיאת התקן מתכווצת, הקומות הופכות צרות יותר ועוצמת המבחן משתפרת פלאים.</li>
            </ul>
          </div>

        </div>

      </div>

      {/* Decision Matrix Hero (Moved Down & Polished) */}
      <div className="mt-8 rounded-3xl border p-5 md:p-6 text-right relative overflow-hidden shadow-lg transition-all bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800">
        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-red-600 via-indigo-700 to-emerald-600" />
        
        <h3 className="text-base sm:text-lg font-black mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-slate-900 dark:text-slate-100">
          <Award size={18} className="text-emerald-500" />
          מטריצת החלטה ורמות מובהקות (ארבעת מצבי עולם הסקה סטטיסטית)
        </h3>

        <DecisionMatrix theme={theme} isValid={isValid} stats={stats} alpha={alpha} />
      </div>

    </div>
    </div>
  );
}


