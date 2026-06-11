import { useLocalStorageState } from '../hooks/useLocalStorageState';
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
  BarChart2,
  Check,
  X
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
type TestType ='single' |'mean' |'sum';
type TailType ='right' |'left' |'two-tailed';

// No props needed - dark-only theme

// --- Decision Matrix Helper Component ---
interface DecisionMatrixProps {
  isValid: boolean;
  stats: any;
  alpha: number;
  calculatePower: boolean;
}

function DecisionMatrix({ isValid, stats, alpha, calculatePower }: DecisionMatrixProps) {
 if (!isValid || !stats) {
 return (
 <div className="py-12 text-center text-slate-500 font-bold text-sm">
 נא להזין ערכי קלט תקינים להצגת מטריצת החלטה...
 </div>
 );
 }

 return (
 <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/25">
 <table className="w-full text-sm text-right border-collapse">
 <thead>
 <tr className="bg-slate-800/70 text-xs text-slate-300 font-extrabold border-b border-slate-800">
 <th className="p-4 border-l border-slate-800 text-center font-black text-slate-100 bg-slate-800/25 w-1/4">החלטת המבחן</th>
 <th className="p-4 border-l border-slate-800 text-center font-black bg-blue-900/10" style={{ minWidth:'180px' }}>H₀ נכונה במציאות (אין אפקט)</th>
 <th className={`p-4 text-center font-black bg-amber-900/10 transition-all ${!calculatePower ? 'opacity-30' : ''}`} style={{ minWidth:'180px' }}>H₁ נכונה במציאות (קיים אפקט)</th>
 </tr>
 </thead>
 <tbody>
 {/* Row 1: Fail to reject H0 (Accept H0) */}
 <tr className="border-b border-slate-800 font-semibold text-slate-950 text-slate-50">
 <td className="p-4 sm:p-5 border-l border-slate-800 font-extrabold bg-red-950/20 text-red-100 border-r-4 border-r-red-500/80">
 <span className="text-base font-black block text-red-400">קבלת <InlineMath math="H_0" /></span>
 <span className="block text-[11px] font-bold text-red-300 mt-1">אי-דחיית השערת האפס</span>
 </td>
 
 {/* Cell 1-1: Accept H0 and H0 is true => Correct decision */}
 <td className="p-4 sm:p-5 border-l border-slate-800 bg-emerald-950/10 hover:bg-emerald-950/20 transition-all">
 <div className="flex items-center justify-between gap-2">
 <span className="font-extrabold text-emerald-400 flex items-center gap-1.5 text-xs sm:text-sm">
 <CheckCircle size={15} className="text-emerald-400" />
 החלטה נכונה
 </span>
 <span className="text-xs font-bold text-slate-400" dir="ltr">1 - α</span>
 </div>
 <div className="text-2xl sm:text-3xl font-black mt-2 text-emerald-300">
 {((1 - alpha) * 100).toFixed(1)}%
 </div>
 <p className="text-[11px] text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
 רמת הסמך הסטטיסטית (Confidence Level) – הסיכוי לא לקפוץ למסקנות שווא כאשר ההשערה אינה נכונה.
 </p>
 </td>

 {/* Cell 1-2: Accept H0 but H1 is true => Type II Error Beta */}
 <td className={`p-4 sm:p-5 transition-all ${!calculatePower ? 'bg-slate-950/15 opacity-40 select-none' : 'bg-amber-950/10 hover:bg-amber-950/20'}`}>
 {calculatePower ? (
 <>
 <div className="flex items-center justify-between gap-2">
 <span className="font-extrabold text-amber-400 flex items-center gap-1.5 text-xs sm:text-sm">
 <XCircle size={15} className="text-amber-600" />
 טעות מסוג II
 </span>
 <span className="text-xs font-semibold text-slate-400" dir="ltr">β (Beta)</span>
 </div>
 <div className="text-2xl sm:text-3xl font-black mt-2 text-amber-300">
 {(stats.beta * 100).toFixed(2)}%
 </div>
 <p className="text-[11px] text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
 קבלת השערת האפס אף על פי שהיא שקרית – החמצת גילוי של אפקט או הבדל קיים במציאות.
 </p>
 </>
 ) : (
 <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
 <Info size={16} className="mb-2 text-slate-500" />
 <span className="text-xs font-black">לא פעיל</span>
 <span className="text-[10px] text-slate-500 mt-1 leading-normal max-w-[130px]">הפעל "חישוב עוצמת מבחן" בפרמטרים</span>
 </div>
 )}
 </td>
 </tr>

 {/* Row 2: Reject H0 */}
 <tr className="font-semibold text-slate-950 text-slate-50">
 <td className="p-4 sm:p-5 border-l border-slate-800 font-extrabold bg-emerald-950/20 text-emerald-100 border-r-4 border-r-emerald-500/80">
 <span className="text-base font-black block text-emerald-400">דחיית <InlineMath math="H_0" /></span>
 <span className="block text-[11px] font-bold text-emerald-300 mt-1">קבלת הטענה האלטרנטיבית</span>
 </td>

 {/* Cell 2-1: Reject H0 and H0 is true => Type I Error Alpha */}
 <td className="p-4 sm:p-5 border-l border-slate-800 bg-red-950/10 hover:bg-red-950/20 transition-all">
 <div className="flex items-center justify-between gap-2">
 <span className="font-extrabold text-red-400 flex items-center gap-1.5 text-xs sm:text-sm">
 <XCircle size={15} className="text-red-600" />
 טעות מסוג I
 </span>
 <span className="text-xs font-semibold text-slate-400" dir="ltr">α (Alpha)</span>
 </div>
 <div className="text-2xl sm:text-3xl font-black mt-2 text-red-300">
 {(alpha * 100).toFixed(1)}%
 </div>
 <p className="text-[11px] text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
 רמת המובהקות – הסיכוי לדחות בטעות את השערת האפס הנכונה, כלומר לטעון לקשר או אפקט שאינו קיים באמת.
 </p>
 </td>

 {/* Cell 2-2: Reject H0 and H1 is true => Correct decision Power! */}
 <td className={`p-4 sm:p-5 transition-all ${
 !calculatePower 
 ? 'bg-slate-950/15 opacity-40 select-none' 
 : 'bg-gradient-to-br from-indigo-50/30 to-emerald-50/30 from-indigo-950/10 to-emerald-950/10 hover:from-indigo-50/45 hover:to-emerald-50/45 hover:from-indigo-950/15 hover:to-emerald-950/15 transition-all'
 }`}>
 {calculatePower ? (
 <>
 <div className="flex items-center justify-between gap-2">
 <span className="font-extrabold text-indigo-300 flex items-center gap-1.5 text-xs sm:text-sm">
 <CheckCircle size={15} className="text-indigo-400" />
 החלטה נכונה (עוצמה)
 </span>
 <span className="text-xs font-bold text-slate-400" dir="ltr">1 - β (Power)</span>
 </div>
 <div className="text-2xl sm:text-3xl font-black mt-2 text-indigo-400 tracking-tight">
 {(stats.power * 100).toFixed(2)}%
 </div>
 <p className="text-[11px] text-slate-400 mt-1.5 leading-normal font-medium max-w-sm">
 עוצמת המבחן – ההסתברות של המחקר לזהות ולדחות השערה מוטעית, ובכך להוכיח את קיומו של אפקט אמיתי.
 </p>
 </>
 ) : (
 <div className="flex flex-col items-center justify-center py-6 text-center text-slate-400">
 <Info size={16} className="mb-2 text-slate-500" />
 <span className="text-xs font-black">לא פעיל</span>
 <span className="text-[10px] text-slate-500 mt-1 leading-normal max-w-[130px]">הפעל "חישוב עוצמת מבחן" בפרמטרים</span>
 </div>
 )}
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
 className?: string;
}

const InputTooltip: React.FC<InputTooltipProps> = ({ content, children, className = "" }) => {
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
    <div className={`relative inline-flex items-center gap-1.5 ${className}`} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
      {children}
      <Info size={13} className="text-indigo-400/80 hover:text-indigo-300 cursor-help shrink-0" />
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 text-xs rounded-xl shadow-xl pointer-events-none text-center leading-normal font-medium bg-slate-800 text-slate-100 border border-slate-700 font-sans"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function HypothesisTestingCalculator() {
 // Input states
 const [varianceKnown, setVarianceKnown] = useLocalStorageState<boolean>('HT_varianceKnown', true);
 const [calculatePower, setCalculatePower] = useLocalStorageState<boolean>('HT_calculatePower', true);

 const [mu0, setMu0] = useLocalStorageState<number>('HT_mu0', 100);
 const [mu0Input, setMu0Input] = useLocalStorageState<string>('HT_mu0Input', '100');
 
 const [mu1, setMu1] = useLocalStorageState<number>('HT_mu1', 108);
 const [mu1Input, setMu1Input] = useLocalStorageState<string>('HT_mu1Input', '108');

 const [muH1, setMuH1] = useLocalStorageState<number>('HT_muH1', 108);
 const [muH1Input, setMuH1Input] = useLocalStorageState<string>('HT_muH1Input', '108');

 const [sigma, setSigma] = useLocalStorageState<number>('HT_sigma', 15);
 const [sigmaInput, setSigmaInput] = useLocalStorageState<string>('HT_sigmaInput', '15');

 const [n, setN] = useLocalStorageState<number>('HT_n', 36);
 const [nInput, setNInput] = useLocalStorageState<string>('HT_nInput', '36');

 const [alpha, setAlpha] = useLocalStorageState<number>('HT_alpha', 0.05);
 const [alphaInput, setAlphaInput] = useLocalStorageState<string>('HT_alphaInput', '0.05');

 const [testType, setTestType] = useLocalStorageState<TestType>('HT_testType', 'mean');
 const [tailType, setTailType] = useLocalStorageState<TailType>('HT_tailType', 'right');

 const statSymbol = testType ==='single' ?'X' : testType ==='sum' ?'\\sum X' :'\\bar{X}';
 const statName = testType ==='single' ?'הערך הבודד' : testType ==='sum' ?'סכום המדגם' :'ממוצע המדגם';
 const statNamePlural = testType ==='single' ?'ערכים בודדים' : testType ==='sum' ?'סכומי מדגם' :'ממוצעי מדגם';

 // Dynamic parameterized formal hypothesis
 const getFormalHypothesisMath = () => {
 let parameterSymbol ='\\mu';
 let h0Val = mu0Input;

 if (testType ==='sum') {
 parameterSymbol ='E(\\sum X)';
 const parsedMu0 = parseFloat(mu0Input);
 const parsedN = parseInt(nInput, 10);
 if (!isNaN(parsedMu0) && !isNaN(parsedN)) {
 h0Val = (parsedN * parsedMu0).toString();
 } else {
 h0Val ='n \\cdot \\mu_0';
 }
 }

 let h0Symbol ='=';
 let h1Symbol ='\\neq';

 if (tailType ==='right') {
 h0Symbol ='\\le';
 h1Symbol ='>';
 } else if (tailType ==='left') {
 h0Symbol ='\\ge';
 h1Symbol ='<';
 }

 return `H_0: ${parameterSymbol} ${h0Symbol} ${h0Val} \\quad \\text{vs.} \\quad H_1: ${parameterSymbol} ${h1Symbol} ${h0Val}`;
 };

 // Dynamic theoretical (general) formal hypothesis
 const getGeneralFormalHypothesisMath = () => {
 let parameterSymbol ='\\mu';
 if (testType ==='sum') {
 parameterSymbol ='E(\\sum X)';
 }

 const nullValueSymbol = testType ==='sum' ?'n \\cdot \\mu_0' :'\\mu_0';

 let h0Symbol ='=';
 let h1Symbol ='\\neq';

 if (tailType ==='right') {
 h0Symbol ='\\le';
 h1Symbol ='>';
 } else if (tailType ==='left') {
 h0Symbol ='\\ge';
 h1Symbol ='<';
 }

 return `H_0: ${parameterSymbol} ${h0Symbol} ${nullValueSymbol} \\quad \\text{vs.} \\quad H_1: ${parameterSymbol} ${h1Symbol} ${nullValueSymbol}`;
 };

 // Accordion state
 const [showSteps, setShowSteps] = useState<boolean>(true);

 // Error validations
 const errors = useMemo(() => {
 const errList: { [key: string]: string } = {};
 
 const parsedMu0 = parseFloat(mu0Input);
 if (mu0Input.trim() ==='') errList.mu0 ='שדה חובה';
 else if (isNaN(parsedMu0)) errList.mu0 ='הזן מספר תקין';

 const parsedMu1 = parseFloat(mu1Input);
 if (mu1Input.trim() ==='') errList.mu1 ='שדה חובה';
 else if (isNaN(parsedMu1)) errList.mu1 ='הזן מספר תקין';

 const parsedMuH1 = parseFloat(muH1Input);
 if (calculatePower) {
  if (muH1Input.trim() === '') errList.muH1 = 'שדה חובה';
  else if (isNaN(parsedMuH1)) errList.muH1 = 'הזן מספר תקין';
 }

 const parsedSigma = parseFloat(sigmaInput);
 if (sigmaInput.trim() ==='') errList.sigma ='שדה חובה';
 else if (isNaN(parsedSigma)) errList.sigma ='הזן מספר תקין';
 else if (parsedSigma <= 0) errList.sigma ='סטיית תקן חייבת להיות גדולה מ-0';

 const parsedN = parseInt(nInput, 10);
 if (nInput.trim() ==='') errList.n ='שדה חובה';
 else if (isNaN(parsedN)) errList.n ='הזן מספר שלם';
 else if (parsedN <= 0) errList.n ='גודל מדגם חייב להיות לפחות 1';

 const parsedAlpha = parseFloat(alphaInput);
 if (alphaInput.trim() ==='') errList.alpha ='שדה חובה';
 else if (isNaN(parsedAlpha)) errList.alpha ='הזן הסתברות';
 else if (parsedAlpha <= 0 || parsedAlpha >= 1) errList.alpha ='רמת מובהקות חייבת להיות בין 0 ל-1 בלבד';

 return errList;
 }, [mu0Input, mu1Input, sigmaInput, nInput, alphaInput, calculatePower, muH1Input]);

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

 const handleMuH1Change = (val: string) => {
 setMuH1Input(val);
 const parsed = parseFloat(val);
 if (!isNaN(parsed)) setMuH1(parsed);
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
 setCalculatePower(true);
 setMu0(100);
 setMu0Input('100');
 setMu1(108);
 setMu1Input('108');
 setMuH1(108);
 setMuH1Input('108');
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
 let effectH1Mean = muH1;

 if (testType ==='mean') {
 se = sigma / Math.sqrt(n);
 effectH0Mean = mu0;
 effectH1Mean = muH1;
 } else if (testType ==='sum') {
 se = sigma * Math.sqrt(n);
 effectH0Mean = mu0 * n;
 effectH1Mean = muH1 * n;
 } else {
 // Single item
 se = sigma;
 effectH0Mean = mu0;
 effectH1Mean = muH1;
 }

 const df = testType ==='single' ? 1 : Math.max(1, n - 1);
 
 // Non-Centrality Parameter calculation
 const ncp = (effectH1Mean - effectH0Mean) / se;

 // 2. Critical Score Sourcing & Distribution Mapping
 let zCrit: number = 0;
 let zCritLower: number = 0; // for two-tailed

 if (varianceKnown) {
 if (tailType ==='right') {
 zCrit = inverseNormalCDF(1 - alpha);
 } else if (tailType ==='left') {
 zCrit = inverseNormalCDF(alpha); // This will be negative
 } else { // two-tailed
 zCrit = inverseNormalCDF(1 - alpha / 2);
 zCritLower = -zCrit;
 }
 } else {
 if (tailType ==='right') {
 zCrit = studentTPPF(1 - alpha, df);
 } else if (tailType ==='left') {
 zCrit = studentTPPF(alpha, df);
 } else { // two-tailed
 zCrit = studentTPPF(1 - alpha / 2, df);
 zCritLower = -zCrit;
 }
 }

 // Single Boundary Calculation Engine
 let c2: number = effectH0Mean + zCrit * se;
 let c1: number = tailType ==='two-tailed' ? effectH0Mean + zCritLower * se : 0;
 
 const C_bar_value = tailType ==='two-tailed' ? c2 : c2; // primary boundary
 const C_bar_value_1 = c1;
 const C_bar_value_2 = c2;

 // 3. Non-Central Risk & Power Evaluation
 let beta = 0;
 let power = 0;

 if (varianceKnown) {
 if (tailType ==='right') {
 beta = normalCDF(c2, effectH1Mean, se);
 power = 1 - beta;
 } else if (tailType ==='left') {
 beta = 1 - normalCDF(c2, effectH1Mean, se);
 power = 1 - beta;
 } else { // two-tailed
 beta = normalCDF(c2, effectH1Mean, se) - normalCDF(c1, effectH1Mean, se);
 power = 1 - beta;
 }
 } else {
 if (tailType ==='right') {
 beta = studentTCDF(zCrit - ncp, df);
 power = 1 - beta;
 } else if (tailType ==='left') {
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
 }, [mu0, mu1, muH1, sigma, n, alpha, testType, tailType, isValid, varianceKnown, calculatePower]);

 // --- Dynamic Decision Data Logic ---
 const decisionData = useMemo(() => {
 if (!stats || !isValid) return null;

 // We decouple xBar from mu1, by defining xBar variable which will eventually be bound to a separate state.
 // For now we use the existing mu1 state as the xBar fallback until we add the xBar state, but the calculation is completely isolated.
 const xBarValue = mu1; 
 
 let isReject = false;
 let ruleText ='';
 let decisionHeading ='';
 let belongingExplanationText ='';
 
 // Formal Structural Set Compilation using purely C and \bar{C}
 let zoneRejectionTeX ='';
 let zoneAcceptanceTeX ='';

 const formattedXBar = xBarValue.toFixed(xBarValue % 1 === 0 ? 0 : 3);

 if (tailType ==='right') {
 isReject = xBarValue >= stats.C_bar_value;
 zoneRejectionTeX = `C = \\{ \\bar{X} \\mid \\bar{X} \\ge ${stats.C_bar_value.toFixed(4)} \\}`;
 zoneAcceptanceTeX = `\\bar{C} = \\{ \\bar{X} \\mid \\bar{X} < ${stats.C_bar_value.toFixed(4)} \\}`;
 } else if (tailType ==='left') {
 isReject = xBarValue <= stats.C_bar_value;
 zoneRejectionTeX = `C = \\{ \\bar{X} \\mid \\bar{X} \\le ${stats.C_bar_value.toFixed(4)} \\}`;
 zoneAcceptanceTeX = `\\bar{C} = \\{ \\bar{X} \\mid \\bar{X} > ${stats.C_bar_value.toFixed(4)} \\}`;
 } else { // two-tailed
 isReject = xBarValue <= stats.C_bar_value_1 || xBarValue >= stats.C_bar_value_2;
 zoneRejectionTeX = `C = \\{ \\bar{X} \\mid \\bar{X} \\le ${stats.C_bar_value_1.toFixed(4)} \\lor \\bar{X} \\ge ${stats.C_bar_value_2.toFixed(4)} \\}`;
 zoneAcceptanceTeX = `\\bar{C} = \\{ \\bar{X} \\mid ${stats.C_bar_value_1.toFixed(4)} < \\bar{X} < ${stats.C_bar_value_2.toFixed(4)} \\}`;
 }

 if (isReject) {
 decisionHeading ='\\text{Reject } H_0';
 belongingExplanationText = `מכיוון שממוצע המדגם בפועל הוא X̄ = ${formattedXBar}, הוא שייך לקבוצה C.`;
 } else {
 decisionHeading ='\\text{Do Not Reject } H_0';
 belongingExplanationText = `מכיוון שממוצע המדגם בפועל הוא X̄ = ${formattedXBar}, הוא שייך לקבוצה \\bar{C}.`;
 }

 let verbalConclusion ='';
 const comparisonText = tailType ==='right' ? `גדולה מ-${mu0}` : tailType ==='left' ? `קטנה מ-${mu0}` : `שונה מ-${mu0}`;
 
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

 // --- Chart Limits for X-axis & Gradient Calculations ---
  const chartLimits = useMemo(() => {
    if (!stats || !isValid) return { xMin: 0, xMax: 100 };
    const { effectH0Mean, effectH1Mean, se } = stats;
    const minCenter = calculatePower ? Math.min(effectH0Mean, effectH1Mean) : effectH0Mean;
    const maxCenter = calculatePower ? Math.max(effectH0Mean, effectH1Mean) : effectH0Mean;
    return {
      xMin: minCenter - 4.2 * se,
      xMax: maxCenter + 4.2 * se,
    };
  }, [stats, isValid, calculatePower]);

  // --- Custom Ticks for X-Axis representing means and standard deviations ---
  const xAxisTicks = useMemo(() => {
    if (!stats || !isValid) return [];
    const { effectH0Mean, effectH1Mean, se } = stats;
    
    const ticksSet = new Set<string>();
    
    const addVal = (val: number) => {
      ticksSet.add(val.toFixed(2));
    };

    addVal(effectH0Mean);
    addVal(effectH0Mean - se);
    addVal(effectH0Mean + se);
    addVal(effectH0Mean - 2 * se);
    addVal(effectH0Mean + 2 * se);
    addVal(effectH0Mean - 3 * se);
    addVal(effectH0Mean + 3 * se);

    if (calculatePower) {
      addVal(effectH1Mean);
      addVal(effectH1Mean - se);
      addVal(effectH1Mean + se);
      addVal(effectH1Mean - 2 * se);
      addVal(effectH1Mean + 2 * se);
      addVal(effectH1Mean - 3 * se);
      addVal(effectH1Mean + 3 * se);
    }

    const rawTicks = Array.from(ticksSet).map(Number).sort((a, b) => a - b);
    const finalTicks: number[] = [];
    const minSpacing = se * 0.45;

    for (const t of rawTicks) {
      if (finalTicks.length === 0) {
        finalTicks.push(t);
      } else {
        const prev = finalTicks[finalTicks.length - 1];
        if (t - prev >= minSpacing) {
          finalTicks.push(t);
        } else {
          const diffPrevToMean = Math.abs(prev - effectH0Mean);
          const diffCurrToMean = Math.abs(t - effectH0Mean);
          const diffPrevToMeanH1 = calculatePower ? Math.abs(prev - effectH1Mean) : Infinity;
          const diffCurrToMeanH1 = calculatePower ? Math.abs(t - effectH1Mean) : Infinity;
          
          const prevIsMean = diffPrevToMean < 0.01 || diffPrevToMeanH1 < 0.01;
          const currIsMean = diffCurrToMean < 0.01 || diffCurrToMeanH1 < 0.01;
          
          if (currIsMean && !prevIsMean) {
            finalTicks[finalTicks.length - 1] = t;
          }
        }
      }
    }
    return finalTicks;
  }, [stats, isValid, calculatePower]);

  // --- Dynamic Graph Data Generation ---
  const chartData = useMemo(() => {
    if (!stats || !isValid) return [];

    const pts = [];
    const numPoints = 180;
    const { effectH0Mean, effectH1Mean, se, c1, c2 } = stats;
    const { xMin, xMax } = chartLimits;
    const step = (xMax - xMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const x = xMin + i * step;
      const { df, varianceKnown } = stats;
      const pdfH0 = varianceKnown 
        ? normalPDF(x, effectH0Mean, se) 
        : studentTPDF((x - effectH0Mean) / se, df) / se;
      const pdfH1 = calculatePower ? (varianceKnown 
        ? normalPDF(x, effectH1Mean, se) 
        : studentTPDF((x - effectH1Mean) / se, df) / se) : 0;

      // Determine rejection regions to shade Alpha and Power
      let isRejected = false;
      if (tailType === 'right') {
        isRejected = x >= c2;
      } else if (tailType === 'left') {
        isRejected = x <= c2; 
      } else { // two-tailed
        isRejected = x <= c1 || x >= c2;
      }

      // Rejection area under H0 is Alpha (Type I Error)
      const alphaShade = isRejected ? pdfH0 : 0;
      
      // Rejection area under H1 is Power (1-Beta)
      const powerShade = calculatePower && isRejected ? pdfH1 : 0;

      pts.push({
        x: Number(x.toFixed(4)),
        pdfH0,
        pdfH1,
        alphaShade,
        powerShade,
      });
    }

    return pts;
  }, [stats, isValid, tailType, calculatePower, chartLimits]);

 // Custom tooltips for graphs
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPt = payload[0].payload;
      return (
        <div className="p-3 border rounded-xl shadow-lg text-xs font-sans text-right space-y-1 backdrop-blur-md bg-slate-900/90 border-slate-700 text-slate-100">
          <p className="font-bold text-sm text-indigo-400">נקודת נתונים</p>
          <p className="flex justify-between gap-4">
            <span>X:</span> 
            <span className="font-mono font-bold">{dataPt.x}</span>
          </p>
          <p className="flex justify-between gap-4 text-blue-300">
            <span>H₀:</span> 
            <span className="font-mono font-bold">{dataPt.pdfH0.toFixed(4)}</span>
          </p>
          <p className="flex justify-between gap-4 text-amber-300">
            <span>H₁:</span>
						<span className="font-mono font-bold">{dataPt.pdfH1.toFixed(4)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 bg-slate-950 min-h-screen text-slate-100 p-4 sm:p-6 md:p-8" dir="rtl">
      {/* Parameters Input Card */}
      <div className="rounded-3xl p-5 md:p-6 border shadow-md transition-colors bg-slate-900 border-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-4 mb-5">
          <Sliders size={20} className="text-indigo-500" />
          <h3 className="text-lg sm:text-xl font-black text-slate-100">
            פרמטרים והשערות מחקר
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_225px] gap-6">
          <div className="flex-1 min-w-0">
            {/* Custom Parameters Table Layout */}
            <div className="overflow-visible rounded-2xl border border-slate-800 bg-slate-950/10 transition-all mb-6" dir="rtl">
              <table className="w-full border-collapse border-spacing-0">
                <thead>
                  <tr className="bg-slate-800/40 border-b border-slate-800">
                    <th className="p-3.5 text-right font-black text-xs sm:text-sm text-slate-300 w-[28%] border-l border-slate-800">
                      <div className="flex items-center gap-2.5 justify-start">
                        <button
                          type="button"
                          onClick={() => setVarianceKnown(!varianceKnown)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            varianceKnown ? 'bg-indigo-600' : 'bg-slate-700/80'
                          }`}
                        >
                          {/* On State Checkmark */}
                          <span className={`absolute right-1 top-0 bottom-0 flex items-center justify-center text-white transition-opacity duration-200 ${varianceKnown ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                            <Check size={10} className="stroke-[3.5]" />
                          </span>

                          {/* Off State X */}
                          <span className={`absolute left-1 top-0 bottom-0 flex items-center justify-center text-slate-300 transition-opacity duration-200 ${!varianceKnown ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
                            <X size={10} className="stroke-[3.5]" />
                          </span>

                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              varianceKnown ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span>שונות ידועה:</span>
                      </div>
                    </th>
                    <th className="p-3.5 text-center font-black text-xs sm:text-sm text-slate-300 w-[24%] border-l border-slate-800">
                      <div className="flex items-center gap-1.5 justify-center">
                        <span>אוכלוסייה</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-none bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold shrink-0">H₀</span>
                      </div>
                    </th>
                    <th className="p-3.5 text-center font-black text-xs sm:text-sm text-slate-300 w-[24%] border-l border-slate-800">
                      מדגם
                    </th>
                    <th className="p-3.5 text-center font-black text-xs sm:text-sm text-slate-300 w-[24%]">
                      <InputTooltip content="תחת הנחת סטיית תקן זהה, אם ידועה">
                        <div className="flex items-center gap-1.5 justify-center cursor-help">
                          <span>השערת המחקר</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-none bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold shrink-0">H₁</span>
                        </div>
                      </InputTooltip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: mu0, n, and power toggle */}
                  <tr className="border-b border-slate-800/80">
                    <td className="p-4 text-right align-middle text-xs sm:text-sm font-semibold border-l border-slate-800 bg-slate-950/20">
                      <div className="flex items-center gap-1.5 justify-start">
                        <InputTooltip content="תוחלת אוכלוסיית הבסיס (השערת האפס H₀)" className="w-full justify-between">
                          <span className="cursor-help border-b border-dotted border-slate-500">
                            תוחלת (μ₀):
                          </span>
                        </InputTooltip>
                      </div>
                    </td>
                    <td className="p-3 align-middle border-l border-slate-800 bg-slate-900/40">
                      <input
                        type="text"
                        value={mu0Input}
                        onChange={(e) => handleMu0Change(e.target.value)}
                        className={`w-full bg-transparent px-3 py-1 font-mono font-bold text-center text-lg sm:text-xl text-slate-100 placeholder-slate-400 outline-none transition-all rounded focus:bg-indigo-950/10 ${
                          errors.mu0 ? 'text-red-400 font-bold' : ''
                        }`}
                        placeholder="100"
                        dir="ltr"
                      />
                      {errors.mu0 && (
                        <div className="text-[11px] text-red-400 font-bold leading-tight mt-1 text-center">{errors.mu0}</div>
                      )}
                    </td>
                    <td className="p-3 align-middle border-l border-slate-800 bg-slate-900/40">
                      <div className="flex items-center justify-between gap-2 ctrl-cell-wrapper w-full">
                        <InputTooltip content="מספר התצפיות במדגם (n)">
                          <span className={`text-xs sm:text-sm text-slate-400 font-bold shrink-0 cursor-help border-b border-dotted border-slate-500 ${testType === 'single' ? 'opacity-30' : ''}`}>
                            גודל מדגם (n):
                          </span>
                        </InputTooltip>
                        <div className="w-16 sm:w-20 shrink-0">
                          <input
                            type="text"
                            value={testType === 'single' ? '1' : nInput}
                            disabled={testType === 'single'}
                            onChange={(e) => handleNChange(e.target.value)}
                            className={`w-full bg-transparent px-2 py-1 font-mono font-bold text-center text-lg sm:text-xl text-slate-100 placeholder-slate-400 outline-none transition-all rounded focus:bg-indigo-950/10 ${
                              testType === 'single' ? 'opacity-40 cursor-not-allowed bg-slate-100/5' : ''
                            } ${errors.n && testType !== 'single' ? 'text-red-400 font-bold' : ''}`}
                            placeholder="36"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      {errors.n && testType !== 'single' && (
                        <div className="text-[11px] text-red-400 font-bold leading-tight mt-1 text-right">{errors.n}</div>
                      )}
                    </td>
                    <td className="p-3 align-middle bg-slate-900/40">
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => setCalculatePower(!calculatePower)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            calculatePower ? 'bg-indigo-600' : 'bg-slate-700/80'
                          }`}
                        >
                          <span
                            className={`pointer-events-none flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                              calculatePower ? '-translate-x-5' : 'translate-x-0'
                            }`}
                          >
                            {calculatePower ? (
                              <div className="w-[2px] h-[10px] bg-indigo-600 rounded-full" />
                            ) : (
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-400" />
                            )}
                          </span>
                        </button>
                        <span className="text-xs sm:text-sm font-bold text-slate-300">
                          חישוב עוצמה
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Row 2: sigma and mu1(Xbar) */}
                  <tr>
                    <td className="p-4 text-right align-middle text-xs sm:text-sm font-semibold border-l border-slate-800 bg-slate-950/20">
                      <div className="flex items-center gap-1.5 justify-start">
                        <InputTooltip content={varianceKnown ? "סטיית תקן של האוכלוסייה (σ)" : "סטיית תקן מדגמית (S) המשמשת כאומד לסטיית התקן"} className="w-full justify-between">
                          <span className="cursor-help border-b border-dotted border-slate-500">
                            {varianceKnown ? 'סטיית תקן (σ):' : 'סטיית תקן (S):'}
                          </span>
                        </InputTooltip>
                      </div>
                    </td>
                    <td className="p-3 align-middle border-l border-slate-800 bg-slate-900/40">
                      <input
                        type="text"
                        value={sigmaInput}
                        onChange={(e) => handleSigmaChange(e.target.value)}
                        className={`w-full bg-transparent px-3 py-1 font-mono font-bold text-center text-lg sm:text-xl text-slate-100 placeholder-slate-400 outline-none transition-all rounded focus:bg-indigo-950/10 ${
                          errors.sigma ? 'text-red-400 font-bold' : ''
                        }`}
                        placeholder="15"
                        dir="ltr"
                      />
                      {errors.sigma && (
                        <div className="text-[11px] text-red-00 text-red-400 font-bold leading-tight mt-1 text-center">{errors.sigma}</div>
                      )}
                    </td>
                    <td className="p-3 align-middle border-l border-slate-800 bg-slate-900/40">
                      <div className="flex items-center justify-between gap-2 ctrl-cell-wrapper w-full">
                        <InputTooltip content="ממוצע המדגם בפועל">
                          <span className="text-xs sm:text-sm text-slate-400 font-bold shrink-0 cursor-help border-b border-dotted border-slate-500">
                            ממוצע מדגם (X̄):
                          </span>
                        </InputTooltip>
                        <div className="w-16 sm:w-20 shrink-0">
                          <input
                            type="text"
                            value={mu1Input}
                            onChange={(e) => handleMu1Change(e.target.value)}
                            className={`w-full bg-transparent px-2 py-1 font-mono font-bold text-center text-lg sm:text-xl text-slate-100 placeholder-slate-400 outline-none transition-all rounded focus:bg-indigo-950/10 ${
                              errors.mu1 ? 'text-red-400 font-bold' : ''
                            }`}
                            placeholder="108"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      {errors.mu1 && (
                        <div className="text-[11px] text-red-400 font-bold leading-tight mt-1 text-right">{errors.mu1}</div>
                      )}
                    </td>
                    <td className={`p-3 align-middle bg-slate-900/40 transition-all ${!calculatePower ? 'opacity-30' : ''}`}>
                      <div className="flex items-center justify-between gap-2 ctrl-cell-wrapper w-full">
                        <InputTooltip content="התוחלת המשוערת תחת השערת המחקר האלטרנטיבית (H₁)">
                          <span className={`text-xs sm:text-sm font-bold shrink-0 cursor-help border-b border-dotted border-slate-500 ${!calculatePower ? 'text-slate-500 opacity-50' : 'text-slate-400'}`}>
                            ממוצע (μ₁):
                          </span>
                        </InputTooltip>
                        <div className="w-16 sm:w-20 shrink-0">
                          <input
                            type="text"
                            value={muH1Input}
                            disabled={!calculatePower}
                            onChange={(e) => handleMuH1Change(e.target.value)}
                            className={`w-full bg-transparent px-2 py-1 font-mono font-bold text-center text-lg sm:text-xl text-slate-100 placeholder-slate-400 outline-none transition-all rounded focus:bg-indigo-950/10 ${
                              !calculatePower ? 'opacity-40 cursor-not-allowed' : ''
                            } ${calculatePower && errors.muH1 ? 'text-red-400 font-bold' : ''}`}
                            placeholder="108"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      {calculatePower && errors.muH1 && (
                        <div className="text-[11px] text-red-400 font-bold leading-tight mt-1 text-right">{errors.muH1}</div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Alpha Selection Row with type manually option */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4" dir="rtl">
              <span className="text-xs sm:text-sm font-black text-slate-400">
                :(α) מובהקות ורמת סמך
              </span>
              
              <div className="flex gap-1.5 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800">
                {[0.10, 0.05, 0.01].map((pVal) => (
                  <button
                    key={pVal}
                    type="button"
                    onClick={() => applyAlphaPreset(pVal)}
                    className={`px-3 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all ${
                      alpha === pVal
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pVal * 100}%
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={alphaInput}
                  onChange={(e) => handleAlphaChange(e.target.value)}
                  className={`w-18 px-2.5 py-1.5 bg-slate-900 border rounded-xl text-center font-mono font-bold text-sm text-indigo-300 focus:bg-indigo-950/20 outline-none ${
                    errors.alpha ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' : 'border-slate-800 focus:ring-4 focus:ring-indigo-500/10'
                  }`}
                  placeholder="0.05"
                  dir="ltr"
                />
              </div>
              {errors.alpha && (
                <p className="text-[11px] text-red-400 font-bold mt-1 text-right">{errors.alpha}</p>
              )}
            </div>
          </div>

          {/* Main Test Statistic Type Selector */}
          <div className="flex flex-col gap-3 shrink-0 h-[229.583px] w-[201px] bg-slate-950/20 border border-slate-800/60 p-4 rounded-2xl">
            <span className="text-xs sm:text-sm font-black text-slate-300 text-right w-full">סטטיסטי המבחן:</span>
            <div className="flex flex-col gap-2 w-full">
              {[
                { id: 'single', label: 'תצפית X' },
                { id: 'mean', label: 'ממוצע X̄' },
                { id: 'sum', label: 'סכום ΣX' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTestType(item.id as TestType)}
                  className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all text-center border ${
                    testType === item.id
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-md scale-[1.02]'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
  {/* Dynamic Formal Hypotheses Display Banner with H1 Buttons */}
  <div className="mb-6 p-4 rounded-2xl border border-indigo-900/40 bg-indigo-950/10 flex flex-col xl:flex-row items-center justify-between gap-6 transition-all" dir="rtl">
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-black text-indigo-200 flex items-center gap-1.5 mb-1">
        <Award size={16} className="text-indigo-500 shrink-0" />
        השערות המבחן בצורה הפורמלית:
      </h4>
      <span className="text-xs text-slate-400 block mt-1 leading-relaxed font-medium max-w-sm">
        קביעת השערת האפס המבטאת חוסר שינוי, למול השערת המחקר. בחרו את כיוון השערת המחקר:
      </span>
    </div>

    {/* Squared Buttons for H1 */}
    <div className="flex gap-2 shrink-0">
      <button 
        onClick={() => setTailType('right')} 
        className={`flex flex-col items-center justify-center w-[85px] h-16 rounded-xl border transition-all ${tailType === 'right' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
      >
        <span className="text-xs font-black">ימני</span>
        <span className="text-[10px] font-mono mt-1 font-bold" dir="ltr">μ &gt; μ₀</span>
      </button>
      <button 
        onClick={() => setTailType('two-tailed')} 
        className={`flex flex-col items-center justify-center w-[85px] h-16 rounded-xl border transition-all ${tailType === 'two-tailed' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
      >
        <span className="text-xs font-black">דו-צדדי</span>
        <span className="text-[10px] font-mono mt-1 font-bold" dir="ltr">μ ≠ μ₀</span>
      </button>
      <button 
        onClick={() => setTailType('left')} 
        className={`flex flex-col items-center justify-center w-[85px] h-16 rounded-xl border transition-all ${tailType === 'left' ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
      >
        <span className="text-xs font-black">שמאלי</span>
        <span className="text-[10px] font-mono mt-1 font-bold" dir="ltr">μ &lt; μ₀</span>
      </button>
    </div>

    {/* Formal Hypotheses Display */}
    <div className="flex flex-col items-center justify-center p-3 bg-slate-950/90 border border-slate-800 rounded-xl min-w-[180px] shrink-0 text-center shadow-sm">
      <div className="text-sm sm:text-base font-extrabold text-slate-100 font-mono tracking-wide flex justify-center w-full" dir="ltr">
        <InlineMath math={getFormalHypothesisMath()} />
      </div>
      <div className="text-[10px] text-slate-500 font-mono mt-1.5 border-t border-dotted border-slate-800 pt-1 flex justify-center w-full" dir="ltr">
        <InlineMath math={getGeneralFormalHypothesisMath()} />
      </div>
    </div>
  </div>

  {/* Popular Z & Phi Row for Hypothesis Testing */}
  <div className="mb-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-right space-y-3 shadow-sm">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-slate-300">
        <Sliders size={14} className="text-indigo-400" />
        <span className="text-xs font-black font-sans text-indigo-200">
          ערכים וציוני תקן פופולריים למבחן {tailType === 'two-tailed' ? 'דו-צדדי' : 'חד-צדדי'}:
        </span>
      </div>
      <span className="text-[10px] text-slate-400">מודגש אוטומטית בהתאם לקלט פעיל. לחצו למילוי ועדכון מהיר של הפרמטרים:</span>
    </div>
    
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {[
        { confidence: "90%", alpha: 0.10, tail: "one", phi: 0.9000, z: 1.282, label: "חד-צדדי (α=0.10)" },
        { confidence: "90%", alpha: 0.10, tail: "two", phi: 0.9500, z: 1.645, label: "דו-צדדי (α=0.10)" },
        { confidence: "95%", alpha: 0.05, tail: "one", phi: 0.9500, z: 1.645, label: "חד-צדדי (α=0.05)" },
        { confidence: "95%", alpha: 0.05, tail: "two", phi: 0.9750, z: 1.960, label: "דו-צדדי (α=0.05)" },
        { confidence: "99%", alpha: 0.01, tail: "one", phi: 0.9900, z: 2.326, label: "חד-צדדי (α=0.01)" },
        { confidence: "99%", alpha: 0.01, tail: "two", phi: 0.9950, z: 2.576, label: "דו-צדדי (α=0.01)" },
      ].filter((item) => {
        const isTwoTailed = tailType === 'two-tailed';
        return isTwoTailed ? item.tail === 'two' : item.tail === 'one';
      }).map((item, idx) => {
        const isMatched = Math.abs(alpha - item.alpha) < 0.001 && (
          (tailType === 'two-tailed' && item.tail === 'two') ||
          (tailType !== 'two-tailed' && item.tail === 'one')
        );

        return (
          <button
            key={idx}
            type="button"
            onClick={() => {
              applyAlphaPreset(item.alpha);
              if (item.tail === 'two') {
                setTailType('two-tailed');
              } else {
                if (tailType !== 'left' && tailType !== 'right') {
                  setTailType('right');
                }
              }
            }}
            className={`p-2.5 rounded-xl border text-center transition-all duration-300 relative overflow-hidden select-none cursor-pointer flex flex-col justify-between h-24 ${
              isMatched
                ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.25)] ring-1 ring-indigo-500'
                : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/60'
            }`}
          >
            {isMatched && (
              <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-l from-indigo-500 to-blue-500" />
            )}
            <div>
              <div className="text-[10px] font-black text-indigo-300/90 leading-tight">{item.label}</div>
              <div className="text-[13px] font-black text-slate-100 mt-1">רמת ביטחון {item.confidence}</div>
            </div>
            <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-slate-800">
              <span className="text-[9px] text-slate-400 font-mono">Z_crit:</span>
              <span className="text-xs font-black font-mono text-indigo-300">{item.z.toFixed(3)}</span>
              <span className="text-[9px] text-slate-400 font-mono">Φ: {item.phi.toFixed(4)}</span>
            </div>
          </button>
        );
      })}
    </div>
  </div>

  {/* Main Grid Layout */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

  {/* RIGHT Column - Dashboard & Visual Analytics */}
  <div className="contents">

 {/* Overlapping Curves Chart */}
 <div className="rounded-3xl p-6 md:p-8 border shadow-md transition-all bg-slate-900 border-slate-800 w-full min-w-0 order-1 lg:order-1">
 <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 border-b border-slate-800 pb-4 mb-5">
 <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
 <span className="flex items-center gap-1.5 font-black text-blue-400 select-none">
 <span className="w-3 h-3 rounded-none bg-blue-600 inline-block" />
 H₀
 </span>
 <span className={`flex items-center gap-1.5 font-black transition-all cursor-pointer select-none ${calculatePower ? 'text-amber-400' : 'text-slate-500 opacity-60 hover:opacity-100'}`} onClick={() => setCalculatePower(!calculatePower)}>
 <span className={`w-3 h-3 rounded-none inline-block ${calculatePower ? 'bg-amber-500' : 'bg-slate-700/80'}`} />
 H₁
 </span>
 <span className="flex items-center gap-1.5 font-black text-green-400 select-none">
  <span className="w-3 h-3 rounded-none bg-green-500/30 border border-green-500 inline-block" />
  C (אזור דחייה)
</span>
 <span className={`flex items-center gap-1.5 font-black transition-all select-none ${calculatePower ? 'text-emerald-400' : 'hidden opacity-0'}`}>
 <span className="w-3 h-3 rounded-none bg-emerald-500/30 border border-emerald-500 inline-block" />
 1-β
 </span>
 </div>
 </div>

 {isValid && stats ? (
 <div className="h-[380px] w-full mt-4" dir="ltr">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -25, bottom: 5 }}>
  <defs>
  <linearGradient id="h0Color" x1="0" y1="0" x2="0" y2="1">
  <stop offset="5%" stopColor={'var(--color-accent)'} stopOpacity={0.1}/>
  <stop offset="95%" stopColor={'var(--color-accent)'} stopOpacity={0}/>
  </linearGradient>
  <linearGradient id="h1Color" x1="0" y1="0" x2="0" y2="1">
  <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.1}/>
  <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0}/>
  </linearGradient>
  {(() => {
    if (!stats || !isValid || !chartLimits) return null;
    const { c1, c2 } = stats;
    const { xMin, xMax } = chartLimits;

    const pct = (val) => {
      const p = ((val - xMin) / (xMax - xMin)) * 100;
      return Math.max(0, Math.min(100, p));
    };

    if (tailType === 'right') {
      const c2Pct = pct(c2);
      return (
        <linearGradient id="rejectionGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0} />
          <stop offset={c2Pct + "%"} stopColor="#22c55e" stopOpacity={0} />
          <stop offset={(c2Pct + 0.001) + "%"} stopColor="#22c55e" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={1.0} />
        </linearGradient>
      );
    } else if (tailType === 'left') {
      const c2Pct = pct(c2);
      return (
        <linearGradient id="rejectionGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={1.0} />
          <stop offset={c2Pct + "%"} stopColor="#22c55e" stopOpacity={0.1} />
          <stop offset={(c2Pct + 0.001) + "%"} stopColor="#22c55e" stopOpacity={0} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      );
    } else { // two-tailed
      const c1Pct = pct(c1);
      const c2Pct = pct(c2);
      return (
        <linearGradient id="rejectionGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={1.0} />
          <stop offset={c1Pct + "%"} stopColor="#22c55e" stopOpacity={0.1} />
          <stop offset={(c1Pct + 0.001) + "%"} stopColor="#22c55e" stopOpacity={0} />
          <stop offset={c2Pct + "%"} stopColor="#22c55e" stopOpacity={0} />
          <stop offset={(c2Pct + 0.001) + "%"} stopColor="#22c55e" stopOpacity={0.1} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={1.0} />
        </linearGradient>
      );
    }
  })()}
  </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={'var(--chart-grid)'} />
 
 <XAxis 
 dataKey="x" 
 type="number" 
 domain={[chartLimits.xMin, chartLimits.xMax]}
 ticks={xAxisTicks}
 tick={{ fill:'var(--chart-axis-label)', fontSize: 13, fontWeight: 'bold' }}
 axisLine={{ stroke:'var(--chart-grid)' }}
 tickLine={true}
 tickFormatter={(val) => val.toFixed(2)}
 />
 <YAxis hide={true} />
 <RechartsTooltip content={<CustomChartTooltip />} />

 {/* H0 Curve Base Area */}
 <Area 
 type="monotone" 
 dataKey="pdfH0" 
 stroke={'var(--color-accent)'} 
 strokeWidth={2} 
 fill="url(#h0Color)" 
 dot={false}
 isAnimationActive={false}
 />

 {/* H1 Curve Base Area */}
 {calculatePower && (
 <Area 
 type="monotone" 
 dataKey="pdfH1" 
 stroke="var(--chart-4)" 
 strokeWidth={2} 
 fill="url(#h1Color)" 
 dot={false}
 isAnimationActive={false}
 />
 )}

 {/* Shaded Red Layer for Alpha Area (Type I) */}
 <Area 
  type="monotone" 
  dataKey="alphaShade" 
  stroke="none" 
  fill="url(#rejectionGradient)" 
  dot={false}
  isAnimationActive={false}
/>

 {/* Shaded Emerald Layer for Power Area */}
 {calculatePower && (
 <Area 
 type="monotone" 
 dataKey="powerShade" 
 stroke="none" 
 fill={'var(--chart-acceptance)'} 
 dot={false}
 isAnimationActive={false}
 />
 )}



 {/* Vertical Reference Line at Mean of H0 */}
 <ReferenceLine 
  x={stats.effectH0Mean} 
  stroke="var(--color-accent)" 
  strokeWidth={1.5} 
  strokeDasharray="4 4"
  label={{
    value: "μ₀",
    position: "top",
    fill: "var(--color-accent)",
    fontWeight: "bold",
    fontSize: 12
  }}
  />

 {/* Vertical Reference Line at Mean of H1 */}
 <ReferenceLine 
  x={stats.effectH1Mean} 
  stroke="var(--chart-4)" 
  strokeWidth={1.5} 
  strokeDasharray="4 4"
  label={calculatePower ? {
    value: "μ₁",
    position: "top",
    fill: "var(--chart-4)",
    fontWeight: "bold",
    fontSize: 12
  } : undefined}
  />

 {/* Vertical LINE for SELECTOR: Critical Values */}
 {tailType ==='two-tailed' ? (
 <>
 <ReferenceLine 
 x={stats.c1} 
 stroke="var(--color-error)" 
 strokeWidth={2.5} 
 label={{
 value: `C₁: ${stats.c1.toFixed(2)}`,
 position:'top',
 fill:'var(--color-error)',
 fontSize: 13,
 fontWeight:'bold'
 }}
 />
 <ReferenceLine 
 x={stats.c2} 
 stroke="var(--color-error)" 
 strokeWidth={2.5} 
 label={{
 value: `C₂: ${stats.c2.toFixed(2)}`,
 position:'top',
 fill:'var(--color-error)',
 fontSize: 13,
 fontWeight:'bold'
 }}
 />
 </>
 ) : (
 <ReferenceLine 
 x={stats.c2} 
 stroke="var(--color-error)" 
 strokeWidth={3} 
 label={{
 value: `C: ${stats.c2.toFixed(2)}`,
 position:'top',
 fill:'var(--color-error)',
 fontSize: 14,
 fontWeight:'bold'
 }}
 />
 )}

 </AreaChart>
 </ResponsiveContainer>
 </div>
 ) : (
 <div className="py-24 text-center text-red-650 text-red-400 font-black text-lg md:text-xl">
 נא לתקן את שגיאות הקלטים בצד ימין על מנת להציג את הגרף.
 </div>
 )}
 </div>

 {/* Solutions Steps Accordion / Panel */}
 <div className="rounded-3xl border shadow-md transition-all overflow-hidden bg-slate-900 border-slate-800 w-full min-w-0 lg:col-span-2 order-3 lg:order-3">
 <button
  onClick={() => setShowSteps(!showSteps)}
  className="w-full px-8 py-5.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-black text-slate-50 hover:bg-slate-800/40 transition-colors border-b border-slate-800/50"
 >
  <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-right">
   <div className="flex items-center gap-3">
    <Calculator className="text-indigo-600" size={24} />
    <span className="text-xl sm:text-2xl font-black">שלבי פתרון מתמטיים וגזירת הערכים</span>
   </div>
   {isValid && decisionData && (
    <div className="mr-0 sm:mr-3 flex items-center shrink-0">
     {decisionData.isReject ? (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] leading-none">
       <CheckCircle size={14} className="text-emerald-400 shrink-0" />
       <span>החלטה: דוחים את </span>
       <span dir="ltr" className="inline-block"><InlineMath math="H_0" /></span>
      </div>
     ) : (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-red-500/15 text-red-400 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)] leading-none">
       <XCircle size={14} className="text-red-400 shrink-0" />
       <span>החלטה: אין לדחות את </span>
       <span dir="ltr" className="inline-block"><InlineMath math="H_0" /></span>
      </div>
     )}
    </div>
   )}
  </div>
  <div className="flex items-center self-end sm:self-auto text-slate-400">
   {showSteps ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
  </div>
 </button>

 <AnimatePresence>
 {showSteps && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height:'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="px-8 py-6.5 space-y-8"
 >
 {isValid && stats ? (
 <div className="space-y-8 text-base divide-y divide-slate-200 divide-slate-800/50">
 
 {/* Step 1: Hypothesis Formulation (New Step requested by user) */}
 <div className="space-y-3 pt-4">
 <div className="flex items-center gap-3 font-extrabold text-indigo-400">
 <span className="w-9 h-9 rounded-full bg-indigo-100 bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">1</span>
 <span className="text-xl sm:text-2xl font-black">ניסוח השערות המחקר (השערת האפס והשערת המחקר)</span>
 </div>
 <p className="text-base sm:text-lg text-slate-200 leading-relaxed pr-9 font-semibold">
 הצעד הראשון והחשוב בכל מבחן השערה סטטיסטי הוא ניסוח מדויק של צמד ההשערות. ההשערות מנוסחות תמיד במונחי פרמטר האוכלוסייה התיאורטי (<InlineMath math="\mu" />):
 </p>
 
 <div className="pr-9 py-3 space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {/* H0 Card */}
 <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3 text-right">
 <div className="flex items-center gap-2 text-indigo-300 font-extrabold justify-start">
 <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/15 border border-indigo-500/30 font-mono">H0</span>
 <span>השערת האפס</span>
 </div>
 <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 text-center" dir="ltr">
 <BlockMath math={`H_0: \\mu = ${mu0}`} />
 </div>
 <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
 מניחה שאין השפעה, קשר או שינוי חדש במערכת, וכי המצב הקיים נותר ללא שינוי. תוחלת האוכלוסייה שווה בדיוק לערך הבסיס שהוגדר.
 </p>
 <p className="text-xs sm:text-sm text-slate-400 font-bold">
 ✍️ ניסוח מילולי: תוחלת האוכלוסייה (<InlineMath math="\mu" />) שווה ל-{mu0}.
 </p>
 </div>

 {/* H1 Card */}
 <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3 text-right">
 <div className="flex items-center gap-2 text-indigo-300 font-extrabold justify-start">
 <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/15 border border-indigo-500/30 font-mono">H1</span>
 <span>השערת המחקר</span>
 </div>
 <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 text-center" dir="ltr">
 {tailType === 'right' ? (
 <BlockMath math={`H_1: \\mu > ${mu0}`} />
 ) : tailType === 'left' ? (
 <BlockMath math={`H_1: \\mu < ${mu0}`} />
 ) : (
 <BlockMath math={`H_1: \\mu \\neq ${mu0}`} />
 )}
 </div>
 <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
 מייצגת את שאלת המחקר והשינוי שהחוקר מנסה להוכיח. כיוון הניסוח נקבע בהתאם לכיוון המבחן שהוגדר.
 </p>
 <p className="text-xs sm:text-sm text-slate-400 font-bold">
 ✍️ ניסוח מילולי: תוחלת האוכלוסייה (<InlineMath math="\mu" />) {' '}
 {tailType === 'right' ? (
 <span>גדולה מ-{mu0} (מבחן חד-צדדי ימני).</span>
 ) : tailType === 'left' ? (
 <span>קטנה מ-{mu0} (מבחן חד-צדדי שמאלי).</span>
 ) : (
 <span>שונה מ-{mu0} (מבחן דו-צדדי).</span>
 )}
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Step 2: Definition of variables and SE */}
 <div className="space-y-3 pt-6">
 <div className="flex items-center gap-3 font-extrabold text-indigo-400">
 <span className="w-9 h-9 rounded-full bg-indigo-100 bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">2</span>
 <span className="text-xl sm:text-2xl font-black">חישוב שגיאת התקן</span>
 </div>
 <p className="text-base sm:text-lg text-slate-200 leading-relaxed pr-9 font-semibold">
 {varianceKnown 
 ? "לפי משפט הגבול המרכזי (CLT), שגיאת התקן מייצגת את פיזור ההתפלגות של הסטטיסטי שנמדד:"
 : "מכיוון ששונות האוכלוסייה אינה ידועה, נשתמש בסטיית התקן המדגמית S כדי לאמוד את שגיאת התקן של הממוצע:"}
 </p>
 <div className="pr-9 py-3 text-xl md:text-2xl">
 {testType ==='single' ? (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">
 {varianceKnown 
 ? "תצפית בודדת: הפיזור המקורי של האוכלוסייה תקף כמות שהוא."
 : "תצפית בודדת: פיזור המדגם המקורי (S) משמש ישירות כפיזור ההתפלגות."}
 </p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`SE = ${varianceKnown ?'\\sigma' :'S'} = ${sigmaInput}`} />
 </div>
 </div>
 </div>
 ) : testType ==='mean' ? (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">
 {varianceKnown 
 ? "ממוצע מדגם: סטיית התקן מתכווצת על פי שורש גודל המדגם."
 : "ממוצע מדגם: סטיית התקן המדגמית מתכווצת על פי שורש גודל המדגם."}
 </p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`SE = \\frac{${varianceKnown ?'\\sigma' :'S'}}{\\sqrt{n}} = \\frac{${sigmaInput}}{\\sqrt{${nInput}}} = ${stats.se.toFixed(4)}`} />
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">
 {varianceKnown
 ? "סכום מדגם: ממוצעי ההשערה והפיזור גדלים על פי גודל המדגם."
 : "סכום מדגם: ממוצעי ההשערה והפיזור גדלים על פי גודל המדגם תוך שימוש ב-S."}
 </p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`SE = ${varianceKnown ?'\\sigma' :'S'} \\cdot \\sqrt{n} = ${sigmaInput} \\cdot \\sqrt{${nInput}} = ${stats.se.toFixed(4)}`} />
 </div>
 </div>
 <div className="text-sm sm:text-base font-bold text-slate-200 mt-2 p-4 bg-slate-800 border border-slate-700 rounded-xl">
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

 {/* Step 3: Critical Value derivation */}
 <div className="space-y-3 pt-6">
 <div className="flex items-center gap-3 font-extrabold text-indigo-400">
 <span className="w-9 h-9 rounded-full bg-indigo-100 bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">3</span>
 <span className="text-xl sm:text-2xl font-black">מציאת ערך קריטי של המבחן</span>
 </div>
 <p className="text-base sm:text-lg text-slate-205 leading-relaxed pr-9 font-semibold">
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
 {tailType ==='right' ? (
 <div className="space-y-4">
 <p className="text-base sm:text-lg text-slate-50 font-bold">
 {varianceKnown 
 ? "חד-צדדי ימני: אנו מחפשים שטח עבודה משמאל בגודל 1-α."
 : "חד-צדדי ימני (מבחן t): אנו מאתרים בקצה הימני שטח ברמת מובהקות α."}
 </p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
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
 <p className="text-sm sm:text-base text-slate-100 font-extrabold mb-2 leading-relaxed">
 עבור ערך קריטי מוגדר <InlineMath math="c" /> וכלל החלטה (עבור {statName} <InlineMath math={statSymbol} />):
 </p>
 
 <div className="space-y-3 pr-2">
 <div className="space-y-1">
 <div className="flex items-start gap-2">
 <span className="text-emerald-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
 <p className="text-xs sm:text-sm text-slate-200 font-extrabold leading-relaxed">
 <strong className="text-emerald-400 font-black font-sans">אזור הדחייה (<InlineMath math="C" />):</strong> קבוצת הערכים שעבורם נחליט לדחות את השערת האפס <InlineMath math="H_0" />.
 </p>
 </div>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-emerald-950/20 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.1)] space-y-3 text-sm sm:text-base md:text-lg font-extrabold min-w-[280px]">
 <BlockMath math={`C = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} \\ge ${stats.c2.toFixed(3)} \\right\\}`} />
 </div>
 </div>
 <p className="text-xs text-slate-400 font-bold italic mr-5">
 *תרגום למילים: אזור הדחייה מוגדר על ידי כל הערכים של {statName} שהם גדולים או שווים לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
 </p>
 </div>

 <div className="space-y-1 pt-3 border-t border-dashed border-slate-800">
 <div className="flex items-start gap-2">
 <span className="text-red-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
 <p className="text-xs sm:text-sm text-slate-200 font-extrabold leading-relaxed">
 <strong className="text-red-400 font-black font-sans">אזור הקבלה / אי-הדחייה (<InlineMath math="C^c" />):</strong> קבוצת הערכים המשלימה שעבורם לא נדחה את השערת האפס <InlineMath math="H_0" />.
 </p>
 </div>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-red-950/20 p-4 sm:p-5 rounded-2xl border-2 border-red-500/30 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.1)] space-y-3 text-sm sm:text-base md:text-lg font-extrabold min-w-[280px]">
 <BlockMath math={`C^c = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} < ${stats.c2.toFixed(3)} \\right\\}`} />
 </div>
 </div>
 <p className="text-xs text-slate-400 font-bold italic mr-5">
 *תרגום למילים: אזור הקבלה מקיף את כל {statNamePlural} הנופלים מתחת לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
 </p>
 </div>
 </div>
 </div>
 </div>
 ) : tailType ==='left' ? (
 <div className="space-y-4">
 <p className="text-base sm:text-lg text-slate-50 font-bold">
 {varianceKnown 
 ? "חד-צדדי שמאלי: אנו מחפשים שטח קיצון שמאלי בגודל α."
 : "חד-צדדי שמאלי (מבחן t): אנו מחפשים שטח קיצון שמאלי בגודל α בהתפלגות t."}
 </p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
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
 <p className="text-sm sm:text-base text-slate-100 font-extrabold mb-2 leading-relaxed">
 עבור ערך קריטי מוגדר <InlineMath math="c" /> וכלל החלטה (עבור {statName} <InlineMath math={statSymbol} />):
 </p>
 
 <div className="space-y-3 pr-2">
 <div className="space-y-1">
 <div className="flex items-start gap-2">
 <span className="text-emerald-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
 <p className="text-xs sm:text-sm text-slate-200 font-extrabold leading-relaxed">
 <strong className="text-emerald-400 font-black font-sans">אזור הדחייה (<InlineMath math="C" />):</strong> קבוצת הערכים שעבורם נחליט לדחות את השערת האפס <InlineMath math="H_0" />.
 </p>
 </div>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-emerald-950/20 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.1)] space-y-3 text-sm sm:text-base md:text-lg font-extrabold min-w-[280px]">
 <BlockMath math={`C = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} \\le ${stats.c2.toFixed(3)} \\right\\}`} />
 </div>
 </div>
 <p className="text-xs text-slate-400 font-bold italic mr-5">
 *תרגום למילים: אזור הדחייה מוגדר על ידי כל הערכים של {statName} שהם קטנים או שווים לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
 </p>
 </div>

 <div className="space-y-1 pt-3 border-t border-dashed border-slate-800">
 <div className="flex items-start gap-2">
 <span className="text-red-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
 <p className="text-xs sm:text-sm text-slate-200 font-extrabold leading-relaxed">
 <strong className="text-red-400 font-black font-sans">אזור הקבלה / אי-הדחייה (<InlineMath math="C^c" />):</strong> קבוצת הערכים המשלימה שעבורם לא נדחה את השערת האפס <InlineMath math="H_0" />.
 </p>
 </div>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-red-950/20 p-4 sm:p-5 rounded-2xl border-2 border-red-500/30 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.1)] space-y-3 text-sm sm:text-base md:text-lg font-extrabold min-w-[280px]">
 <BlockMath math={`C^c = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} > ${stats.c2.toFixed(3)} \\right\\}`} />
 </div>
 </div>
 <p className="text-xs text-slate-400 font-bold italic mr-5">
 *תרגום למילים: אזור הקבלה מקיף את כל {statNamePlural} הנופלים מעל לערך הקריטי שנקבע (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
 </p>
 </div>
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-4">
 <p className="text-base sm:text-lg text-slate-50 font-bold">דו-צדדי: אנו מפצלים את המובהקות לשני קצוות ההתפלגות (α/2 בכל קצה).</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
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
 <p className="text-sm sm:text-base text-slate-100 font-extrabold mb-2 leading-relaxed">
 עבור שני ערכים קריטיים מוגדרים <InlineMath math="c_1, c_2" /> וכלל החלטה (עבור {statName} <InlineMath math={statSymbol} />):
 </p>
 
 <div className="space-y-3 pr-2">
 <div className="space-y-1">
 <div className="flex items-start gap-2">
 <span className="text-emerald-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
 <p className="text-xs sm:text-sm text-slate-200 font-extrabold leading-relaxed">
 <strong className="text-emerald-400 font-black font-sans">אזור הדחייה (<InlineMath math="C" />):</strong> קבוצת הערכים שעבורם נחליט לדחות את השערת האפס <InlineMath math="H_0" />.
 </p>
 </div>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-emerald-950/20 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.1)] space-y-3 text-sm sm:text-base md:text-lg font-extrabold min-w-[280px]">
 <BlockMath math={`C = \\left\\{ ${statSymbol} \\;\\middle|\\; ${statSymbol} \\le ${stats.c1.toFixed(3)} \\;\\cup\\; ${statSymbol} \\ge ${stats.c2.toFixed(3)} \\right\\}`} />
 </div>
 </div>
 <p className="text-xs text-slate-404 font-bold italic mr-5">
 *תרגום למילים: אזור הדחייה מוגדר על ידי כל הערכים של {statName} שהם קטנים או שווים לערך הקריטי התחתון (<InlineMath math={`${stats.c1.toFixed(3)}`} />) או גדולים או שווים לערך הקריטי העליון (<InlineMath math={`${stats.c2.toFixed(3)}`} />).*
 </p>
 </div>

 <div className="space-y-1 pt-3 border-t border-dashed border-slate-800">
 <div className="flex items-start gap-2">
 <span className="text-red-400 font-extrabold text-sm sm:text-base shrink-0">●</span>
 <p className="text-xs sm:text-sm text-slate-205 text-slate-200 font-extrabold leading-relaxed">
 <strong className="text-red-400 font-black font-sans">אזור הקבלה / אי-הדחייה (<InlineMath math="C^c" />):</strong> קבוצת הערכים המשלימה שעבורם לא נדחה את השערת האפס <InlineMath math="H_0" />.
 </p>
 </div>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-red-950/20 p-4 sm:p-5 rounded-2xl border-2 border-red-500/30 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.1)] space-y-3 text-sm sm:text-base md:text-lg font-extrabold min-w-[280px]">
 <BlockMath math={`C^c = \\left\\{ ${statSymbol} \\;\\middle|\\; ${stats.c1.toFixed(3)} < ${statSymbol} < ${stats.c2.toFixed(3)} \\right\\}`} />
 </div>
 </div>
 <p className="text-xs text-slate-404 font-bold italic mr-5">
 *תרגום למילים: אזור הקבלה מקיף את כל {statNamePlural} הנופלים בתחום התקין שבין שני הערכים הקריטיים שנקבעו.*
 </p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Step 4: Power calculation under H1 */}
 <div className="space-y-3 pt-6">
 <div className="flex items-center gap-3 font-extrabold text-indigo-400">
 <span className="w-9 h-9 rounded-full bg-indigo-100 bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-350">4</span>
 <span className="text-xl sm:text-2xl font-black">חישוב טעות מסוג שני (<InlineMath math="\\beta" />) ועוצמת המבחן (<InlineMath math="1-\\beta" />)</span>
 </div>
 <p className="text-base sm:text-lg text-slate-200 leading-relaxed pr-9 font-semibold">
 עוצמת המבחן מייצגת את הסיכוי להגיע להחלטת דחייה מוצדקת עבור הטענה האלטרנטיבית. אנו בודקים מה השטח של התפלגות H₁ הנופל בתוך סקטור אזור הדחייה:
 </p>
 <div className="pr-9 py-3 space-y-4 text-xl md:text-2xl">
 {calculatePower ? (
 varianceKnown ? (
 tailType ==='right' ? (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">עוצמה מעל הערך הקריטי C (תחת התפלגות Z):</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`Z_{H1} = \\frac{C - \\mu_1}{SE} = \\frac{${stats.c2.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
 <BlockMath math={`\\beta = P(Accept\\ H_0 | H_1\\ is\\ True) = \\Phi(Z_{H1}) = ${stats.beta.toFixed(4)}`} />
 <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
 </div>
 </div>
 </div>
 ) : tailType ==='left' ? (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">עוצמה מתחת לערך הקריטי C (תחת התפלגות Z):</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`Z_{H1} = \\frac{C - \\mu_1}{SE} = \\frac{${stats.c1.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
 <BlockMath math={`\\beta = P(Accept\\ H_0 | H_1\\ is\\ True) = 1 - \\Phi(Z_{H1}) = ${stats.beta.toFixed(4)}`} />
 <BlockMath math={`Power (1-\\beta) = \\Phi(Z_{H1}) = ${(stats.power).toFixed(4)}`} />
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">עוצמה בשטח הדו-צדדי תחת H₁ (תחת התפלגות Z):</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`Z_{H1,1} = \\frac{C_1 - \\mu_1}{SE} = \\frac{${stats.c1.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
 <BlockMath math={`Z_{H1,2} = \\frac{C_2 - \\mu_1}{SE} = \\frac{${stats.c2.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
 <BlockMath math={`\\beta = \\Phi(${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(3)}) - \\Phi(${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(3)}) = ${stats.beta.toFixed(4)}`} />
 <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
 </div>
 </div>
 </div>
 )
 ) : (
 tailType ==='right' ? (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">חישוב לפי פונקציית התפלגות t ופרמטר אי-מרכזיות (NCP):</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`NCP = \\frac{\\mu_{H1} - \\mu_{H0}}{SE} = \\frac{${stats.effectH1Mean} - ${stats.effectH0Mean}}{${stats.se.toFixed(4)}} = ${stats.ncp.toFixed(4)}`} />
 <BlockMath math={`t_{\\beta} = t_{crit} - NCP = ${stats.zCrit.toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(stats.zCrit - stats.ncp).toFixed(4)}`} />
 <BlockMath math={`\\beta = P(t_{df} < t_{\\beta}) = ${stats.beta.toFixed(4)}`} />
 <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
 </div>
 </div>
 </div>
 ) : tailType ==='left' ? (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">חישוב לפי פונקציית התפלגות t ופרמטר אי-מרכזיות (NCP):</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`NCP = \\frac{\\mu_{H1} - \\mu_{H0}}{SE} = \\frac{${stats.effectH1Mean} - ${stats.effectH0Mean}}{${stats.se.toFixed(4)}} = ${stats.ncp.toFixed(4)}`} />
 <BlockMath math={`t_{\\beta} = t_{crit} - NCP = ${stats.zCrit.toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(stats.zCrit - stats.ncp).toFixed(4)}`} />
 <BlockMath math={`\\beta = 1 - P(t_{df} < t_{\\beta}) = ${stats.beta.toFixed(4)}`} />
 <BlockMath math={`Power (1-\\beta) = ${(stats.power).toFixed(4)}`} />
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-base sm:text-lg text-slate-50 font-bold">חישוב לפי פונקציית התפלגות t ופרמטר אי-מרכזיות (NCP):</p>
 <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
 <div className="bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
 <BlockMath math={`NCP = \\frac{\\mu_{H1} - \\mu_{H0}}{SE} = \\frac{${stats.effectH1Mean} - ${stats.effectH0Mean}}{${stats.se.toFixed(4)}} = ${stats.ncp.toFixed(4)}`} />
 <BlockMath math={`t_{\\beta, 1} = -t_{crit} - NCP = ${(-stats.zCrit).toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(-stats.zCrit - stats.ncp).toFixed(4)}`} />
 <BlockMath math={`t_{\\beta, 2} = t_{crit} - NCP = ${stats.zCrit.toFixed(4)} - ${stats.ncp.toFixed(4)} = ${(stats.zCrit - stats.ncp).toFixed(4)}`} />
 <BlockMath math={`\\beta = P(t_{df} < t_{\\beta, 2}) - P(t_{df} < t_{\\beta, 1}) = ${stats.beta.toFixed(4)}`} />
 <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
 </div>
 </div>
 </div>
 )
 )
 ) : (
 <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2 max-w-xl mx-auto">
 <Info size={20} className="mx-auto text-indigo-400" />
 <h5 className="font-extrabold text-slate-200 text-sm sm:text-base">חישוב עוצמת מבחן כבוי</h5>
 <p className="text-xs sm:text-sm font-medium leading-relaxed">
 על מנת להציג את שלבי החישוב המלאים של טעות מסוג שני (<InlineMath math="\\beta" />) ועוצמת המבחן (<InlineMath math="1-\\beta" />), הפעל את אפשרות "חישוב עוצמה" בתוך כרטיסיית הפרמטרים למעלה.
 </p>
 </div>
 )}
 </div>
 </div>


 {/* Step 4: Final Decision Block (Highlighted green/red panel) - Requirement 2 & 3 */}
 {decisionData && (
 <div className={`mt-8 rounded-3xl p-6 md:p-8 border-2 shadow-lg transition-all text-right relative overflow-hidden ${
 decisionData.isReject 
 ?'bg-gradient-to-br from-emerald-950/25 to-teal-950/5 border-emerald-800' 
 : 'bg-gradient-to-br from-red-950/25 to-rose-950/5 border-red-800'
 }`}>
 {/* Top Accent Strip */}
 <div className={`absolute top-0 right-0 w-full h-1.5 ${decisionData.isReject ?'bg-emerald-500' :'bg-red-500'}`} />
 
 <h3 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2 pb-3 border-b border-dashed border-slate-800/85">
 {decisionData.isReject ? (
 <CheckCircle className="text-emerald-500 animate-bounce shrink-0" size={24} />
 ) : (
 <XCircle className="text-red-500 animate-pulse shrink-0" size={24} />
 )}
 <span className={`text-xl font-black ${decisionData.isReject ? 'text-emerald-300' : 'text-red-300'}`}>
 שלב הכרעה סטטיסטית סופי 5
 </span>
 <span className="text-xs font-bold text-slate-500 mr-auto font-mono">
 α = {alpha} | n = {n}
 </span>
 </h3>

 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 leading-relaxed text-sm sm:text-base font-bold text-slate-200">
 <div className={`text-base sm:text-lg font-black flex justify-center items-center gap-2 ${decisionData.isReject ?'text-emerald-300' :'text-red-300'}`}>
 <span>מצב: המדגם נמצא באזור {decisionData.isReject ? 'הדחייה' : 'הקבלה'}</span>
 <span className="mt-1"><InlineMath math={decisionData.isReject ? 'C' : '\\bar{C}'} /></span>
 </div>
 <div className="text-base sm:text-lg font-black mt-2 flex justify-center items-center gap-2">
 <span>החלטה פורמלית:</span>
 <span className="font-mono underline decoration-2 mt-1" dir="ltr"><InlineMath math={decisionData.decisionHeading} /></span>
 </div>

 {/* Zone Formal Data */}
 <div className="mt-5 p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/50 flex flex-col gap-2.5 text-center text-sm">
 <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
 <span className="text-slate-400 font-extrabold">הגדרת האזור:</span>
 <span className="font-mono text-indigo-300" dir="ltr"><InlineMath math={decisionData.isReject ? decisionData.zoneRejectionTeX : decisionData.zoneAcceptanceTeX} /></span>
 </div>
 <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
 <span className="text-slate-400 font-extrabold flex items-center">הסתברות בהינתן <span className="font-mono ml-1 mt-0.5"><InlineMath math="H_0" /></span>:</span>
 <span className="font-mono text-indigo-300" dir="ltr"><InlineMath math={decisionData.isReject ? `P(\\bar{X} \\in C \\mid H_0) = \\alpha = ${alpha}` : `P(\\bar{X} \\in \\bar{C} \\mid H_0) = 1 - \\alpha = ${parseFloat((1 - alpha).toFixed(4))}`} /></span>
 </div>
 <div className="text-slate-300 font-semibold mt-1">
 {decisionData.belongingExplanationText}
 </div>
 </div>

 </div>
 
 <p className="text-sm sm:text-base font-extrabold text-slate-200 leading-relaxed mt-4">
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
  <div className="contents">

 {/* Decision Matrix Hero (Moved to side panel) */}
  <div className="rounded-3xl border p-5 md:p-6 text-right relative overflow-hidden shadow-lg transition-all bg-slate-900 border-slate-800 w-full min-w-0 order-2 lg:order-2">
    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-red-600 via-indigo-700 to-emerald-600" />
    <h3 className="hidden">
      <Award size={18} className="text-emerald-500" />
      מטריצת החלטה ורמות מובהקות
    </h3>
    <DecisionMatrix isValid={isValid} stats={stats} alpha={alpha} calculatePower={calculatePower} />
  </div>

  {/* Theoretical Help widget inside side panel */}
 <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-900 border border-slate-800 text-white shadow-md relative overflow-hidden w-full min-w-0 order-4 lg:order-4" dir="rtl">
 <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl" />
 <h4 className="text-sm font-black flex items-center gap-2 text-indigo-300 mb-2">
 <Info size={16} />
 הוראות הסבר מהירות:
 </h4>
 <ul className="text-xs space-y-2 text-slate-300 leading-relaxed pr-2 list-disc list-inside font-semibold font-sans">
 <li><strong>ממוצע H₀ המרכזי</strong> מבסס את קו התחלת הבסיס להשוואה (H₀ baseline).</li>
 <li><strong>אלטרנטיבה H₁</strong> מגדירה את המיקום השני המשוער בפועל.</li>
 <li>ככל שגודל המדגם (<InlineMath math="n" />) גדל, היכולת של המבחן להבחין אפילו באפקטים זעירים או שינויים קטנים בתוחלת משתפרת, מה שמאפשר לדחות את השערת האפס בקלות רבה יותר עבור אותה תוצאה מדגמית.</li>
 </ul>
 </div>

 </div>

 </div>

 

 </div>
 </div>
 );
}


