# Admin Users Phase W5 - Classification Review Before Enforcement

Status: review report only.

No runtime enforcement is enabled.
No UI hiding is enabled.
No backend route blocking is enabled.
No database changes are made.

Classified files reviewed: 201
Potential classification issues: 36

## Issue counts

- admin_route_without_card_grant: 8
- clients_billing_admin_route_not_payment_sensitive: 4
- read_or_preview_route_marked_edit: 21
- settlement_financial_route_not_payment_sensitive: 3

## Severity counts

- high: 11
- medium: 25

## High-priority review items

- app/admin/invoices/page.tsx — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/admin/lawsuits/audit/page.tsx — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/admin/authorize/route.ts — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/admin/email-automation-status/route.ts — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/admin/invoices/route.ts — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/admin/lawsuits/audit/route.ts — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/admin/lawsuits/cleanup-confirm/route.ts — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/admin/lawsuits/cleanup-preview/route.ts — admin_route_without_card_grant: Admin-only route is not mapped to a specific Admin-card grant.
- app/api/settlements/attorney-fee-breakdown/route.ts — settlement_financial_route_not_payment_sensitive: Settlement financial route is not marked payment-sensitive.
- app/api/settlements/local-provider-fee-defaults/route.ts — settlement_financial_route_not_payment_sensitive: Settlement financial route is not marked payment-sensitive.
- app/api/settlements/provider-fee-defaults/route.ts — settlement_financial_route_not_payment_sensitive: Settlement financial route is not marked payment-sensitive.

## Next phase

Phase W6 should add explicit classification overrides for the reviewed routes before any UI hiding or backend enforcement work.
