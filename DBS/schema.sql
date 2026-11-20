-- DriveMitra Full SQLite Database Schema Reference
-- Snapshot created: 2026-11-20T12:42:00.384Z
PRAGMA foreign_keys = ON;

CREATE TABLE auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT,
      token_hash TEXT UNIQUE NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE document_files (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE finance_alerts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL,
      emi_id TEXT,
      vehicle_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      channel_summary TEXT NOT NULL,
      action_route TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

CREATE TABLE finance_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL REFERENCES vehicle_finance_records(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      parent_doc_id TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending_verification',
      verified_by TEXT,
      verified_at TEXT,
      expiry_date TEXT,
      requires_renewal INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      notes TEXT
    );

CREATE TABLE finance_emi_instalments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL REFERENCES vehicle_finance_records(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      emi_number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      opening_principal REAL NOT NULL,
      principal_component REAL NOT NULL,
      interest_component REAL NOT NULL,
      emi_amount REAL NOT NULL,
      late_fee_inr REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      remaining_amount REAL NOT NULL,
      payment_date TEXT,
      status TEXT NOT NULL,
      reconciliation_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      updated_at TEXT NOT NULL
    );

CREATE TABLE finance_institutions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      institution_type TEXT NOT NULL,
      branch TEXT NOT NULL,
      relationship_manager TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      default_payment_method TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE finance_notification_settings (
      organization_id TEXT PRIMARY KEY,
      reminder_days_json TEXT NOT NULL,
      notify_after_due_date INTEGER NOT NULL DEFAULT 1,
      overdue_escalation_days INTEGER NOT NULL DEFAULT 5,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      recipient_roles_json TEXT NOT NULL,
      recipient_emails_json TEXT NOT NULL,
      default_currency TEXT NOT NULL DEFAULT 'INR',
      default_timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      default_reporting_period TEXT NOT NULL DEFAULT 'monthly',
      partial_payment_rule TEXT NOT NULL DEFAULT 'allow_partial',
      due_soon_window_days INTEGER NOT NULL DEFAULT 7,
      allow_manual_late_fee_entry INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL
    );

CREATE TABLE finance_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT NOT NULL REFERENCES vehicle_finance_records(id) ON DELETE CASCADE,
      emi_id TEXT NOT NULL REFERENCES finance_emi_instalments(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      emi_number INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      late_fee_component_inr REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      bank_transaction_ref TEXT NOT NULL,
      bank_transaction_ref_masked TEXT NOT NULL,
      receipt_doc_id TEXT,
      receipt_file_name TEXT,
      reconciliation_status TEXT NOT NULL DEFAULT 'pending',
      reconciled_by TEXT,
      reconciled_at TEXT,
      correction_of_payment_id TEXT,
      correction_reason TEXT,
      is_corrected INTEGER NOT NULL DEFAULT 0,
      recorded_by TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

CREATE TABLE finance_update_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      finance_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      previous_value TEXT NOT NULL,
      updated_value TEXT NOT NULL,
      update_reason TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      updated_by_role TEXT NOT NULL,
      update_date TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'approved'
    );

CREATE TABLE fleet_alerts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT,
      timestamp TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      action_route TEXT NOT NULL
    );

CREATE TABLE fleet_api_keys (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      prefix TEXT NOT NULL,
      scope TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL
    );

CREATE TABLE fleet_audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL
    );

CREATE TABLE fleet_custom_dashboards (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      widgets TEXT NOT NULL,
      default_view INTEGER NOT NULL DEFAULT 0
    );

CREATE TABLE fleet_custom_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      vehicle_or_driver TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      recorded_date TEXT NOT NULL,
      amount_inr REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      notes TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE fleet_document_vault (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      document_number TEXT,
      masked_number TEXT,
      issuing_authority TEXT,
      issued_date TEXT,
      expiry_date TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      verified_by TEXT,
      verified_at TEXT,
      rejection_reason TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );

