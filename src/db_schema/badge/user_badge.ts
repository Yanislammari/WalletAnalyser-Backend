import { DataTypes, Model } from "sequelize";
import { sequelize } from "../../config";
import { User } from "../users/users";
import { Badge } from "./badge";

export enum LevelBadge {
  "Beginner" = "Beginner",
  "Intermediate" = "Intermediate",
  "Advanced" = "Advanced",
  "Expert" = "Expert",
}

export const attributesUserBadgeAllias = {
  uuid: "uuid",
  user_uuid: "user_uuid",
  badge_uuid: "badge_uuid",
  level_badge: "level_badge",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

export class UserBadge extends Model {
  public uuid!: string;
  public user_uuid!: string;
  public badge_uuid!: string;
  public level_badge!: LevelBadge;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserBadge.init(
  {
    uuid: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    badge_uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Badge,
        key: "uuid",
      },
    },
    level_badge: {
      type: DataTypes.ENUM(...Object.values(LevelBadge)),
      allowNull: false,
      defaultValue: LevelBadge.Beginner,
    },
  },
  {
    sequelize,
  }
);

UserBadge.belongsTo(User, { 
  as: "user", 
  foreignKey: attributesUserBadgeAllias.user_uuid,
  onDelete: "CASCADE"
});

UserBadge.belongsTo(Badge, { 
  as: "badge", 
  foreignKey: attributesUserBadgeAllias.badge_uuid
});

User.hasMany(UserBadge, {
  as: "userBadges",
  foreignKey: attributesUserBadgeAllias.user_uuid
})

Badge.hasMany(UserBadge, {
  as: "userBadges",
  foreignKey: attributesUserBadgeAllias.badge_uuid
});