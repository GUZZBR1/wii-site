# Robust real-time jump and swing detection under landmark jitter

Researched 2026-11-25. All parameter values under "Inferences" are suggested starting points to be tested, not published standards. Repo observations come from reading `src/kinematics/jumpDetector.ts`, `swingDetector.ts`, `src/cv/oneEuroFilter.ts` and `src/cv/pose.worker.ts` in the working tree.

> Note (added on import): the "Current code behaviour" bullets describe the pre-PR-#5 detectors. Jump re-arming now uses position only (`rise <= 0.03` for 160 ms — variant B below), and the swing detector tracks the peak across same-direction qualifying samples; both are in `src/kinematics/`. The jitter measurement recipe and the remaining proposals are still unapplied.

## 1. Arming a jump detector despite small hip oscillation around neutral

### Takeaway
Do not require sample-to-sample velocity to have a particular sign (`velocityUp <= 0`) in order to re-arm: at rest the sign of the difference is essentially noise. Arm on a position band (hysteresis) plus a windowed stability test over time, and keep the takeoff threshold and the arming rule as separate parameters.

### Cited Findings
- Force-plate countermovement-jump practice defines "quiet" from a baseline window (typically 1 s of quiet standing) and detects onset when the signal leaves baseline by more than 5 SD of that window — [Owen et al. 2014](https://pubmed.ncbi.nlm.nih.gov/24276298/); [Park et al. 2025](https://journal.iusca.org/index.php/Journal/article/view/472).
- Pre-jump sway/weight rocking makes static-band thresholds fire early. In 32,891 trials, the rate of onsets more than 30 ms earlier than a first-derivative reference was 38.07% for 4×SD without back-step, 29.24% for 5×SD, 28.10% for percentage-of-bodyweight, and 7.67% for a range-based (max/min of the quiet window) threshold — [Adlou et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517217/). Note: the reference is another algorithm (first-derivative), not hand-labelled truth, and the data are force, not pose.
- The same study classifies quiet-standing quality by the SD within the 1 s sliding minimum-SD window, and estimates baseline from that minimum-SD window — [Adlou et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517217/).
- A first-derivative onset method (10 Hz low-pass) is reported as the closest to manually selected onsets and least sensitive to slow sway, because slow sway produces little rate of change — [Adlou et al. 2026, summarising Pinto & Callaghan 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517217/); [Pinto & Callaghan](https://pubmed.ncbi.nlm.nih.gov/36913948/).
- Dispersion-threshold identification (I-DT, from eye tracking) is the standard "is it still?" algorithm: samples are "still" if they stay inside a spatial dispersion threshold for a minimum duration (typically 100–200 ms). Velocity-threshold (I-VT) is simpler but sensitive to noisy signals — [Review of eye-movement event detection](https://pmc.ncbi.nlm.nih.gov/articles/PMC9699548/); [Salvucci & Goldberg 2000](https://www.cs.drexel.edu/~dds26/publications/Salvucci-ETRA00.pdf).
- One Euro filter: first-order low-pass with cutoff `fc = fcmin + beta*|filtered derivative|`; the derivative is computed from raw values and low-passed with a fixed 1 Hz cutoff "to avoid high derivative bursts caused by jitter" — [Casiez et al. CHI 2012](https://gery.casiez.net/publications/CHI2012-casiez.pdf).
- Tuning: set beta=0 and fcmin≈1 Hz, hold still and lower fcmin to remove jitter; then move fast and raise beta to cut lag. Beta depends on signal units (the authors suggest even starting at 0.001 or 0.0001 and stepping by factors of 10) — [1€ filter page](https://gery.casiez.net/1euro/).

### Inferences
- Current code behaviour: after firing, re-arm requires `rise <= 0.03 && velocityUp <= 0` continuously for 160 ms; any single positive frame-to-frame difference resets `neutralSince`. With symmetric noise around neutral, P(diff <= 0) is about 0.5 per frame, so about 5–6 consecutive successes (160 ms at 30 fps) is unlikely (order of a few percent per attempt). This is arithmetic under an idealised independence assumption; filtered noise is correlated, so measure it with a fixture.
- `velocityUp` is a per-frame difference, not per second, so its meaning changes with frame rate. Express speeds as torso-heights/s using timestamps.
- Recommended arming rule (simplest first):
  1. Position hysteresis: takeoff at `rise >= 0.08` (unchanged); neutral if `|rise - baseline| <= 0.03–0.04`. No velocity sign condition.
  2. If more is needed, windowed stability: keep samples for the last 150–250 ms and require `max - min <= 0.03–0.04` torso heights (I-DT style). Require the window to span the full duration and have at least ~4 samples. Range over a window is deterministic, frame-rate independent and easy to test.
  3. If a velocity condition is kept, make it a deadband: `|v| < 0.2–0.3 torso/s`, v taken as the slope across ≥100 ms rather than one frame.
- Takeoff must not be weakened: apply the stability test only to (re)arming, not to firing. Once armed, stay armed until takeoff fires or tracking is lost; do not disarm because a countermovement or wobble leaves the neutral band, otherwise the crouch before a jump disarms the detector.
- Countermovement: the crouch gives negative `rise` then fast positive velocity. Either (a) keep the absolute `rise >= 0.08` threshold, or additionally require upward velocity of roughly >0.4–0.6 torso/s to reject slow "standing taller" movements. (b) is a new gate that makes takeoff stricter, so add it only if drift causes false jumps.
- Slow drift (player steps closer/farther, slouches): a fixed `hipY0` from calibration can leave `rise` permanently outside the neutral band, which deadlocks re-arming. Option: adapt the baseline only while the window is stable, with a slow EMA (time constant about 1–3 s) and a bounded correction (e.g. ±0.15 torso). Never adapt while airborne or moving. Trade-off: too fast an adaptation absorbs a slow rise; too slow keeps the deadlock. A plain timeout re-arm is a weaker alternative.
- Camera distance changes also shift hip y in the image; torso-height normalisation by the calibrated value does not correct this.
- One Euro on this signal: with fcmin=1 Hz at 30 fps, alpha ≈ 0.17 (tau ≈ 160 ms), and the app's beta=0.5 in torso units raises cutoff only to about 1.5–2 Hz at 1–2 torso/s. So takeoff is noticeably lagged and attenuated, and the filtered signal approaches neutral slowly after landing. Raising beta (e.g. 1–5, tune) reduces takeoff lag with little effect at rest; lowering fcmin reduces rest jitter but lengthens the settle time. Computed from the filter equations, not measured.
- The One Euro internal derivative is itself only 1 Hz low-passed (lags ~160 ms); do not expose it as a takeoff-velocity signal without checking latency.
- Suggested deterministic tests: (i) neutral ± alternating noise of ±0.01–0.02 after a jump still re-arms within N ms; (ii) same noise never fires; (iii) crouch-then-jump fires exactly once; (iv) slow 0.1-torso drift over 5 s neither fires nor deadlocks; (v) 15, 30 and 60 fps give the same result.

### Gaps
- Found no peer-reviewed study of webcam pose jump *detection* (as opposed to jump-height measurement) that reports tuned arming thresholds, deadbands or false-positive rates. Validation papers found measure height/timing offline, e.g. [Aleksic et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11511341/) (abstract only seen).

## 2. Swing detection state machines

### Takeaway
Use onset with a high speed threshold, track the peak over a short window, and re-arm only after speed stays below a much lower threshold for a continuous dwell. Which samples count toward direction and which reset the dwell should be decided separately.

### Cited Findings
- An open design spec for a webcam paddle/swing detector uses: wrist position relative to the shoulder midline normalised by shoulder width; velocity from real frame timestamps; signed "stroke speed" along the body axis (backswings and vertical motion give near-zero or negative values); onset when stroke speed > 3 shoulder-widths/s for 2 consecutive frames, outside a ~400 ms cooldown, and only after total speed has dropped below ~1 since the last swing; peak speed = max total speed over the last 3 frames. These are explicitly stated as starting values, not validated results — [K-coder05/ping-pong issue #10](https://github.com/K-coder05/ping-pong/issues/10).
- Wearable tennis stroke detectors commonly use peak detection with thresholding and windowing on a derivative of the sensed signal (acceleration derivative) — [Aalto thesis/record on wrist vs racket IMU](https://www.finna.fi/Record/aaltodoc.123456789_103287?sid=3458451208&lng=en-gb) (search snippet only).
- I-VT vs I-DT trade-off (velocity threshold is simple but noise-sensitive; dispersion plus minimum duration is more robust) applies to defining the neutral state — [Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9699548/).

### Inferences
- Current code behaviour: fires on the first sample with 3D speed >= 2 widths/s, so (a) power comes from the onset sample, not the peak, (b) side comes from that single sample's lateral velocity, (c) any direction, including a backswing or raising the arm, can fire. Re-arm needs `readyDistance < 0.35 && speed < 1.2` continuously for 180 ms; one jitter spike resets the timer.
- Suggested state machine: `READY -> TRACKING -> RECOVER -> READY`.
  - READY→TRACKING: speed >= on-threshold (2–3 widths/s), optionally 2 consecutive samples (costs ~33 ms at 30 fps).
  - TRACKING: update `peakSpeed = max(...)` from **all** samples; accumulate direction evidence from qualifying samples only (e.g. sum of signed lateral velocity, or the lateral velocity at the fastest qualifying sample). A non-qualifying sample is ignored for direction and does not abort or reset the peak.
  - Emit when speed falls below about 60–80% of the peak, or speed < off-threshold, or a hard timeout of 120–200 ms. If no qualifying direction evidence exists, emit nothing and go to RECOVER (or back to READY if it was a pure backswing, so the forward stroke that follows is not swallowed). The latter point is important: a 400 ms refractory started by a backswing would hide the real swing, so start the refractory only on an emitted event.
  - Latency trade-off: waiting for the peak delays the event; the timeout bounds it.
- Refractory: 400 ms (already used; matches the open spec) measured from emission, in timestamps not frames.
- Rearm dwell: require continuous neutral for 100–200 ms where neutral = speed < off (about 1–1.2 widths/s) and, if wanted, position within the ready zone. Reset the timer on a violating sample. To tolerate jitter without abandoning "continuous": use two levels (start the dwell below 1.0, reset only above 1.4), or evaluate the median speed of the last 3 samples, or use positional range over the window instead of instantaneous speed.
- Requiring both speed and a calibrated ready position can deadlock if the player rests the arm elsewhere. "Speed low for a longer time (e.g. 400–600 ms) anywhere" is a reasonable fallback re-arm.
- Large dt (dropped frames, tracking loss) should reset the dwell timer and previous sample, so a gap is not counted as dwell.
- Differentiating noise: for independent position noise sigma, first-difference speed noise is about `sqrt(2)*sigma/dt` per axis, so at 30 fps sigma=0.02 shoulder widths gives ~0.85 widths/s per axis. Monocular depth (z) is typically the noisiest axis; check its rest noise before including it in 3D speed. (The sigma value is illustrative, not measured.)
- Tests: single-sample spike does not fire; backswing then forward stroke fires once with forward side; one wrong-direction sample mid-stroke does not change side or lose the peak; jitter at rest re-arms; a spike during dwell delays re-arm by exactly one dwell.

### Gaps
- No peer-reviewed source found giving tuned refractory, dwell or peak-tracking values for webcam-pose racket swings. The only concrete numbers are from an unvalidated open-source spec and the existing code.
- General gesture-spotting literature ([Alon et al.](https://pubmed.ncbi.nlm.nih.gov/19574627/), abstract only seen) addresses learned start/end segmentation, not these threshold state machines.

## 3. Measured jitter of MediaPipe pose landmarks at rest

### Takeaway
No reliable published per-landmark rest-jitter figure for Pose Landmarker Lite on a webcam was found; measure it in the app. Importantly, the Tasks pose landmarker already applies heavy One Euro smoothing in VIDEO mode, so the app's filters are a second stage.

### Cited Findings
- Pose smoothing is enabled when `num_poses == 1` and stream mode is on; smoothing multiple poses is unsupported — [pose_landmarker_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarker_graph.cc).
- In the web task runner, stream mode is any `runningMode` other than `'IMAGE'`, so `'VIDEO'` enables it — [vision_task_runner.ts](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/core/vision_task_runner.ts).
- Image landmarks: One Euro with min_cutoff 0.05, beta 80, derivative cutoff 1.0 (source comments: alpha ≈ 0.01 when static, ≈ 0.94 when fast). World landmarks: min_cutoff 0.1, beta 40, dcutoff 1.0 (alpha ≈ 0.02 static, ≈ 0.8 fast). Visibility is smoothed with a low-pass alpha 0.1 — [pose_landmarks_detector_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarks_detector_graph.cc).
- That filter's derivative is multiplied by the inverse object scale ((bbox width + height)/2, or ROI for image landmarks), and each axis of each landmark is filtered separately — [landmarks_smoothing_calculator_utils.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/calculators/util/landmarks_smoothing_calculator_utils.cc); [one_euro_filter.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/util/filtering/one_euro_filter.cc).
- Accuracy (not jitter) studies exist: a three-camera MediaPipe vs Vicon study reports systematic offsets and residual variability during squats/lunges — [Chen et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13766164/); a 60 s static-standing study compares MediaPipe 3D (lite/full/heavy) with Azure Kinect on posture measures — [Ferraris et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC12944656/). The passages retrieved from neither gave a frame-to-frame rest-jitter value.
- Users have reported visible jitter with the Tasks pose landmarker (anecdotal, 2023, unquantified) — [mediapipe issue #4507](https://github.com/google-ai-edge/mediapipe/issues/4507).

### Inferences
- The app runs `runningMode: 'VIDEO'`, `numPoses: 1`, so internal smoothing should be active. Source was read from `master`; the pinned `tasks-vision` version was not checked against it.
- Because the first stage has a very low static cutoff, residual noise at rest is likely small but temporally correlated (slow wander rather than white noise). Correlated wander produces runs of same-sign differences, which defeats "N consecutive rising/falling frames" logic, and the formula `sqrt(2)*sigma/dt` will overestimate speed noise.
- The second One Euro stage adds lag mainly on small, slow movements; consider testing it with a much higher fcmin or removing it, using recorded traces. Benchmark before changing.
- Measurement recipe: record raw snapshot streams for 10 s standing still at the playing distance (several lighting setups, GPU and CPU delegate); for hip `rise` and normalised wrist x/y/z report SD, p95 and max of the range over 200 ms windows, p95 of |per-second velocity|, and drift of 1 s means. Set neutral band ≈ 1.5–2× the p95 window range, and confirm it stays well below the 0.08 takeoff threshold. These multipliers are heuristics.

### Gaps
- No citable number for rest jitter (pixels, mm, or torso fractions) of BlazePose/Pose Landmarker Lite hips or wrists on consumer webcams. Searches of web and paper indexes returned accuracy-versus-motion-capture results only, and full texts were only partly inspected.
