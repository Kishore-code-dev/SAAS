import { Navigate, useParams } from 'react-router-dom'
import type { ComponentType } from 'react'
import { DEFAULT_SETTINGS_SLUG, SETTINGS_BASE, SETTINGS_NAV } from '../config/settings.nav.config'
import {
  GeneralSection,
  KycSection,
  LanguageSection,
  NotificationsSection,
  ThresholdsSection,
} from './settings/sections'
import { FinanceUpdatesSection } from './settings/FinanceUpdatesSection'
import {
  AiAdvisorSection,
  ApiKeysSection,
  AppearanceSection,
  BillingSettingsSection,
  CustomDashboardsSection,
  CustomRecordsSettingsSection,
  CustomWidgetsSection,
  ExpenseTypesSection,
  ExportDataSection,
  ExternalVehicleIdsSection,
  FleetioRuleSettingsCard,
  FleetMcpSection,
  FuelTypesSection,
  GroupsSubgroupsSection,
  IntegrationsDirSection,
  IssuePrioritiesSection,
  LabelsSection,
  LoginPasswordSection,
  ManageUsersSection,
  PartCategoriesSection,
  PartLocationsSection,
  PartsReferenceSection,
  ProfileSection,
  RecordSetsSection,
  RenewalTypesSection,
  RepairReasonCodesSection,
  RolesSection,
  SandboxesSection,
  SavedReportsSettingsSection,
  SavedViewsSection,
  SecuritySection,
  ServiceCodesSection,
  StandardRecordsSection,
  VehicleStatusesSection,
  VehicleTypesSection,
  WebhooksSection,
  WorkOrderStatusesSection,
} from './settings/fleetioSettingsSections'

const SECTIONS: Record<string, ComponentType> = {
  // Personal
  profile: ProfileSection,
  notifications: NotificationsSection,
  'custom-dashboards': CustomDashboardsSection,
  'saved-views': () => <SavedViewsSection scope="personal" />,
  'login-password': LoginPasswordSection,
  appearance: AppearanceSection,
  'api-keys': ApiKeysSection,
  // Organization
  general: GeneralSection,
  billing: BillingSettingsSection,
  'export-data': ExportDataSection,
  sandboxes: SandboxesSection,
  // User Access
  'manage-users': ManageUsersSection,
  security: SecuritySection,
  roles: RolesSection,
  'record-sets': RecordSetsSection,
  // Intelligence
  'ai-advisor': AiAdvisorSection,
  thresholds: ThresholdsSection,
  kyc: KycSection,
  // Integrations
  'integrations-directory': () => <IntegrationsDirSection mode="directory" />,
  'integration-links': () => <IntegrationsDirSection mode="links" />,
  webhooks: WebhooksSection,
  'external-connections': () => <IntegrationsDirSection mode="connections" />,
  saml: () => <IntegrationsDirSection mode="saml" />,
  // Developer
  mcp: FleetMcpSection,
  // Data Management
  'standard-records': StandardRecordsSection,
  'custom-records': CustomRecordsSettingsSection,
  groups: GroupsSubgroupsSection,
  'org-saved-views': () => <SavedViewsSection scope="org" />,
  labels: LabelsSection,
  language: LanguageSection,
  // Dashboard
  'custom-widgets': CustomWidgetsSection,
  // Vehicles
  'vehicle-statuses': VehicleStatusesSection,
  'vehicle-types': VehicleTypesSection,
  'external-vehicle-ids': ExternalVehicleIdsSection,
  'expense-types': ExpenseTypesSection,
  'expense-settings': () => <FleetioRuleSettingsCard mode="expense" />,
  // Inspections
  'inspection-settings': () => <FleetioRuleSettingsCard mode="inspection" />,
  // Issues
  'issue-priorities': IssuePrioritiesSection,
  'fault-rules': () => <FleetioRuleSettingsCard mode="faults" />,
  // Reminders
  'service-reminder-settings': () => <FleetioRuleSettingsCard mode="reminders" />,
  'vehicle-renewal-types': () => <RenewalTypesSection target="vehicle" />,
  'contact-renewal-types': () => <RenewalTypesSection target="contact" />,
  // Service
  'maintenance-settings': () => <FleetioRuleSettingsCard mode="maintenance" />,
  'work-order-statuses': WorkOrderStatusesSection,
  'repair-reason-codes': RepairReasonCodesSection,
  'repair-priority-codes': () => <ServiceCodesSection mode="priority" />,
  'vmrs-codes': () => <ServiceCodesSection mode="vmrs" />,
  // Parts & Inventory
  'part-locations': PartLocationsSection,
  'part-categories': PartCategoriesSection,
  'part-manufacturers': () => <PartsReferenceSection mode="manufacturers" />,
  'measurement-units': () => <PartsReferenceSection mode="units" />,
  // Fuel & Energy
  'fuel-energy-settings': () => <FleetioRuleSettingsCard mode="fuel" />,
  'fuel-types': FuelTypesSection,
  // Finance
  'finance-updates': FinanceUpdatesSection,
  // Reports
  'saved-reports': SavedReportsSettingsSection,
}

export default function Settings() {
  const { section } = useParams()
  const Section = section ? SECTIONS[section] : undefined
  if (!section || !Section) return <Navigate to={`${SETTINGS_BASE}/${DEFAULT_SETTINGS_SLUG}`} replace />

  const link = SETTINGS_NAV.flatMap((s) => s.links.map((l) => ({ ...l, group: s.title }))).find(
    (l) => l.slug === section,
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#958777]">
          Settings{link ? ` / ${link.group}` : ''}
        </p>
        <h1 className="dm-page-title">{link?.label ?? 'Workspace Settings'}</h1>
      </div>
      <Section />
    </div>
  )
}

