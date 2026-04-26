import { Sector } from "../../db_schema";

export interface SectorNameDto {
  uuid: string;
  sector_name: string;
}

export interface SectorsNameDto {
  sectors : SectorNameDto[]
}