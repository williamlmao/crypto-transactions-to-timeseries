let ss = SpreadsheetApp.getActiveSpreadsheet()
let blockFiDateIndex = 3
let blockFiCurrencyIndex = 0
let coinbaseProDateIndex = 2
let coinbaseProCurrencyIndex = 5


function transformAll() {
  transformCoinbasePro(coinbaseProDateIndex, coinbaseProCurrencyIndex)
  transformBlockFi(blockFiDateIndex, blockFiCurrencyIndex)
}

function transformCoinbaseProOnly() {
  transformCoinbasePro(coinbaseProDateIndex, coinbaseProCurrencyIndex)
}

function transformBlockFiOnly() {
  transformBlockFi(blockFiDateIndex, blockFiCurrencyIndex)
}


function transformBlockFi(dateColumnIndex, currencyColumnIndex) {
  let blockfiHistory = ss.getSheetByName('BlockFi Report')
  let blockfiHistoryValues = blockfiHistory.getDataRange().getValues()
  let coins = blockfiHistoryValues.map((row)=>row[0]).filter(onlyUnique)
  coins.shift() // remove header
  let coinsPriceObjs = {}
  coins.forEach((coin)=>{
    if (coin !== 'USD') {
      
      coinsPriceObjs[coin] = getGoogleFinancePriceObj(coin)
    }
  })
  blockfiHistoryValues = blockfiHistoryValues.map((row, index)=>{
    if (index !== 0) {
      let d = new Date(row[3])
      d.setHours(0,0,0,0)
      row[3] = d
      return row
    }
    return row
  })
  let blockFiHistoryObj = tableToObject(blockfiHistoryValues, 'Confirmed At', false)
  blockfiHistoryValues.shift() // remove header row
  let datesBetween = getDateRangeArrayEarliestToYesterday(blockfiHistoryValues, dateColumnIndex)
  // coinBalanceTracker starts off as an empty object so we don't populate empty data for coins that have 0 balance at the beginning of the report
  let coinBalanceTracker = {}
  let balancesResult = []
  datesBetween.forEach((date)=>{
    if (blockFiHistoryObj[date]) {
      blockFiHistoryObj[date].forEach((currency)=>{
        // Track the balance of each crypto currency for each date
        if (coinBalanceTracker[currency['Cryptocurrency']]) {
          coinBalanceTracker[currency['Cryptocurrency']] = coinBalanceTracker[currency['Cryptocurrency']] + currency['Amount']
        } else {
           coinBalanceTracker[currency['Cryptocurrency']] = currency['Amount']
        }
       
      })
    }
    let coins = Object.keys(coinBalanceTracker)
    // Here is where the data is assembled. Modify headers as needed. 
    coins.forEach((coin)=>{
        let row = [
          date,
          'Will',
          '12313',
          '9995',
          '9995',
          'Blockfi BTC',
          'Blockfi BTC', 
          'Investing',
          'Crypto',
          coin,
          coinBalanceTracker[coin],
          (coin === 'GUSD') ? coinBalanceTracker[coin] : coinBalanceTracker[coin] * coinsPriceObjs[coin][date]
        ]
        balancesResult.push(row)
    })
  })
  writeDataToBottomOfTab('Account Values', balancesResult)
  // If the Transaction Type includes 'Deposit', move the data into cashflows tab. Otherwise, it's an account balance
  let cashflowstab = ss.getSheetByName('Cashflows')
  let cashflowsResult = []
  for (let date in blockFiHistoryObj) {
    blockFiHistoryObj[date].forEach((coin)=>{
      console.log(coin)
      if (coin['Transaction Type'] === 'Withdrawal' || coin['Transaction Type'].includes('Deposit')) {
        console.log(date)
        let row = [
          // Date becomes a string when using a for in loop, so we need to turn it back into a date
          new Date(date),
          'Will',
          'concatenation',
          '9995',
          '9995',
          'BlockFi',
          `BlockFi${coin['Cryptocurrency']}`,
          'Investing',
          'Crypto',
          coin['Cryptocurrency'],
          coin['Amount'],
          (coin['Cryptocurrency'] === 'GUSD') ? coin['Amount'] : coin['Amount'] * coinsPriceObjs[coin['Cryptocurrency']][date]
        ]
        cashflowsResult.push(row)
      }
    }
    )}
  console.log(cashflowsResult)
  writeDataToBottomOfTab('Cashflows', cashflowsResult)
}






function transformCoinbasePro(dateColumnIndex, currencyColumnIndex) {
  let coinbaseProHistory = ss.getSheetByName('CoinbasePro Report')
  let coinbaseProHistoryValues = coinbaseProHistory.getDataRange().getValues()
  // Get a list of all currencies contained in the history tab
  let currencies = coinbaseProHistoryValues.map((row)=>row[currencyColumnIndex]).filter(onlyUnique)
  currencies.shift() // remove header
  // Get historical prices of those currencies
  let currencyPriceMaps = getCurrenciesPriceOverTime(currencies)
  coinbaseProHistoryValues = coinbaseProHistoryValues.map((row, index)=>{
    if (index !== 0) {
      let d = new Date(row[dateColumnIndex])
      // Set hours to 0 for comparison
      d.setHours(0,0,0,0)
      row[dateColumnIndex] = d
      return row
    }
    return row
  })
  let coinbaseProHistoryObj = tableToObject(coinbaseProHistoryValues, 'time', false)
  coinbaseProHistoryValues.shift() // remove header row
  let dateRange = getDateRangeArrayEarliestToYesterday(coinbaseProHistoryValues, dateColumnIndex)
  // coinBalanceTracker starts off as an empty object so we don't populate empty data for coins that have 0 balance at the beginning of the report
  let balancesResult = []
  // Keeps track of balance over time
  let coinBalanceTracker = {}
  dateRange.forEach((date)=>{
     if (coinbaseProHistoryObj[date]) {
      coinbaseProHistoryObj[date].forEach((coin)=>{
        let coinType = coin['amount/balance unit']
        // Update balance tracker
        coinBalanceTracker[coinType] = coin['balance']
        const value = () => {
          if (currencyPriceMaps[coinType]) {
            return  coinBalanceTracker[coinType] * currencyPriceMaps[coinType][date]
          } else {
            return coinBalanceTracker[coinType]
          }
        }
        // Define schema
        let row = [
          date,
          'Will',
          '12313',
          '9991',
          '9991',
          `Coinbase`,
          `Coinbase ${coinType}`, 
          'Investing',
          'Crypto',
          coinType,
          coinBalanceTracker[coinType],
          value()
        ]
        balancesResult.push(row)
    })
    }
  })
  writeDataToBottomOfTab('Account Values', balancesResult)
  // Separate the cashflows to be aggregated into 
  let cashflowsResult = []
  for (let date in coinbaseProHistoryObj) {
    coinbaseProHistoryObj[date].forEach((transaction)=>{
      if (transaction['type'] === 'withdrawal' || transaction['type'] === 'deposit') {
        let row = [
          new Date(date),
          'Will',
          'concatenation',
          '9991',
          '9991',
          'transactionbase Pro',
          `transactionbase Pro${transaction['amount/balance unit']}`,
          'Investing',
          'Crypto',
          transaction['amount/balance unit'],
          transaction['amount'],
          (transaction['amount/balance unit'] === 'USD') ? transaction['amount'] : transaction['amount'] * currencyPriceMaps[transaction['amount/balance unit']][date]
        ]
        cashflowsResult.push(row)
      }
    }
    )}
  writeDataToBottomOfTab('Cashflows', cashflowsResult)
}







