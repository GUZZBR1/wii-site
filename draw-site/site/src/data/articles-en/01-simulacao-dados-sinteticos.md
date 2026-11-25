# Simulation as a complement to the evaluation of captured drawings

## Abstract

Systematically recording varied conditions to evaluate a camera-assisted drawing system can require time, session organization, and access to specific materials and contexts. Synthetic scenes can create controlled and repeatable situations, but they are not automatically equivalent to real captures. This article proposes a framework for determining what a simulation can represent, what it cannot support on its own, and which claims require real evidence. The proposal distinguishes controllable geometry and layouts, appearance and behavior that depend on context, and capture effects whose validity must be checked against real observations. The protocol pairs simulated and real conditions by evaluation question, measures agreement in difficulty ordering, and describes the gap between domains. It also provides for reporting coverage, uncertainty, and cases without a comparable pair. Schematic figures show the condition pair, validation flow, and an illustrative form of agreement. Since no measured data are available, the article does not claim that synthetic scenes represent everyday use or replace real capture. Its contribution is an interpretation criterion for complementing, not replacing, real empirical evidence.

**Keywords:** simulation; synthetic data; validity; evaluation; drawing

## 1. Introduction

Systematically recording varied conditions to evaluate camera-captured drawing can be costly in time and coordination. A team needs to plan tasks, record materials, obtain consent when participants are involved, and repeat scenes in order to separate environmental variation from changes in the activity. Certain conditions, such as page changes or specific combinations of lighting, may occur rarely in natural use. Simulation offers a way to cover controlled situations, but its convenience does not guarantee that appearance or difficulty correspond to the real world.

The central problem is one of validity. A synthetic scene may preserve one relevant property while omitting others. A composition may represent the position and size of a sheet, but not faithfully reproduce paper texture, glare, shadow, hand behavior, or capture noise. Even when a visual dimension looks similar, the response observed in a system may diverge. The usefulness of a simulation must be established for a given question, condition, and outcome.

This article proposes to examine simulation as a complement to the real evaluation of a camera-assisted drawing system, treated as a black box. The question is: **under what conditions does a comparison between simulated scenes and real captures support conclusions about the relative difficulty of evaluation, and which aspects continue to require real evidence?** The formulation does not assume that the difficulty ordering holds. This agreement is something to be measured, and any conclusion is limited to the paired and observed conditions.

The article offers three contributions. First, it organizes a coverage framework that separates aspects that can be represented, aspects that the simulation should not assert, and claims that depend on real observation. Second, it specifies a protocol with real and simulated condition pairs and measures of agreement, difference, and coverage. Third, it delimits how to report discrepancies and avoid extrapolation across domains. The proposal does not present a generator, a synthetic collection, or transfer results.

Section 2 reviews synthetic data in computer vision, domain transfer, and the validity of simulations for evaluation. Section 3 defines coverage and separates geometry, appearance, behavior, and capture. Section 4 describes pairing, data, metrics, and analysis. Section 5 reserves fields for future results. Section 6 discusses possible patterns of agreement or divergence. Section 7 presents threats to validity, and Section 8 summarizes the evidence required.

The economic motivation should not be confused with methodological substitution. A simulation may reduce the cost of preparing cases or allow repetition under a defined condition. Even so, the resources saved do not demonstrate that the cases cover important phenomena. The study needs to consider the cost of validating the real pairs, of revising categories, and of updating conclusions when the simulation does not align with observed use. This effort is part of the validity of the proposal.

The study defines in advance which property must remain comparable across domains. The condition may refer to page position, the presence of shadow, deformation, or another characteristic relevant to the question. It is not enough to compare images by overall appearance. The annotation must indicate which condition is present, how it was observed, and which external outcome will be measured. If a simulation contains several differences with no real counterpart, it may be useful for exploration, but not for supporting a paired comparison.

Synthetic data and real captures can also play complementary roles. Synthetic scenes can expand a grid of conditions, explore rare combinations, or support an analysis of edge cases. Real captures can verify whether these situations occur and whether the observed response follows the simulated trend. The protocol requires distinguishing exploratory discovery from validation. A hypothesis identified in synthetic scenes becomes evidence about real use only after being tested on suitable real captures.

