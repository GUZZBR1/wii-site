# Accessibility barriers in camera-assisted drawing activities

## Abstract

An evaluation of a camera-assisted drawing system may measure technical outputs without showing whether people with diverse needs and contexts can complete the activity. Barriers may arise from dexterity, perception, comprehension, equipment, physical space, or connectivity; the same condition does not affect everyone in the same way. This article proposes an accessibility audit of the digital interface, complemented by an interaction study with inclusively recruited participants. The framework organizes six barrier categories and relates each to criteria and evaluation methods. The protocol combines a review based on WCAG 2.x, drawing sessions, a usability scale, workload assessment, and a semi-structured interview. Recruitment, consent, accommodations, and ethics review are specified before data collection. Tables and figures organize the plan without describing internal mechanisms. Since no participants or usage data are available, the article makes no claim about accessibility, performance, or experience for any group. The proposal makes criteria and barriers observable while limiting conclusions to the people, tasks, materials, and contexts actually studied.

**Keywords:** accessibility; drawing; interaction; diversity; evaluation

## 1. Introduction

A camera-assisted drawing system can be used in different spaces and by people with distinct abilities, equipment, and strategies. An evaluation based only on a technical task does not show whether instructions are understandable, whether the interaction is reachable, or whether the environment limits use. Accessibility is not a property that can be inferred from a single success rate; it involves people, tasks, interfaces, and contexts.

Barriers may be motor, visual, cognitive, related to equipment, to physical space, or to connectivity. They may coexist and change with the task. A posture that is comfortable for one person may be difficult for another; an interface that is legible on a screen may depend on enlarging text or using assistive technologies. The evaluation should ask which people can carry out which actions, under which conditions, and with which adaptations. It is not assumed that each participant represents an entire group, nor that a diagnosis predicts individual experience.

Accessibility guidelines for digital content offer auditable criteria of perceivability, operability, understandability, and compatibility. These criteria matter for interfaces, instructions, and digital materials, but on their own they do not cover physical reach, paper position, available device, or connectivity. An interaction study may reveal barriers that an interface audit does not identify. Conversely, participant reports do not replace systematic inspection of published criteria. The proposal combines the approaches without treating them as equivalent.

The question is: **which motor, visual, cognitive, equipment, space, and connectivity barriers influence the interaction with a camera-assisted drawing system in the tasks and contexts evaluated?** The study does not start from the hypothesis that all barriers will occur, nor that participants will have the same experience. The aim is to identify conditions, adaptations, and reported differences, while preserving the limits of the sample.

The article offers three contributions. First, it presents a taxonomy of barriers and relates each category to criteria and forms of evaluation. Second, it proposes combining an interface audit based on WCAG 2.x with usage sessions and instruments for usability, workload, and interview. Third, it describes recruitment, consent, adaptations, and ethics approval as part of the method. The contribution is a study protocol, not evidence of accessibility already achieved.

Section 2 reviews digital guidelines, assistive technology, accessible creation, and inclusive interaction methods. Section 3 defines the six categories and organizes the criteria. Section 4 describes the audit, the study, recruitment, and the instruments. Section 5 reserves fields for future results. Section 6 discusses possible interpretations. Section 7 delimits validity and privacy. Section 8 synthesizes the proposal and the evidence still needed.

The study treats participation as research collaboration, not as an individual ability test. The instructions allow accommodations relevant to the activity, such as preparation time, breaks, a chosen work position, and alternative forms of response. These adaptations are recorded to contextualize the result, not removed as "noise." The team reports which conditions were offered and which participants used them, without exposing identifiable data.

The protocol separates normative audit, observed performance, and reported experience. A failure in a content criterion may exist without preventing the immediate task; a person may complete the session and still experience effort or insecurity. A positive answer to a questionnaire does not prove conformance with a guideline. Each source of evidence answers a specific question, and interpretation uses the appropriate source.

The study must be carried out before any claim about accessibility for specific audiences. The proposal cannot know the diversity of users, devices, and spaces that will actually take part. The size and composition of the sample must be justified by the objective and by feasibility, not filled in with imagined counts. The team reports recruitment limitations and seeks to include relevant experiences without promising universal representation.

## 2. Related work

### 2.1 Digital accessibility and guidelines

The Web Content Accessibility Guidelines (WCAG) organize criteria to make digital content perceivable, operable, understandable, and compatible with assistive technologies [1, 2]. Audits may examine contrast, text alternatives, navigation, focus, structure, language, and status messages. Conformance is assessed by criterion and level, with observable evidence. A checklist without a record of failures, context, and version is not sufficient for comparison.

WCAG is a reference for digital content and interfaces; it is not a complete assessment of physical interaction with paper, camera, or drawing surface. An audit may identify barriers in instructions, controls, or messages and still not reveal whether a person can position the paper or operate the equipment. For this reason, this article applies the guidelines to the digital content that can be evaluated and complements the analysis with tasks and reports. Published versions of the standard are identifiable and keep their own criteria; the study should declare which edition was used, without treating informative recommendations as normative requirements [1, 2, 6].

