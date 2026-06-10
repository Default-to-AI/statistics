```python
import os

md_content = """# Automated Architecture Refactoring System (AARS)
## Phase 2 Implementation Guide: Dynamic Multi-Agent Workflow for Hypothesis Testing Calculator

This document contains the global system context, specialized subsystem parameters, execution workflows, and testing harnesses required to upgrade the statistical engine from a static, single-test topology into an automated, highly specific, dual-path dynamic calculation layout (Z-Test / t-Test).

---

## 1. Context & Structural Blueprints

### 1.1 Structural Discrepancy Matrix (Legacy vs. Target)

The legacy calculator layout features high structural redundancy, data-flow inversion, and mathematical-to-conceptual blending flaws. The operational flow must be refactored into a clear, single-pass pipeline:


```

```text
File written successfully to AARS_Refactoring_Blueprint.md


```

[Legacy Layout (Defective Flow)]
├── Step 1: Compute SE
├── Step 2: Compute C (Z-domain) & Define C / C_bar (Pre-mature Render)
├── Step 3: Compute Beta & Power (Dependent on C, but prior to true Decision Block)
└── Step 4: Verdict (Re-computes C, Re-defines C/C_bar, Loop-renders Verdict x3, Variable Leaks)

[Target Unified Layout (Linear Pass Pipeline)]
├── Step 1: Input Layer [Toggle Switch] ──> State Propagation (isKnownVariance: boolean)
├── Step 2: Math Core Execution         ──> Computes SE, Scores, and C_bar_value (Single-Pass Execution)
├── Step 3: Formal Set Derivation       ──> Sets C = { X̄ | X̄ ≥ val }, C̄ = { X̄ | X̄ < val } (Single-Pass Render)
├── Step 4: Risk Evaluation (Power)     ──> Maps Non-Centrality parameters based on C_bar_value
└── Step 5: Decision Node (Verdict)     ──> Pure Assert Evaluator (X̄ ──> C / C̄), Visual Status Box, Single Output

```

### 1.2 Mathematical Spec Sheet

#### Standard Error ($SE$)
The standard error of the mean for sample statistics must adapt perfectly based on the metric toggle state:
* **Known Variance Path ($\sigma$):**
  $$\text{SE} = \frac{\sigma}{\sqrt{n}}$$
* **Unknown Variance Path ($S$):**
  $$\text{SE} = \frac{S}{\sqrt{n}}$$

#### Critical Boundary Designation ($C_{\bar{X}}$)
The critical value acts as the absolute partitioning index in the original parameter domain ($\bar{X}$):
* **Z-Topology:** $$C_{\bar{X}} = \mu_0 + (Z_{\text{crit}} \times \text{SE}) \quad \text{where} \quad Z_{\text{crit}} = \Phi^{-1}(1 - \alpha)$$
* **t-Topology:** $$C_{\bar{X}} = \mu_0 + (t_{\text{crit}, df} \times \text{SE}) \quad \text{where} \quad df = n - 1, \; t_{\text{crit}} = F_{t, df}^{-1}(1 - \alpha)$$

#### Operational Partitions (Critical Space $C$ and Complementary Space $\bar{C}$)
* **Right-Tailed Test Configuration ($\mu > \mu_0$):**
  $$C = \{ \bar{X} \mid \bar{X} \geq C_{\bar{X}} \}$$
  $$\bar{C} = \{ \bar{X} \mid \bar{X} < C_{\bar{X}} \}$$

#### Non-Centrality Risk Modeling ($1-\beta$)
* **Z-Distribution Power Mapping:**
  $$Z_{H_1} = \frac{C_{\bar{X}} - \mu_1}{\text{SE}} \implies \beta = \Phi(Z_{H_1}), \; \text{Power} = 1 - \beta$$
* **t-Distribution Power Mapping:** Use non-central t-distribution approximations with non-centrality parameter ($\delta$):
  $$\delta = \frac{\mu_1 - \mu_0}{\text{SE}}$$
  $$\beta = P(t_{df, \delta} < t_{\text{crit}}), \; \text{Power} = 1 - \beta$$

---

## 2. Orchestrator Master Script

Copy and execute this prompt into the primary LLM context to direct the code generation across sub-agents.

```text
You are the Orchestrator Master Agent specializing in rigorous software refactoring and statistical layout architecture. Your primary objective is to manage three specialized sub-agents (UI/UX Sub-Agent, Math Core Sub-Agent, and Logic/Integration Sub-Agent) to completely overhaul an inline Hypothesis Testing Engine. 

