import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { AssetType } from "../../dtos";
import { Asset } from "./asset";

export const attributesAssetCluster = {
  uuid: "uuid",
  asset_uuid: "asset_uuid",
  cluster: "cluster",
  price_to_book: "price_to_book",
  peg: "peg",
  pe: "pe",
  ebitda_margin: "ebitda_margin",
  operating_margin: "operating_margin",
  growth_level: "growth_level",
  growth_trend: "growth_trend",
  ebitda_level: "ebitda_level",
  net_debt_ebitda: "net_debt_ebitda",
  total_asset_to_revenue: "total_asset_to_revenue",
  capex_to_revenue: "capex_to_revenue",
  gross_margin: "gross_margin",
  year_pct_change: "year_pct_change",
  ebitda_trend: "ebitda_trend",
  revenue : "revenue",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class AssetCluster extends Model {
  public uuid!: string;
  public asset_uuid!: string;
  public cluster!: number;
  public price_to_book!: number;
  public peg!: number;
  public pe!: number;
  public ebitda_margin!: number;
  public operating_margin!: number;
  public growth_level!: number;
  public growth_trend!: number;
  public ebitda_level!: number;
  public net_debt_ebitda!: number;
  public total_asset_to_revenue!: number;
  public capex_to_revenue!: number;
  public gross_margin!: number;
  public year_pct_change!: number;
  public ebitda_trend!: number;
  public revenue!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AssetCluster.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    asset_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Asset,
        key: "uuid",
      },
    },
    cluster: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    price_to_book: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    peg: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    pe: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    ebitda_margin: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    operating_margin: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    growth_level: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    growth_trend: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    ebitda_level: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    net_debt_ebitda: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    total_asset_to_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    capex_to_revenue: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    gross_margin: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    year_pct_change: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    ebitda_trend: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    revenue: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    sequelize,
  }
);

AssetCluster.belongsTo(Asset, { as: "asset_cluster", foreignKey: attributesAssetCluster.asset_uuid, onDelete : "CASCADE" });
