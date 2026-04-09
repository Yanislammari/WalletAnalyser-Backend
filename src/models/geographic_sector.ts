export class GeographicSector {
  sector_name: string;
  country_name: string;

  constructor(sector_uuid: string, country_uuid: string) {
    this.sector_name = sector_uuid;
    this.country_name = country_uuid;
  }
}
