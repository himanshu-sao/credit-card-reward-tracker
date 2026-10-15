# Answers to the refiner's open questions — round 1

1. Package publishing: proceed with the assumption — internal-only
   (`private: true`, consumed via workspace protocol). No publishing setup.
2. Node >= 20 pinning: proceed with the assumption — both `.nvmrc`/`engines`
   and the `packageManager` field.

The user has confirmed proceeding with all other assumptions as stated,
including the Fastify recommendation for `apps/api`.