Guidelines for authoring tools broaden the focus: beyond the content produced, they consider the accessibility of the creation process and the ability of authors with disabilities to take part in production [3]. The WAI-ARIA specification defines component semantics for assistive technologies, while authoring practices guide interaction patterns for rich components [4, 5]. Applying them requires observing the real interface; mentioning compatibility in the design does not constitute evidence of adequate operation. Guidance for cognitive content helps formulate clear language, predictable navigation, and support for comprehension, but does not replace consultation with participants [6].

The WCAG2ICT document adapts the discussion of criteria to information and communication technologies that are not web pages [7]. This reference avoids assuming that every element of a physical activity is covered by a digital content standard. The Convention on the Rights of Persons with Disabilities establishes participation, accessibility, and equality as human rights principles [8]. In this study, these principles inform respect for participation choices, but they are not converted into a technical score for a product.

Automated audits can help find simple problems, but their coverage depends on the content, the tool, and the criterion. The team must manually review navigation, texts, states, and assistive compatibility that can be assessed. The report records each applicable criterion, the inspection method, and observable examples. Non-applicable criteria are distinguished from criteria that could not be assessed. This distinction prevents the absence of evidence from being presented as conformance.

### 2.2 Assistive technology and creation

Assistive technology includes resources that extend or replace forms of interaction, perception, and communication. Ability-based design proposes adapting interaction to the capabilities and preferences demonstrated by the person, rather than reducing the design to clinical categories [22]. Critical studies of assistive technology warn that solutions and evaluations may reproduce assumptions about disability when they do not consider social barriers, choice, and context [23]. The session description should therefore record the resources chosen by participants without treating them as a failure or an exception.

Studies of screen reader users document obstacles in web tasks and show why user reports complement technical checks [25]. Work on the social use of assistive technology also indicates that an adaptation may affect not only one action but also the interaction with other people and with the environment [24]. These findings guide research questions but do not allow assuming that the same difficulty appears in paper drawing accompanied by a camera. The unit of analysis remains the observed task and context.

Research on drawing practice by blind people describes strategies for creating graphic information without relying exclusively on the visual channel [26]. A grid-based drawing tool was studied as support for this kind of activity [27]. Later evaluations investigated graphic creation techniques with blind or low-vision people [28]. These studies show that accessible creation is a field with diverse goals and strategies, not a uniform requirement to "replace vision."

Recent work on accessible digital art examines language barriers and ways of making digital artboards usable by blind or low-vision people [29, 30]. The literature on drawing tools for people with visual impairment describes adaptations and design decisions in specific tasks [31]. Digital scenarios differ from an activity that combines paper and camera; these contributions are used to delimit access questions, not to claim equivalence between tools.

Drawing can be communication, expression, planning, or leisure. The purpose changes what counts as success and which barriers matter. For one person, line precision may be central; for another, recording and sharing an idea may be enough. Research on accessible creation recommends consulting participants and observing their own strategies, rather than imposing a single product standard. The proposed study asks what result each person seeks before interpreting a task as completed or interrupted.

### 2.3 Inclusive interaction studies

Inclusive studies discuss recruitment, accessible consent, compensation, adaptations, the risk of coercion, and participation in research decisions. The Belmont Report articulates respect for persons, beneficence, and justice for research with participants [9]. HCI studies on situated ethics show that consent may require dialogue and attention to the relationship between participants and the team, especially when communication, memory, or autonomy vary [10]. The proposal requires ethics approval before recruitment and adapts the way consent is obtained without reducing the information provided.

Standardized scales, such as the System Usability Scale (SUS), offer a brief measure of perceived usability [11]. Studies and reviews discuss the properties, interpretation, and uses of the scale [12, 13]. The NASA Task Load Index (NASA-TLX) was created as a subjective workload instrument and can be applied after a delimited activity [14, 15]. Comparisons with other instruments emphasize that workload measures answer different questions and should not be interpreted as a diagnosis of capacity [16]. A handbook of user experience methods helps plan the presentation, analysis, and uncertainty of the measures [17].

SUS and NASA-TLX do not describe all barriers. The form of administration may itself be inaccessible: small text, reading aloud when not chosen, a motor response that is hard to give, or unclear language. The protocol offers equivalent response modalities and records adaptations that may alter comparability. It does not modify standardized items without identifying the adaptation, because changes may invalidate comparisons with earlier applications. When a validated accessible version is not available for the situation, the result is reported as exploratory.

Semi-structured interviews allow exploring strategies, adaptations, and difficulties not anticipated in advance. Thematic analysis requires making explicit how the data were coded, how interpretations were discussed, and how the team's position may influence the reading [18]. Qualitative reporting criteria and transparency checklists offer questions for documenting recruitment, context, collection, and analysis [19, 20]. They guide the transparency of the report but do not function as automatic guarantees of quality.