CREATE TABLE fleet_driver_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      unassigned_at TEXT,
      assigned_by TEXT NOT NULL,
      notes TEXT
    );

CREATE TABLE fleet_driver_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      trip_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      speed_kmh REAL NOT NULL,
      road_stress_context REAL NOT NULL,
      gps_accuracy_meters REAL NOT NULL,
      mount_stability_warning INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      location_label TEXT NOT NULL,
      dispute_status TEXT NOT NULL,
      dispute_reason TEXT,
      dispute_resolution_note TEXT
    );

CREATE TABLE fleet_drivers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      employee_code TEXT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      alternate_mobile TEXT,
      email TEXT NOT NULL,
      date_of_birth TEXT,
      city TEXT,
      state TEXT,
      address TEXT,
      blood_group TEXT,
      emergency_contact_name TEXT,
      emergency_contact_relation TEXT,
      emergency_contact_phone TEXT,
      license_number TEXT NOT NULL,
      license_categories_json TEXT,
      license_issuing_rto TEXT,
      license_issue_date TEXT,
      license_expiry TEXT NOT NULL,
      hazmat_endorsed INTEGER NOT NULL DEFAULT 0,
      hazmat_expiry TEXT,
      aadhaar_masked TEXT,
      pan_masked TEXT,
      medical_fitness_expiry TEXT,
      police_verification_status TEXT,
      digilocker_status TEXT,
      assigned_vehicle_id TEXT,
      operational_status TEXT NOT NULL,
      status TEXT NOT NULL,
      safety_score REAL NOT NULL,
      speeding_score REAL NOT NULL,
      braking_score REAL NOT NULL,
      acceleration_score REAL NOT NULL,
      cornering_score REAL NOT NULL,
      fatigue_compliance_score REAL NOT NULL,
      total_trips INTEGER NOT NULL DEFAULT 0,
      total_distance_km REAL NOT NULL DEFAULT 0,
      join_date TEXT NOT NULL,
      coaching_recommendations_json TEXT NOT NULL,
      data_confidence_note TEXT NOT NULL
    );

CREATE TABLE fleet_fuel_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      trip_id TEXT,
      amount_inr REAL NOT NULL,
      liters_or_kwh REAL NOT NULL,
      unit_price_inr REAL NOT NULL,
      odometer_km REAL NOT NULL,
      station TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      timestamp TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      entry_source TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      payment_state TEXT,
      anomaly_flags_json TEXT NOT NULL,
      efficiency_km_per_unit REAL,
      cost_per_km_inr REAL
    );

CREATE TABLE fleet_inspection_forms (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      items_count INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      checklist_items_json TEXT
    );

CREATE TABLE fleet_inspection_schedules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      scope TEXT NOT NULL,
      form_id TEXT,
      form_title TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

CREATE TABLE fleet_inspections (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      inspector_name TEXT,
      timestamp TEXT NOT NULL,
      tyre_condition TEXT NOT NULL,
      brake_feel TEXT NOT NULL,
      fluid_leaks_detected INTEGER NOT NULL DEFAULT 0,
      warning_lights_on INTEGER NOT NULL DEFAULT 0,
      battery_or_starting_issue INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 1,
      linked_issue_ids_json TEXT
    );

CREATE TABLE fleet_inventory_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      part_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity_delta REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

CREATE TABLE fleet_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      category TEXT NOT NULL,
      vehicle_id TEXT,
      reference_id TEXT,
      amount_inr REAL NOT NULL,
      paid_amount_inr REAL NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      notes TEXT
    );

CREATE TABLE fleet_maintenance_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      component_name TEXT NOT NULL,
      service_center TEXT NOT NULL,
      workshop_id TEXT,
      description TEXT NOT NULL,
      cost_inr REAL NOT NULL,
      payment_state TEXT,
      bill_number TEXT,
      bill_file_name TEXT,
      downtime_days REAL NOT NULL,
      parts_replaced_json TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      odometer_at_service_km REAL,
      status TEXT NOT NULL,
      linked_prediction_id TEXT,
      linked_work_order_id TEXT
    );

