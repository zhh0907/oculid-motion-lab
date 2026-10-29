# Verification record — 2026-10-29

Environment: Version 0.8.0. Windows, Node 24.15.0, installed Google Chrome through Playwright 1.62.1. Browser input is synthetic or injected at the existing fingertip boundary. No person/camera was recorded.

## Results

- Version 0.8: both authored face profiles change geometry, retain protected eye openings and restore their exact vertices after repeated switching. Tests preserve patient state, sample count, clock, trace revision and the complete gaze sequence, and verify timestamped face-shape export. English UI and both preset options are checked in the browser. Female frontal, side, wide-gaze and fully closed views were inspected. The original 3,600 angle outputs remain exactly equal.

- Version 0.7: connected head/lid topology, shared boundary edges and finite eye geometry pass. The browser verifies actual drag rotation, frontal reset, clay/wireframe modes, fixed patient and simulation time during inspection, stable boundary coordinates through motion, no facial-photo requests, wide gaze/full closure, five skin presets and 320/390 px layouts. Frontal, 63-degree side, full-head, clay, wireframe and closed-eye screenshots were inspected. [Current appearance report](face-report.json).
- Current runtime: 42,780 connected skin vertices; 196/184 shared socket-boundary vertices. Layered eyes use a recessed annular iris and independent convex cornea. All five browser suites passed after integration. A local 180-frame desktop headless Chrome sample had a 22.2 ms median frame interval; no mobile hardware benchmark was performed.

- Version 0.6: scan mesh/UV and asset checksums pass; five skin presets, no colour wheel, patient preservation, wide gaze, complete closure and 320/390 px rendering pass. The historical frontal, oblique, light/dark skin and closed-eye screenshots were inspected. The final static mesh retains crossing triangles under the dynamic patches to prevent visible holes.

- Version 0.5.1 simplifies the rails to plain dots and fewer labels. The existing homepage/patient browser integration suite passed, including rail positions, pause/occlusion, and 320/390/844 px layouts. Motion mathematics is unchanged.

- Live eye-position rails: the projected positions match the simulated eye geometry; the limited-eye marker remains near centre while the other eye and normal reference move; pause/tracking-loss holds and eyelid-occlusion styling pass. Both rails remain readable in desktop and stacked mobile layouts.

- Homepage patient/trajectory integration: 30 balanced profiles; ID recall, refresh persistence, unchanged profile after controller change, portable library import and conflict rejection, shared workspace storage, arbitrary 3D targets, three chart views, independent clearing, pause/tracking loss/reacquisition, and JSON/CSV provenance pass. [Report](patients-browser-report.json).
- Unit checks include six correctly sided examples, deterministic custom-patient replay, stale/corrupt/unavailable storage protection, and continued bounded chart history after the 120-second export buffer fills.

- `npm test`: 40/40 passed. This includes the original patient and three-case suites.
- `node tests/oculid-browser.cjs`: passed; [machine-readable report](browser-report.json).
- `npm run test:workspace`: both inherited browser suites passed with the new eye meshes.
- Wide-target checks: UI-controlled 50° gaze, full closure at that angle, legacy toggle and camera bypass pass. Pure geometry checks cover ±55° yaw, −50° / +40° pitch, contact clearance and continuous outer boundaries.
- Eyelid checks: irregular repeatable blinks, asymmetric lag, pause/reset, fixed canthi, mirrored nasal slide and upper/lower seam equality pass.
- Corner checks: continuous upper/lower attachment, mirrored gaze-plane coordinates, attachment to each asymmetric scan side, aperture containment, closure, and visibility masking across ±55° yaw and −50° / +40° pitch pass.
- Visual inspection: enlarged frontal and oblique eye region, closure, plus desktop, 390 px phone, neutral / 45° lateral / 32° upward / 45° downward gaze and full closure screenshots; corrected iris triangle winding during implementation before the final checks. No page/console errors in the new homepage suite.
- Exact compatibility fixture: 3 controllers × 4 patterns × 300 multi-axis/depth targets = 3,600 samples, with four output angles per sample. Every new output equals the original project's stored expected output. This does not constitute exhaustive equivalence over all possible floating-point inputs, but the audited unchanged engine/weights and isolated appearance boundary support the same motion contract.
- Additional invariance test changes eyelid follow, coverage, opening and manual blinking while checking the entire eye-angle sequence stays identical.
- Regression coverage includes patient library persistence and collision handling, arbitrary diagonal/depth targets, historical run reconstruction, camera loss hold, all available recorded-gaze controllers and history-aware seeking.

## What these results do not establish

Physical webcam detection rate, calibrated accuracy, real-world latency, iPhone/Android WebGL performance, visual similarity judged by humans, eye-tracker recognition of synthetic images, full-angle self-collision/contact physics, and patient/biological validity have not been measured. The moving eye region remains a procedural mesh with simplified surface shading. Version 0.7 retains the licensed head geometry, removes the facial colour image from runtime, and uses independent transmissive corneal geometry. This does not establish clinical or photometric validity. No new eye-motion model was introduced. Very oblique gaze can hide a pupil; exported hidden angles remain simulation ground truth.

The pupil visibility value samples the pupil disk at the recessed iris plane in a fixed front reference view against the procedural aperture and corner-tissue mask. It is not a learned image measurement, uncertainty estimate, or support for arbitrary camera viewpoints. Skin/highlight changes do not enter the visibility calculation. The fixed 250 Hz grid is model time; browser rendering rate is measured separately.

Screenshots can be regenerated with `npm run test:browser` and `npm run test:face`. Runtime downloads and sample JSON/CSV are kept outside version control. Historical model-evaluation reports in this repository describe the original eye-motion work and have not been rerun as eyelid experiments.
