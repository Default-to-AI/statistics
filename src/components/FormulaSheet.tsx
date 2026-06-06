/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { InlineMath, BlockMath } from 'react-katex';
import { 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Layers, 
  TrendingUp, 
  Sigma, 
  Percent, 
  BarChart2, 
  UserCheck, 
  HelpCircle,
  Search,
  Maximize2,
  Minimize2,
  Sliders,
  Award,
  Sparkles
} from 'lucide-react';
import StatisticalHelperModal from './StatisticalHelperModal';

interface FormulaSheetProps {
  theme: 'light' | 'dark';
}

interface SubSection {
  title: string;
  content: React.ReactNode;
}

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  subsections: SubSection[];
}

export default function FormulaSheet({ theme }: FormulaSheetProps) {
  const [activeSection, setActiveSection] = useState<string>('c1');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Interactive mini widgets states
  const [pA, setPA] = useState<number>(0.6);
  const [pB, setPB] = useState<number>(0.4);
  const [pAandB, setPAandB] = useState<number>(0.24);

  // Stats description calculator state
  const [descInput, setDescInput] = useState<string>('12, 15, 15, 17, 20, 22, 25, 30');

  // Math visual helper state
  const [helperModalOpen, setHelperModalOpen] = useState<boolean>(false);
  const [helperModalTab, setHelperModalTab] = useState<'sigma-vs-s' | 'standard-error' | 'sqrt-intuition'>('sigma-vs-s');
  
  const openHelper = (tab: 'sigma-vs-s' | 'standard-error' | 'sqrt-intuition') => {
    setHelperModalTab(tab);
    setHelperModalOpen(true);
  };
  
  const sectionRefs = {
    c1: useRef<HTMLDivElement>(null),
    c2: useRef<HTMLDivElement>(null),
    c3: useRef<HTMLDivElement>(null),
    c4: useRef<HTMLDivElement>(null),
    c5: useRef<HTMLDivElement>(null),
    c6: useRef<HTMLDivElement>(null),
    c7: useRef<HTMLDivElement>(null),
    c8: useRef<HTMLDivElement>(null),
  };

  const handleScrollTo = (id: keyof typeof sectionRefs) => {
    setActiveSection(id);
    const target = sectionRefs[id]?.current;
    if (target) {
      const headerOffset = 90;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  // Tracking which section is currently on screen
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      
      const entries = Object.entries(sectionRefs);
      for (let i = entries.length - 1; i >= 0; i--) {
        const [id, ref] = entries[i];
        if (ref.current && ref.current.offsetTop <= scrollPosition) {
          setActiveSection(id);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTopic = (key: string) => {
    setExpandedTopics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    sections.forEach(s => {
      s.subsections.forEach((sub, i) => {
        updated[`${s.id}-${i}`] = expand;
      });
    });
    setExpandedTopics(updated);
  };

  // Standard deviation, mean, median and IQR live calculator logic
  const computedStats = React.useMemo(() => {
    try {
      const nums = descInput
        .split(',')
        .map(x => parseFloat(x.trim()))
        .filter(x => !isNaN(x))
        .sort((a, b) => a - b);
      
      if (nums.length === 0) return null;
      
      const n = nums.length;
      const sum = nums.reduce((acc, curr) => acc + curr, 0);
      const mean = sum / n;
      
      let median = 0;
      if (n % 2 === 1) {
        median = nums[Math.floor(n / 2)];
      } else {
        median = (nums[n / 2 - 1] + nums[n / 2]) / 2;
      }
      
      // Quartiles calculation (Tukey's Method / Standard interpolation)
      const getPercentile = (p: number) => {
        const pos = (n - 1) * p;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (nums[base + 1] !== undefined) {
          return nums[base] + rest * (nums[base + 1] - nums[base]);
        }
        return nums[base];
      };
      
      const q1 = getPercentile(0.25);
      const q3 = getPercentile(0.75);
      const iqr = q3 - q1;
      
      const sumSqDiff = nums.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0);
      const populationVar = sumSqDiff / n;
      const sampleVar = n > 1 ? sumSqDiff / (n - 1) : 0;
      
      return {
        nums,
        n,
        mean: mean.toFixed(2),
        median: median.toFixed(1),
        q1: q1.toFixed(1),
        q3: q3.toFixed(1),
        iqr: iqr.toFixed(1),
        range: (nums[nums.length - 1] - nums[0]).toFixed(1),
        sampleVar: sampleVar.toFixed(3),
        sampleSD: Math.sqrt(sampleVar).toFixed(3),
        popVar: populationVar.toFixed(3),
        popSD: Math.sqrt(populationVar).toFixed(3),
      };
    } catch {
      return null;
    }
  }, [descInput]);

  const pUnion = Math.min(1, Math.max(0, pA + pB - pAandB));
  const independentComp = (pA * pB).toFixed(4);
  const isIndependent = Math.abs(pAandB - pA * pB) < 1e-7;

  const sections: Section[] = [
    {
      id: 'c1',
      title: '1. הסתברות וקומבינטוריקה',
      icon: <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'תכונות ההסתברות ופעולות על מאורעות',
          content: (
            <div className="space-y-3 font-sans">
              <p className="text-sm">
                הסתברות של מאורע <InlineMath math="A" /> במרחב מדגם <InlineMath math="\Omega" /> מייצגת את מידת היתכנותו.
              </p>
              <ul className="list-disc leading-relaxed pr-6 text-xs sm:text-sm space-y-1 text-slate-600 dark:text-slate-400">
                <li>הסתברות מאורע חסומה תמיד: <InlineMath math="0 \le P(A) \le 1" /></li>
                <li>הסתברות מרחב המדגם כולו (מאורע ודאי): <InlineMath math="P(\Omega) = 1" /></li>
                <li>הסתברות הקבוצה הריקה (מאורע בלתי אפשרי): <InlineMath math="P(\emptyset) = 0" /></li>
              </ul>
            </div>
          )
        },
        {
          title: 'החוק המשלים',
          content: (
            <div className="space-y-2">
              <p className="text-sm">
                ההסתברות שמאורע <InlineMath math="A" /> <strong>לא</strong> יתרחש היא ההסתברות של המשלים שלו:
              </p>
              <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="P(A^c) = 1 - P(A)" />
              </div>
            </div>
          )
        },
        {
          title: 'פעולות בין מאורעות: חיתוך ואיחוד',
          content: (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                <strong>חיתוך <InlineMath math="(A \cap B)" />:</strong> המאורע שבו מתרחשים <strong>גם</strong> מאורע <InlineMath math="A" /> <strong>וגם</strong> מאורע <InlineMath math="B" /> בו-זמנית.
                <br />
                <strong>איחוד <InlineMath math="(A \cup B)" />:</strong> המאורע שבו מתרחש מאורע <InlineMath math="A" /> <strong>או</strong> מאורע <InlineMath math="B" /> (או שניהם).
              </p>
            </div>
          )
        },
        {
          title: 'נוסחת האיחוד לשני מאורעות ולשלושה מאורעות',
          content: (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-500 uppercase block">עבור שני מאורעות:</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl text-center">
                  <BlockMath math="P(A \cup B) = P(A) + P(B) - P(A \cap B)" />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-500 uppercase block">עבור שלושה מאורעות:</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl overflow-x-auto text-center">
                  <BlockMath math="P(A \cup B \cup C) = P(A) + P(B) + P(C) - P(A \cap B) - P(A \cap C) - P(B \cap C) + P(A \cap B \cap C)" />
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'מאורעות זרים לעומת מאורעות בלתי תלויים והגדרותיהם',
          content: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/10 dark:bg-rose-950/5">
                <h4 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 mb-2 border-r-2 border-rose-500 pr-2 text-right" dir="rtl">מאורעות זרים (Mutually Exclusive)</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  מאורעות שאינם יכולים להתרחש יחד. קיום האחד מונע לחלוטין את קיום השני.
                </p>
                <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-rose-200/50 dark:border-slate-700/50 text-center text-xs font-mono font-black text-rose-600 dark:text-rose-400">
                  <InlineMath math="A \cap B = \emptyset \implies P(A \cap B) = 0" />
                </div>
              </div>
              <div className="p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/10 dark:bg-emerald-950/5">
                <h4 className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400 mb-2 border-r-2 border-emerald-500 pr-2 text-right" dir="rtl">מאורעות בלתי תלויים (Independent)</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                  התרחשותו או אי-התרחשותו של אחד אינה משפיעה על סיכויי ההתרחשות של האחר.
                </p>
                <div className="bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-emerald-200/50 dark:border-slate-700/50 text-center text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                  <InlineMath math="P(A \cap B) = P(A) \cdot P(B)" />
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'ניסוי בשלבים: בחירה עם החזרה ובלי החזרה',
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                בניסוי רב-שלבי (כמו שליפת כדורים מכד):
              </p>
              <ul className="list-disc leading-relaxed pr-6 text-xs sm:text-sm space-y-2 text-slate-600 dark:text-slate-400">
                <li>
                  <strong>עם החזרה (With Replacement):</strong> המאורעות בכל שלב הם <strong>בלתי תלויים</strong>. מרחב המדגם וההסתברויות אינם משתנים בין שלב לשלב.
                </li>
                <li>
                  <strong>בלי החזרה (Without Replacement):</strong> המאורעות בכל שלב הם <strong>תלויים</strong>. ההסתברות בכל שלב משתנה על פי התוצאות שהתקבלו בשלבים הקודמים.
                </li>
              </ul>
              <div className="mt-2.5 p-3.5 bg-indigo-50/20 dark:bg-indigo-950/5 rounded-xl border border-indigo-100 dark:border-slate-800">
                <span className="text-xs font-black text-indigo-700 dark:text-indigo-400 block mb-1.5">קומבינטוריקה שימושית (<InlineMath math="n" /> פריטים לבחור <InlineMath math="k" />):</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400 font-sans">
                  <div>• מספר הפרמוטציות לסדר <InlineMath math="n" /> איברים: <InlineMath math="n!" /></div>
                  <div>• מספר הדרכים לבחור <InlineMath math="k" /> מתוך <InlineMath math="n" /> ללא חשיבות לסדר: <InlineMath math="\binom{n}{k} = \frac{n!}{k!(n-k)!}" /></div>
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'הסתברות מותנית',
          content: (
            <div className="space-y-2">
              <p className="text-sm">
                ההסתברות שיתרחש מאורע <InlineMath math="A" /> <strong>בהינתן (בתנאי)</strong> שמאורע <InlineMath math="B" /> כבר התרחש:
              </p>
              <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-transparent dark:border-slate-700/50 text-center shadow-inner">
                <BlockMath math="P(A \mid B) = \frac{P(A \cap B)}{P(B)} \quad \text{for } P(B) > 0" />
              </div>
            </div>
          )
        },
        {
          title: 'משפט המכפלה, הסתברות שלמה וחוק בייס',
          content: (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-blue-500 pr-2 text-right" dir="rtl">1. משפט המכפלה (Product Rule)</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  הצלבת הסתברויות עבור תת-מאורעות:
                </p>
                <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-center font-mono">
                  <InlineMath math="P(A \cap B) = P(B) \cdot P(A \mid B) = P(A) \cdot P(B \mid A)" />
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-blue-500 pr-2 text-right" dir="rtl">2. חוק ההסתברות השלמה (Total Probability)</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  אם מאורעות <InlineMath math="B_1, B_2, \dots, B_n" /> מהווים חלוקה זרה של מרחב המדגם <InlineMath math="\Omega" />:
                </p>
                <div className="p-2 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-center font-mono">
                  <InlineMath math="P(A) = \sum_{i=1}^{n} P(B_i) \cdot P(A \mid B_i)" />
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-blue-500 pr-2 text-right" dir="rtl">3. חוק בייס (Bayes' Theorem)</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  הסתברות אפוסטריורית (עדכון הסתברות גורם):
                </p>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-center font-mono">
                  <BlockMath math="P(B_k \mid A) = \frac{P(B_k) \cdot P(A \mid B_k)}{\sum_{i=1}^{n} P(B_i) \cdot P(A \mid B_i)}" />
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'c2',
      title: '2. משתנים מקריים בדידים',
      icon: <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'פונקציית הסתברות למשתנה בדיד',
          content: (
            <div className="space-y-3 font-sans">
              <p className="text-sm">
                משתנה בדיד מקבל ערכים מתוך קבוצה סופית או בנייה של ערכים מנויים.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                פונקציית ההסתברות <InlineMath math="P(X = x)" /> או <InlineMath math="p(x)" /> מקיימת:
              </p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-900/45 rounded-xl font-mono text-xs">
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">תנאי אי-שליליות</span>
                  <InlineMath math="p(x) \ge 0" />
                </div>
                <div className="p-2.5 bg-slate-100 dark:bg-slate-900/45 rounded-xl font-mono text-xs">
                  <span className="block text-[10px] text-slate-400 font-bold mb-1">סכום ההסתברויות</span>
                  <InlineMath math="\sum_{x} p(x) = 1" />
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'תוחלת של משתנה בדיד ותכונותיה הלינאריות',
          content: (
            <div className="space-y-4 font-sans">
              <p className="text-sm">
                התוחלת (<InlineMath math="\mathbb{E}[X]" /> או <InlineMath math="\mu" />) מייצגת את ממוצע הערכים בטווח הארוך משוקלל על פי הסתברויותיהם:
              </p>
              <div className="p-3.5 bg-slate-100 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="\mathbb{E}[X] = \mu = \sum_{x} x \cdot P(X = x)" />
              </div>
              <div className="space-y-1 font-sans">
                <span className="text-xs font-black text-slate-500 uppercase block mb-1.5 font-sans">תכונות לינאריות עבור קבועים <InlineMath math="a, b, c" />:</span>
                <ul className="list-disc pr-6 text-xs sm:text-sm space-y-1.5 text-slate-600 dark:text-slate-400 font-sans">
                  <li>תוחלת של קבוע: <InlineMath math="\mathbb{E}[c] = c" /></li>
                  <li>ליניאריות הכפל וההוספה: <InlineMath math="\mathbb{E}[aX + b] = a\mathbb{E}[X] + b" /></li>
                </ul>
              </div>
            </div>
          )
        },
        {
          title: 'תוחלת של סכום משתנים מקריים',
          content: (
            <div className="space-y-3 font-sans">
              <p className="text-sm leading-relaxed">
                תוחלת של סכום שני משתנים מקריים שווה תמיד לסכום התוחלות שלהם. <strong>חשוב: תכונה זו נכונה תמיד</strong>, גם אם המשתנים תלויים לחלוטין!
              </p>
              <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="\mathbb{E}[X + Y] = \mathbb{E}[X] + \mathbb{E}[Y]" />
              </div>
              <p className="text-xs text-slate-400 text-right leading-relaxed font-sans">
                ובאופן כללי עבור סכום של <InlineMath math="n" /> משתנים: <InlineMath math="\mathbb{E}\left[\sum X_i\right] = \sum \mathbb{E}[X_i]" />.
              </p>
            </div>
          )
        },
        {
          title: 'שונות וסטיית תקן ותכונותיהן הלינאריות',
          content: (
            <div className="space-y-4 font-sans">
              <p className="text-sm leading-relaxed">
                השונות (<InlineMath math="Var(X)" /> או <InlineMath math="\sigma^2" />) מודדת את פיזור המשתנה סביב תוחלתו.
                <br />
                סטיית התקן (<InlineMath math="SD(X)" /> או <InlineMath math="\sigma" />) היא שורש השונות.
              </p>
              <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl text-center font-sans">
                <BlockMath math="Var(X) = \sigma^2 = \mathbb{E}\left[(X - \mu)^2\right] = \mathbb{E}[X^2] - (\mathbb{E}[X])^2" />
              </div>
              
              <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/15 rounded-xl border border-indigo-100/70 dark:border-indigo-900/30 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="text-right flex-1">
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-200">S מול סמל סיגמא (<InlineMath math="\sigma" />): הבולבלת נגמרה עכשיו!</span>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                    האם מחלקים ב-<InlineMath math="n" /> או ב-<InlineMath math="n-1" />? הבן את ההבדל החשוב בשניית אחת עם מדריך ייעודי.
                  </p>
                </div>
                <button 
                  onClick={() => openHelper('sigma-vs-s')}
                  className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/10 hover:shadow-md active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>הצג פיענוח ויזואלי</span>
                </button>
              </div>

              <div className="space-y-1 font-sans">
                <span className="text-xs font-black text-slate-500 uppercase block mb-1">תכונות השונות וקבועים <InlineMath math="a, b, c" />:</span>
                <ul className="list-disc pr-6 text-xs sm:text-sm space-y-1.5 text-slate-600 dark:text-slate-400">
                  <li>שונות של קבוע היא אפס: <InlineMath math="Var(c) = 0" /></li>
                  <li>הכפלה בקבוע יוצאת בריבוע, הוספה של קבוע מתבטלת: <InlineMath math="Var(aX + b) = a^2 Var(X)" /></li>
                  <li>סטיית התקן של קבוע עם משתנה: <InlineMath math="SD(aX + b) = |a| \cdot SD(X)" /></li>
                </ul>
              </div>
            </div>
          )
        },
        {
          title: 'חיבור שונויות עבור משתנים בלתי תלויים',
          content: (
            <div className="space-y-3 font-sans">
              <p className="text-sm">
                אם המשתנים המקריים <InlineMath math="X" /> ו-<InlineMath math="Y" /> הם <strong>בלתי תלויים</strong>, אז שונות הסכום/ההפרש שלהם היא סכום השונויות בלבד:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-emerald-500/5 dark:bg-emerald-950/10 border border-emerald-500/10 rounded-xl">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">עבור סכום:</span>
                  <InlineMath math="Var(X + Y) = Var(X) + Var(Y)" />
                </div>
                <div className="p-3 bg-indigo-500/5 dark:bg-indigo-950/10 border border-indigo-500/10 rounded-xl">
                  <span className="block text-xs font-semibold text-slate-400 mb-1">עבור הפרש:</span>
                  <InlineMath math="Var(X - Y) = Var(X) + Var(Y)" />
                </div>
              </div>
              <p className="text-xs text-rose-500 dark:text-rose-400 font-bold border-l-2 border-rose-500 pr-2 font-sans">
                שימו לב: שונות ההפרש מהווה חיבור של השונות בגלל שהקבועים היוצאים מההפרש בריבוע (כלומר, <InlineMath math="Var(X-Y) = Var(X + (-1)Y) = Var(X) + (-1)^2 Var(Y)" />).
              </p>
            </div>
          )
        }
      ]
    },
    {
      id: 'c3',
      title: '3. משתנים מקריים רציפים',
      icon: <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'פונקציית צפיפות למשתנה רציף',
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                משתנה רציף יכול לקבל אינסוף ערכים ממשיים בתוך קטע.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                פונקציית צפיפות ההסתברות <InlineMath math="f(x)" /> מקיימת:
              </p>
              <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center space-y-2">
                <div><InlineMath math="f(x) \ge 0 \quad \text{for all } x" /></div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800"><InlineMath math="\int_{-\infty}^{\infty} f(x) dx = 1" /></div>
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold leading-relaxed">
                שימו לב: ההסתברות בנקודה בודדת היא אפס: <InlineMath math="P(X = a) = 0" />. לכן אין הבדל בין אי-שיוויון חזק לחלש כאן, כלומר:
                <br />
                <InlineMath math="P(a \le X \le b) = P(a < X < b) = \int_{a}^{b} f(x) dx" />
              </p>
            </div>
          )
        },
        {
          title: 'פונקציית התפלגות מצטברת למשתנה רציף',
          content: (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                פונקציית ההתפלגות המצטברת <InlineMath math="F(x)" /> מוגדרת כהסתברות של המשתנה להיות קטן או שווה לערך <InlineMath math="x" />:
              </p>
              <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="F(x) = P(X \le x) = \int_{-\infty}^{x} f(t) dt" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-500 uppercase block mb-1">תכונות של המשפט היסודי של החדווא:</span>
                <ul className="list-disc pr-6 text-xs sm:text-sm space-y-1 text-slate-600 dark:text-slate-300">
                  <li>גזירת המצטברת נותנת את הצפיפות: <InlineMath math="f(x) = F'(x)" /></li>
                  <li>הסתברות קטע: <InlineMath math="P(a < X \le b) = F(b) - F(a)" /></li>
                </ul>
              </div>
            </div>
          )
        },
        {
          title: 'תוחלת ושונות של משתנה רציף',
          content: (
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-500 uppercase block">תוחלת:</span>
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                  <BlockMath math="\mathbb{E}[X] = \mu = \int_{-\infty}^{\infty} x \cdot f(x) dx" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-500 uppercase block">שונות:</span>
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                  <BlockMath math="Var(X) = \sigma^2 = \int_{-\infty}^{\infty} (x - \mu)^2 f(x) dx = \mathbb{E}[X^2] - (\mathbb{E}[X])^2" />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed text-right">
                  כאשר המומנט השני מחושב כסביב ראשית הצירים: <InlineMath math="\mathbb{E}[X^2] = \int_{-\infty}^{\infty} x^2 \cdot f(x) dx" />.
                </p>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'c4',
      title: '4. התפלגויות מיוחדות',
      icon: <Sigma className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'התפלגויות בדידות נפוצות (אחידה, בינומית)',
          content: (
            <div className="space-y-4">
              {/* Discrete Uniform */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm animate-fade-in">
                <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-indigo-500 pr-2 text-right" dir="rtl">1. התפלגות אחידה בדידה (Discrete Uniform)</h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  כאשר למשתנה יש <InlineMath math="n" /> תוצאות אפשריות בעלות הסתברות שווה. עבור ערכים שלמים בקטע סגור <InlineMath math="[a, b]" />:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-450 dark:text-slate-400 text-[10px] mb-1">פונקציית הסתברות</span>
                    <InlineMath math="P(X = k) = \frac{1}{b - a + 1}" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-450 dark:text-slate-400 text-[10px] mb-1">תוחלת</span>
                    <InlineMath math="\mathbb{E}[X] = \frac{a + b}{2}" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-450 dark:text-slate-400 text-[10px] mb-1">שונות (שלמים)</span>
                    <InlineMath math="Var(X) = \frac{(b - a + 1)^2 - 1}{12}" />
                  </div>
                </div>
              </div>

              {/* Binomial */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm animate-fade-in">
                <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-indigo-500 pr-2 text-right" dir="rtl">2. התפלגות בינומית <InlineMath math="(X \\sim Bin(n, p))" /></h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  סופרת את מספר ההצלחות בתוך סידרה של <InlineMath math="n" /> ניסויי ברנולי בלתי תלויים עם סיכוי מוגדר <InlineMath math="p" /> להצלחה בכל שלב.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-[11px] overflow-x-auto select-all">
                    <span className="block text-slate-450 dark:text-slate-400 text-[10px] mb-1">פונקציית הסתברות</span>
                    <InlineMath math="P(X = k) = \binom{n}{k} p^k (1-p)^{n-k}" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-450 dark:text-slate-400 text-[10px] mb-1">תוחלת</span>
                    <InlineMath math="\mathbb{E}[X] = np" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-450 dark:text-slate-400 text-[10px] mb-1">שונות</span>
                    <InlineMath math="Var(X) = np(1-p)" />
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'התפלגויות רציפות נפוצות (נורמלית, אחידה רציפה)',
          content: (
            <div className="space-y-4">
              {/* Continuous Uniform */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm animate-fade-in">
                <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-indigo-500 pr-2 text-right" dir="rtl">1. התפלגות אחידה רציפה <InlineMath math="(X \\sim U(a, b))" /></h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  כאשר המשתנה מרוח בצפיפות קבועה ואחידה מעל קטע יחיד ומוגדר <InlineMath math="[a, b]" />.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-500 dark:text-slate-400 text-[10px] mb-1">צפיפות <InlineMath math="f(x)" /> בתוך</span>
                    <InlineMath math="\frac{1}{b - a}" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-500 dark:text-slate-400 text-[10px] mb-1">מצטברת <InlineMath math="F(x)" /></span>
                    <InlineMath math="\frac{x-a}{b-a}" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-500 dark:text-slate-400 text-[10px] mb-1">תוחלת</span>
                    <InlineMath math="\frac{a+b}{2}" />
                  </div>
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <span className="block text-slate-500 dark:text-slate-400 text-[10px] mb-1">שונות</span>
                    <InlineMath math="\frac{(b-a)^2}{12}" />
                  </div>
                </div>
              </div>

              {/* Normal Distribution */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 shadow-sm animate-fade-in">
                <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-indigo-500 pr-2 text-right" dir="rtl">2. התפלגות נורמלית <InlineMath math="(X \\sim N(\\mu, \\sigma^2))" /></h4>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  ההתפלגות המרכזית במחקר. סימטרית לחלוטין סביב התוחלת (צורת פעמון גאוס).
                </p>
                <div className="space-y-4 text-xs sm:text-sm">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg flex flex-col md:flex-row items-center justify-between gap-2.5">
                    <div>
                      <strong className="block text-slate-800 dark:text-slate-100">נוסחת התקנון (Standardization):</strong>
                      <span className="text-slate-500 dark:text-slate-450 text-xs">מעבר ממשתנה מקרי כללי למשתנה נורמלי סטנדרטי <InlineMath math="Z" />:</span>
                    </div>
                    <div className="text-lg font-mono font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800/90 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700/50">
                      <InlineMath math="Z = \frac{X - \mu}{\sigma} \sim N(0, 1)" />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <strong className="block text-slate-800 dark:text-slate-100 mb-2">תכונות ההתפלגות הסטנדרטית ושימוש בטבלת <InlineMath math="Z" />:</strong>
                    <ul className="list-disc pr-5 text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li>סימטריות סביב ציר האפס: <InlineMath math="\Phi(-z) = 1 - \Phi(z)" /></li>
                      <li>הסתברות שבין ערכים: <InlineMath math="P(a \le X \le b) = \Phi\left(\frac{b - \mu}{\sigma}\right) - \Phi\left(\frac{a - \mu}{\sigma}\right)" /></li>
                      <li>הסתברות גדולה מערך: <InlineMath math="P(X \ge x) = 1 - \Phi\left(\frac{x - \mu}{\sigma}\right)" /></li>
                    </ul>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                    <strong className="block text-slate-800 dark:text-slate-100 mb-1.5">קומבינציות לינאריות של משתנים עצמאיים:</strong>
                    <span className="text-slate-500 dark:text-slate-450 text-xs leading-relaxed block mb-2">
                      אם <InlineMath math="X \\sim N(\\mu_X, \\sigma_X^2)" /> ו-<InlineMath math="Y \\sim N(\\mu_Y, \\sigma_Y^2)" /> הם בלתי תלויים, אז קומבינציה לינארית תניב גם כן משתנה נורמלי:
                    </span>
                    <div className="text-center font-mono py-1 rounded-md bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50 overflow-x-auto">
                      <InlineMath math="aX + bY \sim N\left(a\mu_X + b\mu_Y, \; a^2\sigma_X^2 + b^2\sigma_Y^2\right)" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'משפט הגבול המרכזי (CLT)',
          content: (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">
                <strong>משפט הגבול המרכזי (Central Limit Theorem)</strong> קובע כי סכום או ממוצע של מספר גדול של משתנים מקריים בלתי תלויים בעלי התפלגות זהה (כלשהי!) ישאפו להתפלגות נורמלית ככל שגודל המדגם <InlineMath math="n" /> גדל (כרף קלאסי: <InlineMath math="n \ge 30" />).
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/65 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-indigo-500 pr-2 text-right" dir="rtl">עבור ממוצע המדגם <InlineMath math="(\\overline{X})" /></h4>
                  <p className="text-xs text-slate-500 dark:text-slate-350 leading-relaxed mb-3">
                    הצטמצמות תנודת שגיאת הממוצע:
                  </p>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg text-center">
                    <BlockMath math="\overline{X} \sim N\left(\mu, \frac{\sigma^2}{n}\right)" />
                    <div className="mt-2 text-xs text-slate-400 font-mono">
                      <InlineMath math="Z = \frac{\overline{X} - \mu}{\sigma/\sqrt{n}} \sim N(0, 1)" />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/65 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mb-2 border-r-2 border-indigo-500 pr-2 text-right" dir="rtl">עבור סכום המדגם <InlineMath math="(S_n = \\sum X_i)" /></h4>
                  <p className="text-xs text-slate-500 dark:text-slate-350 leading-relaxed mb-3">
                    התפשטות ואיסוף סך הסכום:
                  </p>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg text-center">
                    <BlockMath math="S_n \sim N\left(n\mu, n\sigma^2\right)" />
                    <div className="mt-2 text-xs text-slate-400 font-mono">
                      <InlineMath math="Z = \frac{S_n - n\mu}{\sigma\sqrt{n}} \sim N(0, 1)" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'c5',
      title: '5. משתנה מקרי דו-מימדי',
      icon: <Percent className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'שונות משותפת (Covariance): הגדרה ומשמעות',
          content: (
            <div className="space-y-4">
              <p className="text-sm">
                השונות המשותפת מודדת את כיוון ועוצמת הקשר הלינארי המשותף שבין המשתנים המקריים <InlineMath math="X" /> ו-<InlineMath math="Y" />:
              </p>
              <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="Cov(X, Y) = \sigma_{XY} = \mathbb{E}[(X - \mu_X)(Y - \mu_Y)] = \mathbb{E}[XY] - \mathbb{E}[X]\mathbb{E}[Y]" />
              </div>
              
              <div className="space-y-1 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 rounded-xl text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <strong className="block text-slate-800 dark:text-slate-100 mb-1.5">הבנת כיוון הקשר:</strong>
                <ul className="list-disc pr-5 space-y-1">
                  <li><InlineMath math="Cov(X, Y) > 0" />: <strong>קשר חיובי</strong> (כאשר <InlineMath math="X" /> עולה, <InlineMath math="Y" /> נוטה לעלות).</li>
                  <li><InlineMath math="Cov(X, Y) < 0" />: <strong>קשר שלילי</strong> (כאשר <InlineMath math="X" /> עולה, <InlineMath math="Y" /> נוטה לרדת).</li>
                  <li><InlineMath math="Cov(X, Y) = 0" />: <strong>חוסר קשר לינארי</strong>.</li>
                </ul>
              </div>
            </div>
          )
        },
        {
          title: 'שונות משותפת של משתנים בלתי תלויים ותוחלת המכפלה',
          content: (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                אם משתנים מקריים <InlineMath math="X" /> ו-<InlineMath math="Y" /> הם <strong>בלתי תלויים</strong>, לא קיים ביניהם שום קשר, ולכן:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center text-xs sm:text-sm font-mono font-black">
                <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/45 rounded-xl">
                  <span className="block text-slate-400 text-[10px] mb-1 font-sans">שונות משותפת אפס</span>
                  <InlineMath math="Cov(X, Y) = 0" />
                </div>
                <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/45 rounded-xl">
                  <span className="block text-slate-400 text-[10px] mb-1 font-sans">תוחלת המכפלה שווה למכפלת התוחלות</span>
                  <InlineMath math="\mathbb{E}[XY] = \mathbb{E}[X] \cdot \mathbb{E}[Y]" />
                </div>
              </div>
              <p className="text-xs text-rose-500 font-bold leading-normal">
                שימו לב: משתנים שהשונות המשותפת שלהם היא 0 אינם בהכרח בלתי תלויים (ייתכן קשר שאינו לינארי, כמו קשר ריבועי). אך אם הם בלתי תלויים - השונות משותפת בהכרח אפס.
              </p>
            </div>
          )
        },
        {
          title: 'חיבור שונויות עבור משתנים מקריים תלויים',
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                במידה והם <strong>תלויים</strong>, יש לשנות את חישוב שונות הסכום או ההפרש של המשתנים כדי להביא בחשבון את השונות המשותפת ביניהם:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center text-xs">
                <div className="p-4 bg-indigo-50/10 dark:bg-indigo-950/5 border border-indigo-200 dark:border-slate-800 rounded-xl">
                  <span className="block text-[10px] text-indigo-600 dark:text-slate-400 font-black mb-1 flex justify-center">עבור סכום תלוי:</span>
                  <InlineMath math="Var(X + Y) = Var(X) + Var(Y) + 2Cov(X, Y)" />
                </div>
                <div className="p-4 bg-indigo-50/10 dark:bg-indigo-950/5 border border-indigo-200 dark:border-slate-800 rounded-xl">
                  <span className="block text-[10px] text-indigo-600 dark:text-slate-400 font-black mb-1 flex justify-center">עבור הפרש תלוי:</span>
                  <InlineMath math="Var(X - Y) = Var(X) + Var(Y) - 2Cov(X, Y)" />
                </div>
              </div>

              <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <span className="block text-[11px] text-slate-400 mb-1">נוסחת הקבועים הכללית ביותר לדו-מימד:</span>
                <BlockMath math="Var(aX + bY) = a^2Var(X) + b^2Var(Y) + 2abCov(X, Y)" />
              </div>
            </div>
          )
        },
        {
          title: 'מקדם מתאם של פירסון (ρ)',
          content: (
            <div className="space-y-4">
              <p className="text-sm">
                מודד את החוזק היחסי של הקשר הלינארי (נקי מיחידות מידה):
              </p>
              <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="\rho_{XY} = \frac{Cov(X, Y)}{\sigma_X \cdot \sigma_Y}" />
              </div>
              
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm rounded-xl space-y-1">
                <strong className="block text-slate-800 dark:text-slate-100 mb-1 leading-normal">טווח ומשמעות המתאם מול האוכלוסייה:</strong>
                <ul className="list-disc pr-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>חסום לחלוטין: <InlineMath math="-1 \le \rho_{XY} \le 1" /></li>
                  <li><InlineMath math="\rho_{XY} = 1" /> או <InlineMath math="-1" /> מראה קשר לינארי מושלם של קו ישר.</li>
                  <li>רוחב העוצמה נקבע לפי המרחק מ-0. ערך מוחלט שמרביתו מעל 0.7 נחשב לקשר חזק.</li>
                </ul>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'c6',
      title: '6. סטטיסטיקה תיאורית',
      icon: <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'מדדי מרכז (ממוצע, חציון, שכיח)',
          content: (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-100/50 dark:bg-slate-800/65 rounded-xl border border-slate-200/50 dark:border-slate-700/60 shadow-sm">
                <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 mb-1 border-r-2 border-indigo-500 pr-1.5 text-right font-sans" dir="rtl">ממוצע (Mean)</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-350 mb-2 leading-relaxed">
                  המרכז המכני של הנתונים, רגיש ביותר לערכי קיצון.
                </p>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-center font-mono text-xs">
                  <InlineMath math="\overline{X} = \frac{\sum_{i=1}^n x_i}{n}" />
                </div>
              </div>
              
              <div className="p-3 bg-slate-100/50 dark:bg-slate-800/65 rounded-xl border border-slate-200/50 dark:border-slate-700/60 shadow-sm">
                <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 mb-1 border-r-2 border-indigo-500 pr-1.5 text-right font-sans" dir="rtl">חציון (Median)</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-350 mb-2 leading-relaxed">
                  הערך החוצה את הנתונים המסודרים לחצי וחצי. חסין לערכי קיצוניים.
                </p>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-center text-xs">
                  אינדקס חציון: <InlineMath math="\frac{n+1}{2}" />
                </div>
              </div>

              <div className="p-3 bg-slate-100/50 dark:bg-slate-800/65 rounded-xl border border-slate-200/50 dark:border-slate-700/60 shadow-sm">
                <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 mb-1 border-r-2 border-indigo-500 pr-1.5 text-right font-sans" dir="rtl">שכיח (Mode)</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-350 mb-2 leading-relaxed">
                  הערך שמופיע הכי הרבה מבין דגימות המערך.
                </p>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 text-center text-xs">
                  שכיחות מקסימלית במערך
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'מדדי פיזור: אחוזונים, טווח (Range) וטווח בין-רבעוני (IQR)',
          content: (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm rounded-xl leading-relaxed">
                <strong>אחוזונים ורבעונים:</strong> מחלקים את הנתונים הממוינים למאה/ארבעה חלקים שווים.
                <ul className="list-disc pr-5 mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li><strong>רבעון ראשון <InlineMath math="(Q_1)" />:</strong> אחוזון ה-25% של הדגימות.</li>
                  <li><strong>רבעון שני <InlineMath math="(Q_2)" /> / חציון:</strong> אחוזון ה-50%.</li>
                  <li><strong>רבעון שלישי <InlineMath math="(Q_3)" />:</strong> אחוזון ה-75% של הדגימות.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
                  <span className="block text-slate-400 text-[10px] mb-1">טווח (Range):</span>
                  <InlineMath math="\text{Range} = X_{max} - X_{min}" />
                </div>
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
                  <span className="block text-slate-400 text-[10px] mb-1">טווח בין-רבעוני (IQR):</span>
                  <InlineMath math="\text{IQR} = Q_3 - Q_1" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center space-y-2">
                <span className="block text-[11px] text-slate-400">שונות המדגם המתוקנת (חלוקה ב-<InlineMath math="n-1" /> לקבלת אומד חסר הטיה לשונות האוכלוסייה):</span>
                <BlockMath math="S^2 = \frac{\sum_{i=1}^{n} (x_i - \overline{X})^2}{n - 1}" />
              </div>
            </div>
          )
        },
        {
          title: 'אסימטריה וצורת התפלגות הנתונים',
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                ממדד הריכוזיות ניתן לקבוע את צורתו וזנבו של גרף ההתפלגות:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3.5 rounded-xl border border-indigo-200/50 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <h5 className="font-extrabold text-slate-800 dark:text-slate-100 mb-2">התפלגות סימטרית</h5>
                  <p className="text-slate-500 mb-2 text-[11px]">הפעמון מאוזן לחלוטין סביב המרכז:</p>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">ממוצע ≈ חציון ≈ שכיח</span>
                </div>

                <div className="p-3.5 rounded-xl border border-indigo-200/50 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <h5 className="font-extrabold text-slate-800 dark:text-slate-100 mb-2">אסימטריה חיובית (ימנית)</h5>
                  <p className="text-slate-500 mb-2 text-[11px]">זנב שרוע לצד ימין, קיצוני חלש בכיוון החיובי:</p>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">ממוצע &gt; חציון &gt; שכיח</span>
                </div>

                <div className="p-3.5 rounded-xl border border-indigo-200/50 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <h5 className="font-extrabold text-slate-800 dark:text-slate-100 mb-2">אסימטריה שלילית (שמאלית)</h5>
                  <p className="text-slate-500 mb-2 text-[11px]">זנב שרוע לצד שמאל, משיכה בכיוון השלילי:</p>
                  <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">ממוצע &lt; חציון &lt; שכיח</span>
                </div>
              </div>
            </div>
          )
        }
      ]
    },
    {
      id: 'c7',
      title: '7. אמידה ורווחי סמך',
      icon: <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'אומדים פופולריים ואמידה נקודתית',
          content: (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                אמידה נקודתית משמשת כדי לשער פרמטר כלשהו באוכלוסייה <InlineMath math="(\theta)" /> על בסיס מספר יחיד המחושב מהמדגם ונקרא אומד <InlineMath math="(\hat{\theta})" />.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
                  <span className="block text-slate-400 mb-1">אומד לתוחלת <InlineMath math="(\mu)" />:</span>
                  <InlineMath math="\hat{\mu} = \overline{X}" />
                </div>
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
                  <span className="block text-slate-400 mb-1">אומד לשונות <InlineMath math="(\sigma^2)" />:</span>
                  <InlineMath math="\hat{\sigma}^2 = S^2" />
                </div>
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
                  <span className="block text-slate-400 mb-1">אומד לפרופורציה <InlineMath math="(p)" />:</span>
                  <InlineMath math="\hat{p} = \frac{x}{n}" />
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'תכונות אומדים (חסר הטיה ו-MSE)',
          content: (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <strong>1. אומד חסר הטיה (Unbiased Estimator):</strong>
                <br />
                אומד שהתוחלת התיאורטית שלו שווה לפרמטר האמיתי באוכלוסייה:
                <div className="my-2 p-1.5 bg-white dark:bg-slate-950 rounded text-center font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                  <InlineMath math="\mathbb{E}[\hat{\theta}] = \theta" />
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <strong>2. טעות ריבועית ממוצעת (MSE - Mean Squared Error):</strong>
                <br />
                מדד לטיב האומד הבוחן שילוב של שונות וסטייה מהתוחלת (הטיה בריבוע):
                <div className="my-2 p-1.5 bg-white dark:bg-slate-950 rounded text-center font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">
                  <InlineMath math="MSE(\hat{\theta}) = \mathbb{E}\left[(\hat{\theta} - \theta)^2\right] = Var(\hat{\theta}) + \left[Bias(\hat{\theta})\right]^2" />
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'טעות התקן (SE)',
          content: (
            <div className="space-y-4">
              <p className="text-sm">
                <strong>טעות התקן (Standard Error)</strong> היא פשוט סטיית התקן של פילוג סטטיסטי המבחן (האומד) על פני מרחב המדגמים:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  <span className="block text-slate-400 mb-1.5">עבור ממוצע <InlineMath math="(\sigma)" /> ידועה</span>
                  <div className="bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 font-mono">
                    <InlineMath math="SE = \sigma_{\overline{X}} = \frac{\sigma}{\sqrt{n}}" />
                  </div>
                </div>

                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  <span className="block text-slate-400 mb-1.5">עבור ממוצע <InlineMath math="(\sigma)" /> לא ידועה</span>
                  <div className="bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 font-mono">
                    <InlineMath math="SE = S_{\overline{X}} = \frac{S}{\sqrt{n}}" />
                  </div>
                </div>

                <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  <span className="block text-slate-400 mb-1.5">עבור פרופורציה המדגם</span>
                  <div className="bg-white dark:bg-slate-950 p-2 rounded border border-slate-100 dark:border-slate-800 font-mono">
                    <InlineMath math="SE = \sigma_{\hat{p}} = \sqrt{\frac{\hat{p}(1-\hat{p})}{n}}" />
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/15 rounded-xl border border-emerald-100/70 dark:border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="text-right flex-1">
                  <span className="block text-xs font-black text-emerald-800 dark:text-emerald-300">למה מחלקים בשורש של n? (איך השורש הגיע למכנה?)</span>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                    האם אתה רוצה להבין את ההוכחה המתמטית הפשוטה כיצד השונות הדו-מימדית יורדת לחד-מימד כשורש n?
                  </p>
                </div>
                <button 
                  onClick={() => {
                    openHelper('standard-error');
                  }}
                  className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/10 hover:shadow-md active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>הסבר לי את חוקיות השורש</span>
                </button>
              </div>
            </div>
          )
        },
        {
          title: 'רווח סמך לתוחלת כאשר שונות האוכלוסייה ידועה (Z)',
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                בניית טווח ערכים לתוחלת במונחי רמת סמך <InlineMath math="1-\alpha" />, כאשר סטיית תקן האוכלוסייה ידועה במלואה:
              </p>
              <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="\overline{X} \pm Z_{1 - \alpha/2} \cdot \frac{\sigma}{\sqrt{n}}" />
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                <strong>אורך רווח הסמך <InlineMath math="(L)" />:</strong> שווה למרחק שבין שני הגבולות, כלומר פעמיים מרחק השגיאה:
              </p>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 text-center font-mono rounded">
                <InlineMath math="L = 2 \cdot Z_{1 - \alpha/2} \cdot \frac{\sigma}{\sqrt{n}}" />
              </div>
            </div>
          )
        },
        {
          title: 'רווח סמך לתוחלת כאשר שונות האוכלוסייה אינה ידועה (T)',
          content: (
            <div className="space-y-3">
              <p className="text-sm">
                במציאות סטיית התקן <InlineMath math="\sigma" /> כמעט תמיד אינה ידועה במלואה. לכן משתמשים בסטיית המדגם המתוקנת <InlineMath math="S" /> ובהתפלגות <InlineMath math="T" /> בעלת <InlineMath math="n-1" /> דרגות חופש <InlineMath math="(df)" />:
              </p>
              <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="\overline{X} \pm T_{1 - \alpha/2, \; n-1} \cdot \frac{S}{\sqrt{n}}" />
              </div>
              <p className="text-xs text-rose-500 font-extrabold border-r-2 border-rose-500 pr-2">
                שימו לב: מכיוון שהתפלגות <InlineMath math="T" /> היא בעלת זנבות עבים יותר מהתפלגות נורמלית, רווחי הסמך בשימוש ב-<InlineMath math="T" /> יהיו בהכרח רחבים וארוכים יותר מאשר ב-<InlineMath math="Z" /> לאותו מדגם, כדי לפצות על אי-הוודאות שבשונות.
              </p>
            </div>
          )
        }
      ]
    },
    {
      id: 'c8',
      title: '8. פרוטוקול שלבי פתרון בבדיקת השערות',
      icon: <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      subsections: [
        {
          title: 'שלב א\': הגדרה פורמלית של ההשערות',
          content: (
            <div className="space-y-4">
              <p className="text-sm">
                מגדירים את השערת האפס הזקופה לאי-שינוי <InlineMath math="(H_0)" /> מול טענת הגילוי המחקרית האלטרנטיבית <InlineMath math="(H_1)" />.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <h5 className="font-extrabold text-[12px] text-indigo-600 dark:text-indigo-400 mb-2">מבחן דו-צדדי (Two-Tailed)</h5>
                  <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded font-mono">
                    <div><InlineMath math="H_0: \theta = \theta_0" /></div>
                    <div className="text-red-500 font-extrabold"><InlineMath math="H_1: \theta \neq \theta_0" /></div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <h5 className="font-extrabold text-[12px] text-indigo-600 dark:text-indigo-400 mb-2">מבחן חד-צדדי ימני</h5>
                  <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded font-mono">
                    <div><InlineMath math="H_0: \theta \le \theta_0" /></div>
                    <div className="text-indigo-600 dark:text-indigo-400 font-extrabold"><InlineMath math="H_1: \theta > \theta_0" /></div>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <h5 className="font-extrabold text-[12px] text-indigo-600 dark:text-indigo-400 mb-2">מבחן חד-צדדי שמאלי</h5>
                  <div className="text-xs space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded font-mono">
                    <div><InlineMath math="H_0: \theta \ge \theta_0" /></div>
                    <div className="text-indigo-600 dark:text-indigo-400 font-extrabold"><InlineMath math="H_1: \theta < \theta_0" /></div>
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'שלב ב\': קביעת רמת המובהקות (α) וסוגי הטעויות',
          content: (
            <div className="space-y-4">
              <p className="text-sm">
                ההחלטות במחקר הן הסתברותיות ועומדות מול סיכויי טעות:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl border border-red-100 bg-red-50/10 dark:border-red-900/40 dark:bg-rose-950/5">
                  <strong className="text-red-700 dark:text-red-400 block mb-1">טעות מסוג ראשון (<InlineMath math="\alpha" />):</strong>
                  דחייה מוטעית של השערת האפס כשהיא נכונה.
                  <div className="mt-2 text-center p-1 bg-white dark:bg-slate-950 font-mono rounded text-xs">
                    <InlineMath math="\alpha = P(\text{Reject } H_0 \mid H_0 \text{ is true})" />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/10 dark:border-amber-900/40 dark:bg-amber-950/5">
                  <strong className="text-amber-700 dark:text-amber-400 block mb-1">טעות מסוג שני <InlineMath math="(\beta)" />:</strong>
                  אי-דחיית השערה שקרית כשהאלטרנטיבית נכונה.
                  <div className="mt-2 text-center p-1 bg-white dark:bg-slate-950 font-mono rounded text-xs font-bold">
                    <InlineMath math="\beta = P(\text{Fail to reject } H_0 \mid H_1 \text{ is true})" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl">
                <span className="block text-xs font-black text-slate-500 uppercase mb-1">עוצמת המבחן (Power):</span>
                הסיכוי לדחות מוצדק את השערת האפס המוטעית: <InlineMath math="\pi = 1 - \beta" />.
              </div>
            </div>
          )
        },
        {
          title: 'שלב ג\': הגדרת סטטיסטי המבחן (Test Statistic) וטעות התקן (SE)',
          content: (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                סטטיסטי המבחן מודד פער יחסי בין הערך המדגמי הנמדד בפועל לבין הערך הצפוי תחת הנחת תקינותה של השערת האפס <InlineMath math="(H_0)" />, המנורמל על פי שגיאת התקן של האומדן:
              </p>
              
              <div className="p-3.5 bg-slate-100/50 dark:bg-slate-900/40 rounded-xl text-center">
                <BlockMath math="\text{Test Statistic} = \frac{\text{Observed Value} - \text{Expected Value under } H_0}{\text{Standard Error } (SE)}" />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs space-y-2">
                <strong className="block text-slate-800 dark:text-slate-100">מגוון הסטטיסטיים השכיחים:</strong>
                <ul className="list-disc pr-5 leading-relaxed text-slate-600 dark:text-slate-300 space-y-1.5">
                  <li><strong>Z-Statistic:</strong> לתוחלת עם שונות תחת הכלל המרכזי <InlineMath math="(\sigma \text{ ידועה})" />.</li>
                  <li><strong>T-Statistic למדגם יחיד:</strong> לתוחלת במצרפת מדגם ממוצע קטן <InlineMath math="(\sigma \text{ לא ידועה}, \; df = n-1)" />.</li>
                  <li><strong>T-Statistic לשני מדגמים בלתי-תלויים:</strong> בחינת הבדלי תוחלות עם שימוש בשונות מקובצת:
                    <br />
                    <InlineMath math="S_p^2 = \frac{(n_1-1)S_1^2 + (n_2-1)S_2^2}{n_1+n_2-2}" /> וכן <InlineMath math="t_{calc} = \frac{(\overline{X}_1 - \overline{X}_2) - 0}{\sqrt{S_p^2(1/n_1 + 1/n_2)}}" />.
                  </li>
                  <li><strong>F-Statistic לשיוויון שונויות:</strong> בדיקת יחס שתי שונויות <InlineMath math="F = \frac{S_1^2}{S_2^2}" />.</li>
                </ul>
              </div>
            </div>
          )
        },
        {
          title: 'שלב ד\': קביעת כלל ההחלטה (Decision Rule) ואזור הדחייה',
          content: (
            <div className="space-y-4">
              <p className="text-sm">
                מגדירים מראש מהם קריטריוני גבול החשד שעבורם נחליט לדחות את השערת האפס:
              </p>
              
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-3 text-xs sm:text-sm">
                <div>
                  <strong className="block text-indigo-700 dark:text-indigo-400">1. שיטת ערך קריטי (Critical Value):</strong>
                  נחפש בטבלאות ערך קריטי בהתאם ל-<InlineMath math="\alpha" /> ודרגות החופש.
                  <ul className="list-disc pr-5 mt-1 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <li>חד-צדדי ימני <InlineMath math="(Z)" />: נדחות אם <InlineMath math="Z_{calc} > Z_{1-\alpha}" />.</li>
                    <li>דו-צדדי <InlineMath math="(Z)" />: נדחות אם <InlineMath math="|Z_{calc}| > Z_{1-\alpha/2}" />.</li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <strong className="block text-emerald-700 dark:text-emerald-400">2. גישת ה-P-Value (הכלל האוניברסלי):</strong>
                  ההסתברות לקבל תוצאה קיצונית לפחות כמו שנמדדה, תחת הנחה ש-<InlineMath math="H_0" /> נכונה.
                  <div className="my-2 p-1.5 bg-white dark:bg-slate-950 font-black font-mono text-center rounded text-emerald-600">
                    <InlineMath math="\text{Reject } H_0 \iff \text{P-Value} \le \alpha" />
                  </div>
                </div>
              </div>
            </div>
          )
        },
        {
          title: 'שלב ה\': חישוב ומסקנה סטטיסטית פורמלית',
          content: (
            <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed">
              <p>
                <strong>המסקנה הסטטיסטית מעוצבת תמיד על פי תבנית מקצועית מוגדרת:</strong>
              </p>
              <div className="p-4 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                "ברמת מובהקות של <InlineMath math="\alpha = X\%" />, סטטיסטי המבחן שחושב פוסל / אינו פוסל את גבול הסף של אזור הדחייה (או שכלל ה-P-Value הניב ערך הקטן / גדול מרמת המובהקות), 
                לכן <strong>נדחית / אינה נדחית</strong> השערת האפס <InlineMath math="(H_0)" />.
                <br />
                בהתאמה לכך, קיים / לא קיים אישוש סטטיסטי המעיד כי [הסבר הטענה במונחי הבעיה האקדמית המקורית]".
              </div>
            </div>
          )
        }
      ]
    }
  ];

  // Filters sections on search query
  const filteredSections = React.useMemo(() => {
    if (!searchQuery.trim()) return sections;
    
    return sections.map(s => {
      const matchSub = s.subsections.filter(sub => {
        return (
          sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
      return { ...s, subsections: matchSub };
    }).filter(s => s.subsections.length > 0);
  }, [searchQuery]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Search bar & Actions */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm transition-all ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 right-3 flex items-center pr-1 text-slate-400">
            <Search size={16} />
          </span>
          <input 
            type="text" 
            placeholder="חיפוש נוסחה או תת-נושא..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-1.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-semibold"
          />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => toggleAll(true)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all shadow-sm"
          >
            <Maximize2 size={12} />
            הרחב הכל
          </button>
          <button 
            onClick={() => toggleAll(false)}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all shadow-sm"
          >
            <Minimize2 size={12} />
            צמצם הכל
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar + Accordion Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Navigation Sidebar (lg:col-span-3) */}
        <aside className="lg:col-span-3 sticky top-20 z-10 hidden lg:block space-y-4">
          <div className={`p-5 rounded-2xl border shadow-sm transition-all ${
            theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <h3 className="text-xs font-black text-slate-400 uppercase mb-4 tracking-wider flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Layers size={14} className="text-blue-500" />
              פרקי דף הנוסחאות
            </h3>
            
            <nav className="space-y-1.5">
              {sections.map((section) => {
                const isSelected = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleScrollTo(section.id as any)}
                    className={`w-full text-right py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-between gap-1.5 group ${
                      isSelected
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-r-4 border-blue-500'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate">{section.title}</span>
                    <span className={`transition-transform duration-300 drop-shadow-sm ${
                      isSelected ? 'text-blue-600 scale-110' : 'text-slate-400 group-hover:translate-x-1'
                    }`}>
                      ←
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Practical interactive playground inside sidebar */}
          <div className={`p-5 rounded-2xl border bg-gradient-to-tr from-indigo-950 to-slate-900 border-slate-800 text-white shadow-md relative overflow-hidden`} dir="rtl">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-8 -mt-8 blur-xl" />
            
            <h4 className="font-extrabold text-xs text-indigo-400 mb-1 flex items-center gap-1.5">
              <Sliders size={13} />
              חישוב איחוד קל (הוכחת נוסחה)
            </h4>
            <p className="text-[10px] text-slate-300 leading-relaxed mb-3">
              נוסחת איחוד תאורטית למאורעות:
            </p>

            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-1">
                <span>P(A):</span>
                <input 
                  type="number" 
                  step="0.05"
                  min="0"
                  max="1"
                  value={pA}
                  onChange={(e) => setPA(parseFloat(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 bg-slate-900 text-white border border-slate-700 text-right font-mono rounded"
                />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span>P(B):</span>
                <input 
                  type="number" 
                  step="0.05"
                  min="0"
                  max="1"
                  value={pB}
                  onChange={(e) => setPB(parseFloat(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 bg-slate-900 text-white border border-slate-700 text-right font-mono rounded"
                />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span>P(A ∩ B):</span>
                <input 
                  type="number" 
                  step="0.05"
                  min="0"
                  max="1"
                  value={pAandB}
                  onChange={(e) => setPAandB(parseFloat(e.target.value) || 0)}
                  className="w-14 px-1 py-0.5 bg-slate-900 text-white border border-slate-700 text-right font-mono rounded"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-indigo-300 font-extrabold">
                  <span>איחוד P(A ∪ B):</span>
                  <span className="font-mono">{pUnion.toFixed(4)}</span>
                </div>
                <div className="text-[9px] text-slate-400">
                  {isIndependent ? '✓ מאורעות בלתי תלויים' : `✗ תלויים (עבור אי-תלות נדרש ${independentComp})`}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Panel (lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-8">
          
          {filteredSections.map((section) => (
            <div 
              key={section.id} 
              ref={sectionRefs[section.id as keyof typeof sectionRefs]}
              id={section.id}
              className={`rounded-2xl border p-5 md:p-6 transition-all scroll-mt-24 shadow-sm ${
                theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Section Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                <div className="p-2 bg-slate-100/60 dark:bg-slate-800 rounded-lg">
                  {section.icon}
                </div>
                <h2 className={`text-base sm:text-lg font-black tracking-tight ${
                  theme === 'dark' ? 'text-slate-50' : 'text-slate-900'
                }`}>
                  {section.title}
                </h2>
              </div>

              {/* Accordions List inside section */}
              {section.subsections.length > 0 ? (
                <div className="space-y-3">
                  {section.subsections.map((sub, i) => {
                    const topicKey = `${section.id}-${i}`;
                    const isExpanded = !!expandedTopics[topicKey];
                    return (
                      <div 
                        key={topicKey}
                        className={`rounded-xl border transition-all ${
                          isExpanded
                            ? (theme === 'dark' ? 'bg-slate-950/40 border-slate-800/80 ring-2 ring-blue-500/5' : 'bg-slate-50/45 border-slate-200 ring-2 ring-blue-500/5')
                            : (theme === 'dark' ? 'border-slate-800 hover:border-slate-700 bg-slate-900/30' : 'border-slate-200 hover:border-slate-300 bg-white')
                        }`}
                      >
                        {/* Accordion Trigger */}
                        <button
                          onClick={() => toggleTopic(topicKey)}
                          className={`w-full text-right p-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-black transition-all ${
                            isExpanded ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="text-slate-800 dark:text-white">{sub.title}</span>
                          <span className={`${isExpanded ? 'text-blue-600' : 'text-slate-400'}`}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>

                        {/* Accordion Collapsible Content */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800/70 text-slate-600 dark:text-slate-300">
                                {sub.content}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-bold">לא נמצאו תת-נושאים תואמים לחיפוש.</p>
              )}

              {/* Special Addition: Live interactive Descriptive Stats Calculator inside Chapter 6 */}
              {section.id === 'c6' && (
                <div className="mt-6 p-4 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-900/55 bg-indigo-50/10 dark:bg-indigo-950/5">
                  <h4 className="font-extrabold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-2">
                    <Sliders size={14} />
                    מחשבון עזר אקטיבי למדדי תיאור
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    הקלד מספרים מופרדים בפסיקים למטה ותראה בזמן אמת את חישוב מדדי המרכז והפיזור של הנתונים, כולל חציון, צמדים, IQR ושונות המדגם המתוקנת:
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 block font-bold">מעוניין בשיקוף נתוני המדגם:</label>
                      <input 
                        type="text"
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                        placeholder="לדוגמה: 12, 15, 15, 17, 20..."
                        className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono font-bold"
                      />
                    </div>

                    {computedStats && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800">
                          <span className="block text-[9px] text-slate-400 font-bold">ממוצע</span>
                          <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">{computedStats.mean}</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800">
                          <span className="block text-[9px] text-slate-400 font-bold">חציון (Q₂)</span>
                          <span className="font-mono font-black text-xs text-slate-900 dark:text-slate-100">{computedStats.median}</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800">
                          <span className="block text-[9px] text-slate-400 font-bold">טווח בין-רבעוני (IQR)</span>
                          <span className="font-mono font-black text-xs text-indigo-600 dark:text-indigo-400">{computedStats.iqr}</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800">
                          <span className="block text-[9px] text-slate-400 font-bold">שונות המדגם (S²)</span>
                          <span className="font-mono font-black text-xs text-emerald-600 dark:text-emerald-400">{computedStats.sampleVar}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

        </div>
      </div>

      <AnimatePresence>
        {helperModalOpen && (
          <StatisticalHelperModal 
            isOpen={helperModalOpen}
            onClose={() => setHelperModalOpen(false)}
            initialTab={helperModalTab}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
