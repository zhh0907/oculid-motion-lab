# Verification record — 2026-10-27

Environment: Windows, Node 24.15.0, installed Google Chrome through Playwright 1.62.1. Browser input is synthetic or injected at the existing fingertip boundary. No person/camera was recorded.

## Results

- `npm test`: 21/21 passed. This includes the original patient and three-case suites.
- `node tests/oculid-browser.cjs`: passed; [machine-readable report](browser-report.json).
- `npm run test:workspace`: both inherited browser suites passed with the new eye meshes.
- Visual inspection: desktop, 390 px phone and full closure screenshots; corrected iris triangle winding during implementation before the final checks. No page/console errors in the new homepage suite.
- Exact compatibility fixture: 3 controllers × 4 patterns × 300 multi-axis/depth targets = 3,600 samples, with four output angles per sample. Every new output equals the original project's stored expected output. This does not constitute exhaustive equivalence over all possible floating-point inputs, but the audited unchanged engine/weights and isolated appearance boundary support the same motion contract.
- Additional invariance test changes eyelid follow, coverage, opening and manual blinking while checking the entire eye-angle sequence stays identical.
- Regression coverage includes patient library persistence and collision handling, arbitrary diagonal/depth targets, historical run reconstruction, camera loss hold, all available recorded-gaze controllers and history-aware seeking.

## What these results do not establish

Physical webcam detection rate, calibrated accuracy, real-world latency, iPhone/Android WebGL performance, visual similarity judged by humans, eye-tracker recognition of synthetic images, full-angle self-collision/contact physics, and patient/biological validity have not been measured. The eye region is a procedural mesh with simplified surface shading. Very oblique gaze can hide a pupil; exported hidden angles remain simulation ground truth.

The pupil visibility value samples the front-view pupil disk against the procedural aperture. It is not a learned image measurement, uncertainty estimate, or support for arbitrary camera viewpoints. Skin/highlight changes do not enter the visibility calculation. The fixed 250 Hz grid is model time; browser rendering rate is measured separately.

Screenshots can be regenerated with `npm run test:browser`. Runtime downloads and sample JSON/CSV are kept outside version control. Historical model-evaluation reports in this repository describe the original eye-motion work and have not been rerun as eyelid experiments.