## 2. Related work

### 2.1 Synthetic data in computer vision

Synthetic data are used in computer vision to expand collections, control scene factors, and provide labels associated with constructed situations. Virtual environments and rendered images make it possible to repeat conditions that would be difficult to record precisely in the field. The literature shows applications in recognition, segmentation, motion estimation, and scene perception. This experience provides strategies for defining a condition and building comparable pairs, but it does not prove that the synthetic distribution corresponds to that of real photographs. Content type, appearance, and task affect transferability.

Synthetic benchmarks tend to prioritize category coverage and annotation consistency. They can expose rare cases and support controlled comparisons, but they also embed construction choices that delimit what is represented. A set may vary position, scale, or occlusion and leave out texture, complex lighting, or human behavior. The description of coverage must make these choices explicit. For drawing on paper, the visual similarity of a composition is not enough to represent the properties of the medium or of the interaction.

Simulation studies also use synthetic data for development and testing in domains where real observation is scarce or expensive. The most convincing evaluation compares results under independent real conditions and reports which aspects were preserved. Without this verification, the simulation demonstrates that a case was produced, not that it represents a condition of use. This principle guides the coverage framework of this article. Datasets built for urban perception, tracking, and indoor scenes show the diversity of tasks that adopt virtual scenarios [6–10, 13, 19, 24, 25]. They illustrate control and scale, but do not validate the representation of drawing on paper.

Some works use games or virtual worlds to obtain labels and cover rare situations; others compare synthetic data with field captures. The design of a benchmark determines which factors vary and which remain fixed. Diversity of categories is not equivalent to diversity of materials, cameras, or people. This distinction is important to prevent a large collection of correlated variations from being treated as broad representation of real use. The present article considers the relevant unit to be the condition and its observed pair, and not the number of images per se.

### 2.2 Domain transfer

Domain transfer examines whether a relationship observed in one distribution holds in another. Differences may involve color, texture, lighting, background, resolution, or composition. Domain adaptation and domain randomization research investigates ways of reducing dependence on specific appearances. Its results vary according to task, data, and evaluation. Therefore, a technique that transfers to an object benchmark does not guarantee equivalence for paper, ink, or drawings captured in an everyday environment.

The gap between simulation and reality, often called sim-to-real, may appear as a difference in appearance or in system behavior. The first can be judged by observers or visual measures; the second requires evaluating outputs on the relevant task. A synthetic image may look plausible and still yield a different difficulty ordering. The protocol of this article treats agreement of results as an empirical hypothesis, not as a consequence of apparent quality.

Domain randomization seeks to expose an evaluation to a variety of simulated appearances [1–5, 14–18]. It can help explore sensitivity, but it does not eliminate the need to select relevant variations or to verify correspondence with real data. A broad variation may include improbable conditions and leave out frequent phenomena. For this reason, the choice of dimensions and levels must be justified by the research question and observational evidence.

Simulated-to-real transfer benchmarks, virtual world evaluations, and adaptation studies assess different objectives. Some ask whether a model trained in one domain maintains performance in another; others ask whether a simulated condition reproduces the difficulty or behavior of a real task [11, 12, 20, 21, 26]. The second question is central to this article. A transfer result for robotic control or parts classification does not, by analogy, support data validity for drawing. The unit of evidence must coincide with the intended claim.

### 2.3 Validity of simulations for evaluation

The validity of a simulation depends on the use for which it is intended. A simulation may be valid for comparing options in a controlled geometry and invalid for estimating performance in natural use. The supported claim must follow the granularity of the comparison: same question, paired condition, corresponding metric, and declared domain. Metrics of agreement between conditions can indicate whether the relative order holds, while absolute differences reveal that the outputs are not interchangeable.

An evaluation design must avoid retrospective selection of the pairs that agree. The paired conditions, outcomes, inclusion criteria, and analysis are defined before observing the differences. Cases without a corresponding pair are reported as a coverage gap. Real observations must be independent of the process that built the simulation; otherwise an artificial similarity may reflect only the choice of evaluation.

