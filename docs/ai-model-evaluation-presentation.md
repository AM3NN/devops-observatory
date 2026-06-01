# AI Model Evaluation - Presentation Content

This document is a presentation-ready version of the AI model evaluation section that was previously shown inside the app.

## Slide 1 - Context and Objective

- Objective: predict incident risk early using available observability telemetry.
- Constraint: limited historical labeled incidents for supervised ML training.
- Requirement: keep predictions explainable for support and DevOps teams.
- Result: start with an interpretable scoring approach and define an ML evolution path.

## Slide 2 - Models Compared

### Heuristic Risk Scoring (selected)

- Principle: combine telemetry signals with weighted thresholds.
- Advantages: explainable, fast integration, works with limited data.
- Limits: less adaptive than trained ML, thresholds require tuning.

### Isolation Forest (candidate)

- Principle: unsupervised anomaly detection on unusual signal patterns.
- Advantages: no labels required, useful for anomaly detection.
- Limits: less transparent, can require careful false-positive tuning.

### Random Forest / XGBoost (future)

- Principle: supervised learning from historical labeled incidents.
- Advantages: strong predictive power with sufficient labeled data.
- Limits: needs enough incidents, labeling quality, and retraining workflow.

## Slide 3 - Why Heuristic Scoring Now

- No large labeled incident dataset is available yet.
- Teams need immediate operational value, not a long training cycle.
- The scoring model is human-readable and easier to trust in operations.
- Inputs already exist in the platform telemetry pipeline.

## Slide 4 - Signals Used by the Current Predictor

- Latency trend
- Error-rate trend
- SLO burn rate
- CPU and memory usage
- Recent ERROR/FATAL logs
- Service health status
- Active alerts

## Slide 5 - Output Produced by the Predictor

- Risk score from 0 to 100
- Risk level: low / medium / high
- Prediction horizon (estimated time-to-risk)
- Confidence score
- Human-readable reasons behind each prediction

## Slide 6 - KPI Tracking (Current Phase)

Already measurable:

- Prediction snapshots
- Monitored services
- Average confidence (proxy)
- High-risk prediction rate (proxy)
- Latest evaluation timestamp

Not yet measurable without labels:

- False-positive rate
- Early detection rate

## Slide 7 - Validation Plan Once Labels Exist

- Precision: confirmed incidents among high-risk predictions.
- Recall: incidents predicted before impact.
- False-positive rate: high-risk predictions without incidents.
- Lead time: time gained between prediction and incident start.

## Slide 8 - Roadmap

1. Keep heuristic scoring as the explainable baseline.
2. Add unsupervised anomaly detection (Isolation Forest).
3. Introduce supervised ML (Random Forest/XGBoost) when labels are sufficient.
4. Compare models objectively with precision, recall, false-positive rate, and lead time.

## Slide 9 - Conclusion

- The selected approach is credible for the current data maturity level.
- It delivers immediate operational value with explainability.
- The architecture keeps a clear path toward stronger ML models later.
