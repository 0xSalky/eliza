import { elizaLogger } from "@elizaos/core";
import pkg from "pg";
const { Pool } = pkg;

// Create a connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_MARKET_DATA_URL,
    ssl: false, // Disable SSL
});

// Clean symbol by removing USDT suffix and numeric prefixes
const cleanSymbol = (symbol: string): string => {
    // First remove USDT from the end
    let cleaned = symbol.replace(/USDT$/, "");

    // Remove numeric prefixes that start with 10 (like 10, 1000, 1000000)
    // But keep symbols that have numbers as part of their name (like GMT123, B10)
    cleaned = cleaned.replace(/^10+/, "");

    return cleaned;
};

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
                  symbol: cleanSymbol(assetsSummary.rows[0].symbol),
              }
            : null;

        const result = {
            llmSummary: llmSummary.rows[0].summary_data,
            assetsSummary: transformedAssetsSummary,
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
        watchlist:
            rawMarketData.trading_opportunities?.watchlist?.map((item) => ({
                ...item,
                symbol: cleanSymbol(item.symbol),
            })) || [],
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
        watchlist:
            rawMarketData.llmSummary.trading_opportunities?.watchlist?.map(
                (item) => ({
                    ...item,
                    symbol: cleanSymbol(item.symbol),
                })
            ) || [],
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

export const marketDataWithPrompts = (marketData: string): string => `
# Market Analysis Rules
1. ALWAYS use $ before crypto symbols ($BTC, $ETH, etc)
2. NEVER use emojis
3. Each crypto symbol appears ONLY ONCE
4. Keep to 1-3 sentences
5. Focus on: market structure, funding rates, liquidations, whales

# Writing Style
- Mix TA with degen slang (based, cooked, rekt, chad, cope)
- Start with market observation
- Add technical insight
- End with trading psychology note

# Current Market Data:
${marketData}
`;

export const marketActionWithPrompts = (marketData: string): string => `
# Market Context Rules
1. Compare tweet content with market data
2. Check if tweet aligns with current:
   - Market structure
   - Funding rates
   - Whale movements
   - Trading sentiment

# Action Criteria
- [LIKE]: Tweet matches current market data
- [RETWEET]: High-quality analysis matching data
- [QUOTE]: Can add value based on market data
- [REPLY]: Can contribute market insights

# Current Market Data:
${marketData}
`;

export const marketReplyWithPrompts = (marketData: string): string => `
# Response Rules
1. ALWAYS use $ before symbols
2. NO emojis
3. Each symbol ONCE
4. Keep to 1-3 sentences
5. Match reply to market context

# Style Guide
- Use degen terms (based, cooked, rekt, chad, cope)
- Stay relevant to market data
- Keep character voice consistent
- Be informative and engaging

# Market Context:
${marketData}
`;

export const marketShouldRespondPrompts = (marketData: string): string => `
# Engagement Rules
1. RESPOND if:
   - Tweet discusses current market conditions
   - Analysis aligns with market data
   - Technical discussion matches data
2. IGNORE if:
   - Market context is outdated
   - Analysis contradicts current data
   - No relation to market conditions

# Current Market Data:
${marketData}
`;