The gap addressed is the lack of an interpretation framework for the evaluation of camera-captured drawing that states, factor by factor, what a synthetic scene allows one to test and what continues to depend on real capture. Reviews of generation methods and transfer studies reinforce that purpose and domain matter [22, 23]. Sim-to-real and synthetic data works offer precedents, but validity varies with the task. This article proposes making this boundary explicit and measuring agreement by condition, without presuming equivalence between domains.

A set of synthetic documents shows that the type of object itself may be closer to the problem, yet it still needs to be validated for the present question. Historical documents, printed texts, or annotated pages are not equivalent to drawings that change during a session. The type of mark, the reference, and the outcome differ. Document synthesis studies and analyses of games as a visual source offer methodological precedents, not direct evidence about identity, continuity, or preservation of drawings [24, 25].

## 3. Problem framing

The scope of the simulation is defined by the visual property or condition that the question requires observing. It can help represent relative positions, approximate page occupancy, the presence of objects, and some controlled variations in appearance. This capability does not imply that visual details correspond to real materials. The boundary is specific to each claim: representing a tilted sheet does not demonstrate fidelity of texture, lighting, or response on a task.

The coverage framework distinguishes three categories. **Can represent** indicates an attribute that can be included as an abstract condition and compared with a corresponding question. **Should not represent without validation** indicates phenomena whose appearance or behavior cannot be assumed to be equivalent merely because a visual scheme was built. **Requires real evidence** identifies a claim that must be examined in usage capture or an independent reference. The table is a planning tool, not an audit of any existing dataset.

**Table 1.** Coverage framework that separates representable attributes, phenomena that cannot be presumed equivalent, and claims that require comparison with independent real captures to determine their validity.

| Aspect | Can represent | Cannot support on its own | Requires real evidence |
|---|---|---|---|
| Page geometry | Relative position, orientation, and size | Fidelity of all physical deformation | Correspondence with captured sheets |
| Drawing layout | Schematic distribution of strokes and regions | Variety of styles and spontaneous marks | Preservation of real drawings |
| Occlusion | Abstract area or region covered | Natural movement of hands and instruments | Usage sequences with participants |
| Lighting | Planned qualitative conditions | Glare and shadows from diverse materials | Response in real lighting scenes |
| Paper | General visual categories of surface | Full texture and optical properties | Diversity of observed papers and inks |
| Background | Presence and general contrast of the surroundings | Frequency of objects in everyday environments | Natural sample of spaces and surfaces |
| Capture | Questions about response under a defined condition | Distribution of artifacts from different devices | External comparison on real recordings |
| Interaction | Conceptual input and output cases | Human variation, intent, and drawing strategy | Real sessions and task observation |

The framework distinguishes visual fidelity from functional validity. Two scenes may look alike to an observer and still produce different responses. They may also look different and yield the same difficulty for a task. The evaluation does not compare only overall appearance: it defines the event, the outcome, and the decision to be tested. If the question is page continuity, the pair must represent the same class of event and a common reference. If the question is stroke preservation, the reference must make the comparison of the drawing possible.

The notion of "cannot represent" is provisional and contextual. A simulation may include texture or lighting variation, but its existence does not prove that the distribution reproduces real materials. The table uses "cannot support on its own" to emphasize that such factors may be included as a hypothesis, provided they are evaluated against captures. The category does not prohibit their use; it delimits the strength of the claim without validation.

The framework does not classify an entire scene as valid or invalid. Each row indicates a property and the type of conclusion it can support. An evaluation may use simulation to compare page positions and still require real capture to analyze the effect of glossy paper. This delimitation avoids the false dilemma of accepting or rejecting the simulation as a whole. It allows a controlled part to be useful and other parts to remain open.

A synthetic condition may be useful even if it does not reproduce a complete scene. It can isolate an event, help explore an edge case, or show how a measure behaves under a controlled change. Exploratory value is distinct from external validity. The report identifies which part of the study is exploratory and which aims to say something about real use. A constructed case without a real pair may suggest questions, but it does not enter the paired comparison.

Figure 1 illustrates a real condition and a simulated one associated with the same question. The drawings in the scheme are neutral symbols; they do not represent capture or equivalence. The correspondence is defined by attribute and task, not by the appearance of the figure. The caption makes explicit that none of the panels constitutes experimental evidence.

