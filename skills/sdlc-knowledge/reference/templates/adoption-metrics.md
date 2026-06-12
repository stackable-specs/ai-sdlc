# Adoption Metrics

> Track these per delivery period (sprint / month). They prove the framework is
> working: as the context packs mature, human input and rework should fall while the
> gate pass rate rises. See `../docs/adoption-guide.md`.

| Period | Changes delivered | Avg lead time | Avg human input (words) | Gate pass rate (1st try) | Escalation rate | Rework / defect rate | Predominant autonomy level |
|--------|-------------------|---------------|-------------------------|--------------------------|-----------------|----------------------|----------------------------|
| _…_ | _…_ | _…_ | _…_ | _…_ | _…_ | _…_ | _…_ |

## Targets & direction

| Metric | Healthy direction | Watch for |
|--------|-------------------|-----------|
| Lead time per change | falling | Rising → context packs incomplete or gates miscalibrated |
| Human input size | falling | Flat → stable context not yet moved into packs |
| Gate pass rate (first try) | rising | Falling → requirements or design gates too weak |
| Escalation rate | stable, non-zero | Zero → triggers too lax; spiking → autonomy level too high |
| Rework / defect rate | falling | Rising → test or review gates not catching enough |

## Period notes
_What changed in the context packs, escalation policy, or gate profiles this period,
and why — the learning loop in action._
