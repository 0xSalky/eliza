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
            const queries = [
                "SELECT text_summary FROM futures_summary_for_llm ORDER BY analysis_timestamp DESC LIMIT 1",
                "SELECT text_summary FROM spot_summary_for_llm ORDER BY analysis_timestamp DESC LIMIT 1",
                // "SELECT text_summary FROM scrapper_following_llm_analysis ORDER BY analysis_timestamp DESC LIMIT 1",
            ];

            // Randomly select one query
            const selectedQuery =
                queries[Math.floor(Math.random() * queries.length)];

            const result = await client.query(selectedQuery);

            if (result.rows.length === 0) {
                throw new Error("No market data available");
            }

            return result.rows[0].text_summary;
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
            // Get the latest futures summary
            const futuresLlmSummary = await client.query(
                "SELECT text_summary FROM futures_summary_for_llm"
            );

            // Get the latest futures assets analysis
            const futuresAssetsSummary = await client.query(
                "SELECT * FROM futures_assets_analysis"
            );

            // Get the latest spot summary
            const spotLlmSummary = await client.query(
                "SELECT text_summary FROM spot_summary_for_llm"
            );

            // Get the latest spot assets analysis
            const spotAssetsSummary = await client.query(
                "SELECT * FROM spot_assets_analysis"
            );

            const scrapperLlmSummary = await client.query(
                "SELECT analysis FROM scrapper_following_llm_analysis"
            );

            if (
                futuresLlmSummary.rows.length === 0 &&
                futuresAssetsSummary.rows.length === 0 &&
                spotLlmSummary.rows.length === 0 &&
                spotAssetsSummary.rows.length === 0 &&
                scrapperLlmSummary.rows.length === 0
            ) {
                throw new Error("No market summary data available");
            }

            // Transform assets data to use cleaned symbol
            const transformedFuturesAssetsSummary = futuresAssetsSummary.rows[0]
                ? {
                      ...futuresAssetsSummary.rows[0],
                      symbol: this.cleanSymbol(
                          futuresAssetsSummary.rows[0].symbol
                      ),
                  }
                : null;

            const transformedSpotAssetsSummary = spotAssetsSummary.rows[0]
                ? {
                      ...spotAssetsSummary.rows[0],
                      symbol: this.cleanSymbol(
                          spotAssetsSummary.rows[0].symbol
                      ),
                  }
                : null;

            const result = {
                futuresAnalysis: futuresLlmSummary.rows[0].text_summary,
                futuresAssetsAnalysis: transformedFuturesAssetsSummary,
                spotAnalysis: spotLlmSummary.rows[0].text_summary,
                spotAssetsAnalysis: transformedSpotAssetsSummary,
                twittersAnalysis: scrapperLlmSummary.rows[0].analysis,
            };

            const resultPrompt = `
            Futures Analysis: ${result.futuresAnalysis},
            Futures Assets Analysis: ${result.futuresAssetsAnalysis},
            Spot Analysis: ${result.spotAnalysis},
            Spot Assets Analysis: ${result.spotAssetsAnalysis},
            Twitters Analysis: ${result.twittersAnalysis}
            `;

            return resultPrompt;
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
