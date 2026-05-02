import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Country } from "../country/country";
import { RiskFreeRateCountry } from "./rfr_country";

export const attributesRfr = {
  uuid: "uuid",
  rfr_country_uuid: "rfr_country_uuid",
  rfr_date: "rfr_date",
  rfr_percent_rate: "rfr_percent_rate",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class RiskFreeRate extends Model {
  public uuid!: string;
  public rfr_country_uuid!: string;
  public rfr_date!: Date;
  public rfr_percent_rate!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RiskFreeRate.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    rfr_country_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: RiskFreeRateCountry,
        key: "uuid",
      },
    },
    rfr_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    rfr_percent_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
  }
);

RiskFreeRate.belongsTo(Country, { as: "country", foreignKey: attributesRfr.rfr_country_uuid, onDelete: "CASCADE" });
Country.hasMany(RiskFreeRate, { as: "riskFreeRate", foreignKey: attributesRfr.rfr_country_uuid });
