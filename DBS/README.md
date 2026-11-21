# DriveMitra Database Reference Copy (`DBS/`)

- **Snapshot Timestamp**: 2026-11-20T09:45:00.679Z
- **Integrity Check**: ok
- **Total Tables**: 53
- **Total Rows**: 754

## Auto-Sync Behavior
This folder is automatically kept in sync with `.drivemitra-data/drivemitra.db` on server startup/migrations and after mutating API operations.

## Contents
- `drivemitra.db` — Self-contained SQLite binary database copy (created via `VACUUM INTO`).
- `schema.sql` — Complete `CREATE TABLE` and `CREATE INDEX` DDL statements for all tables.
- `full_data_export.json` — Full JSON export of every table and live row.
- `DriveMitra_Full_Database_Architecture.pdf` — Multi-page formatted schema, ER hierarchy, TypeScript interfaces, and API reference.

## Table Row Counts
- `auth_sessions`: 0 rows
- `document_files`: 0 rows
- `finance_alerts`: 19 rows
- `finance_documents`: 31 rows
- `finance_emi_instalments`: 264 rows
- `finance_institutions`: 9 rows
- `finance_notification_settings`: 3 rows
- `finance_payments`: 82 rows
- `finance_update_history`: 20 rows
- `fleet_alerts`: 6 rows
- `fleet_api_keys`: 3 rows
- `fleet_audit_logs`: 4 rows
- `fleet_custom_dashboards`: 6 rows
- `fleet_custom_records`: 9 rows
- `fleet_document_vault`: 4 rows
- `fleet_driver_assignments`: 7 rows
- `fleet_driver_events`: 6 rows
- `fleet_drivers`: 10 rows
- `fleet_fuel_transactions`: 8 rows
- `fleet_inspection_forms`: 9 rows
- `fleet_inspection_schedules`: 9 rows
- `fleet_inspections`: 4 rows
- `fleet_inventory_transactions`: 3 rows
- `fleet_invoices`: 4 rows
- `fleet_maintenance_records`: 4 rows
- `fleet_parts_inventory`: 5 rows
- `fleet_payments`: 3 rows
- `fleet_purchase_orders`: 2 rows
- `fleet_recalls`: 6 rows
- `fleet_reports`: 2 rows
- `fleet_service_programs`: 6 rows
- `fleet_service_schedules`: 4 rows
- `fleet_service_tasks`: 15 rows
- `fleet_small_issues`: 4 rows
- `fleet_suppliers`: 3 rows
- `fleet_tools`: 12 rows
- `fleet_trips`: 6 rows
- `fleet_tyre_positions`: 12 rows
- `fleet_vehicle_components`: 81 rows
- `fleet_vehicles`: 11 rows
- `fleet_warranties`: 8 rows
- `fleet_webhooks`: 3 rows
- `fleet_work_orders`: 3 rows
- `fleet_workshops`: 3 rows
- `fleet_workspace_settings`: 3 rows
- `org_fleet_blobs`: 3 rows
- `org_members`: 6 rows
- `organizations`: 3 rows
- `password_reset_tokens`: 0 rows
- `platform_admin_audit_logs`: 1 rows
- `saas_billing_invoices`: 5 rows
- `users`: 7 rows
- `vehicle_finance_records`: 13 rows
