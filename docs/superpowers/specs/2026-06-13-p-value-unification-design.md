# P-Value Integration Design

## Architecture & Components
The `HypothesisTestingCalculator.tsx` component currently calculates test statistics (critical values, beta, power) based on inputs.
We will augment the existing calculation engine to also compute the exact p-value for the provided `xBar` (which is currently using the `mu1` state fallback for the observed mean) based on the null hypothesis distribution.

## Data Flow
- **Inputs**: `mu0` (null mean), `xBar` (observed mean, using `mu1`), `sigma`, `n`, `testType`, `tailType`, `varianceKnown`.
- **Calculation Engine** (`stats` useMemo):
  - Will calculate the observed test statistic (Z or T): `statObs = (xBar - effectH0Mean) / se`.
  - Calculate `pValue` depending on `tailType`:
    - `right`: `1 - normalCDF(statObs)` or `1 - studentTCDF(statObs)`
    - `left`: `normalCDF(statObs)` or `studentTCDF(statObs)`
    - `two-tailed`: `2 * min(p_left, p_right)`
- **Output**: The calculated `pValue` will be incorporated into the `decisionData` object and displayed in the results section.

## UI Changes
- **Selected Approach**: Option B (Unified Results). No mode toggle is added.
- The results box (which currently shows "Reject H0" or "Do Not Reject H0" and the verbal conclusion) will be updated to display a prominent new line: `Exact P-Value: [calculated value]`.
- We will visually style the p-value to stand out, and compare it against `alpha` to reinforce the decision (e.g., `p < alpha` implies Reject).

## Error Handling
- Normal bounds checking for probabilities to ensure `0 <= pValue <= 1`.
- Formatting extremely small p-values (e.g., `< 0.0001`) appropriately so the UI remains clean.

## Testing
- Verify that known inputs produce correct p-values matching standard tables.
- Verify two-tailed p-values correctly double the tail probability.
- Ensure the decision text (Reject/Do Not Reject) perfectly aligns with the `pValue < alpha` rule.
