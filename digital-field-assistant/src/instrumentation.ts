// Early process startup instrumentation for Next.js (App Router).
// Ensures telemetry is initialized before auto-instrumented spans fire.
import { initializeTelemetry } from './lib/telemetry';
initializeTelemetry();