Research relating accessibility and usability shows that the two areas overlap without being identical [21]. An interaction may seem easy to one person and remain inaccessible to another; a normative barrier may be detected even without a spontaneous report of difficulty. The gap is combining an audit against digital guidelines with an inclusive interaction protocol for camera-assisted paper drawing. Guidelines help find observable failures in the interface; tasks and reports help understand situated use. No single source allows generalization to all users. This article articulates these sources and defines limits for recruitment, interpretation, and reporting.

## 3. Problem framing

A useful evaluation turns "accessibility" into questions about observable actions, conditions, and consequences. A barrier is a mismatch between a task or environment and the needs, strategies, or resources available to a person. It does not reside exclusively in the body, in the interface, or in the space. The same person may carry out the activity in one environment and meet an obstacle in another, or may switch strategies during a session. The framework organizes observations into six categories so that the team records what happened without inferring a medical cause.

The table relates each barrier to an operational criterion and a form of assessment. The criterion describes a condition to observe, not a universal standard. Measures may be qualitative or quantitative depending on the question, and units must be defined before collection. The report separates direct evidence, interpretation, and the explanation suggested by the participant. The absence of an occurrence in the sample does not prove that the barrier does not exist in another context.

**Table 1.** Matrix of barriers, accessibility criteria, and forms of assessment, considering diverse needs without generalizing beyond the people and contexts studied; author's own work to guide contextual observation.

| Barrier | Observable criterion | How to assess |
|---|---|---|
| Motor | The person can position, start, continue, and complete the task with their chosen strategy. | Observe interrupted actions, requested assistance, posture adaptation, and reports of effort. |
| Visual | Instructions, the state of the activity, and the result can be perceived through channels compatible with individual preference. | Inspect contrast and digital alternatives; ask which signals were perceived and through which channel. |
| Cognitive | The task, the sequence of instructions, and the relevant states are understandable without depending on unnecessary memory. | Ask the person to explain what they expect, record hesitations, and ask how they interpreted each message. |
| Equipment | The available resources can be positioned and used safely in the chosen context. | Record the type of resource in broad categories, declared compatibility, adjustments, and obstacles encountered. |
| Space | The surface, seat, lighting, and reach allow the activity to be set up comfortably. | Map relevant physical conditions, position choices, requests for change, and breaks. |
| Connectivity | The session and the necessary materials can be accessed without imposing a dependency incompatible with the context. | Check access before the session, record interruptions, and offer an alternative form of participation when possible. |

Figure 1 summarizes the six categories to support reading of the taxonomy, without suggesting that each person belongs to a single category or that the barriers are independent.

**Figure 1.** Conceptual map of motor, visual, cognitive, equipment, space, and connectivity barriers in drawing activities; author's own work to organize categories without classifying participants.

![](figures/04-mapa-barreiras.svg)

**3.1 Motor barriers.** Fine control, reach, posture, fatigue, pain, and coordination may affect different actions in different ways. The team does not ask the person to demonstrate an isolated skill, nor does it define a standard posture. It records whether positioning the paper, holding the instrument, or responding to an instruction required a change, a pause, or help. The person's account clarifies whether a difficulty is relevant to their activity or is part of a comfortable strategy. The assistance offered is described so that independent performance, requested assistance, and accepted adaptation can be told apart. This description must not turn independence into a higher goal when the purpose is to enable participation.

The same observable action may have different explanations. A pause may indicate chosen rest, planning of the drawing, an external interruption, or a motor difficulty. The contextual annotation includes what the person reported and avoids assigning a cause based on video alone. If audiovisual observation is used, it must be specifically consented to and limited to what is necessary. The protocol allows the person to stop the recording without losing the right to continue the session.

**3.2 Visual barriers.** Contrast, size, location, visual consistency, and exclusive reliance on color may affect the perception of digital instructions and states. The visual evaluation of the interface uses the applicable WCAG criteria, and also checks text alternatives and reading order when there is non-text content [1]. Physical interaction may depend on lighting, paper orientation, and visual signals; these conditions are described without assuming that all participants perceive or interpret them in the same way. People with low vision may prefer magnification, proximity, contrast, or a combination of channels. Blind people may use other strategies, and the team asks which are relevant rather than imposing a solution.

The audit and the session answer different questions. A contrast check may show that a criterion was met or failed for a digital component. It does not prove that the whole task is accessible. A person may identify a message and still not understand what to do; another may complete the task through prior experience even when faced with inaccessible information. The report records both facts without erasing one source in favor of the other.

**3.3 Cognitive barriers.** Comprehension, attention, memory, reading, and expectation may interact with long instructions, ambiguous terms, transient messages, or unexpected changes. The team offers instructions in clear language and checks whether the person understood them, without turning the session into a school test. Open questions help identify unfamiliar vocabulary, divergent goals, and alternative interpretations. Silence is not automatically treated as comprehension.

A language adaptation is documented together with its reason and timing. Simplifying an instruction during the session may improve participation, but it also changes the original task. The protocol records what was presented and what was adjusted, making it possible to analyze whether the episodes are comparable. Support elements, such as repetition or consultation of the instructions, are not considered errors when they are part of the intended use. The analysis seeks to identify missing or ambiguous information in the concrete context.

