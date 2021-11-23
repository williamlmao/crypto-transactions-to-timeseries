// Take each report and past it into ingest report to be transformed into the following standardizedTransactionSchema
// standardizedTransactionSchema for every report [Date, Account, Transaction Type, Currency, Amount]
// Take that standardizedTransactionSchema and compare each row against the historical data to fill in the gaps
// Figure out which coins are in the data set
// Grab the historical prices for those coins
// Determine the earliest date in the report
// For each date, keep a running balance for each currency
// Determine the value of each currency on each day for each account
// test

const accountValuesSheet = ss.getSheetByName("Account Values");
const cashFlowsSheet = ss.getSheetByName("Cashflows");
const valuesHeaders = ["Date", "Account", "Currency", "Amount", "Value (USD)"];
const cashFlowsHeaders = [
  "Date",
  "Account",
  "Transaction Type",
  "Currency",
  "Amount",
  "Value (USD)",
];
const usdStablecoins = ["USD", "GUSD", "USDC", "USDT"];
const availableCurrencies = ["BTC", "ETH", "ADA", "XLM"];
const standardizedTransactionSchema = [
  "Date",
  "Account",
  "Transaction Type",
  "Currency",
  "Amount",
];
const historicalPricesObj = getCurrenciesPriceOverTime(availableCurrencies);

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  // Or DocumentApp or FormApp.
  ui.createMenu("Fill Historical Values")
    .addItem("Fill Historical (All)", "fillAll")
    .addItem("Fill Historical (BlockFi)", "fillBlockFi")
    .addItem("Fill Historical (CoinbasePro)", "fillCoinbasePro")
    .addToUi();
}

function fillAll() {
  reset("Account Values");
  reset("Cashflows");
  // Apply headers
  accountValuesSheet.appendRow(valuesHeaders);
  cashFlowsSheet.appendRow(cashFlowsHeaders);
  fillCoinbasePro(true, true);
  fillBlockFi(true, true);
}

function fillBlockFi(dontClear, dontApplyHeaders) {
  const blockFiMap = {
    Date: "Confirmed At",
    "Transaction Type": "Transaction Type",
    Currency: "Cryptocurrency",
    Amount: "Amount",
  };
  if (!dontClear) {
    console.log("clearing");
    reset("Account Values");
    reset("Cashflows");
  }
  // Apply headers, unless they are being applied at fillAll()
  if (!dontApplyHeaders) {
    accountValuesSheet.appendRow(valuesHeaders);
    cashFlowsSheet.appendRow(cashFlowsHeaders);
  }
  fillData("BlockFi", blockFiMap);
}

function fillCoinbasePro(dontClear, dontApplyHeaders) {
  const coinbaseProMap = {
    Date: "time",
    "Transaction Type": "type",
    Currency: "amount/balance unit",
    Amount: "amount",
  };
  // Apply headers, unless they are being applied at fillAll()
  if (!dontClear) {
    console.log("clearing");
    reset("Account Values");
    reset("Cashflows");
  }
  if (!dontApplyHeaders) {
    console.log("adding headers");
    accountValuesSheet.appendRow(valuesHeaders);
    cashFlowsSheet.appendRow(cashFlowsHeaders);
  }
  fillData("CoinbasePro", coinbaseProMap);
}

function fillData(accountName, map) {
  // If dontClear is false, then datasets are cleared. Has to be a double negative like this so that fillAll can run fillCBP and fillBlockFi without resetting twice

  try {
    let data = standardizeReport(accountName, map);
    let accountValues = fillHistoricalValues(data, accountName);
    let cashflows = fillCashflows(data, accountName);
    // Weird error here. Cannot read length of undefined, but if I use
    writeDataToBottomOfTab("Account Values", accountValues);
    writeDataToBottomOfTab("Cashflows", cashflows);
  } catch (e) {
    console.log(
      `There was probably no report found for ${accountName}. Full error: ${JSON.stringify(
        e.stack
      )}`
    );
  }
}

// Take each report and past it into ingest report to be transformed into the following standardizedTransactionSchema

function standardizeBlockfi() {
  let blockfiHistory = ss.getSheetByName("BlockFi Report");
  let blockfiHistoryValues = blockfiHistory.getDataRange().getValues();

  let data = standardizeReport(blockfiHistoryValues, blockFiMap, "BlockFi");
  return data;
}

function standardizeCoinbasePro() {
  let coinbaseProHistory = ss.getSheetByName("CoinbasePro Report");
  let coinbaseProHistoryValues = coinbaseProHistory.getDataRange().getValues();
  let coinbaseProMap = {
    Date: "time",
    "Transaction Type": "type",
    Currency: "amount/balance unit",
    Amount: "amount",
  };
  return standardizeReport(
    coinbaseProHistoryValues,
    coinbaseProMap,
    "CoinbasePro"
  );
}

/**
 * Data is a 2D array without headers, following the standardizedTransactionSchema in standardize reports
 */
