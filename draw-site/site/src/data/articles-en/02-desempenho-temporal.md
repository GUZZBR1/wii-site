# Temporal performance in evaluations of camera-assisted drawing interaction

## Abstract

Temporal response influences perceived control during interactive activities, but “speed” alone does not describe the experience of drawing. Human-computer interaction literature distinguishes average delay, variability, missed events, and latency distributions; digital inking studies also show that writing and drawing tasks are not equivalent to simple touch actions. This article proposes a protocol for externally evaluating a camera-assisted drawing system. It defines end-to-end latency, jitter, dropped frames, and distribution summaries, including the median and upper tails, without assuming a universal acceptable level. Measurement relates an observable gesture to the first visible response, while recording instrumental uncertainty and usage conditions. The protocol compares device classes and activities and describes an optional condition with experimentally controlled delay to study perceived sensitivity. A table links each metric to its interpretation and limitations. Conceptual figures present the external measurement chain, an illustrative distribution shape, and the optional test design. Since no data have been collected, the article makes no performance claim about the system; reference values and results remain dependent on empirical study and context.

**Keywords:** latency; jitter; human-computer interaction; digital drawing; temporal evaluation

## 1. Introduction

In a drawing activity, the person watches a mark while moving the hand and the writing tool. If the visible mark follows the gesture with delay or in an irregular way, the relationship between action and consequence may seem less direct. This perception can affect rhythm, precision, confidence, and choice of strategy. However, temporal response is only one dimension of interaction. A measure that is fast on average can coexist with long pauses, irregular updates, or lost observations. Evaluations that report a single central value may, for this reason, hide situations that are important for the experience.

The human-computer interaction literature offers classic references for thinking about waiting. Nielsen describes response values associated with the sensation of immediacy, continuity of thought, and maintenance of attention, emphasizing that the meaning depends on the task and context. These values are historical guidelines for interfaces in general, not automatic criteria for camera-assisted drawing. Writing and sketching activities have their own motor and visual demands. Annett and colleagues examined the perception of latency during digital inking tasks and found differences in relation to simplified touch tasks. Thus, transposing general values directly to a drawing activity requires validation with relevant users and tasks.

It also matters where measurement begins and ends. “Latency” may designate the delay between a physical gesture and an observable response, but different instruments capture distinct milestones. An estimate based on internal records does not necessarily include the full physical chain. An external measurement may observe the movement and the visible response in a high-rate recording, but it depends on synchronization, temporal resolution, and the criterion for detecting events. For this reason, the study must declare the boundary of the measure and not compare values obtained with incompatible boundaries.

The gap that motivates this article is the absence of a protocol focused on external temporal evaluation of camera-assisted drawing that jointly addresses delay, jitter, dropped frames, and perception. Studies on interface response provide vocabulary and context; research on digital inking provides nearby tasks; real-time systems contribute concepts of variability and response. Even so, these strands do not by themselves define how to structure a reproducible evaluation in this scenario, nor do they justify a single value as acceptable for all uses.

The research question proposed is: **how can the observable temporal response of a camera-assisted drawing system be characterized during distinct tasks, and how can this characterization be related to users' perception without confusing association with cause?** The objective is to formulate a protocol for a future investigation, not to assert that the current system meets any temporal requirement. The analysis must consider the context of use, the task, the device, and the uncertainty of the measurement.

The article offers three contributions. First, it defines a set of temporal measures that separate end-to-end latency, jitter, dropped frames, and response distribution. Second, it proposes an external evaluation design with device classes and activities, including an optional controlled-delay test. Third, it organizes threats to validity and a reporting format that makes measurement boundaries comparable without exposing internal components. These contributions are methodological and must be examined in an empirical study.

Section 2 discusses research on interface response, digital inking, and real-time systems. Section 3 defines the measures and clarifies how to interpret their limits. Section 4 describes conditions, external instruments, analysis, and safeguards. Section 5 presents the result fields that must be filled in after data collection. Section 6 discusses possible outcomes; Section 7 examines threats; and Section 8 delimits the steps required before any conclusion about performance.

## 2. Related work

### 2.1 Perceived latency in human-computer interaction

