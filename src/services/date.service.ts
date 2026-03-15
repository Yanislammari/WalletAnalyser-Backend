export default class DateService {

  constructor() {

  }

  transformExcelDateToDbDate(excelString : string) {
    const excelDate = new Date((parseInt(excelString) - 25569) * 86400 * 1000);  
    return excelDate;
  }
}
