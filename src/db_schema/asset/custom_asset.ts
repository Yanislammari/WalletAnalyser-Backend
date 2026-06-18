import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Currency } from "../currencies/currency";

export const attributesCustomAsset = {
  uuid: "uuid",
  ticker_name: "ticker_name",
  official_name: "official_name",
  base_currency_uuid: "base_currency_uuid",
  asset_type: "asset_type",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class CustomAsset extends Model {
  public uuid!: string;
  public ticker_name!: string | null;
  public official_name!: string | null;
  public base_currency_uuid!: string | null;
  public asset_type!: string | null;
  // mimic Asset interface so existing code is compatible
  public sector_uuid: string | null = null;
  public country_uuid: string | null = null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustomAsset.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    ticker_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    official_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    base_currency_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: Currency,
        key: "uuid",
      },
    },
    asset_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "custom_assets",
  }
);

CustomAsset.belongsTo(Currency, { as: "base_currency", foreignKey: attributesCustomAsset.base_currency_uuid });