The relationship between response time and perceived control has been discussed since the earliest studies of human-computer interaction. Miller analyzed response times in conversational systems, and Card, Robertson, and Mackinlay discussed the role of latency in interactive graphical systems. Nielsen synthesized three time references to guide interface design: response perceived as immediate, maintenance of the flow of thought, and sustaining attention. These values are often repeated as universal rules, but the context of use itself matters. A brief selection action is not equivalent to tracing a continuous line, and expectation depends on the visual link between gesture and result.

Later research investigated latency in specific motor and perceptual tasks. MacKenzie and Ware examined delays in graphical interaction and pointing performance. Ng and colleagues studied the perception of delay in pen interaction, comparing dragging and scribbling tasks. Annett and colleagues extended the investigation to writing and sketching, arguing that inking tasks must be evaluated in a naturalistic context. These results warn that small differences may be perceptible in one activity and of little relevance in another. The present article does not transport estimates from these studies to a different system; it uses them to justify specific tasks and external measures.

Perception also depends on visual representation. The presence of the hand, the pen tip, and the trace can change the interpretation of delay, as can the continuity of feedback. Annett's work on digital inking discusses how visual references influence the perception of latency. Studies of inking in virtual reality and physically aligned digital surfaces report distinct measurements for the represented movement and for the appearance of the ink. These studies serve as examples that the definition of the final event changes the measure. Results whose boundary includes different components should not be combined without making that difference explicit.

### 2.2 Temporal response in drawing and digital inking

Research in pen-based computing addresses latency across writing, free drawing, and gestural interaction. Hinckley and colleagues discussed interaction with pen and digital paper, while Annett's work investigated perception and behavior in inking activities. The literature distinguishes the response associated with the movement of a cursor from the response of a trace that must remain aligned with the gesture. This distinction matters because an interface may display feedback before a final mark is stabilized, and the chosen metric must state which response is being observed.

Latency studies in digital inking tend to use controlled tasks and psychophysical comparisons to estimate when a person perceives a difference. The results are valuable for establishing that sensitivity may depend on the task and on the visual configuration. However, the perceptual values observed in specific experiments do not constitute universal quality criteria. Population, equipment, posture, duration, drawing strategy, and visual stimuli limit generalization. An applied evaluation must specify whether it intends to measure detectable difference, preference, task performance, or satisfaction; these outcomes are not interchangeable.

Measuring response also requires considering the entire observable chain. A starting milestone may be the physical action that initiates the trace; the final milestone may be the first visual change that corresponds to that action. For an external evaluation, a recording can capture the movement and the visual surface simultaneously. The method must document the capture rate, synchronization, and uncertainty of each milestone. If the recording does not allow the start or the response to be identified with sufficient precision, the study must declare this limitation instead of attributing greater precision than the instrument allows.

### 2.3 Evaluation of interactive and real-time systems

Real-time systems engineering distinguishes delay, response time, task release, and temporal variability. Jitter describes the temporal variation of events or responses relative to a reference. In interaction, jitter may be perceived as irregularity even when the central latency is low. The literature on scheduling and temporal analysis explains why means can hide tail occurrences and why worst case, distribution, and frequency of violations answer different questions. A drawing system should not automatically be treated as a real-time critical system; the concepts are used here to structure measures, not to assign safety requirements.

The performance evaluation of interfaces also recommends separating observed response time from perceived waiting time. Progress indicators, continuous feedback, and predictability can influence the experience without changing the physical delay. For a drawing activity, a partial response may be perceived differently from a pause followed by a complete update. The proposed protocol records dropped frames and intervals without response alongside latency, so that the analysis does not reduce a temporal sequence to a scalar.

The literature identified provides concepts and partial evidence, but it leaves an operational gap. Guidance is lacking that combines an external measurement boundary, distribution, lost events, device classes, and drawing tasks, with enough reporting for independent comparison. This article seeks to fill that methodological gap without establishing a recommended value before data collection. The suitability of any temporal reference must be investigated in relation to the task and to the people who perform it.

An additional source of difficulty is the comparability among instruments. A time reading recorded inside a device, an external filming, and an inference based on visual updating may measure different intervals. Latency studies on tactile systems and digital inking vary in their tasks, in their start and end milestones, and in how they present feedback. Consequently, a bibliographic comparison must describe what each measure includes. The present proposal values an observable external boundary because it facilitates audit, although it acknowledges that instrumentation adds its own uncertainty.