**3.4 Equipment barriers.** Necessary resources may be unavailable, incompatible, dependent on battery, or require installation and configuration. The assessment asks which resources the person regularly uses and whether they prefer to use them during the session. The inventory records broad categories and relevant adjustments, avoiding the collection of brand, serial number, or identifiers that are not needed. A borrowed resource may offer an alternative, but may also require familiarization; the team asks whether the person wishes to use it and distinguishes this condition from their usual environment.

Compatibility must be observed in the task, not inferred from a list of supported devices. If a device cannot be used, the reason and the point at which the activity was affected are recorded. If the person chooses not to use an offered resource, that decision is respected. The analysis distinguishes institutional unavailability, personal preference, and observed incompatibility, without blaming the participant.

**3.5 Space barriers.** Table reach, surface stability, seat position, lighting, noise, circulation, and privacy may influence the session. The space must allow choices of posture and accommodation of the devices the person uses. When this is not possible, the restriction is recorded as a characteristic of the location. The team does not treat a laboratory posture as a universal reference for comfort.

Remote and home-based tasks must also be considered. They may widen the choice of environment or reduce travel, but they depend on space and privacy that are under the participant's control. The team asks whether a more comfortable condition exists and accepts rescheduling or an alternative modality where feasible. A methodological choice that excludes people for lack of an adequate space reduces external validity and must be discussed.

**3.6 Connectivity barriers.** Network access, connection stability, data cost, and device availability may determine whether a person can take part in a remote session or access materials. Connectivity is not an individual attribute; it depends on the service, location, equipment, and socioeconomic conditions. The study offers accessible instructions in advance and states access requirements before consent. The team considers an in-person or offline modality when this is ethically and logistically possible.

A network interruption must be distinguished from an interruption of the activity for another reason. The person may prefer not to continue after a failure, without this being recorded as a personal failure. If the connection affects a usage measure, the analysis documents the episode, the decision taken, and whether the data remained usable. These decisions are defined in advance to avoid selective exclusion after the results are known.

The categories may overlap: a visually cluttered interface may increase cognitive demand; an inaccessible table may hinder the use of an assistive resource; an unstable connection may interrupt an instruction. The team records a primary category only when this helps organization, and preserves other interpretations such as relations between barriers. The framework is not meant to classify participants. It serves to organize questions, observations, and improvement proposals without inferring diagnosis or universality.

## 4. Proposed evaluation protocol

The protocol combines a digital audit with an interaction study. The audit examines the content, controls, instructions, and digital states that are part of the activity, using the published edition of WCAG declared in the report [1]. For other digital materials, the WCAG2ICT criteria may guide the selection of relevant items [7]. Before the inspection, the team defines the desired conformance level, the pages or screens evaluated, the assistive technologies considered, and the test conditions. Global conformance is not declared on the basis of a partial selection of criteria.

Each check includes the criterion, the condition in which it applies, the inspection method, the observed evidence, the status, and the justification. Statuses include conformant, non-conformant, not applicable, or not verified, always with an observation. Automated inspection may complement the review but does not alone decide whether the content is accessible. The manual evaluation verifies navigation, focus, accessible names, messages, structure, and comprehension whenever the elements are present. Changes between sessions are recorded so that an audit can be repeated.

The study with people begins only after approval by the applicable ethics committee. The proposal, recruitment materials, consent process, and the handling of recordings must be approved before inviting participants. The team explains the purpose, the estimated duration in practical terms, the activities requested, foreseeable risks, compensation where applicable, the data collected, access, retention, and a contact for questions. Consent is informed, voluntary, and presented in an accessible format. The person may ask questions, accept or refuse recording separately, and withdraw from participation without penalty.

Recruitment criteria are formulated from the research question. The team seeks diversity of relevant experiences in relation to motor, visual, cognitive, equipment, space, and connectivity barriers, without requiring a diagnosis as a standard condition. Inclusion and exclusion criteria are justified; exclusions based on language, device, transport, or ability to perform the task must be declared and examined as possible sources of bias. There is no numerical composition defined before the feasibility assessment. The team documents which recruitment networks were used and which groups may remain absent.

The interested person receives a description of the activity and may indicate preferences for communication, position, breaks, and assistive resources. This conversation does not ask for unnecessary medical details. The team confirms the adaptations before starting and asks whether they remain appropriate during the session. No more is photographed or recorded than the approved protocol requires. If visual data are needed, the framing avoids faces, personal documents, and private surroundings whenever possible; the final decision is approved in the ethics protocol.

The session offers a drawing task defined in terms of the person's goal and the study's goal. Before the task, there is time to get to know the materials, choose a position, and ask questions. The instruction is read or presented in the chosen format. During the activity, the facilitator avoids guiding each action but offers help if requested, and records when an intervention alters the task. The person may pause, change strategy, or end. The procedure does not require participants to disclose health information or to demonstrate a specific skill.

Observation records completion or interruption of the task, requested assistance, adaptation used, reported barriers, questions, comprehension errors, and spontaneous comments. Recording categories are defined before analysis and described in a guide for the team. A second researcher may review a consented sample of the records to discuss ambiguities, but this does not automatically convert qualitative interpretation into an objective measure. Disagreements are examined and the report describes how they were resolved.