![](figures/01-par-real-simulado.svg)

**Figure 1.** Scheme of a real and simulated condition pair for the same evaluation question. The examples are diagrams, not captures or evidence of equivalence; author's own work.

## 4. Proposed evaluation protocol

The protocol begins with an evaluation question and an external outcome defined before the comparison. For each selected synthetic condition, a real condition representing the same relevant property is identified. The pairs are determined by annotation of the condition and not by the similarity of results. When there is no suitable real condition, the case is kept out of the agreement estimate and listed as a lack of coverage.

The real collection is independent and documents the task, medium, environment, human participation, and references used to evaluate the response. The simulated scene is described only by the attribute it intends to represent and by the pairing rule adopted in the study; this article does not specify how to build it. The same task and the same output criterion are applied in both domains whenever possible. If a measure is not comparable, the difference is declared instead of forcing a pairing.

The design contains a per-condition comparison phase and a coverage analysis phase. The first verifies whether the relative difficulty ordering observed in synthetic conditions follows the ordering obtained in real pairs. The second describes which conditions had a pair, which did not, and which differed in relevant properties. An evaluation may combine synthetic and real conditions in separate sessions; the order is alternated when this reduces sequence effects. Sampling units and repetitions are defined by the question and justified before collection.

**Table 2.** Metrics for ordering agreement, per-condition difference, and coverage of the set, with interpretation and limits defined before collection and without presuming equivalence between domains.

| Metric | Definition | Use | Limitation |
|---|---|---|---|
| Order agreement | Association between orderings by synthetic and real condition | Assesses maintenance of relative difficulty | Does not report equality of performance |
| Paired difference | Distance between responses for each corresponding condition | Describes divergence between domains | Depends on the scale and the external metric |
| Per-condition agreement | Proportion of pairs with compatible ordering | Locates discordant conditions | Depends on the tie rule |
| Paired coverage | Planned conditions with a valid real pair | Delimits the reach of the comparison | Does not measure the quality of an individual pair |
| Uncertainty | Sampling variation of the metrics per condition | Qualifies the stability of the estimates | Requires appropriate sample and grouping |

For the relative order, rank correlation can be used between the aggregated difficulties of each condition. The correlation is computed over previously defined pairs and accompanied by an uncertainty interval. It answers whether the conditions tend to maintain their order, not whether the values or outputs are equal. High agreement may coexist with a systematic difference between domains. For this reason, the paired difference is reported alongside the correlation.

The paired difference is computed for each corresponding condition, with the sign and scale of the measure made explicit. If the metric is categorical, an agreement table may be more suitable than a continuous distance. The analysis does not convert incomparable metrics into a composite score without justification. Coverage reports how many of the planned conditions found a real correspondence, and a table of missing cases clarifies which dimension could not be validated.

The analysis estimates agreement by condition, task, and material group when the sample allows. Results are grouped by session or participant in the real captures; repeated synthetic scenes do not artificially increase the number of human units. The team avoids treating many variations of the same scene as independent evidence. Uncertainty is presented for each estimate, and the interpretation describes sample imbalances.

A pilot stage verifies whether each pair actually corresponds to the same question and whether the annotation instructions allow classifying the condition without knowing the output. The pilot serves to correct the description of the condition, the reference, and the recording form; it does not automatically enter the confirmatory analysis. Changes made after the pilot are reported. If the definition of a pair changes after observing its agreement, the corresponding analysis is marked as exploratory to avoid selective choice.

Real and synthetic captures must be processed according to a common comparison rule, defined only in terms of observable events and outputs. The team verifies whether framing, task, or reference quality make one domain easier to evaluate than the other. Differences in annotation visibility are also recorded. When the output cannot be compared by the same metric, the pair remains informative descriptively, but does not contribute to a numerical correlation.

The protocol avoids retrospective selection. Pairs, outcomes, exclusions, and primary analyses are defined before comparing the outputs. A real condition without a pair, a simulation that represents more than one factor, or a low-confidence reference is explicitly identified. Exploratory analyses may suggest new pairs, but are kept separate from the pre-specified comparisons. The team records the reason for each exclusion and does not remove divergences because they seem improbable.

