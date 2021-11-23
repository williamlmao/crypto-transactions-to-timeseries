function reset(sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  sheet.clear();
}
function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

Date.prototype.addDays = function (days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
};

function compareDatesNoHours(date1, date2) {
  let d1 = `${date1.getDate()}${date1.getMonth}${date1.getFullYear}`;
  let d2 = `${date2.getDate()}${date2.getMonth}${date2.getFullYear}`;
  console.log(d1 == d2);
  if (d1 === d2) {
    return true;
  } else {
    return false;
  }
}

function getDates(startDate, stopDate) {
  var dateArray = new Array();
  var yesterday = startDate;
  while (yesterday <= stopDate) {
    dateArray.push(new Date(yesterday));
    yesterday = yesterday.addDays(1);
  }
  return dateArray;
}

/**
 * Provided a data set and the column index of the dates, returns an array of all dates between the earliest date and yesterday. Can provide a third argument for a specific date range.
 */
function getDateRangeArrayEarliestToYesterday(data, dateColumnIndex) {
  let historyDateArray = data.map((row) => {
    // Set hours to 0 for comparison
    let d = new Date(row[dateColumnIndex]);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  historyDateArray.sort((a, b) => b - a);
  let historyStart = historyDateArray[historyDateArray.length - 1];
  // Must pull to yesterday because google finance data does not always include current day.
  let yesterday = new Date();
  yesterday = yesterday.setDate(yesterday.getDate() - 1);
  return getDates(historyStart, yesterday);
}

function zeroDateHours(date) {
  let d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isValidDate(d) {
  if (d instanceof Date && !isNaN(d)) {
    return true;
  } else {
    return false;
  }
}

function writeDataToBottomOfTab(tabName, datas) {
  var SS = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SS.setActiveSheet(SS.getSheetByName(tabName));
  var lastRow = sheet.getLastRow() + 1;
  var lastColumn = sheet.getLastColumn() + 1;
  var rows = datas.length;
  var cols = datas[0].length;
  var writeResult = sheet.getRange(lastRow, 1, rows, cols).setValues(datas);
  SpreadsheetApp.flush();
  return writeResult;
}

// Date	Owner	Transaction ID	Account ID	Mask	Name	Official Name	Account Type	Account Subtype	Currency	Amount	Value (USD)
function tableToObject(data, selectedKey, isSelectedKeyUnique) {
  const headers = data.shift();
  const selectedKeyIndex = headers.indexOf(selectedKey);
  const object = {};
  data.forEach((row) => {
    if (isSelectedKeyUnique) {
      let nestedObject = {};
      headers.forEach((header, index) => {
        nestedObject[header] = row[index];
      });
      object[row[selectedKeyIndex]] = nestedObject;
    } else {
      let nestedObject = {};
      headers.forEach((header, index) => {
        nestedObject[header] = row[index];
      });
      if (object[row[selectedKeyIndex]] === undefined) {
        object[row[selectedKeyIndex]] = [nestedObject];
      } else {
        object[row[selectedKeyIndex]].push(nestedObject);
      }
    }
  });
  return object;
}

const getCurrenciesPriceOverTime = (currencies) => {
  let result = {};
  currencies.forEach((coin) => {
    if (coin !== "USD") {
      if (getGoogleFinancePriceObj(coin) !== undefined) {
        result[coin] = getGoogleFinancePriceObj(coin);
      } else {
        result[coin] = "";
      }
    }
  });
  return result;
};

function getmmddyyFormattedDate(date) {
  data = new Date(date);
  var year = date.getFullYear();

  var month = (1 + date.getMonth()).toString();
  month = month.length > 1 ? month : "0" + month;

  var day = date.getDate().toString();
  day = day.length > 1 ? day : "0" + day;

  return month + "/" + day + "/" + year;
}

/**
 * Returns an object whose keys are date and values are closing price of a given currency
 */
function getGoogleFinancePriceObj(coin) {
  let priceSheet = ss.getSheetByName(coin);
  if (priceSheet) {
    return priceSheet
      .getDataRange()
      .getValues()
      .reduce((acc, cv) => {
        let date = new Date(cv[0]);
        date.setHours(0, 0, 0, 0);
        acc[date] = cv[1];
        return acc;
      }, {});
  }
}

function createHeaderIndexMap(headers) {
  let indexmap = {};
  headers.forEach((header, index) => {
    indexmap[header] = index;
  });
  return indexmap;
}