After the task, the SUS may be offered to summarize perceived usability [11]. The protocol presents the items in an accessible format and without inducing a response. The NASA-TLX may characterize the perceived workload along the instrument's own dimensions [14, 15]. The order, the response mode, and any adaptation are recorded. If the participant prefers to answer orally, a researcher may transcribe without rewording. An altered version does not receive normative interpretation as if it were identical to the original instrument.

The semi-structured interview explores what helped or hindered, which signals were understood, which resources were needed, and how the person would evaluate the activity in everyday use. Open questions come before specific probes to reduce suggestion. The facilitator allows time for responses and approved alternative forms of communication. Thematic analysis describes familiarization, coding, grouping, and review of themes, as well as the researchers' position [18]. Qualitative reporting uses the transparency recommendations that are relevant, without presenting a checklist as proof of validity [19, 20].

The instruments and their limits are summarized in Table 2. No single instrument answers whether a person had equitable access to the activity. SUS and NASA-TLX provide structured subjective responses; observation contextualizes performance; the interview explains meanings and strategies; the audit identifies digital criteria. The synthesis compares the sources and preserves divergences instead of forcing agreement.

**Table 2.** Instruments for audit, usability, workload, and qualitative reporting, indicating the evidence, mode of application, and interpretive limits of each source in this protocol; author's own work.

| Instrument | Evidence produced | Application and limit |
|---|---|---|
| WCAG audit | Observable conformance of applicable digital criteria. | Manual inspection supported by tools; does not cover the whole physical activity. |
| Task observation | Actions, interruptions, requests for help, and adaptations. | Contextual record; does not alone infer the cause of a difficulty. |
| System Usability Scale | Overall perception of usability after the task. | Standardized questionnaire; accessibility of the response mode must be verified. |
| NASA Task Load Index | Multidimensional perception of workload. | Applied after a delimited task; not a diagnosis of capacity. |
| Semi-structured interview | Meanings, strategies, unanticipated barriers, and preferences. | Interpretive analysis requires reflexivity and transparency. |
| Context record | Equipment, environment, connectivity, and relevant accommodations. | Collect only necessary data; avoid identifiers and health details. |

Figure 2 places the external order of approval, participation, and collection, without representing internal steps of the system or anticipating how the activity will take place in each context.

**Figure 2.** External flow of ethics evaluation, recruitment, consent, session, and instruments, without describing the internal functioning of the system; author's own work to situate the stages of research with people.

![](figures/04-fluxo-estudo.svg)

As the composition has not yet been observed, Figure 3 leaves fields empty and serves only as a reminder to describe the sample in aggregate after recruitment.

**Figure 3.** Planned sample profile with empty fields to describe diversity and access needs after recruitment; does not represent participants or counts; author's own work as a guide for aggregate reporting.

![](figures/04-perfil-amostra.svg)

The sample profile is described in categories chosen with justification and consent. The researcher avoids tables that would allow a person to be identified through a rare combination of characteristics. If a report includes personal data, the team removes or generalizes details that are not essential, provided this preserves the meaning. The results include the conditions that make an interpretation plausible and the situations that are absent, without extending the findings to the general population.

Quantitative analyses begin with descriptive statistics compatible with the distribution and with the study design. The team reports denominators, missing data, adaptations, and uncertainty, without turning a convenience sample into a population estimate. Exploratory comparisons between profiles are made only when there is sufficient ethical and methodological basis. The qualitative analysis is conducted in parallel to contextualize differences and unexpected results. No association is interpreted as a causal effect of disability, of an assistive technology, or of an environmental condition.

The team keeps a record of methodological decisions, versions of the materials, protocol deviations, and justifications. The record does not expose personal information and does not include internal details of the system. A change of task, instruction, or instrument must be described so that the reader knows which sessions can be compared. The comparison between audit and reports is made question by question: which digital criteria failed, which barriers were observed, which were reported, and which remained unexplained.

## 5. Structure of the results

No study with participants has been completed for this article. Therefore, there is no evidence to claim conformance, ease of use, workload, an observed barrier, or the experience of any group. This section remains as a reporting structure until the protocol receives ethics approval and data collection is carried out.

| Results block | Future content |
|---|---|
| Digital audit | [PENDING-DATA] Applicable criteria, method, evidence, status, and justification. |
| Interaction | [PENDING-DATA] Tasks, interruptions, requests for help, and adaptations, with context. |
| Questionnaires | [PENDING-DATA] Responses and missing data, without population extrapolation. |
| Interviews | [PENDING-DATA] Themes, anonymized examples, and analytical procedure. |
| Profile and context | [PENDING-DATA] Aggregate characterization that does not allow participants to be identified. |

The future report should distinguish findings from the audit, observations from the session, responses to instruments, and interpretations by the team. If participants report an unanticipated barrier, it will be described as an emerging theme, with sufficient context and protection of identity. If a category does not appear, the text will state the limit of observation rather than conclude that the barrier does not exist. No cell will be filled in by theoretical expectation or by the literature cited.