The stability of the conclusion is assessed by sensitivity analysis when there are justified alternatives for the annotation or the pairing. For example, an ambiguous category may be reported under more than one previously defined classification. This examination does not choose the version that maximizes agreement; it shows how reference uncertainty affects the estimate. The team also reports whether the results change when a session or scene is omitted, respecting the sampling unit.

Figure 2 organizes the conceptual blocks: defining the condition, establishing pairs, assessing agreement, and delimiting the reach of the evidence. Figure 3 shows an illustrative form for the relationship between synthetic and real difficulty. They do not describe a generation process nor present estimates. Validation concerns the correspondence of questions and observable results between domains.

![](figures/01-fluxo-validacao.svg)

**Figure 2.** Conceptual flow of condition specification, comparison between pairs, and delimitation of evidence. The scheme does not describe how simulated scenes are generated in the evaluation; author's own work.

![](figures/01-concordancia-sim-real.svg)

**Figure 3.** Illustrative curve of association between simulated and real difficulty, without numbers on the axes. The expected shape is not a result; scheme without observations or measured points; author's own work.

## 5. Structure of the results

This section reserves the reporting format for a future comparison. No experimental data are presented in this article; therefore, no value of agreement, difference, or coverage is reported. The `[PENDING-DATA]` fields indicate results that can only be filled in after the real and synthetic collection, the review of the pairs, and the defined analysis. The table describes the structure of presentation, without indicating an expected trend.

The first summary documents which conditions were planned, which received a valid real pair, and which were left without correspondence. For each pair, the report identifies the compared property, the task, the reference, the outcome, and the reason for considering the scenes comparable. Excluded conditions remain visible. The coverage framework distinguishes absence of data from absence of effect and records annotation limitations.

**Table 3.** Structure for reporting condition pairs and future agreement measures, keeping fields empty until real and simulated data have been collected and reviewed.

| Condition | Valid real pair | Agreement | Difference and uncertainty |
|---|---|---|---|
| Geometry and layout | [PENDING-DATA] | [PENDING-DATA] | [PENDING-DATA] |
| Appearance and lighting | [PENDING-DATA] | [PENDING-DATA] | [PENDING-DATA] |
| Occlusion and interaction | [PENDING-DATA] | [PENDING-DATA] | [PENDING-DATA] |
| Condition without a comparable pair | Not applicable | Not applicable | [PENDING-DATA] |

The results must present difficulty ordering by condition in both domains, together with agreement and paired difference. Coverage indicates what part of the planned conditions was validated. Conditions without a pair do not enter the agreement calculation, but appear in the description. If the distributions are very different, the report does not summarize them in a single estimate without showing the heterogeneity.

The schematic figures in this article are not result graphs. A future empirical figure should show observations and uncertainty by condition, and identify which pairs were used. If the order among conditions varies across tasks or materials, the groups will be displayed separately. Fields without data remain as `[PENDING-DATA]` until there is reviewed evidence.

## 6. Discussion

If the difficulty ordering is similar between simulated and real conditions, the result will support a limited claim: for the pairs, task, sample, and measure evaluated, the simulation preserved part of the relative ordering. This will not demonstrate equality of performance, universal fidelity, or coverage of everyday use. Order agreement may coexist with a systematic difference between domains. The interpretation must show both aspects and delimit the real sample that was used.

If there is agreement only in certain conditions, the conclusion will be specific to those factors. The simulation may be adequate for exploring geometry and not for representing texture or interaction, for example, but this inference requires corresponding data and cannot be deduced from the conceptual table. Analysis by groups helps locate the boundary between useful conditions and conditions still without validation. The report avoids extrapolating an aggregate result to dimensions that did not take part in the comparison.

A systematic disagreement indicates that the simulation did not preserve the relationship observed for the tested question. The difference may stem from absent visual attributes, from imperfect pairing, or from variability in the real captures. The protocol does not assign an automatic cause; annotations and sensitivity analysis can guide a future hypothesis. The discrepancy is relevant information, not a result to discard for being inconvenient.

