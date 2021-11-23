# crypto-transactions-to-timeseries

At the time of writing, BlockFi and Coinbase Pro (other institutions to be added!) do not chart historical portfolio value. This tool compares Google Finance price data against transaction reports and generates a time-series dataset that can be used in Data Studio or other data visualization software. Also pulls out the contribution

## Setup

1. Copy this google sheet
2. Export your transaction history from the respective account
3. Paste the transaction history into the respective 'Report' tab in the sheet
4. Click the "Fill Historical Values" button in the menu and run `Fill All`
5. Accept the permissions, you may get an unsafe warning because this isn't an approved script. Run `Fill All` again
6. Copy this data studio report
7. Connect the data source

## How it works

1. `standardizeReport` standardizes the transaction reports from the crypto institution into this format: `['Date', "Account", "Transaction Type", "Currency", "Amount"]`. This function also adds the account name and normalizes transaction types.
2. That data is then transformed into an object where the keys are the dates and the values are objects containing currency types and the net change in balance for that day. Example:

```
 '10/01/21': {
     'BlockFi': {
       'USD': 1000,
       'BTC': 0.129,
     },
     'Coinbase': {
       'SHIB': -300000,
       'ETH': 1.2
     }
  }
```

3. Using local sheets formulas `=GoogleFinance("CURRENCY:BTCUSD","close",if(min('BlockFi Report'!$D$2:$D)>DEV!B2,DEV!$B$2,min('BlockFi Report'!$D$2:$D)) , today())`, we get the historical prices from the earliest date in either transaction report.
4. A `historicalPricesObj` is generated by creating an object from the tables in the `BTC`, `ETH`, `ADA`, `XLM` tabs in the gsheet.
5. Tool iterates through the date range (earliest date to yesterday) and tracks the account balance for each currency along the way. Value is calculated by by multiplying the account balance for each currency by the "closing" price in the `historicalPricesObj`.

## Limitations

- Historical price data is currently using Google Finance formulas to pull in data. Only a small set of cryptocurrencies are supported. For unsupported currencies, the tool returns '' in the value (USD) column.

- Coinbase report dates are in ISO string format. Google Finance formula needs a date. We use another hidden tab (DEV) to do the conversion with sheets formulas.