Negative results, procedural failures, and inability to complete a task will also be reported when consent and data protection allow. The team will state whether adaptations were used and whether they modified the task. The analysis will associate data across instruments only when there is justification and sufficient data. Until data collection is complete, the conclusion remains restricted to the proposed protocol.

Any comparison will be accompanied by a description of the context and of the uncertainty. The results should allow readers to distinguish the absence of an observed barrier from the absence of an opportunity to observe it. The table functions as a reporting structure, not as a record of current findings.

## 6. Discussion

The protocol treats accessibility as situated evidence organized in layers. An audit may show that an applicable digital criterion failed, while participants still complete the task through prior experience or an alternative strategy. The appropriate conclusion is that the task was completed under those conditions; the normative failure still requires correction and investigation. The reverse case is also possible: an inspection finds no failure in the criteria reviewed, but participants report difficulty related to space, equipment, or the meaning of the activity. The audit does not cover these barriers on its own.

If different participants choose distinct strategies, this variation should not be treated as noise. It may indicate that the task admits multiple paths, that an accommodation was useful, or that the instruction leaves room for different interpretations. The team separates the observation from the judgment about the quality of the strategy. The literature on accessible drawing documents diverse creative practices [26–31]; this study should verify how these practices appear in its own context, without assuming that one mode of creation represents all the others.

A difference between questionnaire scores and interview content is not necessarily a contradiction. The SUS offers a global assessment; the NASA-TLX addresses perceived workload; interviews may reveal a specific aspect that does not alter an overall score [11, 14]. A favorable score does not cancel a reported barrier, just as a completed task does not prove that the effort was acceptable. The report presents each instrument with its purpose, mode of administration, and limitations. Changes in the form of response are made explicit before results are compared with earlier studies.

The categories of the matrix help plan observation, but a barrier may cut across several of them. A small screen may present a visual challenge and require a different motor strategy; unstable connectivity may make an instruction hard to resume. An analysis that forces each episode into a single category loses important relations. On the other hand, attributing causes without direct evidence is also inadequate. A careful interpretation preserves both the observed description and the explanation offered by the participant.

Inclusive recruitment and accessible consent are not administrative tasks separate from scientific quality. They influence who can take part, which data are produced, and which conclusions can be supported. If the team is only able to recruit people with a certain device or with access to a particular space, that limit affects external validity. If participants do not understand the consent information, the ethical validity of the collection is affected. Ethics approval, dialogue, and the recording of adaptations are part of the method [9, 10].

The most informative result may be identifying a barrier that was not anticipated, or showing that a technical criterion is insufficient to explain the experience. This does not mean the protocol failed. It means the initial question needs refinement and future studies may prioritize observations or participants still absent. Thematic analysis and qualitative reporting standards help make the interpretive path examinable [18–20].

A comparison between groups should only be made with justification, protection against identification, and an interpretation compatible with the sample. Differences in a small group may reflect context, experience, task, or response mode. The team should not convert a difference into a recommendation for all people with the same diagnosis. The potential contribution of the study lies in describing situated interactions and needs, not in establishing a ranking of capacity between groups.

Finally, audit results may generate a list of corrections and a new inspection. Interaction results may guide changes to instructions, materials, the environment, or the recruitment policy. Any change must be tested with the people affected and, when it involves interaction with participants, must follow the relevant ethical process. Accessibility is not confirmed by a single session; it is a continuing obligation to review criteria, listen to participants, and report limits.

## 7. Limitations and threats to validity

**Construct validity.** Accessibility, usability, workload, and participation are related but non-interchangeable concepts. WCAG assesses digital content criteria, the SUS summarizes perceived usability, and the NASA-TLX describes perceived workload. None of them alone represents the total experience. The barrier matrix is a proposed organizing structure, not a validated scale. A future interpretation should avoid treating the number of observations in each category as severity or prevalence.

**Internal validity.** Familiarity with paper, instructions, materials, or the facilitator may alter the interaction. Help offered by the team may reduce a barrier or change the task. Recording may influence behavior; for this reason, it must be consented to and limited. If the procedure changes between sessions, the comparison may be compromised. The protocol records interventions and deviations, without claiming that all confounding factors can be controlled in a single use session.

**External validity.** Participants recruited through organizations, personal networks, or accessible spaces may not reflect those who are absent from these networks. An in-person session does not represent remote use; a home environment does not represent a classroom or workplace. Available resources vary across regions and people. The study must describe the sample and context carefully, so as not to allow re-identification, and limit its conclusions to the conditions examined.

**Data and interpretation validity.** Questionnaires may be difficult to understand or to answer in a particular format. Adaptations improve access but may alter comparability. Interviews depend on the relationship with the researcher and on analytical interpretation. Transcription, anonymization, or translation may remove nuances. The protocol reports procedures, losses, and decisions. Triangulation does not automatically resolve discrepancies: it helps locate which question each source answers.