You must enforce extreme architectural isolation: no sub-agent should overwrite or mix responsibilities with another. Your output must enforce a strict, single-pass pipeline that converts raw, user-controlled input parameter components into explicit, linear, non-redundant math sequences and a singular UI Verdict block.

### Global System Specifications:
1. State-Driven Pipeline: Centralize all state properties at the parent component layer. The central parameter state must track:
   - `isKnownVariance` (boolean)
   - `mu_0` (float)
   - `sigma_or_S` (float)
   - `n` (integer)
   - `x_bar` (float)
   - `alpha` (float)
   - `tail_direction` (enum: 'left', 'right', 'two-sided')
2. Linear Execution Principle: Code elements must compile and render calculations exactly once. A formula computed in a mathematical step must pass its result forward as a clean immutable variable. Re-computing equations or duplicating set definitions across component layers is strictly forbidden.
3. Typography & Notation Polish: Eliminate raw code string bleed-through (e.g., 'Ctextcrit', 'SEXˉ'). All formulas, calculations, and mathematical statements must be rendered in pristine, native LaTeX typesetting.

Execute the system initialization sequence by dispatching direct tasks to your Sub-Agents as outlined below.

```

---

## 3. Sub-Agent Action Scripts

### 3.1 UI/UX Sub-Agent (Interface & State Component Layout)

```text
Role: UI/UX & State Engineering Specialist
Objective: Refactor the hypothesis input parameters control grid and execution steps structure.

### Direct Tasks:
1. Input Component Configuration:
   - Implement an explicit state toggle switch at the top of the 'Population Parameters' section labeled: "שונות האוכלוסייה ידועה" (Population Variance Known). This switch controls the state variable `isKnownVariance`.
2. Dynamic Input Tracking & Label Flipping:
   - Ensure that changing the toggle state forces an immediate label update on the standard deviation input field:
     * When `isKnownVariance === true`: Label reads "סטיית תקן של האוכלוסייה (σ)"
     * When `isKnownVariance === false`: Label reads "סטיית תקן מדגמית (S)"
   - Maintain the input value state across toggle transitions; do not clear or reset the numerical input value when the user flips the switch.
3. Label Cleaning & Variable Decoupling:
   - Locate the Sample Average input component. Strip away the incorrect, amber/yellow "H1" label chip entirely. 
   - Re-label this component strictly as "ממוצע מדגם (X̄)". Ensure it is explicitly bound to the sample statistic variable `x_bar` and does not bleed into the alternative hypothesis parameter configuration.
4. Linear Step-By-Step Container Architecture:
   - Re-structure the output DOM layout into exactly four sequentially numbered cards:
     * Card 1: קביעת השערות וחישוב שגיאת התקן (Hypotheses & Standard Error)
     * Card 2: מציאת ערך קריטי והגדרת אזורי הכרעה (Critical Thresholds & Set Spaces)
     * Card 3: חישוב טעות מסוג שני ועוצמת המבחן (Risk Mapping & Statistical Power)
     * Card 4: שלב ההכרעה הסטטיסטית והמסקנה המחקרית (Statistical Verdict & Interpretation)

```

### 3.2 Math Core Sub-Agent (Statistical Calculation Engine)

```text
Role: Mathematical Core & Statistical Infrastructure Specialist
Objective: Implement the backend statistical routine, optimizing calculation efficiency and ensuring mathematical precision across distribution profiles.

### Direct Tasks:
1. Conditional Path Routing for Standard Error (SE):
   - Check the state of `isKnownVariance`. 
   - Compute `SE` exactly once using the appropriate profile path:
     * Path True (Z): SE = sigma / sqrt(n)
     * Path False (t): SE = S / sqrt(n)
