import { CountryNameDto } from "./country";

export interface CountryAlliasNameDto {
  uuid: string;
  country_allias_name: string;
}

export interface CountriesAlliasNameDto {
  country : CountryNameDto;
  countries_allias : CountryAlliasNameDto[];
}