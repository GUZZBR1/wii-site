# Third-party notices

## MediaPipe Tasks Vision

`@mediapipe/tasks-vision` is distributed by Google under the Apache License 2.0. The app uses `@mediapipe/tasks-vision@1.2.3`, the Pose Landmarker Lite model bundle at <https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task>, and the HandLandmarker (full) model bundle at <https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task>.

The Pose Landmarker model file is distributed under Apache 2.0 as confirmed by the MediaPipe maintainers in [google-ai-edge/mediapipe issue #6306](https://github.com/google-ai-edge/mediapipe/issues/6306). The HandLandmarker model is published as Apache 2.0 in the [upstream hand-tracking model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20(Lite_Full)%20with%20Fairness%20Oct%202021.pdf). Their SHA-256 values are recorded in `public/mediapipe/models/SHA256SUMS`.

License text: <https://www.apache.org/licenses/LICENSE-2.0>

MediaPipe Tasks process the camera frames on device. The upstream privacy notice says the API may send performance and utilization metrics to Google: <https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/README.md#privacy-notice>.
