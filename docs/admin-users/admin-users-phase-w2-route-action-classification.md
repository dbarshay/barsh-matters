# Admin Users Phase W2 - Route / Page / Action Classification

Status: classification only.

No runtime enforcement is enabled.
No UI hiding is enabled.
No backend route blocking is enabled.
No database changes are made.

Total classified files: 201

## Summary by file kind

- api_route: 167
- layout: 1
- page: 33

## Summary by area

- admin_cards: 56
- admin_screen: 6
- client_billing_payments: 7
- clio_storage_finalize: 2
- document_generation: 1
- documents: 34
- home_dashboard: 59
- individual_matters: 25
- lawsuits: 6
- maildrop_email: 1
- print_queue: 1
- settlement_payment_status: 3

## Sensitive/admin counts

- Payment-sensitive files: 23
- Admin-only files: 67
- Phase W6 overrides applied: 32

## Admin card grant keys observed

- admin.card.auditHistory
- admin.card.backupRestore
- admin.card.claimIndex
- admin.card.clientsBilling
- admin.card.documentReadiness
- admin.card.documentTemplates
- admin.card.lawsuitCleanup
- admin.card.permissionsReview
- admin.card.readinessDashboard
- admin.card.referenceData
- admin.card.ticklers
- admin.card.usersRoles

## Next phase

Phase W3 should build a dry-run simulator that evaluates this classification against users and roles without enforcing blocks.
