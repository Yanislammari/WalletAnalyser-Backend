export default class DateService {

  constructor() {

  }

  transformExcelDateToDbDate(excelString : string) {
    const excelDate = new Date((parseInt(excelString) - 25569) * 86400 * 1000);  
    return excelDate;
  }

  isAssetPriceSameDay(todayDateMinusOneDay : Date, comparedDate : Date){
    return comparedDate.getUTCFullYear() === todayDateMinusOneDay.getUTCFullYear() &&
    comparedDate.getUTCMonth() === todayDateMinusOneDay.getUTCMonth() &&
    comparedDate.getUTCDate() === todayDateMinusOneDay.getUTCDate() - 1;
  }
}