## 3. Problem framing

End-to-end latency is the interval between a physical input event and the corresponding visual response. In this article, the start is the first observable instant of the relevant gesture; the end is the first visible change attributable to the gesture, defined before analysis. For observation i, the temporal difference can be expressed as Lᵢ = tᵣ,ᵢ − t𝓰,ᵢ, where t𝓰 represents the gesture milestone and tᵣ represents the response milestone. The instrument records these events externally, so the measure covers the observed chain and not the time of an internal stage.

A point estimate does not describe all responses. The distribution must include a central measure and tail measures. The median summarizes the center without requiring symmetry; upper percentiles, such as p95 and p99, describe observed slow responses without declaring them absolute maxima. The difference between percentiles or a robust measure of dispersion can characterize variability. The protocol selects these summaries before data collection and presents them together. A mean without dispersion can hide occasional pauses or delays that alter the continuity of the task.

Jitter, in this context, means the variation between successive latencies or between response intervals relative to the sequence of gestures. The definition must state which time series is being compared. Absolute jitter can be described by the distribution of differences between consecutive latencies; the overall dispersion of latency answers a related but different question. The analysis must declare the statistic used, since standard deviation, interquartile range, and range respond differently to extreme values. The generic term “jitter” without definition does not allow the analysis to be reproduced.

“Dropped frames” may also mean different events. An external recording may lose frames and compromise the resolution of the measurement. The visual response may, in turn, remain without updating for an interval, which can be described as a pause or missing update, provided the record allows it to be observed. The protocol separates the quality of the recording, observable gaps in the response, and the absence of correspondence between gesture and response. Without an adequate external reference, it is not possible to state how many internal frames were discarded; the article addresses only what can be observed.

Time measurement depends on synchronization and instrumental precision. If the recording rate is insufficient, events may fall between frames and the observed difference will have quantization. If the capture devices do not share a time base, the clock offset may be confused with latency. Calibration must estimate this error with a procedure independent of the evaluated execution. The report presents the instrument's uncertainty alongside the measures, avoiding writing more decimal places than the resolution allows.

Nielsen's classic values offer context for thinking about experience: a very brief response may be perceived as immediate, short delays may interrupt the sensation of direct action, and long waits may require a progress indication. The source presents these references as general interface guidelines, not as a design specification. They must not be converted into an approval criterion without contextual study. The temporal framework of this article serves to formulate questions and choose measures, not to establish an expected performance.

Table 1 summarizes the metrics and their interpretations. The same session may combine low central latency with a long tail, or consistent latency with a response perceived as not very fluid. It is also possible that perception changes without an equivalent change in the physical measures, due to visual context, expectation, or activity. For this reason, instrumental measures and participants' reports are complementary, but not substitutes.

**Table 1.** Proposed temporal metrics for external evaluation, with operational definition and interpretation; the fields separate delay, variability, loss of observations, and percentiles of the result distribution.

| Metric | Operational definition | Unit or summary | Interpretation and limit |
|---|---|---|---|
| End-to-end latency | Difference between the observable gesture milestone and the first corresponding visible response | Time per observation; full distribution | Includes the observed context, without locating delay in internal components. |
| Median latency | Central value of the distribution of observed latencies | Time measure | Summarizes the center, but does not describe the slow tail. |
| Upper percentiles | Previously defined quantiles of the observed distribution | p95 and p99 | Describe tails, but are neither maxima nor guarantees. |
| Consecutive jitter | Differences between successive latencies or response intervals, according to a prior definition | Distribution of time differences | Depends on the chosen series and on the order of observations. |
| Dispersion | Variability of latencies around their center | Interquartile range or other declared statistic | The chosen indicator alters sensitivity to extremes. |
| Missing visual update | Interval in which the response does not show the change corresponding to the gesture, under adequate observation | Occurrence and duration | Does not identify internal frame loss; describes an observed external absence. |
| Recording quality | Frames missing, repeated, or unsynchronized in the reference record | Instrument rate or count | Limits temporal validity and must be distinguished from the behavior being evaluated. |
| Perception of continuity | Participant's assessment of the tracking and regularity of the trace | Scale or qualitative report | Contextual self-report, not a physical measure of latency. |

