import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Currency } from "..";

export const attributesAsset = {
  uuid: "uuid",
  base_currency_uuid: "base_currency_uuid",
  asset_type: "asset_type",
  ticker_name: "ticker_name",
  official_name: "official_name",
  exchange_code: "exchange_code",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class Asset extends Model {
  public uuid!: string;
  public base_currency_uuid!: string;
  public asset_type!: string;
  public ticker_name!: string;
  public official_name!: string;
  public exchange_code!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Asset.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
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
      allowNull: false,
    },
    ticker_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    official_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    exchange_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
  }
);

Asset.belongsTo(Currency, { as: "base_currency", foreignKey: attributesAsset.base_currency_uuid });
