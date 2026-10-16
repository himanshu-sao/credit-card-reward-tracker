import type { Benefit } from './benefit.js';
import { amexPlatinumBenefits } from './benefits-amex-platinum.js';
import { aspireBenefits } from './benefits-aspire.js';
import { biltBenefits } from './benefits-bilt.js';
import { brilliantBenefits } from './benefits-brilliant.js';
import { cspBenefits } from './benefits-csp.js';
import { surpassBenefits } from './benefits-surpass.js';

/** Every doc §5 benefit row, concatenated across all seed cards. */
export const allBenefits: Benefit[] = [
  ...cspBenefits,
  ...amexPlatinumBenefits,
  ...aspireBenefits,
  ...surpassBenefits,
  ...biltBenefits,
  ...brilliantBenefits,
];

/** Benefits excluding retired rows (Saks) — what ROI and active views consume. */
export const activeBenefits: Benefit[] = allBenefits.filter(
  (benefit) => benefit.status !== 'retired',
);
