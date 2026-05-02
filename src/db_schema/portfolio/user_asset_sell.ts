import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Portfolio } from "./portfolio";
import { AssetPrice } from "../asset/asset_price";
import { Currency } from "../currencies/currency";

export const attributesUserAssetSell = {
  uuid: "uuid",
  portfolio_uuid: "portfolio_uuid",
  asset_price_uuid: "asset_price_uuid",
  company_name: "company_name",
  sell_currency_uuid: "sell_currency_uuid",
  sell_date: "sell_date",
  asset_sell_amount: "asset_sell_amount",
  asset_sell_share: "asset_sell_share",
  average_asset_share_buy_price: "average_asset_share_buy_price",
  asset_sell_gain: "asset_sell_gain",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class UserAssetSell extends Model {
  public uuid!: string;
  public portfolio_uuid!: string;
  public asset_price_uuid!: string | null;
  public company_name!: string | null;
  public sell_currency_uuid!: string;
  public sell_date!: Date;
  public asset_sell_amount!: number | null;
  public asset_sell_share!: number | null;
  public average_asset_share_buy_price!: number | null;
  public asset_sell_gain!: number | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserAssetSell.init(
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
    sell_currency_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Currency,
        key: "uuid",
      },
    },
    sell_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    asset_sell_amount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    asset_sell_share: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    average_asset_share_buy_price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    asset_sell_gain: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
  }
);

UserAssetSell.belongsTo(Portfolio, { as: "portfolio", foreignKey: attributesUserAssetSell.portfolio_uuid });
UserAssetSell.belongsTo(AssetPrice, { as: "asset_price", foreignKey: attributesUserAssetSell.asset_price_uuid });
UserAssetSell.belongsTo(Currency, { as: "sell_currency", foreignKey: attributesUserAssetSell.sell_currency_uuid });