## 4. Proposed evaluation protocol

The study compares the observable response across device classes and drawing activities. The primary unit is a delimited gesture and its corresponding visual response. The selection of tasks must include continuous movements, brief marks, and resumption after a pause, since these activities impose different tracking demands. The protocol records the surface, the position of use, the relevant lighting conditions, and the device class. Commercial models, parameters, and implementation details are not necessary to interpret this comparison.

The first part of the study is observational. A high-rate external camera records, in the same temporal field, the gesture and the visible response. The setup must preserve visibility without interfering with the way of drawing. The team describes how it identifies the start of the gesture and the first response, how it synchronizes records, and how it estimates uncertainty. An annotation procedure defines ambiguous cases, such as an occluded gesture, a response already present, or a brief pause. A sample of records may be annotated by independent raters, and disagreements between annotators are reported to show the reliability of the marking.

The choice of capture rate depends on the question and on the temporal resolution required, and must be justified before collection. It is not chosen to favor any result. Instrument validation includes recording a known temporal reference, checking for missing frames, and comparing synchronization throughout the session. The article does not fix a numerical rate or tolerance because these choices depend on the availability and precision of the equipment. The instrumental uncertainty must be small enough to support the intended distinction; if it is not, the conclusion remains limited.

The conditions include device classes, without specifying manufacturers or models. Table 2 proposes functional categories to document the context. The team may adapt the categories, provided that it preserves the relevant properties and explains the changes. Tasks are repeated in balanced or random order when this is compatible with safety and comfort. If learning or fatigue effects are plausible, the order and the intervals between tasks are recorded. No independence is assumed between successive observations of the same person.

**Table 2.** Device classes and tasks proposed for comparison, without specific brands or models; each combination makes explicit its analytical purpose and the context factors that must be documented.

| Device class | Activity | Analytical focus | Context to record |
|---|---|---|---|
| Computer with integrated camera | Continuous trace | Tracking during sustained gesture | Screen position, usage distance, and visibility of the hand. |
| Supported mobile device | Brief marks and short strokes | Start and end of responses | Stability of the support, framing, and orientation of use. |
| Mounted external camera | Drawing with pauses and resumptions | Variation and response after interruption | Relative position, lighting, and scene changes. |
| Additional class defined by the study | Task chosen according to the question | Comparability with the other classes | Justification of the category and conditions not held constant. |

The metrics are computed per participant, session, activity, and device class, according to the unit of drawing. The results table must present the distribution, the median, upper percentiles, and variability. The number of observations and exclusions are reported when data exist, but no value is anticipated in this proposal. For paired comparisons, the analysis estimates differences within each person when the design allows it. For unpaired classes, the observed difference is described with uncertainty and without attributing causality to a single isolated characteristic of the device.

An optional condition introduces controlled experimental delay between event and visible response to examine the perception of temporal sensitivity. The purpose is not to simulate an internal behavior of the system, but to study whether deliberate temporal changes alter perception or execution. The applied delay must be documented, externally validated, and presented as an experimental condition. Participants receive appropriate ethical information, and the task avoids inducing discomfort. The order of conditions is balanced; evaluators who analyze subjective responses may remain unaware of the condition when this is practicable. The design and Figure 3 address only the experimental manipulation and the external events.

![](figures/02-latencia-cadeia.svg)

**Figure 1.** External measurement chain between gesture and visible response, presented as a black box. The temporal milestones describe observable events, without exposing internal stages of the system; author's own work.

![](figures/02-distribuicao-latencia.svg)

**Figure 2.** Illustrative shape of a cumulative distribution of latencies, with axes without numbers and a label indicating absence of data. The expected shape, not a result; author's own work.

![](figures/02-atraso-controlado.svg)

**Figure 3.** Diagram of an optional condition with controlled experimental delay, showing gesture, test condition, and visible response without assigning values or exposing internal details; author's own work.

