# Lateral trunk lean from MediaPipe Pose world landmarks (monocular webcam)

Research date: 2026-11-25. "Source code" links point to the `master` branch of google-ai-edge/mediapipe as fetched that day. The web build actually shipped may differ by version.

## 1. World landmark coordinate system: origin, axes, units, gravity, depth quality

### Takeaway
World landmarks are hip-centred estimates in "metres", learned from synthetic GHUM fits. They are image/camera-aligned, not gravity-aligned. Depth is the weakest axis, and Google lists "applications requiring metric accurate depth" as out of scope.

### Cited Findings
- `worldLandmarks` are 33 keypoints in "real-world meters with the midpoint of the hips as the origin", each with `visibility` and `presence`. The docs page does not state axis directions. — [Pose Landmarker guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker)
- Model card: world X, Y, Z are in metres, centred on the subject's hips, range [-1.5, 1.5]. They were "obtained not via human annotation, but by fitting synthetic data (GHUM model) to the 2D annotation", person segmentation mask and camera intrinsics. — [BlazePose GHUM 3D model card](https://developers.google.com/ml-kit/images/vision/pose-detection/pose_model_card.pdf)
- Model card, screen z: negative is between hips and camera, positive is behind the hips; "Z is not metric but up to scale". This sentence describes the screen-space z, not world z. — [model card](https://developers.google.com/ml-kit/images/vision/pose-detection/pose_model_card.pdf)
- Model card out-of-scope list includes "applications requiring metric accurate depth", people further than about 4 m, multiple people, and a head that is not visible. The training and evaluation images are smartphone back-camera photos; training augmentation mentions 8° roll. — [model card](https://developers.google.com/ml-kit/images/vision/pose-detection/pose_model_card.pdf)
- A repository answer on axis orientation says z points toward the camera for negative values and the other axes are orthogonal to it (the commenter quotes the screen-z text of the model card). — [issue #4205](https://github.com/google-ai-edge/mediapipe/issues/4205)
- The documentation-issue asking for world-axis orientation received only the suggestion to estimate skeleton orientation from the shoulder or hip direction. — [issue #3370](https://github.com/google-ai-edge/mediapipe/issues/3370)
- The landmark graph runs on a rotated crop. The crop rotation comes from two alignment keypoints with a target angle of 90°, so the body axis is made upright before the landmark model runs. — [pose_landmarks_detector_graph.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarks_detector_graph.cc)
- The world landmarks are then passed through `WorldLandmarkProjectionCalculator` with that crop rectangle. It rotates only x and y (`x' = cos·x − sin·y`, `y' = sin·x + cos·y`) and leaves z unchanged. It applies no pitch, gravity or perspective correction. — [world_landmark_projection_calculator.cc](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/calculators/util/world_landmark_projection_calculator.cc)
- A request for world coordinates aligned to real-world space (floor origin) exists as a feature request, which confirms the output is hip-relative. — [issue #2820](https://github.com/google/mediapipe/issues/2820). The origin moves with the hips every frame. — [issue #5444](https://github.com/google-ai-edge/mediapipe/issues/5444)
- Users report that front-facing standing people are reconstructed leaning forward in depth ("the higher a body part is, the less than expected depth is predicted"). These are user reports, not a controlled measurement. — [issue #2918](https://github.com/google-ai-edge/mediapipe/issues/2918), [issue #2203](https://github.com/google/mediapipe/issues/2203), [issue #3476](https://github.com/google-ai-edge/mediapipe/issues/3476)
- 3D training data: GHUM fitted to 2D annotations, with annotator-supplied depth ordering that reduced depth-order errors during fitting from 25% to 3%. — [BlazePose GHUM Holistic, arXiv 2206.11678](https://arxiv.org/pdf/2206.11678)

### Inferences
- Axis convention to use: +x toward image right (the subject's anatomical LEFT when facing the camera, in an unmirrored frame), +y toward image bottom, −z toward the camera. x/y direction follows from the in-image-plane rotation in the projection calculator; I found no official sentence stating "+y is down" for world landmarks. Verify once at runtime (shoulder y should be negative when standing; `P11.x − P12.x` should be positive when facing the camera).
- y is the camera's image vertical, not gravity. Camera roll appears one-for-one as lean offset; camera pitch mixes vertical with depth.
- Whole-body in-plane roll is preserved in the output, because the crop rotation is added back after inference.
- Whether the model is equally accurate for rolled torsos is not established; the upright-crop step suggests in-plane roll is handled better than yaw or pitch.
- CSS mirroring of the preview does not affect landmarks; only mirroring the pixels sent to the model would.

### Gaps
- No official axis diagram or text for world-landmark x/y/z signs was found.
- No published noise (jitter) figure for world z of the Lite model, in particular none for a seated or standing webcam user.
- The effect of off-centre position in the frame (perspective) on world-landmark orientation is not documented.

## 2. Trunk lateral flexion conventions, lateral axis construction, degeneracies, calibration

### Takeaway
Define lean as the angle of the mid-hip to mid-shoulder vector against a vertical reference, resolved along a HORIZONTAL body lateral axis (hip or shoulder line with its vertical component removed). This keeps the signal under rigid torso roll and stays signed correctly under body yaw, but the more the body is yawed the more it depends on noisy depth.

### Cited Findings
- In a 2D-versus-3D validity study, of four 2D definitions of lateral trunk angle, the one formed by the shoulder joint centre, the ASIS and the VERTICAL line was the one that matched 3D for every variable (r ≥ 0.62; mean differences −1.0° to 1.2°). — [DiCesare et al., PMC4127504](https://pmc.ncbi.nlm.nih.gov/articles/PMC4127504/)
- A study building segment frames from MediaPipe landmarks used mid-shoulder and mid-hip as virtual points and computed trunk angles as Euler rotations following ISB recommendations. — [Zhang et al., Applied Ergonomics 2026, PMID 42575021](https://pubmed.ncbi.nlm.nih.gov/42575021/)
- A browser BlazePose pipeline defines trunk lean as the angle between (mid-shoulder − mid-hip) and the upward image vertical (0, −1), flagged at ≥ 0.090 rad (about 5.2°). It is unsigned and image-plane only. — [Pavlikov et al., PMC13517231](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517231/)
- The same paper notes that a trunk lean also tilts other lines (their ear-line head-tilt metric is only raised while the trunk is upright). — [PMC13517231](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517231/)

### Inferences (derived math; not taken from a source)
Notation: P11/P12 = left/right shoulder, P23/P24 = left/right hip (world landmarks).

```
S = (P11 + P12)/2 ; H = (P23 + P24)/2 ; t = S - H            // trunk vector
u = unit up. Default (0,-1,0); better: calibrated (below)
a = P23 - P24     (and/or P11 - P12, or the sum of both)      // right -> left, anatomical
a_h = a - (a·u) u                                             // remove vertical component
if |a_h| / |a| < kMin  or  |a_h| < dMin : invalid, hold last value
l = a_h / |a_h|                                               // horizontal body-left axis
f = normalize(cross(l, u))  or its negation                   // forward; fix the sign with a unit test
lean = atan2(t·l, t·u)                                        // + = toward subject's LEFT
```

- Why the horizontal projection is required: for a rigid frontal-plane roll φ while facing the camera, in (right-on-screen, up) terms t = (sin φ, cos φ) and a = (cos φ, −sin φ). Using the raw body line as the axis gives t·a = 0, so lean reads zero. Projecting a onto the horizontal gives l = (1, 0) and lean = φ. The same cancellation happens for any "shoulder midpoint relative to the shoulder/hip line" measure.
- The shoulder line is only a source of heading (yaw). Its tilt must be discarded. Hips are steadier as a heading source when the player swings arms or shrugs; shoulders are usually better seen at a desk webcam where hips are cropped or occluded. A confidence-weighted sum of both is reasonable but averages in torso twist.
- Yaw relative to camera: with u = (0,−1,0), ψ = atan2(a_h.z, a_h.x). ψ = 0 means facing the camera; |ψ| ≈ 180° means back to camera. Sign of ψ should be checked empirically.
- Alternative angle: `asin((t·l)/|t|)` is the elevation of the trunk out of the body sagittal plane and does not inflate under large forward flexion, whereas `atan2(t·l, t·u)` is the frontal-plane projection angle (clinical 2D convention) and blows up as t·u approaches 0. For a mostly upright game player they are nearly equal.
- Side-on is NOT a mathematical singularity of this construction (a_h stays large, along z). It is a SIGNAL degeneracy: t·l = t.x cos ψ + t.z sin ψ, so at ψ = 90° lean comes entirely from depth. The true singularity is a body line near vertical (roll near 90°).
- Noise propagation: σ_lean ≈ sqrt(σx² cos²ψ + σz² sin²ψ) / |t| (small angles, independent errors). For |t| = 0.5 m, every 1 cm of displacement error is about 1.1°.
- Forward-lean leakage: an apparent forward pitch β (real, or the model's depth bias) leaks into lateral lean as about atan(tan β · sin ψ) if the heading is wrong or the up vector is wrong; e.g. 10° and 20° gives about 3.5°. With a correct heading, real forward flexion is separated into f; heading ERRORS from noisy shoulder z are what mix the two.
- Gating suggestion (thresholds are engineering guesses to be tuned): trust fully for |ψ| ≲ 30°, degrade or hold between 30° and 60°, reject beyond. Smooth the heading vector (not the angle ψ, which wraps) more heavily than the trunk vector.
- Neutral baseline: during calibration take the median (or mean-then-normalize) of t̂ over upright still frames. Two options: (a) scalar `lean0` subtracted later (simple; correct only near the calibration yaw, since model/pitch bias projects differently at other yaws); (b) calibrated up vector u = normalize(median t̂), which absorbs camera roll, camera pitch and the model's forward bias, but also treats the player's habitual posture as vertical. A hybrid is to take roll and pitch of u from calibration but reject it if it is more than about 25° from (0,−1,0). A single frontal neutral pose cannot separate camera pitch from the person's own forward posture.
- Recompute or invalidate calibration if the camera moves. Camera-aligned coordinates have no way to detect this.
- Fallback when |ψ| is small or z is unreliable: image-plane lean with aspect correction, `atan2((Sx − Hx)·W, (Hy − Sy)·H)`. It uses no depth and is unaffected by rigid torso roll, but is foreshortened by yaw (roughly cos ψ for pure lateral lean) and contaminated by forward flexion × sin ψ.
- Test fixtures worth adding: rigid roll of all torso points about the hip centre (expected lean = φ); the same under yaw ±30°; pure forward flexion under yaw (expected about 0); shoulder-only tilt/shrug (expected about 0); camera roll absorbed by calibration.

### Observations from the local code (`/home/lucas_coimbra/projects/wii/src`, read 2026-11-25)

> Note (added on import): this section describes the pre-PR-#5 implementation. Lane lean now uses world landmarks measured against the leg-calibrated vertical (`legsVertical` in `bodyFrame.ts`, `leanUp0` in the calibration profile), and lane direction remains unverified on a real camera.
- `kinematics/postureSignals.ts` (`torsoLeanDeltaRad`) and `cv/calibrator.ts` use IMAGE landmarks, not world landmarks: mid-hip to mid-shoulder against image vertical. This already survives rigid torso roll (it does not reference the shoulder line).
- Both apply `atan2` to normalized x and y without aspect correction. At the requested 640×480, tan(reported) = 0.75·tan(true), so the 0.12 rad lane threshold corresponds to about 9° of true image-plane lean (not 6.9°).
- Sign check needed: `cv/poseClient.ts` sends `createImageBitmap(video, …)` with no flip (mirroring is CSS only). In an unmirrored frame, a player leaning to their own left moves toward larger x, giving delta > 0, which `LaneLeanDetector` maps to `'right'`; `TrackGame` maps `'right'` to lane +1. This looks inverted from the player's point of view. Inferred from reading the code, not verified with a camera.

### Gaps
- No ISB or other standard was retrieved that defines trunk lateral flexion from markerless shoulder/hip midpoints; ISB definitions use bony landmarks, and the ISB documents themselves were not fetched here.
- No source was found describing the horizontal-projection-of-shoulder-line construction or validating yaw gating thresholds. These are derivations.

## 3. Published accuracy of BlazePose for trunk lean

### Takeaway
I found no study giving a clean lateral-trunk-lean error for BlazePose world landmarks from a frontal webcam. Indirect evidence suggests several degrees at best for trunk angles, with frontal-plane estimates degrading under multi-planar motion and non-frontal views, so a lean threshold should sit well above about 5°.

### Cited Findings
- Developer-reported 3D mean absolute error on a yoga evaluation set (single person, 2–4 m, 17 COCO keypoints): Heavy 36 mm, Full 39 mm, Lite 45 mm; 2D mAP 68.1 / 62.6 / 45.0. — [arXiv 2206.11678](https://arxiv.org/pdf/2206.11678)
- Monocular MediaPipe (BlazePose v0.8, world coordinates) against Vicon in lifting, n = 20: across all joint-plane-task combinations RMSE 5.9–67.1°. The camera was at about 90° (symmetric lift) or 45° (other tasks), never frontal. Trunk axial-rotation error reached 58.7°. MediaPipe had lower trunk error than OpenCap in the sagittal plane. The trunk frontal-plane values are in a table not retrieved. — [PMID 42575021](https://pubmed.ncbi.nlm.nih.gov/42575021/)
- Eleven monocular estimators on 25 participants: mean per-joint position error 72–122 mm in the image plane versus 146–249 mm in 3D including depth (range across models, not specific to BlazePose). — [Rode et al., PMC12589393](https://pmc.ncbi.nlm.nih.gov/articles/PMC12589393/)
- Single-participant study: MediaPipe 3D agreed worse with optical capture (mean ICC 0.658) than MediaPipe 2D (0.848). — [Balci et al., PMC12833419](https://pmc.ncbi.nlm.nih.gov/articles/PMC12833419/), values as quoted in [Shrestha et al., PMC13667498](https://pmc.ncbi.nlm.nih.gov/articles/PMC13667498/)
- MediaPipe upper-limb validation (n = 10, not trunk): frontal-plane shoulder abduction RMSE 9.0–11.2° across viewpoints; out-of-plane and rotational tasks were far worse (roughly 18–46°). — [PMC13667498](https://pmc.ncbi.nlm.nih.gov/articles/PMC13667498/)
- Browser BlazePose compensation detector: trunk lean was among the two best metrics ("near-expert") against clinician ratings, on a seated frontal task with healthy volunteers simulating compensations. Its F1 ranged 0.75–0.98 when the threshold was varied ±20%. This is classification agreement, not angle error. — [PMC13517231](https://pmc.ncbi.nlm.nih.gov/articles/PMC13517231/)
- Generic 2D video (not BlazePose) versus 3D for frontal-plane trunk angle: r = 0.81–0.92, absolute agreement below 5°, but 95% limits of agreement −11.8° to +9.4°. — [Straub & Powers, PMC8805121](https://pmc.ncbi.nlm.nih.gov/articles/PMC8805121/)

### Inferences
- For a game with a roughly frontal player, aspect-corrected 2D lean is probably at least as reliable as 3D lean; world landmarks mainly add heading estimation and yaw compensation. This should be A/B tested on recorded sessions.
- Baseline-relative detection with hysteresis (enter around 8–10°, exit lower) is more defensible than absolute angle claims.
- Position MAE in mm cannot be converted directly into angle error, because errors of neighbouring torso points are likely correlated.
- The Lite model (used by this project) has the weakest published accuracy of the three variants.

### Gaps
- No trunk lateral flexion RMSE/MAE for BlazePose Lite, webcam, frontal view was found.
- No study of lateral-lean error as a function of body yaw was found.
- Only passages and abstracts were retrieved through the research index; full tables were not reviewed. Several 2026 studies are very recent and were not independently appraised.
