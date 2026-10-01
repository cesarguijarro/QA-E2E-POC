/**
 * Single place for environment-dependent values.
 * Override any of them from .env or the CI environment; the defaults are the staging hosts.
 * (Specs still contain hardcoded hosts today - migrating them to ENV is the next cleanup.)
 */
export const ENV = {
  /** Label stored with every recorded result, so history can be split by environment. */
  name: process.env.QA_ENV ?? 'staging',
  /** Admin / login host (same meaning BASE_URL already has in LoginPage). */
  adminUrl: process.env.BASE_URL ?? 'https://app.staging-admin.sightx.io',
  /** Main application (dashboard, builder, analysis). */
  dashboardUrl: process.env.DASHBOARD_URL ?? 'https://staging.sightx.io',
  /** Survey execution (respondent side). */
  surveyUrl: process.env.SURVEY_URL ?? 'https://survey.staging.sightx.io',
};