**Ethics and privacy.** Participants may reveal sensitive information when explaining a barrier or an accommodation. Collecting diagnosis, video, or environmental data increases risk without being necessary for every question. The team minimizes collection, restricts access, defines retention, and reports any authorized sharing. Consent does not eliminate the duty of protection. The possibility of withdrawal and the refusal of recording must be compatible with the study design.

**Normative scope.** The edition and level of WCAG chosen limit what the audit can claim. Non-applicable criteria, third-party materials, and physical elements are outside parts of the inspection. A partial audit does not authorize announcing full conformance. The team declares the scope and includes the limitations of the evaluation method. Normative recommendations must be updated to the declared edition, without treating informative notes as requirements.

## 8. Conclusion

This article proposes evaluating motor, visual, cognitive, equipment, space, and connectivity barriers in camera-assisted drawing activities. The framework connects each category to observable criteria and forms of investigation, and the protocol combines a digital audit, a session with participants, questionnaires, and an interview. The proposal delimits the difference between conformance, observed performance, and reported experience.

There are not yet results to support a claim about the accessibility of the system or about any group. The next step is to submit the protocol to the ethics committee, prepare accessible materials, recruit participants in a justified way, and carry out sessions with adaptations chosen through dialogue. The report should protect identity, present evidence by source, and declare who or what remained outside the study. Conclusions must remain tied to the people, tasks, and contexts actually evaluated.

Only an ethical, documented collection, interpreted with the participation of the people involved, can support concrete recommendations. The protocol offers criteria for producing that evidence without anticipating its results.

## Statements

- Use of AI: text drafted with the support of generative AI, with review and responsibility by the authors; references checked against DOI or primary page.
- Data: no participant data were collected for this proposal.
- Code: there is no analysis or collection code associated with results in this article.
- Conflict of interest: the authors must declare conflicts related to the study before submission.
- Ethics: the protocol will be submitted to the applicable research ethics committee before recruitment; accessible consent will be obtained before any session.
- Author contributions: to be defined by the authors according to their actual contributions.

## References