CREATE TABLE fleet_parts_inventory (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock_qty REAL NOT NULL,
      reorder_threshold REAL NOT NULL,
      unit_cost_inr REAL NOT NULL,
      preferred_supplier_id TEXT,
      warehouse_location TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE fleet_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      recorded_by TEXT NOT NULL
    );

CREATE TABLE fleet_purchase_orders (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      po_number TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      status TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_amount_inr REAL NOT NULL,
      payment_state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expected_at TEXT
    );

CREATE TABLE fleet_recalls (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign TEXT NOT NULL,
      oem TEXT NOT NULL,
      target_make TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      issued_date TEXT NOT NULL
    );

CREATE TABLE fleet_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      period TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      format TEXT NOT NULL,
      row_count INTEGER NOT NULL
    );

CREATE TABLE fleet_service_programs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      powertrain TEXT NOT NULL,
      cadence TEXT NOT NULL,
      interval_km REAL NOT NULL,
      interval_days INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

CREATE TABLE fleet_service_schedules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      title TEXT NOT NULL,
      health_area TEXT NOT NULL,
      interval_days INTEGER NOT NULL,
      interval_km REAL NOT NULL,
      due_date TEXT NOT NULL,
      due_odometer_km REAL NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL
    );

CREATE TABLE fleet_service_tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      health_area TEXT NOT NULL,
      avg_hours REAL NOT NULL,
      est_cost_inr REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

CREATE TABLE fleet_small_issues (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      driver_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      health_area TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      reported_at TEXT NOT NULL,
      linked_work_order_id TEXT
    );

CREATE TABLE fleet_suppliers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      gstin TEXT,
      city TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      lead_time_days INTEGER NOT NULL,
      rating REAL NOT NULL
    );

CREATE TABLE fleet_tools (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      category TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      purchase_cost_inr REAL NOT NULL DEFAULT 0,
      next_calibration_date TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE fleet_trips (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      origin_address TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      start_lat REAL NOT NULL,
      start_lng REAL NOT NULL,
      end_lat REAL,
      end_lng REAL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      distance_km REAL NOT NULL,
      planned_distance_km REAL,
      duration_minutes REAL NOT NULL,
      planned_duration_minutes REAL,
      avg_speed_kmh REAL NOT NULL,
      max_speed_kmh REAL NOT NULL,
      status TEXT NOT NULL,
      truck_routing_mode TEXT,
      route_json TEXT NOT NULL,
      speed_timeline_json TEXT NOT NULL,
      stops_json TEXT NOT NULL,
      offline_synced INTEGER NOT NULL DEFAULT 0
    );

CREATE TABLE fleet_tyre_positions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
      position TEXT NOT NULL,
      brand TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      tread_depth_mm REAL NOT NULL,
      installed_at_odometer_km REAL NOT NULL,
      expected_life_km REAL NOT NULL,
      status TEXT NOT NULL,
      last_inspected_at TEXT NOT NULL
    );

CREATE TABLE fleet_vehicle_components (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
      component_name TEXT NOT NULL,
      health_score REAL NOT NULL,
      status TEXT NOT NULL,
      wear_rate_per_1000km REAL NOT NULL,
      last_serviced_at TEXT NOT NULL,
      predicted_replacement_date TEXT NOT NULL,
      notes TEXT NOT NULL
    );

