# Oculid architecture and reproducibility

```mermaid
flowchart LR
  A[Target: automatic / pointer / fingertip] --> B[Upstream geometry + GRU]
  B --> C[Upstream patient layer]
  C --> D[4 gaze angles at 250 Hz]
  D --> E[Procedural eyelid state]
  D --> F[Globe yaw and pitch]
  E --> G[Eye-region renderer]
  F --> G
  D --> H[Bare-eye comparison]
  D --> I[JSON / CSV]
  E --> I
```

`src/simulation.mjs` orchestrates unchanged upstream inference and patient functions. `src/eyelid-model.mjs` contains deterministic appearance math and an `EyelidDynamics` follower without DOM or Three.js. `src/eye-rig.mjs` owns geometry and materials. `src/main.mjs` connects controls, camera lifecycle, playback and downloads. The original UI remains at `workspace.html`; `app.js` changes its rendered eye construction, not motion calculations. `demo.html` uses the same new renderer for its three fixed cases.

Distances are metres, time is seconds, angles are degrees. Coordinates and L/R array order stay compatible with upstream: +Z forward, yaw about Y, pitch about local negative X; no torsion. Do not infer anatomical left/right from screen position. Front-facing render and camera preview mirroring are separate conventions. Eye separation is 64 mm for generated targets, and replay uses the original recording centres.

`src/target-range.mjs` converts yaw/pitch target excursions into the same world-space positions consumed by the original engine. Camera input bypasses this module. Legacy target functions remain available.

Eyelid shape uses an asymmetric almond profile across fixed corners. Horizontal gaze moves the aperture apex while closure adds a nasal tissue sweep. The lid follower uses time constants of 55 ms for upward pitch, 28 ms for downward pitch and 35 ms for yaw; these are engineering parameters, not fitted physiological measurements. The upper and lower apex depend on openness and pitch; a blink moves both to one common seam. The contact surface clears the 12.4 mm appearance globe and moving corneal cap even while the lid follower lags. In v0.7, `head-topology.mjs` welds and subdivides the scan, cuts actual socket loops and appends lid rings using the same boundary vertex indices. `head-mesh.mjs` fairs the neutral join and deforms the interior with a quadratic falloff to zero at the shared boundary; the lid margin has a 0.85 mm inner wall. Corner tissue spans the aperture. Eyebrow roots bind to actual skin triangles; lashes and brows are thin tube meshes.

`globe-mesh.mjs` provides an open-front sclera, recessed iris annulus with a pupil hole, dark cavity and transmissive convex cornea. `eye-anatomy.mjs` centralizes their appearance dimensions. `skin-material.mjs` generates seeded microscopic albedo, bump and roughness; no facial photograph is fetched. Skin UVs wrap around the skull. `ocular-shading.mjs` still approximates socket contact darkening. Physical materials supply reflections/transmission, not a clinical optical simulation. Blink schedules and appearance variation are deterministic. These are appearance approximations, not fitted tissue or optical properties. No inverse eye tracking occurs in the renderer.

The orbit camera supports drag, wheel and keyboard input. Skin/clay/wireframe modes and camera changes do not reset the fixed patient or simulation. Switching to pointer input disables orbit gestures; frontal reset restores the examination view. The old `periocular-shape.mjs`, `scan-geometry.mjs`, `face-reference.mjs` and offline scan-projection script remain historical v0.6 code, not current runtime dependencies.

## State and export

Motion options and appearance edits reset the homepage's current run. Appearance is therefore constant within an exported run, except for time-dependent blinking and separately recorded manual blink times. Pausing holds simulation time and lid state. The homepage updates lid dynamics on the 250 Hz simulation grid and includes its gaze-follow and closure fields in each exported sample. The inherited workspace also updates lids per simulation sample; a replay seek initializes lid state at the selected pose. The three-case demo samples the same follower at display times, without changing its original motion simulator. A missing fingertip holds all state and adds no observations. Reacquisition clears recurrent controller history, as in upstream, while preserving the patient plant state. The 250 Hz grid is model time, not a hardware frame-rate guarantee. Large wall-clock gaps are capped; hidden-tab playback is not real-time acquisition.

`oculid-run-v1` includes model ID, patient parameters, coordinate declaration, appearance, input settings, manual blink timestamps, and up to 30,000 samples (120 seconds). Each sample includes target, ideal/reference/output angles and each lid's apex/closure/pupil visibility. It is valid to export hidden gaze angles when the pupil is fully occluded, but those values are simulation ground truth rather than observations. Files stay in browser memory until downloaded.