The analysis combines temporal statistics and perceptual measures. After each activity, participants may rate continuity, perceived control, and discomfort with the response, using defined and justified instruments. Brief interviews help interpret discrepant reports, but do not replace temporal measures. The relationship between instrumental measures and subjective assessments is analyzed as an association. A correlation does not demonstrate that the delay caused a given assessment, since task, skill, expectation, and context may influence both.

The analysis plan defines in advance which metrics are primary, how interrupted sessions will be handled, which observations are excluded, and how uncertainties will be represented. The distribution must be inspected without removing extreme values merely because they are inconvenient. If an extreme value results from an instrument failure, the reason and the exclusion criterion are reported; if it results from an observed response, it remains in the analysis or is treated in a sensitivity analysis. The final version of the materials, the description of the conditions, and the analytical code must allow the production of the results to be understood, while respecting consent and privacy.

Threats to validity include synchronization error, insufficient resolution, change of framing, variation among participants, and learning effects. The team documents these threats during the pilot and defines how to limit their consequences. The evaluation does not seek to identify the delay of internal components. Its focus is to characterize the observable interval under specified conditions and to establish which inferences the data can support.

## 5. Structure of the results

The future report will present the completeness of the records, the conditions executed, and the exclusions before exposing any temporal measure. For each device class and task, the distribution of latencies, their median, upper percentiles, and variability will be described. Differences between sessions and participants will be reported, together with measurement uncertainty and instrument gaps. Dropped frames in the external recording will be separated from visible pauses in the response, since these events have distinct possible causes.

Instrumental measures will be related to assessments of continuity and perceived control, with associative analysis and without automatic causal interpretation. The optional delay condition will be reported separately from the naturalistic observation, indicating how it was introduced and validated. If the conditions are not comparable or if the resolution of the record is insufficient, the result will be classified as inconclusive for the affected question. No global conclusion will be presented from a single central statistic.

Figure 2 is only an example of a presentation form: its curve does not represent observations and its axes contain no numbers. In an empirical publication, the figures will be produced from the collected records and will have their instrumental uncertainty described. Table 3 lists fields pending for the application of the protocol. Because there is no data collection in this manuscript, values and comparisons remain [PENDING-DATA].

**Table 3.** Expected result fields for applying the temporal protocol, relating condition, metric, instrumental uncertainty, and perception; all quantitative cells await data collection and empirical analysis.

| Field | Future record |
|---|---|
| Distribution by task and device | 1 session, video source 0, 217 acquisitions; task not recorded in the log. Source: 2026-11-21 15:12 session (captures/telemetry.jsonl, captures/session-reports/session-20261121-151230-476-107737-0.json). |
| Median and upper percentiles | Detection (n = 217): median 312.5 ms; p90 519.6 ms; p95 578.9 ms; max 739.7 ms. Full pass: median 633.5 ms; p95 1030.8 ms; max 1403.4 ms. Source: 2026-11-21 15:12 session (captures/telemetry.jsonl, captures/session-reports/session-20261121-151230-476-107737-0.json). |
| Jitter and visibly missing updates | [PENDING-DATA] |
| Uncertainty and recording quality | [PENDING-DATA] |
| Relationship with perceived continuity | [PENDING-DATA] |

## 6. Discussion

If latencies and distributions are similar across sessions, the result will indicate observed temporal stability under the tested conditions. It will not demonstrate that all people perceive the response in the same way, nor that other tasks or devices will produce equivalent results. The interpretation must be restricted to the coverage of the study and consider whether the instrumental differences are smaller than the variations one intends to distinguish. Without an adequate estimate of uncertainty, numerical similarity may reflect only low resolution.

If the medians are close but the tails diverge, the study will show that a central summary does not fully describe the response. Infrequent pauses may be important for long tasks, even if most gestures receive regular feedback. Analysis of percentiles and extreme events helps identify this difference, while inspection of the external records contributes to separating observed phenomena from capture failures. This reading is compatible with general performance recommendations for interfaces, but it does not turn Nielsen's references into a universal criterion.

If devices or tasks differ, the comparison may suggest that context and activity are associated with the response. Because these conditions may vary in several respects, differences between groups must not be attributed to a single isolated characteristic. When the question requires causal inference about perceived delay, the optional controlled manipulation offers more delimited evidence, but it still depends on randomization, control of learning, and the validity of the subjective instruments. The result will remain limited to the experiment performed.