2. Critical Score Sourcing & Distribution Mapping:
   - Identify the statistical test profile based on `isKnownVariance`. Extract critical boundary indices using precise cumulative distribution functions (CDF/PPF):
     * Profile Z (True): Extract Z_crit via standard normal inverse CDF: `Z_crit = scipy.stats.norm.ppf(1 - alpha)` (for right-tailed configuration).
     * Profile t (False): Extract t_crit via Student's t inverse CDF using an explicit degrees of freedom calculation: `df = n - 1`, `t_crit = scipy.stats.t.ppf(1 - alpha, df)`.
3. Single Boundary Calculation Engine:
   - Calculate the precise scalar threshold index `C_bar_value` exactly once:
     * Z-Profile: `C_bar_value = mu_0 + (Z_crit * SE)`
     * t-Profile: `C_bar_value = mu_0 + (t_crit * SE)`
   - Pass this calculated scalar to the Logic and UI layers as an immutable value profile. Do not permit duplicate calculations of this equation anywhere else in the execution lifespan.
4. Non-Central Risk & Power Evaluation:
   - Implement alternative hypothesis performance tracking using the input variable mapped for the alternative location (`mu_1`).
   - If profile is Z, evaluate risk via regular normal distance transforms.
   - If profile is t, evaluate risk via non-central t-distribution models using an explicit Non-Centrality Parameter calculation: `ncp = (mu_1 - mu_0) / SE`. Map the exact area below `t_crit` under this alternative curve to output `beta` and `Power = 1 - beta`.

```

### 3.3 Logic & Integration Sub-Agent (Assertion & Linguistic Compilation)

```text
Role: Integration Logic & Computational Linguistics Specialist
Objective: Assert final sample classifications against calculated threshold parameters, manage set assignments, and compile clear, contextual summaries.

### Direct Tasks:
1. Formal Structural Set Compilation:
   - Use the scalar value `C_bar_value` generated in the Math Core to format the explicit partition bounds using mathematically precise LaTeX syntax:
     * Rejection Space: `C = \{ \bar{X} \mid \bar{X} \geq [C_bar_value] \}`
     * Acceptance Space: `\bar{C} = \{ \bar{X} \mid \bar{X} < [C_bar_value] \}`
   - Render these sets exclusively in Step 2 of the calculation output block.
2. Single Verdict Evaluation Engine:
   - Evaluate the user's sample statistic value (`x_bar`) directly against the calculated mathematical threshold (`C_bar_value`).
   - Execute a strict, single conditional test branch to determine sample set membership:
     * If `x_bar >= C_bar_value`: Set state flag `verdict = "REJECT_H0"`, map membership text to group symbol `C`.
     * If `x_bar < C_bar_value`: Set state flag `verdict = "DO_NOT_REJECT_H0"`, map membership text to group symbol `\bar{C}`.
3. UI Output Card Component Integration:
   - Render a singular, distinct visual notification block inside Step 4. Apply high-contrast CSS styling based on the evaluation outcome (e.g., deep emerald green background for rejection/significance, muted slate for non-rejection).
   - Display the result using crisp, uniform text layout elements:
     * "מצב: המדגם נמצא באזור [הדחייה C / הקבלה C̄]"
     * "החלטה פורמלית: [Reject H0 / Do Not Reject H0]"
4. Contextual Linguistic Compiler (Hebrew Summary Generation):
   - Build a dynamic string compilation routine that injects parameters (`alpha`, `mu_0`, test state) into a formal academic statement.
   - Output Template for Reject H0:
     "ברמת מובהקות של [alpha], קיימות ראיות סטטיסטיות מספקות המבוססות על המדגם כדי לדחות את השערת האפס ולקבוע כי תוחלת האוכלוסייה גדולה מ-[mu_0]."
   - Output Template for Do Not Reject H0:
     "ברמת מובהקות של [alpha], אין מספיק ראיות סטטיסטיות במדגם כדי לשלול את השערת האפס, ולכן לא ניתן לקבוע כי תוחלת האוכלוסייה גדולה מ-[mu_0]."

