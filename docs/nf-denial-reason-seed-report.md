# DenialReason seed — coverage report (2026-07-09)

Source: `docs/nf-denial-reason-distinct.csv` — 947 distinct values, 97,486 rows with a denial value.

- **Mapped:** 96,463 rows (99.0%) -> 21 canonical targets.
- **Dropped (non-denial status / junk, no canonical home):** 1,023 rows (1.0%), 36 distinct values.

## Per-target (row weight desc)

| Target | New? | Distinct variants | Rows |
|---|---|---:|---:|
| Fee Schedule |  | 345 | 37,241 |
| Medical Necessity (IME) |  | 118 | 28,073 |
| Medical Necessity (Peer Review) |  | 24 | 14,700 |
| No-Show (IME) |  | 30 | 3,133 |
| 120 Day Rule- Failure to Provide Verification (OVR) |  | 41 | 2,728 |
| No Coverage (Policy Exhausted) |  | 16 | 2,353 |
| Duplicate Billing | NEW | 82 | 1,683 |
| 45 Day Rule (Late Submission of Bill) |  | 68 | 1,287 |
| No Coverage (Other) | NEW | 20 | 1,067 |
| No-Show (EUO) |  | 52 | 938 |
| No Coverage (Workers Compensation) | NEW | 3 | 568 |
| Alleged Fraud |  | 14 | 526 |
| Verification/Investigation Pending | NEW | 21 | 498 |
| Medical Necessity (Causality) |  | 16 | 409 |
| PPO/Carrier Contract | NEW | 7 | 387 |
| No Coverage (Not Eligible IP) |  | 22 | 302 |
| 30 Day Rule (Late Notice of Claim) |  | 7 | 292 |
| No Coverage (Wrong Carrier) | rename | 6 | 96 |
| No Coverage (Policy Expired) |  | 10 | 77 |
| Deductible | NEW | 3 | 63 |
| No Coverage (Motorcycle) |  | 6 | 42 |

## Dropped values (all 36, count desc)

Payment/status notes or data-quality strings, not denial categories — left unresolved:

-  359 × Partially paid but EOR not received
-  182 × No Denial Issued
-  122 × FULLY PAID AS PER EOB
-   84 × Partially paid but EOR not received : Partially paid but EOR not received
-   39 × Denied
-   38 × Pharma Portion Denied : -
-   37 × Pharma Portion Denied : -, Agreement with carrier
-   33 × Fully paid as per EOB-Confirm with provider
-   23 × INCORRECT CLAIM NUMBER
-   16 × FULLY PAID AS PER EOB : FULLY PAID AS PER EOB
-   15 × PAYMENT PER DENIAL - CONFIRM WITH CLIENT
-   12 × Pharma Portion Denied : -, Pharma Portion Denied : -
-    9 × Partially paid as per EOB-Confirm with provider
-    7 × Partially paid but EOR not received : Partially pa
-    6 × --- Select Reason ---
-    5 × Improper licensure, Pharma Portion Denied : -
-    4 × TIMELY DENIAL
-    3 × DOA is after the DOS
-    3 × Improper licensure
-    3 × INITIAL SERVICE WERE NOT RENDERED WITHIN 14 DAY AFTER MOTOR VEHICLE ACCIDENT
-    3 × Partially paid but EOR not received : Partially paid but EOR not received, Partially paid but EOR not received
-    3 × SETTLEMENT AGREEMENT
-    2 × INVALID DENIAL
-    2 × Pharma Portion Denied : -, Improper licensure
-    2 × Transportation network vehicle
-    1 × Co-payment applied
-    1 × DEDUCTIBLE, Deductible Applied
-    1 × INCORRECT DOL
-    1 × LATE DENIAL
-    1 × PARTIAL PAY
-    1 × Partially paid but EOR not received : Partially paid but EOR not received,  Pharma Portion Denied : -, Pharma Portion Denied : -
-    1 × Partially paid but EOR not received : Partially paid but EOR not received, FULLY PAID AS PER EOB : FULLY PAID AS PER EOB
-    1 × Partially paid but EOR not received, Pharma Portion Denied : -
-    1 × Pharma Portion Denied : -, Improper licensure, Pharma Portion Denied : -
-    1 × Pharma Portion Denied : -, Pharma Portion Denied :
-    1 × Provider Incorrect