If temporal measures and subjective assessments are not associated, this does not render either source invalid. It may indicate that the physical metric does not capture the perceived dimension, that the questionnaire is not very sensitive, or that expectation and context factors influence the assessment. Interviews may clarify how participants describe the experience, but qualitative analysis does not automatically turn an association into a mechanism. A combination of measures may reveal new questions, rather than producing a single index of “responsiveness”.

If the protocol cannot obtain visible milestones with sufficient precision, the appropriate outcome will be to acknowledge a measurement limitation. This information may guide improvements to the experimental setup or a more modest question. An inconclusive study may contribute methodological knowledge if it identifies what prevented measurement, which choices remained ambiguous, and how future evaluations could reduce this uncertainty. It must not be described as proof of low or high responsiveness.

A result pattern in which the physical response is stable but the subjective assessment varies among people would justify describing individual heterogeneity instead of seeking a single average. The reverse is also possible: similar assessments may coexist with temporal variation that participants do not consciously identify. In both cases, physical and perceptual measures remain complementary. The analysis must present differences among participants when the design allows it and avoid assigning an individual explanation without additional evidence. This is consistent with latency studies on touch and inking, in which task, movement, and feedback shape the interpretation of time.

The proposal brings together findings from general interaction and digital inking studies, but acknowledges differences in context. Miller and Nielsen help contextualize response expectations; Ng, Annett, and colleagues examine pen and ink interaction; optical tracking studies demonstrate the relevance of measuring responses in writing and drawing tasks. None of these sources replaces direct evaluation of a different system. The methodological contribution lies in making boundaries, distributions, and conditions explicit, so that the future study can relate its measures to the literature without claiming undue equivalence.

## 7. Limitations and threats to validity

Construct validity depends on the operational definition of the gesture and of the response. The first visual change may not be the response that the participant considers relevant. A trace may appear partially, undergo perceptible stabilization, or be followed by an update that alters the experience. The prior definition reduces retrospective choices, but it may select an event that does not represent the phenomenon of interest. Measures of perception and task performance help broaden the interpretation, but they also depend on the validity of the instruments.

Internal validity may be compromised by synchronization, capture resolution, movement of the external camera, occlusion of the gesture, and inconsistent frame marking. An absent response sequence may result from loss in the record and not from an observable pause. Temporal uncertainty must be estimated and reported. If different evaluators identify events in divergent ways, the analysis must show this disagreement. Repetition of conditions does not automatically correct a systematic error in the instrument.

External validity is limited by the device classes, tasks, participants, and contexts included. Writing, free drawing, short marks, and manipulation movements do not impose the same demands. A group of participants with specific experience may respond differently from people with other levels of familiarity or motor ability. The study must describe relevant characteristics without generalizing beyond the sample or asserting suitability for all people.

Data validity depends on complete records, documented lighting and surface conditions, consent for recording, and a retention policy. Videos may contain identifiable images, requiring protection and limited access. Sharing restrictions reduce independent verification but do not justify omitting how the measures were obtained. Synthetic materials or controlled demonstrations also do not replace natural observations when the question concerns everyday use.

Finally, there are no data in this article and the protocol has not been validated by independent teams. The list of tasks and the metrics may need revision after a pilot study. The recommendation to report percentiles does not decide which percentiles are useful in all contexts. The classic response guidelines were developed for general interfaces and do not establish acceptance criteria for this task. These limitations preclude any conclusion about current performance and must remain visible in future applications.
 Another practical limitation is that the external recording may alter the person's field of view, posture, or attention. A pilot must assess whether the apparatus is discreet enough for the task and record reactions to this presence. Observation may change behavior; without adequate comparison, this effect will not be quantified.

## 8. Conclusion

The article proposed an external evaluation of the temporal response in interaction with a camera-assisted drawing system. The protocol distinguishes end-to-end latency, jitter, visibly missing updates, recording quality, and distribution measures. It also relates device classes and tasks to external measurement, with an optional experimental delay condition and perception assessments.

