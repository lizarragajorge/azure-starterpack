// Telemetry initialization:
// - If a connection string is present, use Azure Monitor auto-configuration (useAzureMonitor)
// - Otherwise, fall back to a local console-only tracer provider
// - Always register Azure SDK + OpenAI instrumentation
// - Expose getTracer helper
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

let initialized = false;

export function initializeTelemetry() {
	if (initialized) return;
	const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || process.env.TELEMETRY_CONNECTION_STRING;
	try {
		if (connectionString) {
			// Remote telemetry via Azure Monitor convenience API using explicit Resource
			const { useAzureMonitor } = require('@azure/monitor-opentelemetry');
			// Fallback to environment-based resource specification for compatibility
			// Set service.name and resource attributes once (avoid duplicates on hot reload)
			if (!process.env.OTEL_SERVICE_NAME) process.env.OTEL_SERVICE_NAME = 'digital-field-assistant';
			if (!process.env.OTEL_RESOURCE_ATTRIBUTES) {
				// Cross-runtime instance id: prefer provided env override, else UUID/time-based.
				const provided = process.env.SERVICE_INSTANCE_ID;
				const rand = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`);
				const isEdge = typeof (globalThis as any).EdgeRuntime !== 'undefined';
				const instanceId = provided || (isEdge ? `edge-${rand}` : `srv-${rand}`);
				process.env.OTEL_RESOURCE_ATTRIBUTES = [
					`service.version=1.0.0`,
					`deployment.environment=${process.env.NODE_ENV || 'development'}`,
					`service.instance.id=${instanceId}`,
				].join(',');
			}
			useAzureMonitor({
				azureMonitorExporterOptions: { connectionString },
				// Allow dynamic sampling override via OTEL_SAMPLING_RATIO (e.g., 0.2 for 20%)
				samplingRatio: process.env.OTEL_SAMPLING_RATIO ? Number(process.env.OTEL_SAMPLING_RATIO) : undefined,
				enableLiveMetrics: false,
			});
			console.log('[telemetry] ✓ Azure Monitor remote telemetry configured');
		} else {
			// Console-only fallback. In OTel v2 the NodeTracerProvider shape can differ; fall back to BasicTracerProvider if needed.
			let provider: any | undefined;
			let usedBasic = false;
			try {
				const mod = require('@opentelemetry/sdk-trace-node');
				if (mod?.NodeTracerProvider) {
					provider = new mod.NodeTracerProvider();
				}
			} catch {/* ignore */}
			if (!provider || typeof provider.addSpanProcessor !== 'function') {
				const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base');
				provider = new BasicTracerProvider();
				usedBasic = true;
			}
			const { SimpleSpanProcessor, ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
			provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
			provider.register();
			console.warn(`[telemetry] No connection string set - console spans only (${usedBasic ? 'basic' : 'node'} provider)`);
		}
		// Register instrumentations (Azure SDK + OpenAI)
		const { registerInstrumentations } = require('@opentelemetry/instrumentation');
		const { createAzureSdkInstrumentation } = require('@azure/opentelemetry-instrumentation-azure-sdk');
		const { OpenAIInstrumentation } = require('@opentelemetry/instrumentation-openai');
		registerInstrumentations({ instrumentations: [createAzureSdkInstrumentation(), new OpenAIInstrumentation()] });
		console.log('[telemetry] ✓ Instrumentation registered');
		initialized = true;
	} catch (e) {
		console.error('[telemetry] ✗ Telemetry initialization failed', e);
	}
}

export function getTracer(name = 'dfa', version = '1.0.0') {
	const { trace } = require('@opentelemetry/api');
	return trace.getTracer(name, version);
}