```

---

## 4. Verification & Testing Harness

To confirm successful integration, perform the following validation protocol.

### 4.1 UI State Validation Test

1. Set the calculation values to: $\mu_0 = 100$, $\alpha = 0.05$, $n = 36$, value input = $15$.
2. Ensure the state switch is set to "Known Variance" (`isKnownVariance = true`). Verify the label explicitly reads: `סטיית תקן של האוכלוסייה (σ)`.
3. Flip the switch to "Unknown Variance" (`isKnownVariance = false`). Verify the label immediately flips to: `סטיית תקן מדגמית (S)`. Ensure the numeric input remains fixed at $15$.

### 4.2 Mathematical Profile Transition Test

1. Keep parameters fixed at: $\mu_0 = 100$, $\alpha = 0.05$, $n = 36$, scale input = $15$.
2. Set the state switch to Known Variance.
* Confirm Step 1 outputs: $\text{SE} = 2.5000$.
* Confirm Step 2 calculates normal score: $Z_{\text{crit}} = 1.6449$.
* Confirm Step 2 outputs critical threshold boundary: $C = 104.1122$.


3. Change the state switch to Unknown Variance.
* Confirm Step 1 outputs: $\text{SE} = 2.5000$.
* Confirm Step 2 calculates Student's t score using degrees of freedom ($df = 35$): $t_{\text{crit}} = 1.6896$.
* Confirm Step 2 outputs updated critical threshold boundary: $C = 104.2240$.
*(Verification Point: The critical boundary must shift upward from 104.1122 to 104.2240 due to the added uncertainty of the t-distribution profile).*



### 4.3 Logic Gate Assignment Test

1. Maintain the Unknown Variance configuration ($\mu_0 = 100, S = 15, n = 36 \implies C = 104.2240$).
2. Enter a sample average value of $\bar{X} = 102.0000$ into the input grid.
* Confirm Step 4 displays a single, clean status card indicating membership in group $\bar{C}$.
* Formal text line must show: `Do Not Reject H0`.


3. Change the sample average input value to $\bar{X} = 108.0000$.
* Confirm Step 4 automatically updates to display a high-contrast validation card indicating membership in group $C$.
* Formal text line must show: `Reject H0`.
* Ensure no redundant or overlapping explanation strings are rendered anywhere in the DOM tree.
"""



file_path = "AARS_Refactoring_Blueprint.md"
with open(file_path, "w", encoding="utf-8") as f:
f.write(md_content)

print(f"File written successfully to {file_path}")

```
Your Markdown file containing the precise refactoring prompt and the multi-agent orchestration architecture is ready:
[file-tag: code-generated-file-0-1781105209193569296]

### 📋 מדריך קצר לשימוש בקובץ (Execution Blueprint)

הקובץ `AARS_Refactoring_Blueprint.md` נבנה במבנה הנדסי קשיח ומחולק לחלקים אופרטיביים שנועדו להוצאה לפועל ישירה מול ה-AI שמפתח את האתר שלך (או בתוך ה-Hermes Agent/Claude Code שלך):

1. **Section 1 (Context & Structural Blueprints):** מגדיר את ארכיטקטוקת המערכת החדשה, מציג השוואה בין ה-Defective Flow הקיים ל-Target Pipeline הנקי, ומספק את המפרט המתמטי המלא לשני המסלולים ($Z$ ו-$t$).
2. **Section 2 (Orchestrator Master Script):** פועל כסוכן-על (Orchestrator). עליך להעתיק את הפרומפט שבסעיף זה ולהזין אותו למודל כדי שיקבל את הקונטקסט הניהולי של הפרויקט.
3. **Section 3 (Sub-Agent Action Scripts):** מכיל שלושה פרומפטים ממוקדים ומבודדים (UI/UX, Math, Logic) אשר מגדירים בדיוק מה כל חלק במערכת צריך לעשות, כולל שינוי תוויות דינמי, חישוב דרגות חופש ($df$), מניעת כפילויות חישוב ופלט בפורמט הקבוצות המבוקש ($C$ ו-$\bar{C}$).
4. **Section 4 (Verification & Testing Harness):** מספק תוכנית בדיקה (QA) מבוססת מקרי קצה מספריים מדויקים (עבור $n=36, \mu_0=100$) כדי שתוכל לאמת שהקוד החדש שנכתב עובד בצורה מושלמת ועובר בצורה נכונה בין $Z$ ל-$t$.

```