function fillHistoricalValues(data, accountName) {
  const dateIndex = standardizedTransactionSchema.indexOf("Date");
  const accountIndex = standardizedTransactionSchema.indexOf("Account");
  const amountIndex = standardizedTransactionSchema.indexOf("Amount");
  const currencyIndex = standardizedTransactionSchema.indexOf("Currency");
  // Figure out which coins are in the data set
  const currencies = data
    .map((row) => row[standardizedTransactionSchema.indexOf("Currency")])
    .filter(onlyUnique);
  // Grab the historical prices for those coins
  const currencyPrices = getCurrenciesPriceOverTime(currencies);
  /** 
     *
     * Transforms the data array into an object so that the values are easily referenced. Each data could have multiple currencies or accounts. Shows NET amount change per day. 
      // const transactionAmountsByDateObj = {
      //   '12-12-12': {
      //     'BlockFi': {
      //       'USD': 1,
      //       'BTC': 2,
      //     },
      //     'Coinbase': {
      //       'SHIB': -300,
      //       'ETH': 200
      //     }
      //   }
      // }
    */
  const transactionAmountsByDateObj = data.reduce((acc, cv) => {
    let date = zeroDateHours(cv[dateIndex]);
    if (acc[date]) {
      let updatedObj = { ...acc[date] };
      // If an amount per currency per account already exists, we want to add the amounts
      if (updatedObj[cv[accountIndex]][cv[currencyIndex]]) {
        updatedObj[cv[accountIndex]][cv[currencyIndex]] =
          updatedObj[cv[accountIndex]][cv[currencyIndex]] + cv[amountIndex];
      } else {
        updatedObj[cv[accountIndex]][cv[currencyIndex]] = cv[amountIndex];
      }
    } else {
      let currencyObj = {};
      currencyObj[cv[currencyIndex]] = cv[amountIndex];
      let accountObj = {};
      accountObj[cv[accountIndex]] = currencyObj;
      acc[date] = accountObj;
    }
    return acc;
  }, {});
  // Get a list of unique currencies in the data set so that we can generate the respective historical price objects
  const currencyList = data.map((row) => row[currencyIndex]).filter(onlyUnique);

  // // Get an array of dates from the earliest date to yesterday (Google finance tabs are configured to grab data up to yesterday)
  const dateRange = getDateRangeArrayEarliestToYesterday(data, dateIndex);
  // For each date, keep a running balance for each currency
  let balanceTracker = {};
  let result = [];
  // For each date, check the transactionAmountsByDateObj for data. If the data exists, update the balance tracker and push a row into the final standardizedTransactionSchema.
  // Balance tracker keeps a running balance for each currency in the data set so it can be easily grabbed when transforming into a 2D array
  dateRange.forEach((date) => {
    if (transactionAmountsByDateObj[date]) {
      for (let account in transactionAmountsByDateObj[date]) {
        for (let currency in transactionAmountsByDateObj[date][account]) {
          if (balanceTracker[currency]) {
            balanceTracker[currency] =
              balanceTracker[currency] +
              transactionAmountsByDateObj[date][account][currency];
          } else {
            balanceTracker[currency] =
              transactionAmountsByDateObj[date][account][currency];
          }
        }
      }
    }

    for (let currency in balanceTracker) {
      let value;

      if (historicalPricesObj[currency]) {
        value = historicalPricesObj[currency][date] * balanceTracker[currency];
      } else if (usdStablecoins.includes(currency)) {
        // Value of USD stablecoins is 1:1
        value = balanceTracker[currency];
      }
      // But leave value blank for currencies where Google finance does not have a price chart.
      result.push([
        date,
        accountName,
        currency,
        balanceTracker[currency],
        value,
      ]);
    }
  });
  fillCashflows(data, accountName, historicalPricesObj);
  return result;
  // Determine the value of each currency on each day for each account
}

/**
 * Pulls out any transactions or withdrawls and assigns a value
 */
function fillCashflows(data, accountName) {
  let cashflowsResult = [];
  data.forEach((transaction) => {
    if (
      transaction[standardizedTransactionSchema.indexOf("Transaction Type")] ===
        "Withdrawal" ||
      transaction[standardizedTransactionSchema.indexOf("Transaction Type")] ===
        "Deposit"
    ) {
      let date = transaction[standardizedTransactionSchema.indexOf("Date")];
      let transactionType =
        transaction[standardizedTransactionSchema.indexOf("Transaction Type")];
      let currency =
        transaction[standardizedTransactionSchema.indexOf("Currency")];
      let amount = transaction[standardizedTransactionSchema.indexOf("Amount")];
      let value;
      if (historicalPricesObj[currency]) {
        value = historicalPricesObj[currency][zeroDateHours(date)] * amount;
      } else if (usdStablecoins.includes(currency)) {
        value = amount;
      } else {
        value = "";
      }
      cashflowsResult.push([
        date,
        accountName,
        transactionType,
        currency,
        amount,
        value,
      ]);
    }
  });
  return cashflowsResult;
}

/**
 * data should include headers as the first row
 * returns a 2D array without headers
 */
function standardizeReport(accountName, map) {
  let report = ss.getSheetByName(`${accountName} Report`);
  let data = report.getDataRange().getValues();
  const headers = data.shift();
  const headerIndexMap = createHeaderIndexMap(headers);
  let result = [];
  data.forEach((row) => {
    let standardizedRow = [];
    standardizedTransactionSchema.forEach((field) => {
      // Standardize date formats
      if (field === "Date") {
        standardizedRow.push(new Date(row[headerIndexMap[map[field]]]));
      } else if (field === "Account") {
        standardizedRow.push(accountName);
      } else if (field === "Transaction Type") {
        // Standardize "deposit", "Deposit", "Ach Deposit"
        if (row[headerIndexMap[map[field]]].includes("ithdrawal")) {
          standardizedRow.push("Withdrawal");
        } else if (row[headerIndexMap[map[field]]].includes("eposit")) {
          standardizedRow.push("Deposit");
        } else {
          standardizedRow.push(row[headerIndexMap[map[field]]]);
        }
      } else {
        // headerIndexMap[map["Date"]] = headerIndexMap['Confirmed At'] = 3, which is the index of the date column in the blockfi report named "Confirmed At"
        standardizedRow.push(row[headerIndexMap[map[field]]]);
      }
    });
    result.push(standardizedRow);
  });
  return result;
}
