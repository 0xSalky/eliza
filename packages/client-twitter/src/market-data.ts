import { elizaLogger } from "@elizaos/core";
import pkg from "pg";
const { Pool } = pkg;

// Create a connection pool
const pool = new Pool({
    connectionString: "",
    ssl: false, // Disable SSL
});

export async function fetchMarketData(): Promise<any> {
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
}

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
