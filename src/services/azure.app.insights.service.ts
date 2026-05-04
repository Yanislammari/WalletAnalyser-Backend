import * as appInsights from "applicationinsights";
import { APPINSIGHTS_CONNECTION_STRING } from "../constants/env";

export class AzureAppInsightsService {
  private static initialized: boolean = false;

  public static init(): void {
    if (this.initialized) return;

    appInsights
      .setup(APPINSIGHTS_CONNECTION_STRING)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false)
      .start();

    this.initialized = true;
  }

  public static getClient(): appInsights.TelemetryClient | null {
    return this.initialized ? appInsights.defaultClient : null;
  }
}
