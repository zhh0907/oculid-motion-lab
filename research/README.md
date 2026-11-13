# Reproducible checks

Run from the repository root:

```sh
node research/reproduce.mjs
npm test
```

The first command compares the public headless session, eyelid-enabled session
and the frozen **independently generated** Binocular golden fixture: 3 controllers
× 4 patient patterns × 300 samples = 3,600 samples. It prints sample counts and
maximum absolute angular differences. It never regenerates the golden fixture
from the implementation under test.

Weights: `models-selected.json`. Fixture: `tests/fixtures/upstream-golden.json`.
Numerical source provenance: `docs/upstream-manifest.json`.
Historical training/evaluation outputs remain in the root JSON files and methods
pages; replay recordings are lazy-loaded from `recordings/` by the full workspace.
This consolidation does not retrain models or add human validation data.

For a preprint, treat eye-only and eyelid-enabled views as appearance ablations
of the same target-conditioned motion model. Exact software agreement is not
evidence of anatomical realism, pathological validity or camera tracking accuracy.
Independent human-data evaluation needs its own frozen subjects, protocol,
licenses, metrics and provenance. Do not report planned evaluations as results.
