# Dashboard KPIs and AI Model Selection

This document summarizes the operational KPIs used by DevOps Observatory and the rationale behind the current AI incident prediction approach.

For a slide-by-slide presentation version of the AI model evaluation content, see `docs/ai-model-evaluation-presentation.md`.

## Dashboard KPIs

The platform dashboards are organized around five observability axes: service health, logs, APM, SLOs, and predictive risk.

### Global Dashboard

| KPI               | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Total Services    | Number of services registered and monitored by the platform.       |
| Healthy Services  | Number of services currently operating normally.                   |
| Degraded Services | Number of services showing performance or reliability degradation. |
| Down Services     | Number of unavailable services.                                    |
| Active Alerts     | Number of currently firing alerts.                                 |
| Critical Alerts   | Number of active alerts with critical severity.                    |
| Logs / Minute     | Recent log ingestion rate.                                         |
| Average Latency   | Average response time from recent APM metrics.                     |
| Global Error Rate | Average application error rate across recent metrics.              |
| SLOs at Risk      | Number of SLOs in `at_risk` or `breached` state.                   |
| AI Risk Score     | Predicted incident risk score per service.                         |

### Logs Dashboard

| KPI              | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| Total Logs       | Global volume of collected logs.                               |
| Logs by Severity | Distribution by `DEBUG`, `INFO`, `WARN`, `ERROR`, and `FATAL`. |
| Logs by Service  | Identifies services generating the most log activity.          |
| Top Errors       | Most frequent recent error messages.                           |
| Logs / Minute    | Real-time ingestion throughput.                                |

### APM Dashboard

| KPI                     | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| Response Time / Latency | Measures application responsiveness.                |
| Throughput              | Number of requests handled over time.               |
| Error Rate              | Percentage of failed requests.                      |
| CPU Usage               | Indicates CPU saturation risk.                      |
| Memory Usage            | Indicates memory saturation risk.                   |
| Active Connections      | Current workload and connection pressure.           |
| Trace Duration          | Duration of distributed trace spans and operations. |

### SLO Dashboard

| KPI                   | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| SLO Current Value     | Current measured service level indicator.          |
| SLO Target            | Expected objective for the service.                |
| Error Budget          | Allowed margin of unreliability.                   |
| Error Budget Consumed | Percentage of the error budget already consumed.   |
| Burn Rate             | Speed at which the error budget is being consumed. |
| SLO Status            | Current state: `met`, `at_risk`, or `breached`.    |

### AI Prediction Dashboard

| KPI                | Purpose                                               |
| ------------------ | ----------------------------------------------------- |
| Risk Score         | Incident risk score from `0` to `100`.                |
| Risk Level         | Classification as `low`, `medium`, or `high`.         |
| Prediction Horizon | Estimated time window before risk becomes critical.   |
| Confidence Score   | Confidence level based on available telemetry volume. |
| Prediction Reasons | Human-readable reasons behind the prediction.         |
| Top Risky Services | Services with the highest predicted incident risk.    |

### AI Model Evaluation Dashboard

| KPI                         | Status          | Purpose                                                            |
| --------------------------- | --------------- | ------------------------------------------------------------------ |
| Prediction snapshots        | Available       | Number of stored prediction records used for trend analysis.       |
| Monitored services          | Available       | Number of services evaluated by the model.                         |
| Average confidence          | Proxy           | Confidence estimate based on the amount of recent telemetry.       |
| High-risk prediction rate   | Proxy           | Share of recent predictions classified as high risk.               |
| Latest evaluation timestamp | Available       | Last time the prediction model produced an evaluation.             |
| False-positive rate         | Requires labels | Measures high-risk predictions that did not become real incidents. |
| Early detection rate        | Requires labels | Measures incidents detected before major impact.                   |

## AI Model Comparison

The incident prediction module was evaluated against three possible approaches.

| Approach                | Principle                                                        | Advantages                                                        | Limits                                                              |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| Heuristic Risk Scoring  | Calculates a risk score from telemetry trends and thresholds.    | Simple, explainable, fast to integrate, works with limited data.  | Less adaptive than ML when large historical datasets are available. |
| Isolation Forest        | Unsupervised anomaly detection based on unusual metric behavior. | Useful without labeled incidents, suitable for anomaly detection. | Less transparent for support teams and requires tuning.             |
| Random Forest / XGBoost | Supervised model trained on historical incident labels.          | Strong predictive power when enough labeled data exists.          | Requires a large incident history and careful model training.       |

## Selected Approach

The current implementation uses **heuristic risk scoring**.

This choice is appropriate for the current project phase because the platform does not yet have enough historical, labeled incident data to train a supervised model reliably. The scoring approach uses telemetry already available in the platform:

- latency trend
- error-rate trend
- SLO burn rate
- CPU and memory usage
- recent `ERROR` and `FATAL` logs
- service health status
- active alerts

The model produces a score, a level, an estimated horizon, and explicit reasons. This makes the prediction understandable for support and DevOps teams, which is important in an observability context.

## Evolution Path

The current scoring model is designed as a first predictive layer. Once enough telemetry and incident history are collected, it can be improved by:

1. Adding Isolation Forest for unsupervised anomaly detection.
2. Training a supervised model such as XGBoost or Random Forest on labeled incidents.
3. Comparing model performance using precision, recall, false-positive rate, and early detection rate.

## Evaluation Methodology

The current phase separates **operational evaluation** from **ML evaluation**:

- operational evaluation is already available through prediction snapshots, confidence, high-risk rate, and service coverage
- ML evaluation requires labeled incidents, postmortems, or confirmed incident tickets

Once labeled incidents are available, the following metrics should be computed:

| Metric              | Definition                                         | Why it matters                                    |
| ------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Precision           | Confirmed incidents among high-risk predictions.   | Measures prediction reliability and false alarms. |
| Recall              | Real incidents predicted before they occurred.     | Measures detection coverage.                      |
| False-positive rate | High-risk predictions without confirmed incidents. | Measures alert fatigue risk.                      |
| Lead time           | Time gained between prediction and incident start. | Measures proactive value for support teams.       |

This makes the current model credible without overclaiming: it is an explainable predictive scoring model today, and it defines a clear path toward supervised ML once enough labeled data exists.