CREATE TABLE fleet_vehicles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      registration_number TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      powertrain TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      assigned_driver_id TEXT,
      odometer_km REAL NOT NULL DEFAULT 0,
      daily_avg_km REAL NOT NULL DEFAULT 0,
      health_score REAL NOT NULL DEFAULT 100,
      operation_status TEXT NOT NULL,
      fuel_or_soc_pct REAL NOT NULL DEFAULT 100,
      corridor_id TEXT NOT NULL,
      city_name TEXT NOT NULL,
      registration_expiry TEXT NOT NULL,
      insurance_expiry TEXT NOT NULL,
      insurance_provider TEXT NOT NULL,
      fitness_expiry TEXT,
      puc_expiry TEXT,
      permit_expiry TEXT,
      last_service_date TEXT NOT NULL,
      next_service_due_date TEXT NOT NULL,
      next_service_due_odometer_km REAL,
      monthly_revenue_inr REAL NOT NULL DEFAULT 0,
      specs_json TEXT,
      telemetry_json TEXT NOT NULL,
      decommissioned INTEGER NOT NULL DEFAULT 0
    );

CREATE TABLE fleet_warranties (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT,
      asset_name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      provider TEXT NOT NULL,
      coverage_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      max_odometer_km REAL NOT NULL,
      claim_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE fleet_webhooks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_delivery_status INTEGER NOT NULL DEFAULT 200
    );

CREATE TABLE fleet_work_orders (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      work_order_number TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      workshop_id TEXT,
      workshop_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      health_area TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      linked_issue_ids_json TEXT NOT NULL,
      tasks_json TEXT NOT NULL,
      parts_json TEXT NOT NULL,
      labor_cost_inr REAL NOT NULL,
      parts_cost_inr REAL NOT NULL,
      total_cost_inr REAL NOT NULL,
      payment_state TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      scheduled_for TEXT,
      completed_at TEXT
    );

CREATE TABLE fleet_workshops (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      specialties_json TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      sla_turnaround_hours REAL NOT NULL,
      avg_turnaround_hours REAL NOT NULL,
      completed_jobs_count INTEGER NOT NULL,
      total_spend_inr REAL NOT NULL,
      rating REAL NOT NULL
    );

CREATE TABLE fleet_workspace_settings (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      workspace_settings_json TEXT NOT NULL,
      fleetio_settings_json TEXT NOT NULL,
      visited_integrations INTEGER NOT NULL DEFAULT 1,
      visited_reports INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

CREATE TABLE org_fleet_blobs (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

CREATE TABLE org_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );

CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      timezone TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      vehicle_limit INTEGER NOT NULL,
      driver_limit INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      subscription_start_date TEXT NOT NULL,
      subscription_expiry_date TEXT NOT NULL,
      grace_period_until TEXT,
      suspension_reason TEXT,
      owner_name TEXT,
      owner_email TEXT,
      owner_phone TEXT,
      gstin TEXT,
      created_at TEXT NOT NULL
    );

CREATE TABLE password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE platform_admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_org_id TEXT,
      target_org_name TEXT,
      reason TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

CREATE TABLE saas_billing_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      base_amount_inr INTEGER NOT NULL,
      gst_inr INTEGER NOT NULL,
      total_inr INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      notes TEXT
    );

CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      organization_id TEXT,
      password_change_required INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

CREATE TABLE vehicle_finance_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      institution_id TEXT,
      vehicle_registration TEXT NOT NULL,
      vehicle_name TEXT NOT NULL,
      vehicle_make_model TEXT NOT NULL,
      vehicle_ownership TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      relationship_manager TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      loan_account_number TEXT NOT NULL,
      loan_account_masked TEXT NOT NULL,
      loan_reference_number TEXT NOT NULL,
      loan_type TEXT NOT NULL,
      custom_loan_type_label TEXT,
      principal_amount REAL NOT NULL,
      down_payment REAL NOT NULL,
      net_financed_amount REAL NOT NULL,
      interest_rate_annual_pct REAL NOT NULL,
      interest_type TEXT NOT NULL,
      loan_start_date TEXT NOT NULL,
      loan_tenure_months INTEGER NOT NULL,
      number_of_instalments INTEGER NOT NULL,
      emi_amount REAL NOT NULL,
      first_emi_date TEXT NOT NULL,
      final_emi_date TEXT NOT NULL,
      processing_fees REAL NOT NULL DEFAULT 0,
      other_charges REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      finance_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );

