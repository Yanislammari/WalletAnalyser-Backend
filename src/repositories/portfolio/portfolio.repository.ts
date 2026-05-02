import { Portfolio } from "../../db_schema/portfolio/portfolio";
import { BaseRepository } from "../base.repository";

export class PortfolioRepository extends BaseRepository<Portfolio> {
  constructor() {
    super(Portfolio);
  }
}
