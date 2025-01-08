# Market Data Plugin for ElizaOS

This plugin provides market data services for crypto trading analysis. It connects to a PostgreSQL database to fetch market summaries and asset analysis data.

## Features

- Fetch LLM-friendly market summaries
- Fetch market summaries with asset analysis
- Database connection testing

## Configuration

The plugin requires the following environment variable:

- `DATABASE_MARKET_DATA_URL`: PostgreSQL connection string for the market data database

## Usage

1. Add the plugin to your character configuration:

```json
{
    "plugins": ["market-data"]
}
```

2. Access market data in your character's templates:

```typescript
const marketData = runtime.getService<IMarketDataService>(
    ServiceType.MARKET_DATA
);
const summary = await marketData.fetchLlmSummary();
```

## Development

```bash
# Install dependencies
pnpm install

# Build the plugin
pnpm build

# Clean build artifacts
pnpm clean
```
