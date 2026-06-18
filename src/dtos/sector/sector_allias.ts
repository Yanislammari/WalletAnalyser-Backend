import { Sector } from "../../db_schema";
import { SectorNameDto } from "./sector";

export interface SectorAlliasNameDto {
  uuid: string;
  sector_allias_name: string;
}

export interface SectorsAlliasNameDto {
  sector : SectorNameDto;
  sectors_allias : SectorAlliasNameDto[]
}