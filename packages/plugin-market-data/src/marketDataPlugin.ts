import { Plugin, ServiceType } from "@elizaos/core";
import { MarketDataService } from "./service";

export const marketDataPlugin: Plugin = {
    name: "market-data",
    description: "Provides market data services for crypto trading analysis",
    services: [new MarketDataService()],
    actions: [],
    evaluators: [],
    providers: [
        {
            get: async (runtime) => {
                const marketData = runtime.services.get(
                    ServiceType.MARKET_DATA
                ) as MarketDataService;
                if (!marketData) {
                    return "Market data service not available";
                }
                try {
                    const summary = await marketData.fetchLlmSummary();

                    return "Here's the market data: " + summary;
                } catch (error) {
                    return "Unable to fetch market data";
                }
            },
        },
    ],
};
