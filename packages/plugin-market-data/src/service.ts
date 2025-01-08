import {
    elizaLogger,
    IAgentRuntime,
    Service,
    ServiceType,
} from "@elizaos/core";
import pkg from "pg";
const { Pool } = pkg;

export interface IMarketDataService {
    fetchLlmSummary(): Promise<string>;
    fetchLlmSummaryWithAssets(): Promise<string>;
    testDatabaseConnection(): Promise<boolean>;
}

export class MarketDataService extends Service implements IMarketDataService {
    private pool: pkg.Pool;
    static override serviceType = ServiceType.MARKET_DATA;

    constructor() {
        super();
        this.pool = new Pool({
            connectionString: process.env.DATABASE_MARKET_DATA_URL,
            ssl: false, // Disable SSL
        });

        // Handle pool errors
        this.pool.on("error", (err) => {
            elizaLogger.error("Unexpected error on idle database client:", err);
            process.exit(-1);
        });
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        // Initialize service if needed
    }

    // Clean symbol by removing USDT suffix and numeric prefixes
    private cleanSymbol(symbol: string): string {
        // First remove USDT from the end
        let cleaned = symbol.replace(/USDT$/, "");

        // Remove numeric prefixes that start with 10 (like 10, 1000, 1000000)
        // But keep symbols that have numbers as part of their name (like GMT123, B10)
        cleaned = cleaned.replace(/^10+/, "");

        return cleaned;
    }

    async fetchLlmSummary(): Promise<string> {
        const client = await this.pool.connect();
        try {
            // Get the latest market summary
            const result = await client.query(
                "SELECT summary_data FROM market_summary_for_llm ORDER BY analysis_timestamp DESC LIMIT 1"
            );

            if (result.rows.length === 0) {
                throw new Error("No market data available");
            }

            // Clean up symbols in market_opportunities
            const summaryData = result.rows[0].summary_data;
            if (summaryData.actionable_insights?.market_opportunities) {
                summaryData.actionable_insights.market_opportunities =
                    summaryData.actionable_insights.market_opportunities.map(
                        (opportunity: any) => ({
                            ...opportunity,
                            asset_info: {
                                ...opportunity.asset_info,
                                symbol: this.cleanSymbol(
                                    opportunity.asset_info.symbol
                                ),
                            },
                        })
                    );
            }

            // Return the cleaned summary_data object
            return JSON.stringify(summaryData, null, 2);
        } catch (error) {
            elizaLogger.error("Error fetching market data:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    async fetchLlmSummaryWithAssets(): Promise<string> {
        const client = await this.pool.connect();

        try {
            // Get the latest market summary
            const llmSummary = await client.query(
                "SELECT summary_data FROM market_summary_for_llm ORDER BY analysis_timestamp DESC LIMIT 1"
            );

            // Get the latest assets analysis
            const assetsSummary = await client.query(
                "SELECT * FROM market_assets_analysis ORDER BY timestamp DESC LIMIT 1"
            );

            if (llmSummary.rows.length === 0) {
                throw new Error("No market summary data available");
            }

            // Transform assets data to use cleaned symbol
            const transformedAssetsSummary = assetsSummary.rows[0]
                ? {
                      ...assetsSummary.rows[0],
                      symbol: this.cleanSymbol(assetsSummary.rows[0].symbol),
                  }
                : null;

            const result = {
                llmSummary: llmSummary.rows[0].summary_data,
                assetsSummary: transformedAssetsSummary,
            };

            return JSON.stringify(result, null, 2);
        } catch (error) {
            elizaLogger.error("Error fetching market data:", error);
            throw error;
        } finally {
            client.release();
        }
    }

    async testDatabaseConnection(): Promise<boolean> {
        const client = await this.pool.connect();
        try {
            await client.query("SELECT NOW()");
            elizaLogger.log("Database connection successful");
            return true;
        } catch (error) {
            elizaLogger.error("Database connection failed:", error);
            return false;
        } finally {
            client.release();
        }
    }
}
