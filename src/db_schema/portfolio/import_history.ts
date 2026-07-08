import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { Portfolio } from "./portfolio";

export const attributesImportHistory = {
  uuid:            "uuid",
  portfolio_uuid:  "portfolio_uuid",
  filename:        "filename",
  imported_count:  "imported_count",
  skipped_count:   "skipped_count",
  error_count:     "error_count",
  errors_json:     "errors_json",
  createdAt:       "created_at",
  updatedAt:       "updated_at",
};

export class ImportHistory extends Model {
  public uuid!:           string;
  public portfolio_uuid!: string;
  public filename!:       string | null;
  public imported_count!: number;
  public skipped_count!:  number;
  public error_count!:    number;
  public errors_json!:    string; // JSON.stringify(ImportRowError[])
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ImportHistory.init(
  {
    uuid: {
      type:         DataTypes.UUID,
      primaryKey:   true,
      defaultValue: DataTypes.UUIDV4,
    },
    portfolio_uuid: {
      type:      DataTypes.UUID,
      allowNull: false,
      references: { model: Portfolio, key: "uuid" },
      onDelete: "CASCADE",
    },
    filename: {
      type:      DataTypes.STRING,
      allowNull: true,
    },
    imported_count: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    skipped_count: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    error_count: {
      type:         DataTypes.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    },
    errors_json: {
      type:         DataTypes.TEXT,
      allowNull:    false,
      defaultValue: "[]",
    },
  },
  { sequelize }
);

ImportHistory.belongsTo(Portfolio, {
  as:          "portfolio",
  foreignKey:  attributesImportHistory.portfolio_uuid,
});
Portfolio.hasMany(ImportHistory, {
  foreignKey: "portfolio_uuid",
  onDelete:   "CASCADE",
  hooks:      true,
});
