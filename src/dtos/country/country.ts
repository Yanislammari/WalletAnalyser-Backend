export interface CountryNameDto {
  uuid: string;
  country_name: string;
}

export interface CountriesNameDto {
  countries: CountryNameDto[];
}