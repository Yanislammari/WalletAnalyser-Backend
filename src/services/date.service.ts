export class DateService {
  constructor() {}

  transformExcelDateToDbDate(excelString: string) {
    const excelDate = new Date((parseInt(excelString) - 25569) * 86400 * 1000);
    return excelDate;
  }

  isLatestPriceMoreRecentThanToday(todayDateMinusOneDay: Date, comparedDate: Date) {
    // if asset price date est inférieur à aujourd'hui - 1 ( en clair si on le 26 et que le prix est 24 on fetch sinon non)
    return (
      comparedDate.getUTCFullYear() >= todayDateMinusOneDay.getUTCFullYear() &&
      comparedDate.getUTCMonth() >= todayDateMinusOneDay.getUTCMonth() &&
      comparedDate.getUTCDate() >= todayDateMinusOneDay.getUTCDate() - 1
    );
  }

  getDateAtUtc0() {
    const now = new Date();
    const todayUtc0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    return todayUtc0;
  }
}