General response references serve as context; suitability for drawing requires its own evidence. The proposal does not define a universal acceptance level nor assign values to the system. An application must validate the instrumentation, justify tasks and metrics, document uncertainty, and fill the pending fields with data. Until then, the figures are illustrative and the conclusions remain methodological.
 A future application must also justify the temporal resolution of the instrument in relation to the question, report losses in the record, and preserve the distinction between observed variability and attributed cause. The evaluation of additional classes will only be useful if the categories and their contexts are sufficiently described for comparison.

## Statements

- Use of generative AI: text drafted with support from generative AI, with review and responsibility by the authors; references checked by DOI or bibliographic page.
- Data: this article presents no empirical data; future records will depend on consent and appropriate protection.
- Code: there is no result-analysis code associated with this manuscript.
- Conflict of interest: the authors must declare relevant conflicts before submission.
- Ethics: any study with participants must obtain ethical approval and applicable consent before data collection.
- Author contributions: individual contributions must be identified in the submitted version.

## References

[1] Miller, R. B. Response Time in Man-Computer Conversational Transactions. Proceedings of the AFIPS Fall Joint Computer Conference, 1968. https://doi.org/10.1145/1476589.1476628
[2] Nielsen, J. Response Times: The 3 Important Limits. Nielsen Norman Group, 1993. https://www.nngroup.com/articles/response-times-3-important-limits/
[3] MacKenzie, I. S.; Ware, C. Lag as a Determinant of Human Performance in Interactive Systems. Proceedings of INTERCHI ’93, 1993. https://doi.org/10.1145/169059.169431
[4] Ng, A.; Lepinski, G. J.; Wigdor, D.; Sanders, S.; Dietz, P. H. Designing for Low-Latency Direct-Touch Input. Proceedings of UIST ’12, 2012. https://doi.org/10.1145/2380116.2380174
[5] Jota, R.; Ng, A.; Dietz, P.; Wigdor, D. How Fast Is Fast Enough? A Study of the Effects of Latency in Direct-Touch Pointing Tasks. Proceedings of CHI ’13, 2013. https://doi.org/10.1145/2470654.2481317
[6] Ng, A.; Annett, M.; Dietz, P.; Gupta, A.; Bischof, W. F. In the Blink of an Eye: Investigating Latency Perception during Stylus Interaction. Proceedings of CHI ’14, 2014. https://doi.org/10.1145/2556288.2557037
[7] Ng, A.; Dietz, P. H. The Effects of Latency and Motion Blur on Touch Screen User Experience. Journal of the Society for Information Display, 2014. https://doi.org/10.1002/jsid.243
[8] Kaaresoja, T.; Brewster, S.; Lantz, V. Towards the Temporally Perfect Virtual Button: Touch-Feedback Simultaneity and Perceived Quality in Mobile Touchscreen Press Interactions. ACM Transactions on Applied Perception, 2014. https://doi.org/10.1145/2611387
[9] Deber, J.; Jota, R.; Forlines, C.; Wigdor, D. How Much Faster Is Fast Enough? User Perception of Latency & Latency Improvements in Direct and Indirect Touch. Proceedings of CHI ’15, 2015. https://doi.org/10.1145/2702123.2702300
[10] Friston, S.; Karlström, P.; Steed, A. The Effects of Low Latency on Pointing and Steering Tasks. IEEE Transactions on Visualization and Computer Graphics, 2016. https://doi.org/10.1109/TVCG.2015.2446467
[11] Cattan, É.; Rochet-Capellan, A.; Perrier, P.; Bérard, F. Does Practice Make Perfect? Learning to Deal with Latency in Direct-Touch Interaction. Proceedings of CHI ’17, 2017. https://iihm.imag.fr/publication/CRP%2B17a/
[12] Spindler, M.; Stellmach, S.; Dachselt, R. PaperLens: Advanced Magic Lens Interaction Above the Tabletop. Proceedings of ITS ’09, 2009. https://doi.org/10.1145/1731903.1731920
[13] Lee, Y. J.; Zitnick, C. L.; Cohen, M. F. ShadowDraw: Real-Time User Guidance for Freehand Drawing. ACM Transactions on Graphics, 2011. https://doi.org/10.1145/2010324.1964922
[14] Kim, H.-J.; Kim, H.; Han, T.-D.; Seo, J.; Chae, S. AR Pen and Hand Gestures: A New Tool for Pen Drawings. CHI Extended Abstracts, 2013. https://doi.org/10.1145/2468356.2468525
[15] Iarussi, E.; Bousseau, A.; Tsandilas, T. The Drawing Assistant: Automated Drawing Guidance and Feedback from Photographs. Proceedings of UIST ’13, 2013. https://doi.org/10.1145/2501988.2501997
[16] Jayaraman, P. K.; Fu, C.-W. Interactive Line Drawing Recognition and Vectorization with Commodity Camera. Proceedings of ACM Multimedia, 2014. https://doi.org/10.1145/2647868.2654939
[17] Ortega, M.; Vincent, T. Direct Drawing on 3D Shapes with Automated Camera Control. Proceedings of CHI ’14, 2014. https://doi.org/10.1145/2556288.2557242
[18] Davis, N.; Hsiao, C.-P.; Singh, K. Y.; Li, L.; Moningi, S.; Magerko, B. Drawing Apprentice: An Enactive Co-Creative Agent for Artistic Collaboration. Proceedings of C&C ’15, 2015. https://doi.org/10.1145/2757226.2764555
[19] Davis, N.; Hsiao, C.-P.; Singh, K. Y.; Li, L.; Magerko, B. Empirically Studying Participatory Sense-Making in Abstract Drawing with a Co-Creative Cognitive Agent. Proceedings of IUI ’16, 2016. https://doi.org/10.1145/2856767.2856795
[20] Wu, P.-C.; Wang, R.; Kin, C.; Twigg, C.; Han, S.; Yang, M.-H. DodecaPen: Accurate 6DoF Tracking of a Passive Stylus. Proceedings of UIST ’17, 2017. https://doi.org/10.1145/3126594.3126664
[21] Zhang, Y.; Harrison, C. Pulp Nonfiction: Low-Cost Touch Tracking for Paper. Proceedings of CHI ’18, 2018. https://doi.org/10.1145/3173574.3173691
[22] Oh, C.; Song, J.; Choi, J.; Kim, S.; Lee, S.; Suh, B. I Lead, You Help but Only with Enough Details: Understanding User Experience of Co-Creation with Artificial Intelligence. Proceedings of CHI ’18, 2018. https://doi.org/10.1145/3173574.3174223
[23] Jansen, C.; Sklar, E. Exploring Co-Creative Drawing Workflows. Frontiers in Robotics and AI, 2021. https://doi.org/10.3389/frobt.2021.577770
[24] Maierhöfer, V.; Schmid, A.; Wimmer, R. TipTrack: Precise, Low-Latency, Robust Optical Pen Tracking on Arbitrary Surfaces Using an IR-Emitting Pen Tip. Proceedings of TEI ’24, 2024. https://doi.org/10.1145/3623509.3633366
[25] Kusano, T.; Komuro, T. 3D Tabletop User Interface with High Synchronization Accuracy Using a High-Speed Stereo Camera. Proceedings of ITS ’15, 2015. https://doi.org/10.1145/2817721.2817724
[26] Annett, M. (Digitally) Inking in the 21st Century. IEEE Computer Graphics and Applications, 2017. https://doi.org/10.1109/MCG.2017.1
[27] Annett, M.; Ng, A.; Dietz, P.; Bischof, W. F.; Gupta, A. How Low Should We Go? Understanding the Perception of Latency While Inking. Proceedings of Graphics Interface, 2014. https://graphicsinterface.org/proceedings/gi2014/gi2014-22/
[28] Nielsen, J. Usability Engineering. Academic Press, 1993, Chapter 5. https://www.sciencedirect.com/book/9780125184069/usability-engineering
[29] Maierhöfer, V.; Schmid, A.; Wimmer, R. Off-the-Shelf Stylus: Using XR Devices for Handwriting and Sketching on Physically Aligned Virtual Surfaces. Frontiers in Virtual Reality, 2021. https://doi.org/10.3389/frvir.2021.684498
[30] Schroering, M. A.; Grimm, C. M.; Pless, R. A New Input Device for 3D Sketching. Proceedings of Vision Interface, 2003. https://web.engr.oregonstate.edu/~grimmc/content/papers/vi2003nid/vi2003nid.pdf
