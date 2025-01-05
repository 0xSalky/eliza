import { elizaLogger } from "@elizaos/core";
import pkg from "pg";
const { Pool } = pkg;

// Create a connection pool
const pool = new Pool({
    connectionString: "",
    ssl: false, // Disable SSL
});

export const fetchLlmSummary = async () => {
    const client = await pool.connect();
    try {
        // Get the latest market summary
        const result = await client.query(
            "SELECT summary_data FROM market_summary_for_llm ORDER BY analysis_timestamp DESC LIMIT 1"
        );

        if (result.rows.length === 0) {
            throw new Error("No market data available");
        }

        // Return the raw summary_data object
        return result.rows[0].summary_data;
    } catch (error) {
        elizaLogger.error("Error fetching market data:", error);
        throw error;
    } finally {
        client.release();
    }
};

export const fetchLlmSummaryWithAssets = async () => {
    const client = await pool.connect();

    try {
        const llmSummary = await client.query(
            "SELECT summary_data FROM market_summary_for_llm ORDER BY analysis_timestamp DESC LIMIT 1"
        );

        const assetsSummary = await client.query(
            "SELECT summary_data FROM market_assets_summary ORDER BY analysis_timestamp DESC LIMIT 1"
        );

        if (llmSummary.rows.length === 0 || assetsSummary.rows.length === 0) {
            throw new Error("No market data available");
        }

        const result = {
            llmSummary: llmSummary.rows[0].summary_data,
            assetsSummary: assetsSummary.rows[0].summary_data,
        };

        return result;
    } catch (error) {
        elizaLogger.error("Error fetching market data:", error);
        throw error;
    } finally {
        client.release();
    }
};

export const getMarketOverallSummary = async (): Promise<string> => {
    const rawMarketData = await fetchLlmSummary();

    const marketOverallSummaryWithAssets = {
        metrics: rawMarketData.market_data.metrics,
        watchlist: rawMarketData.trading_opportunities.watchlist,
        market_signals: {
            risk_indicators:
                rawMarketData.market_signals.risk_indicators.market_state,
        },
    };
    return JSON.stringify(marketOverallSummaryWithAssets, null, 2);
};

export const getMarketOverallSummaryWithAssets = async (): Promise<string> => {
    const rawMarketData = await fetchLlmSummaryWithAssets();
    const marketOverallSummaryWithAssets = {
        metrics: rawMarketData.llmSummary.market_data.metrics,
        watchlist: rawMarketData.llmSummary.trading_opportunities.watchlist,
        market_signals: {
            risk_indicators:
                rawMarketData.llmSummary.market_signals.risk_indicators
                    .market_state,
        },
        assets_summary: rawMarketData.assetsSummary,
    };

    return JSON.stringify(marketOverallSummaryWithAssets, null, 2);
};

// Handle pool errors
pool.on("error", (err) => {
    elizaLogger.error("Unexpected error on idle database client:", err);
    process.exit(-1);
});

// Optional: Add a function to test the connection
export async function testDatabaseConnection(): Promise<boolean> {
    const client = await pool.connect();
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