A weak or imprecise correlation may also reflect insufficient coverage or few representative pairs. If the uncertainty is wide, neither equivalence nor incompatibility is concluded. The interpretation distinguishes lack of evidence from evidence of divergence. Conditions without real data remain out of scope, even if the synthetic scene looks plausible.

Works on domain transfer and randomization provide concepts for discussing robustness to appearance change. Research with virtual environments shows how to control conditions and repeat cases. However, these contributions do not establish automatic validity for captured drawings. This study concentrates the question on agreement of difficulty by condition and keeps the domains separate in the analysis. Evidence from one task does not necessarily transfer to another, especially when reference, material, and participant behavior change.

The cost of capturing real data may justify the use of simulation for screening and exploration. The savings, however, must be described together with the cost of validation and the coverage of real conditions. If the pairs only cover situations that are easy to reproduce, the simulation may bias the research toward what is simple to represent. Explicit coverage shows this trade-off and helps plan additional real collection.

It is also possible that a synthetic condition reveals a difficulty that does not appear in the available real pairs. This finding may be useful as a hypothesis or stress test, but it does not prove risk in everyday use. The appropriate response is to seek relevant real capture, adjust the question, or label the condition as exploratory. The article does not recommend excluding divergent synthetic cases, since they may guide later studies.

A simulation does not need to represent all of reality to be useful. An abstraction may answer a narrow question with control and repeatability. The methodological decision depends on what is intended to be inferred: internal comparison between abstract conditions, transfer to real capture, or support for a performance claim. The results and conclusions must use language proportional to that purpose.

Validity also depends on an independent real reference. If the real condition is chosen after observing the synthetic result, agreement may be inflated. If the real annotation is ambiguous, the pairing may reflect the researchers' decision. The plan must fix the selection of conditions and report disagreements between annotators. This care makes the comparison more informative, but does not eliminate domain uncertainty.

In sum, the protocol treats agreement, difference, and coverage as separate questions. Agreement shows maintenance of the relative order; difference characterizes magnitude and direction; coverage defines how far the comparison reaches. No single measure authorizes replacing real captures. The methodological value lies in making the evidence boundary visible and guiding where new data are needed.

## 7. Limitations and threats to validity

Construct validity depends on how a real and a synthetic condition are considered a pair. If important attributes differ, the comparison may attribute disagreement to a factor that was not isolated. If the definitions are vague, raters may form different pairs. The condition manual, independent review, and pairing justification must be documented. The coverage table helps make the decision explicit, but does not guarantee that the chosen attributes represent the question.

Internal validity may be affected by simultaneous changes across conditions. A synthetic scene and its real capture may differ in several aspects beyond the factor of interest. Paired analysis reduces some differences, but does not eliminate them. Retrospective choice of agreeing pairs, exclusion of divergences, or adjustment of the task after observing results may introduce bias. Pre-specification, recording of exclusions, and separation between confirmatory and exploratory analyses reduce this risk.

External validity is limited by the variety of real conditions. A collection captured in one environment or with one type of paper does not represent all use. The simulation may expand abstract coverage, but does not increase the real diversity observed. Participants, materials, task, camera, and context must be described in a manner compatible with privacy. Conclusions remain restricted to these data until independent evaluations extend them.

Data validity depends on the references and the annotation. The truth of a real condition may be uncertain; the performance measure may vary between raters; and visual correspondence may be subjective. The reference and the response should have independent sources when possible. Cases without sufficient confidence are presented separately and do not count as defined agreement or disagreement.

There is a threat of dependence among synthetic variations derived from the same scene. Counting them as independent observations may create false precision. Likewise, multiple captures from one real session may share context. The analysis must reflect grouping by scene, session, and participant and show how many independent units support each estimate. Visual repetition is not equivalent to sampling diversity.

Another limitation is the provisional nature of the framework. New techniques may better represent certain phenomena, and new uses may make other factors a priority. The classification "cannot support on its own" is not a physical impossibility; it only means that the article does not attribute validity without demonstration. Future research may revise the framework when it presents sufficient validation.

