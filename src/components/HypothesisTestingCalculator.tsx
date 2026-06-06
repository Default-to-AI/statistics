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

// --- Types ---
type TestType = 'single' | 'mean' | 'sum';
type TailType = 'right' | 'left' | 'two-tailed';

interface HTCalculatorProps {
  theme: 'light' | 'dark';
}

export default function HypothesisTestingCalculator({ theme }: HTCalculatorProps) {
  // Input states
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
    let effectH1Mean = mu1;

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

    // 2. Critical Value(s) computation based on Alpha under H0 standard distribution
    let c1: number = 0; // lower (used in two-tailed)
    let c2: number = 0; // upper (used in right-tail/two-tail/left-tail)
    let zCrit: number = 0;
    let zCritLower: number = 0;

    if (tailType === 'right') {
      zCrit = inverseNormalCDF(1 - alpha);
      c2 = effectH0Mean + zCrit * se;
    } else if (tailType === 'left') {
      zCrit = inverseNormalCDF(alpha);
      c2 = effectH0Mean + zCrit * se;
    } else { // two-tailed
      zCrit = inverseNormalCDF(1 - alpha / 2);
      zCritLower = -zCrit;
      c1 = effectH0Mean - zCrit * se;
      c2 = effectH0Mean + zCrit * se;
    }

    // 3. Power (1-Beta) calculations based on H1 distribution
    let beta = 0;
    let power = 0;

    if (tailType === 'right') {
      // Acceptance under H0 is x < c2.
      // Beta (Type II error) is the prob under H1 of accepting H0:
      beta = normalCDF(c2, effectH1Mean, se);
      power = 1 - beta;
    } else if (tailType === 'left') {
      // Acceptance under H0 is x > c2 (which is lower threshold).
      // Beta (Type II error) is the prob under H1 of accepting H0:
      beta = 1 - normalCDF(c2, effectH1Mean, se);
      power = 1 - beta;
    } else { // two-tailed
      // Acceptance under H0 is c1 < x < c2.
      beta = normalCDF(c2, effectH1Mean, se) - normalCDF(c1, effectH1Mean, se);
      power = 1 - beta;
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
      zCrit,
      zCritLower,
      beta,
      power,
    };
  }, [mu0, mu1, sigma, n, alpha, testType, tailType, isValid]);

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
      const pdfH0 = normalPDF(x, effectH0Mean, se);
      const pdfH1 = normalPDF(x, effectH1Mean, se);

      // Determine rejection regions to shade Alpha and Power
      let isRejected = false;
      if (tailType === 'right') {
        isRejected = x >= c2;
      } else if (tailType === 'left') {
        isRejected = x <= c2; // c2 acts as the left critical line
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
            <span className="font-mono font-bold">{data.x.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-6 text-blue-600 dark:text-blue-400">
            <span>צפיפות תחת H₀:</span>
            <span className="font-mono font-bold">{data.pdfH0.toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-6 text-amber-600 dark:text-amber-400">
            <span>צפיפות תחת H₁:</span>
            <span className="font-mono font-bold">{data.pdfH1.toFixed(4)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8" dir="rtl">
      
      {/* Decision Matrix Hero */}
      <div className={`rounded-3xl border p-6 md:p-8 text-right relative overflow-hidden shadow-lg transition-all ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
      }`}>
        <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-l from-red-600 via-indigo-700 to-emerald-600" />
        
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <span className="text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm font-black uppercase tracking-wider mb-2 flex items-center gap-2">
              <Award size={16} />
              <span>מבחני מובהקות וניתוח עוצמה סטטיסטית (Power Analysis)</span>
            </span>
            <h1 className={`text-xl sm:text-2xl md:text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-slate-50' : 'text-slate-950'}`}>
              מטריצת החלטה דינמית ודילמת הטעויות במחקר (2x2 Matrix)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-semibold leading-relaxed">
              הצטלבות בין ההחלטה הסטטיסטית במבחן לבין מצב האמת במציאות. כלי דינמי לחיזוי סיכויי התרחישים ועוצמת המבחן.
            </p>
          </div>
        </div>

        {isValid && stats ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/25">
            <table className="w-full text-sm text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-xs text-slate-800 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4 border-l border-slate-200 dark:border-slate-800 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-200/30 dark:bg-slate-800/25 w-1/4">החלטת המבחן</th>
                  <th className="p-4 border-l border-slate-200 dark:border-slate-800 text-center font-black bg-blue-50/40 dark:bg-blue-900/10">H₀ נכונה במציאות (אין אפקט)</th>
                  <th className="p-4 text-center font-black bg-amber-50/30 dark:bg-amber-900/10">H₁ נכונה במציאות (קיים אפקט)</th>
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
                        <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-450" />
                        החלטה נכונה
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono" dir="ltr">1 - α</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black mt-2 font-mono text-emerald-850 dark:text-emerald-300">
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
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono" dir="ltr">β (Beta)</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black mt-2 text-amber-750 dark:text-amber-300 font-mono">
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
                        <XCircle size={15} className="text-red-650" />
                        טעות מסוג I
                      </span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono" dir="ltr">α (Alpha)</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black mt-2 text-red-700 dark:text-red-300 font-mono">
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
                        <CheckCircle size={15} className="text-indigo-600 dark:text-indigo-405" />
                        החלטה נכונה (עוצמה)
                      </span>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono" dir="ltr">1 - β (Power)</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black mt-2 text-indigo-700 dark:text-indigo-400 tracking-tight font-mono">
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
        ) : (
          <div className="py-12 text-center text-slate-500 font-bold text-sm">
            נא להזין ערכי קלט תקינים להצגת מטריצת החלטה מלאה ומפורטת.
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* RIGHT Column - Dashboard & Visual Analytics */}
        <div className="lg:col-span-8 space-y-8 order-1 lg:order-2">

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
                <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 text-red-700 dark:text-red-400 font-mono tracking-tight break-all">
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
                <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 text-amber-700 dark:text-amber-400 font-mono tracking-tight break-all">
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
                  <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 tracking-tight font-mono break-all">
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
                <div className="text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black mt-2 text-indigo-700 dark:text-indigo-400 font-mono tracking-tight break-all">
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
              <div className="py-24 text-center text-red-650 font-black text-lg md:text-xl">
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
                          לפי משפט הגבול המרכזי (CLT), שגיאת התקן מייצגת את פיזור ההתפלגות של הסטטיסטי שנמדד:
                        </p>
                        <div className="pr-9 py-3 text-xl md:text-2xl">
                          {testType === 'single' ? (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">תצפית בודדת: הפיזור המקורי של האוכלוסייה תקף כמות שהוא.</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`SE = \\sigma = ${sigmaInput}`} />
                                </div>
                              </div>
                            </div>
                          ) : testType === 'mean' ? (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">ממוצע מדגם: סטיית התקן מתכווצת על פי שורש גודל המדגם.</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`SE = \\frac{\\sigma}{\\sqrt{n}} = \\frac{${sigmaInput}}{\\sqrt{${nInput}}} = ${stats.se.toFixed(4)}`} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">סכום מדגם: ממוצעי ההשערה והפיזור גדלים על פי גודל המדגם.</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`SE = \\sigma \\cdot \\sqrt{n} = ${sigmaInput} \\cdot \\sqrt{${nInput}} = ${stats.se.toFixed(4)}`} />
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
                        <p className="text-base sm:text-lg text-slate-800 dark:text-slate-200 leading-relaxed pr-9 font-semibold">
                          עבור רמת מובהקות של <InlineMath math={`\\alpha = ${alpha}`} />, נאתר את ציון ה-Z הגבולי ונממש טרנספורמציה.
                        </p>

                        <div className="pr-9 py-3 space-y-5 text-xl md:text-2xl">
                          {tailType === 'right' ? (
                            <div className="space-y-4">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">חד-צדדי ימני: אנו מחפשים שטח עבודה משמאל בגודל <InlineMath math="1-\alpha" />.</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`Z_{crit} = \\Phi^{-1}(1 - ${alpha}) = \\Phi^{-1}(${(1-alpha).toFixed(4)}) = ${stats.zCrit.toFixed(4)}`} />
                                  <BlockMath math={`C = \\mu_0 + Z_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                </div>
                              </div>
                              <p className="text-base sm:text-lg text-emerald-950 dark:text-emerald-100 font-extrabold bg-emerald-100 dark:bg-emerald-900/30 p-5 border-2 border-emerald-400 dark:border-emerald-800 rounded-2xl mt-3 text-right shadow-sm">
                                כלל ההחלטה: נדחה את H₀ אם הסטטיסטי שיעלה בתוצאה המדגמית יהיה גדול או שווה ל: <strong className="font-mono text-lg sm:text-xl font-black">{stats.c2.toFixed(2)}</strong>.
                              </p>
                            </div>
                          ) : tailType === 'left' ? (
                            <div className="space-y-4">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">חד-צדדי שמאלי: אנו מחפשים שטח קיצון שמאלי בגודל <InlineMath math="\alpha" />.</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`Z_{crit} = \\Phi^{-1}(${alpha}) = ${stats.zCrit.toFixed(4)}`} />
                                  <BlockMath math={`C = \\mu_0 + Z_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                </div>
                              </div>
                              <p className="text-base sm:text-lg text-emerald-950 dark:text-emerald-100 font-extrabold bg-emerald-100 dark:bg-emerald-900/30 p-5 border-2 border-emerald-400 dark:border-emerald-800 rounded-2xl mt-3 text-right shadow-sm">
                                כלל ההחלטה: נדחה את H₀ אם הערך המדגמי בפועל יהיה קטן או שווה ל- <strong className="font-mono text-lg sm:text-xl font-black">{stats.c2.toFixed(3)}</strong>.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">דו-צדדי: אנו מפצלים את המובהקות לשני קצוות ההתפלגות (<InlineMath math="\alpha/2" /> בכל קצה).</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`Z_{crit} = \\Phi^{-1}(1 - \\frac{${alpha}}{2}) = \\Phi^{-1}(${(1 - alpha/2).toFixed(4)}) = ${stats.zCrit.toFixed(4)}`} />
                                  <BlockMath math={`C_1 = \\mu_0 - Z_{crit} \\cdot SE = ${stats.effectH0Mean} - (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c1.toFixed(4)}`} />
                                  <BlockMath math={`C_2 = \\mu_0 + Z_{crit} \\cdot SE = ${stats.effectH0Mean} + (${stats.zCrit.toFixed(4)}) \\cdot ${stats.se.toFixed(4)} = ${stats.c2.toFixed(4)}`} />
                                </div>
                              </div>
                              <p className="text-base sm:text-lg text-emerald-950 dark:text-emerald-100 font-extrabold bg-emerald-100 dark:bg-emerald-900/30 p-5 border-2 border-emerald-400 dark:border-emerald-800 rounded-2xl mt-3 text-right shadow-sm">
                                כלל החלטה: נדחה את H₀ אם תוצאת המדגם תהיה מחוץ לגבולות התקינות, כלומר קטנה מ- <strong className="font-mono font-black">{stats.c1.toFixed(2)}</strong> או גדולה מ- <strong className="font-mono font-black">{stats.c2.toFixed(2)}</strong>.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 3: Power calculation under H1 */}
                      <div className="space-y-3 pt-6">
                        <div className="flex items-center gap-3 font-extrabold text-indigo-700 dark:text-indigo-400">
                          <span className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-base font-black flex items-center justify-center border border-indigo-300">3</span>
                          <span className="text-xl sm:text-2xl font-black">חישוב טעות מסוג שני (<InlineMath math="\beta" />) ועוצמת המבחן (<InlineMath math="1-\beta" />)</span>
                        </div>
                        <p className="text-base sm:text-lg text-slate-800 dark:text-slate-200 leading-relaxed pr-9 font-semibold">
                          עוצמת המבחן מייצגת את הסיכוי להגיע להחלטת דחייה מוצדקת עבור הטענה האלטרנטיבית. אנו בודקים מה השטח של התפלגות H₁ הנופל בתוך סקטור אזור הדחייה:
                        </p>
                        <div className="pr-9 py-3 space-y-4 text-xl md:text-2xl">
                          {tailType === 'right' ? (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">עוצמה מעל הערך הקריטי C:</p>
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
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">עוצמה מתחת לערך הקריטי C:</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`Z_{H1} = \\frac{C - \\mu_1}{SE} = \\frac{${stats.c2.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                  <BlockMath math={`\\beta = P(Accept\\ H_0 | H_1\\ is\\ True) = 1 - \\Phi(Z_{H1}) = ${stats.beta.toFixed(4)}`} />
                                  <BlockMath math={`Power (1-\\beta) =  \\Phi(Z_{H1}) = ${(stats.power).toFixed(4)}`} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-base sm:text-lg text-slate-900 dark:text-slate-50 font-bold">עוצמה בשטח הדו-צדדי תחת H₁:</p>
                              <div className="w-full overflow-x-auto py-2 scrollbar-thin" dir="ltr">
                                <div className="bg-slate-100 dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 dark:border-slate-800 space-y-3 text-sm sm:text-base md:text-lg shadow-inner font-extrabold min-w-[280px]">
                                  <BlockMath math={`Z_{H1,1} = \\frac{C_1 - \\mu_1}{SE} = \\frac{${stats.c1.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                  <BlockMath math={`Z_{H1,2} = \\frac{C_2 - \\mu_1}{SE} = \\frac{${stats.c2.toFixed(3)} - ${stats.effectH1Mean}}{${stats.se.toFixed(4)}} = ${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(4)}`} />
                                  <BlockMath math={`\\beta = \\Phi(${((stats.c2 - stats.effectH1Mean) / stats.se).toFixed(3)}) - \\Phi(${((stats.c1 - stats.effectH1Mean) / stats.se).toFixed(3)}) = ${stats.beta.toFixed(4)}`} />
                                  <BlockMath math={`Power (1-\\beta) = 1 - \\beta = ${(stats.power).toFixed(4)}`} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <p className="text-xl text-red-700 font-extrabold">הנתונים אינם תקינים</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>



        {/* LEFT Column - Controls Panel & Error Matrices */}
        <div className="lg:col-span-4 space-y-6 order-2 lg:order-1">
          
          {/* Inputs Panel card */}
          <div className={`rounded-2xl p-5 md:p-6 border shadow-sm transition-colors ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'
          }`}>
            <h3 className="text-lg sm:text-xl font-black flex items-center gap-2 mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">
              <Sliders size={18} className="text-indigo-500" />
              פרמטרים והשערות מחקר
            </h3>

            <div className="space-y-4">
              
              {/* Type of Test selector */}
              <div className="space-y-1">
                <label className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">ישויות נבדקות במדגם (סטטיסטי):</label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 dark:bg-slate-800 border dark:border-slate-800 rounded-xl">
                  <button 
                    onClick={() => setTestType('single')}
                    className={`py-2 px-1 rounded-lg text-xs sm:text-sm md:text-base font-black transition-all ${
                      testType === 'single'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    תצפית בודדת X
                  </button>
                  <button 
                    onClick={() => setTestType('mean')}
                    className={`py-2 px-1 rounded-lg text-xs sm:text-sm md:text-base font-black transition-all ${
                      testType === 'mean'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    ממוצע מדגם X̄
                  </button>
                  <button 
                    onClick={() => setTestType('sum')}
                    className={`py-2 px-1 rounded-lg text-xs sm:text-sm md:text-base font-black transition-all ${
                      testType === 'sum'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    סכום מדגם ΣX
                  </button>
                </div>
              </div>

              {/* Alternative Hypothesis Selector */}
              <div className="space-y-1">
                <label className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">אופן השערת המחקר האלטרנטיבית (H₁):</label>
                <select 
                  value={tailType}
                  onChange={(e) => setTailType(e.target.value as TailType)}
                  className="w-full p-3 text-sm sm:text-base bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-xl outline-none font-bold text-slate-800 dark:text-slate-100"
                >
                  <option value="right">חד-צדדי ימני (H₁: μ &gt; μ₀)</option>
                  <option value="left">חד-צדדי שמאלי (H₁: μ &lt; μ₀)</option>
                  <option value="two-tailed">דו-צידי (H₁: μ ≠ μ₀)</option>
                </select>
              </div>

              <hr className="border-slate-200 dark:border-slate-800" />

              {/* Mean H0 baseline input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">ממוצע תחת השערת אפס (μ₀):</label>
                  <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-indigo-600 dark:text-indigo-400">H0 baseline</span>
                </div>
                <input 
                  type="text" 
                  value={mu0Input}
                  onChange={(e) => handleMu0Change(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 ${
                    errors.mu0 
                      ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                      : 'border-slate-300 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'
                  }`}
                  placeholder="לדוגמה: 100"
                />
                {errors.mu0 && <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold mt-1">{errors.mu0}</p>}
              </div>
                        {/* Mean H1 alternative input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">ממוצע תחת השערת חלופית (μ₁):</label>
                  <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-amber-600 dark:text-amber-400">Alternative</span>
                </div>
                <input 
                  type="text" 
                  value={mu1Input}
                  onChange={(e) => handleMu1Change(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 ${
                    errors.mu1 
                      ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                      : 'border-slate-300 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'
                  }`}
                  placeholder="לדוגמה: 108"
                />
                {errors.mu1 && <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold mt-1">{errors.mu1}</p>}
              </div>

              {/* Population SD sigma input */}
              <div className="space-y-1">
                <label className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">סטיית תקן של האוכלוסייה (σ):</label>
                <input 
                  type="text" 
                  value={sigmaInput}
                  onChange={(e) => handleSigmaChange(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 ${
                    errors.sigma 
                      ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                      : 'border-slate-300 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'
                  }`}
                  placeholder="סטיית תקן המקורית שנתונה"
                />
                {errors.sigma && <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold mt-1">{errors.sigma}</p>}
              </div>

              {/* Sample size n input (disabled for Single Item test type) */}
              <div className="space-y-1">
                <label className={`text-sm sm:text-base font-black text-slate-700 dark:text-slate-300 ${testType === 'single' ? 'opacity-30' : ''}`}>
                  גודל המדגם (n):
                </label>
                <input 
                  type="text" 
                  value={nInput}
                  disabled={testType === 'single'}
                  onChange={(e) => handleNChange(e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 ${
                    testType === 'single'
                      ? 'bg-slate-100 dark:bg-slate-800/20 text-slate-400 border-transparent opacity-60 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'
                  } ${errors.n ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' : 'border-slate-300 dark:border-slate-700'}`}
                  placeholder="36"
                />
                {testType === 'single' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-1">
                    עבור תצפית בודדת, גודל המדגם מוגדר קשיח כ-n=1.
                  </p>
                )}
                {errors.n && testType !== 'single' && <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold mt-1">{errors.n}</p>}
              </div>

              {/* Alpha inputs significance level */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300">רמת מובהקות המבחן (α):</label>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 font-black">Type I error max</span>
                </div>
                <input 
                  type="text" 
                  value={alphaInput}
                  onChange={(e) => handleAlphaChange(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl outline-none transition-all font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 ${
                    errors.alpha 
                      ? 'border-red-500 text-red-500 ring-4 ring-red-500/10' 
                      : 'border-slate-300 dark:border-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500'
                  }`}
                  placeholder="0.05"
                />
                {errors.alpha && <p className="text-xs sm:text-sm text-red-600 dark:text-red-400 font-bold mt-1">{errors.alpha}</p>}
                
                {/* Alpha Quick Presets Buttons */}
                <div className="flex gap-1.5 mt-2.5">
                  {[0.10, 0.05, 0.01, 0.001].map((pVal) => (
                    <button
                      key={pVal}
                      type="button"
                      onClick={() => applyAlphaPreset(pVal)}
                      className={`flex-1 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all border ${
                        alpha === pVal 
                          ? 'bg-red-600 text-white border-red-700 shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pVal * 100}%
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>



          {/* Theoretical Help widget inside side panel */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950 to-slate-900 border border-slate-800 text-white shadow-md relative overflow-hidden" dir="rtl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl" />
            <h4 className="text-sm font-black flex items-center gap-2 text-indigo-300 mb-2">
              <Info size={16} />
              הוראות הסבר מהירות:
            </h4>
            <ul className="text-xs space-y-2 text-slate-300 leading-relaxed pr-2 list-disc list-inside font-semibold">
              <li><strong>ממוצע H₀ המרכזי</strong> מבסס את קו התחלת הבסיס להשוואה.</li>
              <li><strong>אלטרנטיבה H₁</strong> מגדירה את המיקום השני המשוער בפועל.</li>
              <li>ככל ש-<strong>גודל המדגם (n)</strong> גדול יותר, שגיאת התקן מתכווצת, הקומות הופכות צרות יותר ועוצמת המבחן משתפרת פלאים.</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
