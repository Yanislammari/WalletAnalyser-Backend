import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Country } from "../country/country";
import { tr } from "zod/locales";

export const attributesRfrCountry = {
  uuid: "uuid",
  country_uuid: "country_uuid",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class RiskFreeRateCountry extends Model {
  public uuid!: string;
  public country_uuid!: string;
  public country_rfr?: Country;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RiskFreeRateCountry.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    country_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: {
        name: "unique_rfr_country_constraint",
        msg: "An rfr country already exists in the database",
      },
      references: {
        model: Country,
        key: "uuid",
      },
    },
  },
  {
    sequelize,
  }
);

RiskFreeRateCountry.belongsTo(Country, { as: "country_rfr", foreignKey: attributesRfrCountry.country_uuid, onDelete: "SET NULL" });
Country.hasMany(RiskFreeRateCountry, { as: "country_rfr", foreignKey: attributesRfrCountry.country_uuid });