The homepage defaults to horizontal ±42°, elevation 30°, depression 42° targets. Each eye still computes its own direction to the shared target, so its angle can differ slightly from the midpoint excursion. Controls allow horizontal 10–50°, up 10–40° and down 10–50°; these are exploratory target settings, not joint limits. The GRU may be outside its validated input distribution; geometric reference provides exact target-direction checking.

The homepage camera uses an assumed plane and the original FOV/chest-camera defaults. Physical calibration and dataset replay remain in the complete workspace. The workspace retains `gaze-patient-run-v1` and the original CSV columns, with procedural lid animation in the view only. Homepage/manual-blink data are not silently inserted into legacy exports.

The original GitHub Pages origin can host multiple projects. Oculid uses `oculid-motion-patients-v1` and `oculid-screen-calibration-v1` storage keys. No automatic migration or edits to the original site's browser storage occur. Export/import is the explicit transfer path.

## Verification

Run `npm test` (no installation needed for the Node tests). Run `npm ci`, install Chrome if needed, then `npm run test:browser` and `npm run test:workspace`. All browser tests use Playwright and write screenshots/reports to local output folders. Test-only target injection does not assert physical camera quality.

`docs/upstream-manifest.json` audits unchanged code/weights and the two storage-only adaptations. `tests/fixtures/upstream-golden.json` was generated by importing modules from the original repository, not Oculid. It holds 300 targets each for two GRUs plus ideal geometry, crossed with four case patterns (3,600 outputs). Tests compare every output angle exactly. These checks verify software compatibility, not biological accuracy.

The repository has no runtime build step or CDN dependency. Serve its root over HTTP or HTTPS; `file://` cannot load modules or models correctly. Runtime assets retain their upstream notices and data attribution.

## Homepage patient and trajectory integration (0.4)

`src/patient-bank.mjs` uses the original validated library schema and the same `oculid-motion-patients-v1` storage record as the complete workspace. It detects stale-tab writes, protects unreadable saved data, and performs imports atomically. `src/patient-panel.mjs` binds the compact homepage controls. The original `patient-model.mjs`, its sampling strata and `PatientLayer` are unchanged. A selected saved profile stays frozen across path, appearance and controller changes; explicit template/side edits switch to a separate obvious example. Right-side examples use distinct IDs from the original three left-side examples. Numbered identity is always qualified by its library ID.

`Simulation.selectPatient` accepts a validated profile and library identity. Reset starts the same profile from the original zero plant state. `oculid-run-v1` adds `patientLibraryId`, `patientModelVersion` and `patientInitialState`; baseline samples and the original patient engine reconstruct the outputs. CSV adds patient ID, library ID, template and side columns. No scores are assigned.

The independent `TrajectoryHistory` ring stores copied angle/reference samples at 50 Hz for a 20-second chart window, bounded to 1,008 entries. It is updated from the 250 Hz simulation, including after the 120-second recording limit. `TrajectoryPlot` paints at most 20 times per second. A reset clears its history; clearing only the graph does not reset simulation state or exports. Camera loss and pause stop simulation time; reacquisition starts a new line segment rather than connecting through the tracking interruption.

All graph values are angles in degrees: +yaw is subject-right, +pitch is up. Time views show both eyes with dashed normal-model baselines. The XY view preserves equal pixels per degree on its two axes. These are simulation ground-truth angles even behind a closed eyelid, not image-extracted normalized eye positions or tracking confidence.

## Instantaneous eye-position rails (0.5)

`src/eye-position-rails.mjs` projects the current and baseline pupil centres through the existing eye rotation convention, then divides their X coordinates by `HALF_WIDTH`. Two SVG rails show independent L/R positions in a fixed −1…+1 coordinate frame, with zero at the canthal midpoint. Positive positions move right in the fixed frontal reference view. The iris-plane depth is now 10.55 mm; the rails do not rotate with the inspection camera or include perspective/refraction. This differs from GazeLab's subject-left-positive measurement convention; these are model-derived projections, not tracked image coordinates. The component reads the same current frame as the renderer, so pause and lost-input holds require no additional clock or smoothing. Pupil visibility only changes the marker's occlusion styling, never its ground-truth position or the gaze controller.

## Connected head (0.7)

The homepage, complete workspace and three-case demo all use the connected head and layered eye meshes. The workspace positions the head at the eye midpoint and scales its horizontal attachment to replay eye separation. Homepage appearance exports identify `connected-head-v7`. See [geometry, dimensions, licensing and limitations](VOLUME-v7.zh-CN.md). The original scan colour image is retained only as a historical asset; the runtime fetches the GLB geometry, not the image or the old projected attachment field.