CREATE INDEX idx_fleet_alerts_org ON fleet_alerts(organization_id);

CREATE INDEX idx_fleet_api_keys_org ON fleet_api_keys(organization_id);

CREATE INDEX idx_fleet_audit_logs_org ON fleet_audit_logs(organization_id);

CREATE INDEX idx_fleet_custom_dashboards_org ON fleet_custom_dashboards(organization_id);

CREATE INDEX idx_fleet_custom_records_org ON fleet_custom_records(organization_id);

CREATE INDEX idx_fleet_document_vault_org ON fleet_document_vault(organization_id);

CREATE INDEX idx_fleet_driver_assignments_org ON fleet_driver_assignments(organization_id);

CREATE INDEX idx_fleet_driver_events_org ON fleet_driver_events(organization_id);

CREATE INDEX idx_fleet_drivers_org ON fleet_drivers(organization_id);

CREATE INDEX idx_fleet_fuel_org ON fleet_fuel_transactions(organization_id);

CREATE INDEX idx_fleet_inspection_forms_org ON fleet_inspection_forms(organization_id);

CREATE INDEX idx_fleet_inspection_schedules_org ON fleet_inspection_schedules(organization_id);

CREATE INDEX idx_fleet_inspections_org ON fleet_inspections(organization_id);

CREATE INDEX idx_fleet_inventory_tx_org ON fleet_inventory_transactions(organization_id);

CREATE INDEX idx_fleet_invoices_org ON fleet_invoices(organization_id);

CREATE INDEX idx_fleet_maintenance_org ON fleet_maintenance_records(organization_id);

CREATE INDEX idx_fleet_parts_org ON fleet_parts_inventory(organization_id);

CREATE INDEX idx_fleet_payments_org ON fleet_payments(organization_id);

CREATE INDEX idx_fleet_purchase_orders_org ON fleet_purchase_orders(organization_id);

CREATE INDEX idx_fleet_recalls_org ON fleet_recalls(organization_id);

CREATE INDEX idx_fleet_reports_org ON fleet_reports(organization_id);

CREATE INDEX idx_fleet_service_programs_org ON fleet_service_programs(organization_id);

CREATE INDEX idx_fleet_service_schedules_org ON fleet_service_schedules(organization_id);

CREATE INDEX idx_fleet_service_tasks_org ON fleet_service_tasks(organization_id);

CREATE INDEX idx_fleet_small_issues_org ON fleet_small_issues(organization_id);

CREATE INDEX idx_fleet_suppliers_org ON fleet_suppliers(organization_id);

CREATE INDEX idx_fleet_tools_org ON fleet_tools(organization_id);

CREATE INDEX idx_fleet_trips_org ON fleet_trips(organization_id);

CREATE INDEX idx_fleet_tyres_org ON fleet_tyre_positions(organization_id);

CREATE INDEX idx_fleet_tyres_veh ON fleet_tyre_positions(vehicle_id);

CREATE INDEX idx_fleet_vehicle_components_org ON fleet_vehicle_components(organization_id);

CREATE INDEX idx_fleet_vehicle_components_veh ON fleet_vehicle_components(vehicle_id);

CREATE INDEX idx_fleet_vehicles_org ON fleet_vehicles(organization_id);

CREATE INDEX idx_fleet_warranties_org ON fleet_warranties(organization_id);

CREATE INDEX idx_fleet_webhooks_org ON fleet_webhooks(organization_id);

CREATE INDEX idx_fleet_work_orders_org ON fleet_work_orders(organization_id);

CREATE INDEX idx_fleet_workshops_org ON fleet_workshops(organization_id);

CREATE INDEX idx_org_members_org ON org_members(organization_id);