[1] W3C. Web Content Accessibility Guidelines (WCAG) 2.2. W3C Recommendation, 2023. https://www.w3.org/TR/2023/REC-WCAG22-20231005/
[2] W3C. Web Content Accessibility Guidelines (WCAG) 2.1. W3C Recommendation, 2018. https://www.w3.org/TR/2018/REC-WCAG21-20180605/
[3] Richards, J.; Spellman, J.; Treviranus, J. Authoring Tool Accessibility Guidelines (ATAG) 2.0. W3C Recommendation, 2015. https://www.w3.org/TR/2015/REC-ATAG20-20150924/
[4] W3C. Accessible Rich Internet Applications (WAI-ARIA) 1.2. W3C Recommendation, 2023. https://www.w3.org/TR/wai-aria-1.2/
[5] W3C ARIA Working Group. WAI-ARIA Authoring Practices 1.2. W3C Group Note, 2021. https://www.w3.org/TR/2021/NOTE-wai-aria-practices-1.2-20211129/
[6] W3C Cognitive and Learning Disabilities Accessibility Task Force. Making Content Usable for People with Cognitive and Learning Disabilities. W3C Working Group Note, 2021. https://www.w3.org/TR/2021/NOTE-coga-usable-20210429/
[7] W3C. Guidance on Applying WCAG 2 to Non-Web Information and Communications Technologies (WCAG2ICT). W3C Group Note, 2023. https://www.w3.org/WAI/standards-guidelines/wcag/non-web-ict/
[8] United Nations General Assembly. Convention on the Rights of Persons with Disabilities. Resolution 61/106, 2006. https://www.un.org/disabilities/documents/convention/convention_accessible_pdf.pdf
[9] National Commission for the Protection of Human Subjects of Biomedical and Behavioral Research. The Belmont Report: Ethical Principles and Guidelines for the Protection of Human Subjects of Research. 1979. https://www.hhs.gov/ohrp/regulations-and-policy/belmont-report/read-the-belmont-report/index.html
[10] Hodge, J.; Foley, S.; Brankaert, R.; Kenning, G.; Lazar, A.; Boger, J.; Morrissey, K. Relational, Flexible, Everyday: Learning from Ethics in Dementia Research. Proceedings of the ACM Conference on Human Factors in Computing Systems, 2020. https://doi.org/10.1145/3313831.3376627
[11] Brooke, J. SUS: A ‘Quick and Dirty’ Usability Scale. In Usability Evaluation in Industry, Taylor & Francis, 1996, pp. 189–194. https://www.taylorfrancis.com/chapters/edit/10.1201/9781498710411-35/sus-quick-dirty-usability-scale-john-brooke
[12] Bangor, A.; Kortum, P. T.; Miller, J. T. An Empirical Evaluation of the System Usability Scale. International Journal of Human–Computer Interaction, 24(6), 2008. https://doi.org/10.1080/10447310802205776
[13] Lewis, J. R. The System Usability Scale: Past, Present, and Future. International Journal of Human–Computer Interaction, 34(7), 2018. https://doi.org/10.1080/10447318.2018.1455307
[14] Hart, S. G.; Staveland, L. E. Development of NASA-TLX (Task Load Index): Results of Empirical and Theoretical Research. In Human Mental Workload, Elsevier, 1988, pp. 139–183. https://doi.org/10.1016/S0166-4115(08)62386-9
[15] Hart, S. G. NASA-Task Load Index (NASA-TLX); 20 Years Later. Proceedings of the Human Factors and Ergonomics Society Annual Meeting, 50(9), 2006. https://doi.org/10.1177/154193120605000909
[16] Rubio, S.; Díaz, E.; Martín, J.; Puente, J. M. Evaluation of Subjective Mental Workload: A Comparison of SWAT, NASA-TLX, and Workload Profile Methods. Applied Psychology, 53(1), 2004. https://doi.org/10.1111/j.1464-0597.2004.00161.x
[17] Sauro, J.; Lewis, J. R. Quantifying the User Experience: Practical Statistics for User Research. 2nd ed., Morgan Kaufmann, 2016. https://www.sciencedirect.com/book/monograph/9780128023082/quantifying-the-user-experience
[18] Braun, V.; Clarke, V. Using Thematic Analysis in Psychology. Qualitative Research in Psychology, 3(2), 2006, pp. 77–101. https://doi.org/10.1191/1478088706qp063oa
[19] Tong, A.; Sainsbury, P.; Craig, J. Consolidated Criteria for Reporting Qualitative Research (COREQ): A 32-Item Checklist for Interviews and Focus Groups. International Journal for Quality in Health Care, 19(6), 2007, pp. 349–357. https://doi.org/10.1093/intqhc/mzm042
[20] O’Brien, B. C.; Harris, I. B.; Beckman, T. J.; Reed, D. A.; Cook, D. A. Standards for Reporting Qualitative Research: A Synthesis of Recommendations. Academic Medicine, 89(9), 2014, pp. 1245–1251. https://doi.org/10.1097/ACM.0000000000000388
[21] Petrie, H.; Kheir, O. The Relationship between Accessibility and Usability of Websites. Proceedings of the ACM Conference on Human Factors in Computing Systems, 2007, pp. 397–406. https://doi.org/10.1145/1240624.1240688
[22] Wobbrock, J. O.; Kane, S. K.; Gajos, K. Z.; Harada, S.; Froehlich, J. Ability-Based Design: Concept, Principles and Examples. ACM Transactions on Accessible Computing, 3(3), 2011. https://doi.org/10.1145/1952383.1952384
[23] Mankoff, J.; Hayes, G. R.; Kasnitz, D. Disability Studies as a Source of Critical Inquiry for the Field of Assistive Technology. Proceedings of the ACM SIGACCESS Conference on Computers and Accessibility, 2010. https://doi.org/10.1145/1878803.1878807
[24] Shinohara, K.; Wobbrock, J. O. In the Shadow of Misperception: Assistive Technology Use and Social Interactions. Proceedings of the ACM Conference on Human Factors in Computing Systems, 2011, pp. 705–714. https://doi.org/10.1145/1978942.1979044
[25] Lazar, J.; Allen, A.; Kleinman, J.; Malarkey, C. What Frustrates Screen Reader Users on the Web: A Study of 100 Blind Users. International Journal of Human–Computer Interaction, 22(3), 2007, pp. 247–269. https://doi.org/10.1080/10447310709336964
[26] Kamel, H. M.; Landay, J. A. A Study of Blind Drawing Practice: Creating Graphical Information Without the Visual Channel. Proceedings of the ACM SIGACCESS Conference on Computers and Accessibility, 2000, pp. 34–41. https://doi.org/10.1145/354324.354334
[27] Kamel, H. M.; Landay, J. A. Sketching Images Eyes-Free: A Grid-Based Dynamic Drawing Tool for the Blind. Proceedings of the ACM SIGACCESS Conference on Computers and Accessibility, 2002, pp. 33–40. https://doi.org/10.1145/638249.638258
[28] Fernando, S.; Ohene-Djan, J. An Empirical Evaluation of a Graphics Creation Technique for Blind and Visually Impaired Individuals. British Journal of Visual Impairment, 39(3), 2021, pp. 191–213. https://doi.org/10.1177/0264619620911422
[29] Neate, T.; Roper, A.; Wilson, S. Painting a Picture of Accessible Digital Art. Proceedings of the ACM SIGACCESS Conference on Computers and Accessibility, 2020. https://doi.org/10.1145/3373625.3418019
[30] Zhang, Z. J.; Wobbrock, J. O. A11yBoard: Making Digital Artboards Accessible to Blind and Low-Vision Users. Proceedings of the ACM Conference on Human Factors in Computing Systems, 2023. https://doi.org/10.1145/3544548.3580655
[31] Borah, P. P.; Sorathia, K. B. Design of Naamya: Human-Centered Design of a Bend Gesture-Based Digital Drawing Tool for Individuals with Blindness or Low Vision to Draw Primitive Geometric Shapes. International Journal of Human–Computer Interaction, 41(23), 2025. https://doi.org/10.1080/10447318.2025.2491791
