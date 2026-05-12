import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Portfolio } from "./portfolio";
import { AssetPrice } from "../asset/asset_price";
import { Currency } from "../currencies/currency";

export const attributesUserAssetBuy = {
  uuid: "uuid",
  portfolio_uuid: "portfolio_uuid",
  asset_price_uuid: "asset_price_uuid",
  buy_currency_uuid: "buy_currency_uuid",
  buy_date: "buy_date",
  asset_buy_amount: "asset_buy_amount",
  asset_buy_share: "asset_buy_share",
  asset_buy_price_per_share: "asset_buy_price_per_share",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class UserAssetBuy extends Model {
  public uuid!: string;
  public portfolio_uuid!: string;
  public asset_price_uuid!: string | null;
  public company_name!: string | null;
  public buy_currency_uuid!: string;
  public buy_date!: Date;
  public asset_buy_amount!: number | null;
  public asset_buy_share!: number | null;
  public asset_buy_price_per_share!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserAssetBuy.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    portfolio_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Portfolio,
        key: "uuid",
      },
      onDelete: "CASCADE",
    },
    asset_price_uuid: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: AssetPrice,
        key: "uuid",
      },
    },
    company_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    buy_currency_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Currency,
        key: "uuid",
      },
    },
    buy_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    asset_buy_amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    asset_buy_share: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    asset_buy_price_per_share: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
  }
);

UserAssetBuy.belongsTo(Portfolio, { as: "portfolio", foreignKey: attributesUserAssetBuy.portfolio_uuid });
UserAssetBuy.belongsTo(AssetPrice, { as: "asset_price", foreignKey: attributesUserAssetBuy.asset_price_uuid });
UserAssetBuy.belongsTo(Currency, { as: "buy_currency", foreignKey: attributesUserAssetBuy.buy_currency_uuid });

Portfolio.hasMany(UserAssetBuy, { foreignKey: "portfolio_uuid", onDelete: "CASCADE", hooks: true });
