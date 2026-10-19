// The reset/cadence engine: period generation per reset anchor, ROI math,
// overlap detection. Pure functions over the catalog + card dates.

export const RULES_ENGINE_NAME = 'reset-cadence-engine';

export { generateBenefitInstances, type GenerateInput } from './generate.js';
export type { UserCardDates } from './user-card-dates.js';
export { UserCardDatesSchema } from './user-card-dates.js';
export {
  BenefitInstanceSchema,
  GenerateResultSchema,
  type BenefitInstance,
  type GenerateResult,
} from './result.js';
export { RoiInputSchema, instanceKey, type RoiInput } from './roi/input.js';
export { OverlapInputSchema, type OverlapInput } from './overlap/input.js';
export {
  OverlapWarningSchema,
  detectStaticOverlaps,
  type OverlapWarning,
} from './overlap/registry.js';
export {
  BenefitRoiSchema,
  CardRoiSchema,
  InstanceRoiSchema,
  computeCardRoi,
  type BenefitRoi,
  type CardRoi,
  type InstanceRoi,
} from './roi/compute.js';