Finally, the study evaluates external outputs of the system and does not identify internal mechanisms. A divergence does not say whether its cause lies in the scene, the pairing, or the response. This boundary is necessary to preserve the scope of evaluation and avoids inferences about implementation. The article does not provide a procedure for building synthetic scenes nor a recipe that reproduces any specific system.

## 8. Conclusion

This article proposes a framework for interpreting synthetic data in the evaluation of camera-captured drawing. The central section separates properties that can be represented, phenomena whose equivalence cannot be presumed, and claims that depend on real captures. The protocol compares pairs by condition, difficulty ordering, difference, and coverage, keeping the system as a black box.

Simulation can support control and repetition, but its usefulness for a conclusion about real use must be demonstrated. A plausible appearance is not enough to establish correspondence of response. Agreement, disagreement, and absence of pairs inform distinct methodological decisions and must be reported with uncertainty.

An evaluation that collects real and synthetic pairs for explicitly defined tasks and conditions is still needed. Until these data are analyzed, the agreement and reach of the simulation remain `[PENDING-DATA]`. Future results must limit their conclusions to the real coverage observed and keep exploratory situations clearly identified.

## Statements

- AI use: text drafted with the support of generative AI, with review and responsibility of the authors; references checked by DOI.
- Data: there are no experimental data in this proposal; future data will be described with their origin and access criteria.
- Code: there is no results-analysis code in this version; future materials will be identified by version.
- Conflict of interest: the authors must declare any pertinent conflict before submission.
- Ethics: any collection with participants will be submitted to the applicable ethical review before recruitment.
- Author contributions: the final version must make the individual contributions of the authors explicit.

## References

