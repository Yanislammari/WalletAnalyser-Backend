import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";

export const attributesBadge = {
  uuid: "uuid",
  badge_image_path: "badge_image_path",
  badge_title: "badge_title",
  badge_label: "badge_label",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class Badge extends Model {
  public uuid!: string;
  public badge_image_path!: string;
  public badge_title!: string;
  public badge_label!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Badge.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    badge_image_path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    badge_title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    badge_label: {
      type: DataTypes.STRING,
      allowNull: false,
    }
  },
  {
    sequelize,
  }
);