[1] Tobin, J. et al. Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World. IEEE/RSJ International Conference on Intelligent Robots and Systems, 2017. https://doi.org/10.1109/IROS.2017.8202133
[2] Tremblay, J. et al. Training Deep Networks with Synthetic Data: Bridging the Reality Gap by Domain Randomization. IEEE/CVF Conference on Computer Vision and Pattern Recognition Workshops, 2018. https://doi.org/10.1109/CVPRW.2018.00143
[3] Peng, X. B. et al. Sim-to-Real Transfer of Robotic Control with Dynamics Randomization. IEEE International Conference on Robotics and Automation, 2018. https://doi.org/10.1109/ICRA.2018.8460528
[4] Prakash, A. et al. Structured Domain Randomization: Bridging the Reality Gap by Context-Aware Synthetic Data. IEEE International Conference on Robotics and Automation, 2019. https://doi.org/10.1109/ICRA.2019.8794443
[5] Sadeghi, F.; Levine, S. CAD2RL: Real Single-Image Flight Without a Single Real Image. Robotics: Science and Systems XIII, 2017. https://doi.org/10.15607/RSS.2017.XIII.034
[6] Ros, G. et al. The SYNTHIA Dataset: A Large Collection of Synthetic Images for Semantic Segmentation of Urban Scenes. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2016. https://doi.org/10.1109/CVPR.2016.352
[7] Richter, S. R. et al. Playing for Data: Ground Truth from Computer Games. European Conference on Computer Vision, 2016. https://doi.org/10.1007/978-3-319-46475-6_7
[8] Gaidon, A. et al. Virtual Worlds as Proxy for Multi-Object Tracking Analysis. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2016. https://doi.org/10.1109/CVPR.2016.470
[9] Cordts, M. et al. The Cityscapes Dataset for Semantic Urban Scene Understanding. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2016. https://doi.org/10.1109/CVPR.2016.350
[10] Dosovitskiy, A. et al. CARLA: An Open Urban Driving Simulator. Conference on Robot Learning, 2017. https://proceedings.mlr.press/v78/dosovitskiy17a.html
[11] Johnson-Roberson, M. et al. Driving in the Matrix: Can Virtual Worlds Replace Human-Generated Annotations for Real World Tasks? IEEE International Conference on Robotics and Automation, 2017. https://doi.org/10.1109/ICRA.2017.7989092
[12] Peng, X. et al. VisDA: A Synthetic-to-Real Benchmark for Visual Domain Adaptation. IEEE/CVF Conference on Computer Vision and Pattern Recognition Workshops, 2018. https://openaccess.thecvf.com/content_cvpr_2018_workshops/w40/html/Peng_VisDA_A_Synthetic-to-Real_CVPR_2018_paper.html
[13] Handa, A. et al. Understanding Real World Indoor Scenes With Synthetic Data. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2016. https://doi.org/10.1109/CVPR.2016.442
[14] Sankaranarayanan, S. et al. Learning From Synthetic Data: Addressing Domain Shift for Semantic Segmentation. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2018. https://openaccess.thecvf.com/content_cvpr_2018/papers/Sankaranarayanan_Learning_From_Synthetic_CVPR_2018_paper.pdf
[15] Sankaranarayanan, S. et al. Generate to Adapt: Aligning Domains Using Generative Adversarial Networks. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2018. https://openaccess.thecvf.com/content_cvpr_2018/html/Sankaranarayanan_Generate_to_Adapt_CVPR_2018_paper.html
[16] James, S. et al. Sim-To-Real via Sim-To-Sim: Data-Efficient Robotic Grasping via Randomized-To-Canonical Adaptation Networks. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2019. https://openaccess.thecvf.com/content_CVPR_2019/html/James_Sim-To-Real_via_Sim-To-Sim_Data-Efficient_Robotic_Grasping_via_Randomized-To-Canonical_Adaptation_Networks_CVPR_2019_paper.html
[17] Zhao, Y. et al. Domain Decluttering: Simplifying Images to Mitigate Synthetic-Real Domain Shift and Improve Depth Estimation. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2020. https://openaccess.thecvf.com/content_CVPR_2020/html/Zhao_Domain_Decluttering_Simplifying_Images_to_Mitigate_Synthetic-Real_Domain_Shift_and_CVPR_2020_paper.html
[18] Alghonaim, R.; Johns, E. Benchmarking Domain Randomisation for Visual Sim-to-Real Transfer. IEEE International Conference on Robotics and Automation, 2021. https://doi.org/10.1109/ICRA48506.2021.9561134
[19] Roberts, M. et al. Hypersim: A Photorealistic Synthetic Dataset for Holistic Indoor Scene Understanding. IEEE/CVF International Conference on Computer Vision, 2021. https://doi.org/10.1109/ICCV48922.2021.01073
[20] Mishra, S. et al. Task2Sim: Towards Effective Pre-Training and Transfer From Synthetic Data. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2022. https://openaccess.thecvf.com/content/CVPR2022/html/Mishra_Task2Sim_Towards_Effective_Pre-Training_and_Transfer_From_Synthetic_Data_CVPR_2022_paper.html
[21] Tang, H.; Jia, K. A New Benchmark: On the Utility of Synthetic Data With Blender for Bare Supervised Learning and Downstream Domain Adaptation. IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2023. https://openaccess.thecvf.com/content/CVPR2023/html/Tang_A_New_Benchmark_On_the_Utility_of_Synthetic_Data_With_CVPR_2023_paper.html
[22] Schieber, H. et al. Indoor Synthetic Data Generation: A Systematic Review. Computer Vision and Image Understanding, 2024. https://doi.org/10.1016/j.cviu.2023.103907
[23] Paulin, G.; Ivasić-Kos, M. Review and Analysis of Synthetic Dataset Generation Methods and Techniques for Application in Computer Vision. Artificial Intelligence Review, 2023. https://doi.org/10.1007/s10462-022-10358-3
[24] Walker, D.; Lund, W.; Ringger, E. A Synthetic Document Image Dataset for Developing and Evaluating Historical Document Processing Methods. SPIE Proceedings, 2012. https://doi.org/10.1117/12.912203
[25] Shafaei, A.; Little, J.; Schmidt, M. Play and Learn: Using Video Games to Train Computer Vision Models. British Machine Vision Conference, 2016. https://doi.org/10.5244/C.30.26
[26] Zhu, X. et al. Towards Sim-to-Real Industrial Parts Classification With Synthetic Dataset. IEEE/CVF Conference on Computer Vision and Pattern Recognition Workshops, 2023. https://openaccess.thecvf.com/content/CVPR2023W/VISION/html/Zhu_Towards_Sim-to-Real_Industrial_Parts_Classification_With_Synthetic_Dataset_CVPRW_2023_paper.html
